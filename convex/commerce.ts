import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireCustomer(ctx: any, token: string) {
  if (!token || token.length < 32) throw new ConvexError("Please sign in to continue.");
  const tokenHash = await sha256(token);
  const session = await ctx.db.query("customerSessions")
    .withIndex("by_token_hash", (q: any) => q.eq("tokenHash", tokenHash)).unique();
  if (!session || session.expiresAt <= Date.now()) throw new ConvexError("Your session expired. Sign in again.");
  const user = await ctx.db.get(session.userId);
  if (!user || !user.verified || user.blocked) throw new ConvexError("Account is not authorised.");
  return { user, session };
}

export const startBargain = mutation({
  args: { token: v.string(), items: v.array(v.object({ productId: v.number(), quantity: v.number() })) },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    if (!args.items.length || args.items.length > 30) throw new ConvexError("Your cart is empty or too large.");
    const now = Date.now();
    let originalTotal = 0;
    const prepared = [];
    for (const item of args.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new ConvexError("Invalid item quantity.");
      const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", item.productId)).unique();
      if (!product) throw new ConvexError("A product in your cart is no longer available.");
      if (typeof product.stock === "number" && product.stock < item.quantity) throw new ConvexError(`${product.name} does not have enough stock.`);
      const floor = product.minSellingPrice ?? product.price;
      if (floor <= 0 || floor > product.price) throw new ConvexError(`The minimum price for ${product.name} needs admin review.`);
      originalTotal += product.price * item.quantity;
      prepared.push({ productId: product.id, productName: product.name, quantity: item.quantity, listUnitPrice: product.price, floorUnitPrice: floor, agreedUnitPrice: product.price });
    }
    const bargainId = await ctx.db.insert("bargainSessions", { userId: user._id, status: "open", round: 0, expiresAt: now + 10 * 60 * 1000, originalTotal, currentOffer: originalTotal, createdAt: now, updatedAt: now });
    for (const item of prepared) await ctx.db.insert("bargainItems", { bargainId, ...item });
    return { bargainId, originalTotal, expiresAt: now + 10 * 60 * 1000, floorTotal: prepared.reduce((sum, i) => sum + i.floorUnitPrice * i.quantity, 0) };
  },
});

export const submitOffer = mutation({
  args: { token: v.string(), bargainId: v.id("bargainSessions"), offer: v.number() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const session = await ctx.db.get(args.bargainId);
    if (!session || session.userId !== user._id) throw new ConvexError("Bargaining session not found.");
    if (session.status !== "open" || session.expiresAt <= Date.now()) {
      if (session.status === "open") await ctx.db.patch(session._id, { status: "expired" });
      throw new ConvexError("This offer expired. Start a new bargain.");
    }
    if (session.round >= 3) throw new ConvexError("Maximum negotiation rounds reached.");
    if (!Number.isFinite(args.offer) || args.offer <= 0 || args.offer >= session.originalTotal) throw new ConvexError("Enter an offer below the cart total.");
    const lines = await ctx.db.query("bargainItems").withIndex("by_bargain", (q) => q.eq("bargainId", session._id)).collect();
    const floorTotal = lines.reduce((sum, i) => sum + i.floorUnitPrice * i.quantity, 0);
    const nextRound = session.round + 1;
    const counter = Math.max(floorTotal, Math.ceil((session.originalTotal + args.offer) / 2));
    if (args.offer >= floorTotal && (args.offer >= counter || nextRound === 3)) {
      const allocation = lines.map((line) => {
        const list = line.listUnitPrice * line.quantity;
        const floor = line.floorUnitPrice * line.quantity;
        const proportional = Math.max(floor, Math.round(args.offer * list / session.originalTotal));
        return { line, unit: Math.max(line.floorUnitPrice, Math.min(line.listUnitPrice, proportional / line.quantity)) };
      });
      let allocated = allocation.reduce((sum, x) => sum + x.unit * x.line.quantity, 0);
      if (allocated > args.offer) {
        for (const x of allocation) {
          const reduceBy = Math.min(x.unit - x.line.floorUnitPrice, (allocated - args.offer) / x.line.quantity);
          x.unit -= reduceBy; allocated -= reduceBy * x.line.quantity;
        }
      }
      for (const x of allocation) await ctx.db.patch(x.line._id, { agreedUnitPrice: Math.max(x.line.floorUnitPrice, x.unit) });
      await ctx.db.patch(session._id, { status: "accepted", round: nextRound, currentOffer: allocated, acceptedTotal: allocated, updatedAt: Date.now() });
      return { status: "accepted", round: nextRound, total: allocated, floorTotal, expiresAt: session.expiresAt };
    }
    await ctx.db.patch(session._id, { round: nextRound, currentOffer: args.offer, updatedAt: Date.now() });
    return { status: "countered", round: nextRound, counterOffer: counter, floorTotal, expiresAt: session.expiresAt };
  },
});

export const placeOrder = mutation({
  args: {
    token: v.string(), bargainId: v.id("bargainSessions"),
    address: v.string(), phone: v.string(), paymentMode: v.string(), mockUpiSuccess: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const bargain = await ctx.db.get(args.bargainId);
    if (!bargain || bargain.userId !== user._id || bargain.status !== "accepted" || !bargain.acceptedTotal || bargain.expiresAt <= Date.now()) {
      throw new ConvexError("Accept a valid cart bargain before placing the order.");
    }
    if (args.address.trim().length < 12 || !/^\+?[0-9\s-]{10,15}$/.test(args.phone.trim())) throw new ConvexError("Enter a valid delivery address and phone number.");
    if (!["mock_upi", "cod"].includes(args.paymentMode)) throw new ConvexError("Choose UPI or Cash on Delivery.");
    const items = await ctx.db.query("bargainItems").withIndex("by_bargain", (q) => q.eq("bargainId", bargain._id)).collect();
    for (const item of items) {
      const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", item.productId)).unique();
      if (!product || (typeof product.stock === "number" && product.stock < item.quantity)) throw new ConvexError(`${item.productName} is no longer available in the requested quantity.`);
    }
    const paymentStatus = args.paymentMode === "cod" ? "pending" : args.mockUpiSuccess ? "paid_test" : "failed";
    if (paymentStatus === "failed") throw new ConvexError("Mock UPI payment failed. No order was placed; retry or choose COD.");
    const now = Date.now();
    const code = "SFC-" + now.toString(36).toUpperCase();
    const orderId = await ctx.db.insert("orders", {
      orderCode: code, userId: user._id, customerName: user.name, customerEmail: user.email,
      address: args.address.trim(), phone: args.phone.trim(), subtotal: bargain.originalTotal,
      discount: bargain.originalTotal - bargain.acceptedTotal, shipping: 0, total: bargain.acceptedTotal,
      paymentMode: args.paymentMode, paymentStatus, orderStatus: "Pending", bargainId: bargain._id, createdAt: now,
    });
    for (const item of items) {
      await ctx.db.insert("orderItems", {
        orderId, productId: item.productId, productName: item.productName, image: "",
        quantity: item.quantity, unitPrice: item.agreedUnitPrice, lineTotal: item.agreedUnitPrice * item.quantity, size: "M", color: "Default",
      });
      const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", item.productId)).unique();
      if (product && typeof product.stock === "number") await ctx.db.patch(product._id, { stock: product.stock - item.quantity, updatedAt: now });
    }
    await ctx.db.patch(bargain._id, { status: "ordered", updatedAt: now });
    return { orderId, orderCode: code, total: bargain.acceptedTotal, paymentStatus, orderStatus: "Pending" };
  },
});

export const myOrders = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const orders = await ctx.db.query("orders").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").collect();
    return await Promise.all(orders.map(async (order) => ({
      ...order,
      items: await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect(),
    })));
  },
});


// ─── CUSTOMER EXTRAS: PRE-ORDERS ─────────────────────────────────────────────

const measurementValidator = v.object({
  height: v.number(),
  chest: v.number(),
  waist: v.number(),
  shoulder: v.number(),
  sleeve: v.number(),
});

export const createPreOrder = mutation({
  args: {
    token: v.string(),
    productId: v.number(),
    size: v.string(),
    customMeasurements: v.optional(measurementValidator),
    quantity: v.number(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const product = await ctx.db.query("products")
      .withIndex("by_product_id", (q) => q.eq("id", args.productId)).unique();
    if (!product) throw new ConvexError("This product is no longer available.");
    if (!Number.isInteger(args.quantity) || args.quantity < 1 || args.quantity > 10) {
      throw new ConvexError("Pre-order quantity must be between 1 and 10.");
    }
    if (args.customMeasurements) {
      const values = Object.values(args.customMeasurements);
      if (values.some((value) => !Number.isFinite(value) || value < 20 || value > 250)) {
        throw new ConvexError("Check the custom measurements. Values must be between 20 cm and 250 cm.");
      }
    } else if (product.sizes.length && !product.sizes.includes(args.size)) {
      throw new ConvexError("The selected standard size is not available for this product.");
    }
    if (args.notes.length > 500) throw new ConvexError("Keep tailoring notes under 500 characters.");
    return await ctx.db.insert("preOrders", {
      userEmail: user.email,
      productId: product.id,
      productName: product.name,
      size: args.customMeasurements ? "Custom measurements" : args.size,
      ...(args.customMeasurements ? { customMeasurements: args.customMeasurements } : {}),
      quantity: args.quantity,
      notes: args.notes.trim(),
      status: "pending-retailer-confirmation",
      createdAt: Date.now(),
    });
  },
});

export const preOrdersForUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("preOrders")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ─── CUSTOMER EXTRAS: WISHLIST INTELLIGENCE ───────────────────────────────────

export const wishlistAlertSettings = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("wishlistItems")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    return rows.map((row) => ({
      productId: row.productId,
      enabled: row.alertsEnabled !== false,
      lastKnownPrice: row.lastKnownPrice,
      lastKnownStock: row.lastKnownStock,
      lastKnownDiscount: row.lastKnownDiscount,
    }));
  },
});

export const setWishlistAlerts = mutation({
  args: { token: v.string(), productId: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("wishlistItems")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    const row = rows.find((item) => item.productId === args.productId);
    if (!row) throw new ConvexError("Save this product to your wishlist first.");
    const product = await ctx.db.query("products")
      .withIndex("by_product_id", (q) => q.eq("id", args.productId)).unique();
    await ctx.db.patch(row._id, {
      alertsEnabled: args.enabled,
      ...(product ? {
        lastKnownPrice: product.price,
        ...(product.stock === undefined ? {} : { lastKnownStock: product.stock }),
        lastKnownDiscount: product.discount,
      } : {}),
    });
    return { enabled: args.enabled };
  },
});

export const refreshWishlistAlerts = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const saved = await ctx.db.query("wishlistItems")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    const products = await ctx.db.query("products").collect();
    const now = Date.now();
    let created = 0;

    for (const item of saved) {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) continue;
      const enabled = item.alertsEnabled !== false;
      const hasBaseline = item.lastKnownPrice !== undefined ||
        item.lastKnownStock !== undefined || item.lastKnownDiscount !== undefined;

      if (enabled && hasBaseline) {
        const addNotification = async (kind: string, title: string, body: string) => {
          await ctx.db.insert("userNotifications", {
            userEmail: user.email, kind, title, body,
            productId: product.id, isRead: false, createdAt: now,
          });
          created += 1;
        };

        if (item.lastKnownPrice !== undefined && product.price < item.lastKnownPrice) {
          await addNotification("price-drop", "Wishlist price dropped",
            product.name + " is now ₹" + product.price.toLocaleString("en-IN") +
            " (previously ₹" + item.lastKnownPrice.toLocaleString("en-IN") + ").");
        }
        if (item.lastKnownStock === 0 && product.stock !== undefined && product.stock > 0) {
          await addNotification("back-in-stock", "Back in stock", product.name + " is available again.");
        }
        if (item.lastKnownStock !== undefined && product.stock !== undefined &&
          item.lastKnownStock > 2 && product.stock > 0 && product.stock <= 2) {
          await addNotification("low-stock", "Almost sold out",
            product.name + " has " + product.stock + " recorded units remaining.");
        }
        if (item.lastKnownDiscount !== undefined && product.discount > item.lastKnownDiscount) {
          await addNotification("discount", "Discount increased",
            product.name + " now shows a " + product.discount + "% discount.");
        }
      }

      await ctx.db.patch(item._id, {
        lastKnownPrice: product.price,
        lastKnownDiscount: product.discount,
        ...(product.stock === undefined ? {} : { lastKnownStock: product.stock }),
      });
    }
    return { checked: saved.length, notificationsCreated: created };
  },
});

export const notificationsForUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  },
});

export const markNotificationRead = mutation({
  args: { token: v.string(), notificationId: v.id("userNotifications") },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userEmail !== user.email) throw new ConvexError("Notification not found.");
    await ctx.db.patch(row._id, { isRead: true });
    return { ok: true };
  },
});

export const markAllNotificationsRead = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    await Promise.all(rows.filter((row) => !row.isRead).map((row) => ctx.db.patch(row._id, { isRead: true })));
    return { updated: rows.filter((row) => !row.isRead).length };
  },
});

// ─── CUSTOMER EXTRAS: COLLECTION REQUESTS AND VOTING ─────────────────────────

export const communityRequestsForUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("collectionRequests").collect();
    return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  },
});

export const createCollectionRequest = mutation({
  args: { token: v.string(), title: v.string(), category: v.string(), details: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const title = args.title.trim();
    const category = args.category.trim();
    const details = args.details.trim();
    if (title.length < 5 || title.length > 100) throw new ConvexError("Collection title must be 5–100 characters.");
    if (!category || category.length > 40) throw new ConvexError("Choose a valid category.");
    if (details.length > 500) throw new ConvexError("Keep collection details under 500 characters.");
    const rows = await ctx.db.query("collectionRequests").collect();
    const normalized = title.toLowerCase().replace(/\s+/g, " ");
    const duplicate = rows.find((row) =>
      row.category.toLowerCase() === category.toLowerCase() &&
      row.title.toLowerCase().replace(/\s+/g, " ") === normalized
    );
    if (duplicate) {
      await ctx.db.patch(duplicate._id, { interested: duplicate.interested + 1 });
      return { id: duplicate.id, merged: true };
    }
    const id = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
    await ctx.db.insert("collectionRequests", {
      id, title, category, votes: 0, interested: 1,
      status: "Requested", img: "", creator: user.name,
      userEmail: user.email, details, createdAt: Date.now(),
    });
    return { id, merged: false };
  },
});

export const toggleCommunityVote = mutation({
  args: { token: v.string(), requestId: v.number() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const requests = await ctx.db.query("collectionRequests").collect();
    const request = requests.find((row) => row.id === args.requestId);
    if (!request) throw new ConvexError("Collection request not found.");
    const votes = await ctx.db.query("requestVotes")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    const existing = votes.find((row) => row.requestId === args.requestId);
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(request._id, { votes: Math.max(0, request.votes - 1) });
      return { voted: false };
    }
    await ctx.db.insert("requestVotes", {
      userEmail: user.email, requestId: args.requestId, createdAt: Date.now(),
    });
    await ctx.db.patch(request._id, { votes: request.votes + 1 });
    return { voted: true };
  },
});

export const voteDesign = mutation({
  args: { token: v.string(), cardId: v.number() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const cards = await ctx.db.query("votingCards").collect();
    const card = cards.find((row) => row.id === args.cardId);
    if (!card) throw new ConvexError("Design not found.");
    const likes = await ctx.db.query("cardLikes")
      .withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    const existing = likes.find((row) => row.cardId === args.cardId);
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(card._id, { likes: Math.max(0, card.likes - 1) });
      return { voted: false };
    }
    await ctx.db.insert("cardLikes", {
      userEmail: user.email, cardId: args.cardId, createdAt: Date.now(),
    });
    await ctx.db.patch(card._id, { likes: card.likes + 1 });
    return { voted: true };
  },
});

// ─── CUSTOMER EXTRAS: OUTFITS AND EVENT LISTS ────────────────────────────────

export const saveOutfit = mutation({
  args: { token: v.string(), name: v.string(), productIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const name = args.name.trim();
    const ids = [...new Set(args.productIds)];
    if (name.length < 2 || name.length > 60) throw new ConvexError("Outfit name must be 2–60 characters.");
    if (!ids.length || ids.length > 12) throw new ConvexError("Choose 1–12 products for an outfit.");
    const products = await ctx.db.query("products").collect();
    if (ids.some((id) => !products.some((product) => product.id === id))) throw new ConvexError("One or more products are no longer available.");
    return await ctx.db.insert("savedOutfits", { userEmail: user.email, name, productIds: ids, createdAt: Date.now() });
  },
});

export const savedOutfitsForUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("savedOutfits").withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    const products = await ctx.db.query("products").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map((row) => ({
      ...row, products: row.productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean),
    }));
  },
});

export const saveEventShoppingList = mutation({
  args: { token: v.string(), event: v.string(), budget: v.number(), productIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const event = args.event.trim();
    const ids = [...new Set(args.productIds)];
    if (!event || event.length > 50) throw new ConvexError("Choose a valid occasion.");
    if (!Number.isFinite(args.budget) || args.budget < 1 || args.budget > 1000000) throw new ConvexError("Enter a valid budget.");
    if (!ids.length || ids.length > 20) throw new ConvexError("Choose 1–20 products.");
    const products = await ctx.db.query("products").collect();
    const selected = ids.map((id) => products.find((product) => product.id === id));
    if (selected.some((product) => !product)) throw new ConvexError("One or more selected products are no longer available.");
    const total = selected.reduce((sum, product) => sum + (product?.price ?? 0), 0);
    if (total > args.budget) throw new ConvexError("Selected products exceed the budget.");
    return await ctx.db.insert("eventShoppingLists", {
      userEmail: user.email, event, budget: args.budget, productIds: ids, createdAt: Date.now(),
    });
  },
});

export const eventListsForUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("eventShoppingLists").withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    const products = await ctx.db.query("products").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map((row) => ({
      ...row, products: row.productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean),
    }));
  },
});

// ─── CUSTOMER EXTRAS: RULE-BASED SHOPPING ASSISTANT ──────────────────────────

export const chatHistory = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    return await ctx.db.query("shoppingChats").withIndex("by_user", (q) => q.eq("userEmail", user.email)).unique();
  },
});

export const appendChatMessage = mutation({
  args: { token: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const text = args.text.trim();
    if (text.length < 2 || text.length > 500) throw new ConvexError("Message must be 2–500 characters.");
    const lower = text.toLowerCase();
    const budgetMatch = lower.match(/(?:under|below|within|budget(?:\s+of)?)\s*₹?\s*([\d,]+)/);
    const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : undefined;
    const allProducts = await ctx.db.query("products").collect();
    const categoryTerms: [string, string[]][] = [
      ["Outerwear", ["jacket", "coat", "outerwear", "bomber"]],
      ["Hoodies", ["hoodie", "sweatshirt"]],
      ["Dresses", ["dress", "gown"]],
      ["Footwear", ["shoe", "sneaker", "footwear"]],
      ["T-Shirts", ["tee", "t-shirt", "tshirt"]],
      ["Formal", ["formal", "blazer", "office"]],
    ];
    const category = categoryTerms.find(([, terms]) => terms.some((term) => lower.includes(term)))?.[0];
    let matches = allProducts.filter((product) => (!category || product.category === category) &&
      (budget === undefined || product.price <= budget));
    matches.sort((a, b) => a.price - b.price);
    const recommendations = matches.slice(0, 5);
    const productIds = recommendations.map((product) => product.id);
    const response = recommendations.length
      ? "I matched " + recommendations.length + " catalog item(s)" +
        (category ? " in " + category : "") +
        (budget === undefined ? "" : " within ₹" + budget.toLocaleString("en-IN")) +
        ". These are rule-based catalog matches, not an AI-generated style assessment."
      : "I could not find a matching catalog item for those filters. Try another category or a higher budget.";
    const now = Date.now();
    const row = await ctx.db.query("shoppingChats").withIndex("by_user", (q) => q.eq("userEmail", user.email)).unique();
    const messages = [
      ...(row?.messages ?? []),
      { role: "user" as const, text, createdAt: now },
      { role: "assistant" as const, text: response, productIds, createdAt: now + 1 },
    ].slice(-80);
    if (row) await ctx.db.patch(row._id, { messages, updatedAt: now });
    else await ctx.db.insert("shoppingChats", { userEmail: user.email, messages, updatedAt: now });
    return { messages, productIds, response };
  },
});

// ─── CUSTOMER EXTRAS: VIRTUAL WARDROBE STORAGE ───────────────────────────────

export const generateWardrobeUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireCustomer(ctx, args.token);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveWardrobeItem = mutation({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    category: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const category = args.category.trim();
    const label = args.label.trim();
    if (!["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "Dresses"].includes(category)) {
      throw new ConvexError("Choose a valid wardrobe category.");
    }
    if (label.length > 80) throw new ConvexError("Item name must be under 80 characters.");
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) throw new ConvexError("Uploaded image not found.");
    if (metadata.size > 5 * 1024 * 1024) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError("Wardrobe images must be 5 MB or smaller.");
    }
    return await ctx.db.insert("wardrobeItems", {
      userEmail: user.email, storageId: args.storageId, category,
      label: label || category + " item", createdAt: Date.now(),
    });
  },
});

export const wardrobeForUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const rows = await ctx.db.query("wardrobeItems").withIndex("by_user", (q) => q.eq("userEmail", user.email)).collect();
    return await Promise.all(rows.map(async (row) => ({
      ...row, imageUrl: await ctx.storage.getUrl(row.storageId),
    })));
  },
});

export const deleteWardrobeItem = mutation({
  args: { token: v.string(), itemId: v.id("wardrobeItems") },
  handler: async (ctx, args) => {
    const { user } = await requireCustomer(ctx, args.token);
    const row = await ctx.db.get(args.itemId);
    if (!row || row.userEmail !== user.email) throw new ConvexError("Wardrobe item not found.");
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
    return { ok: true };
  },
});
