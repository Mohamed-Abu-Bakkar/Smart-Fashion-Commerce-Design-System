import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const tokenArg = v.string();

async function requireCustomer(ctx: any, token: string) {
  if (!token || token.length < 32) throw new Error("Sign in to continue.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const session = await ctx.db.query("customerSessions")
    .withIndex("by_token", (q: any) => q.eq("tokenHash", tokenHash)).unique();
  if (!session || session.expiresAt <= Date.now()) throw new Error("Your session expired. Please sign in again.");
  const user = await ctx.db.query("users").withIndex("by_email", (q: any) => q.eq("email", session.userEmail)).unique();
  if (!user || !user.verified || user.blocked === true) throw new Error("Your account is unavailable.");
  return user.email as string;
}

async function notify(ctx: any, email: string, kind: string, title: string, body: string, productId?: number) {
  await ctx.db.insert("userNotifications", {
    userEmail: email, kind, title, body,
    ...(productId === undefined ? {} : { productId }),
    isRead: false, createdAt: Date.now(),
  });
}

const addressValidator = v.object({
  name: v.string(), phone: v.string(), line1: v.string(),
  city: v.string(), state: v.string(), postalCode: v.string(),
});
const measurementsValidator = v.object({
  height: v.number(), chest: v.number(), waist: v.number(), shoulder: v.number(), sleeve: v.number(),
});

// ─── CART, GUEST MERGE AND ORDERS ─────────────────────────────────────────────

export const cartForUser = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("cartItems").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    const products = await ctx.db.query("products").collect();
    return rows.map((row) => ({ ...row, product: products.find((p) => p.id === row.productId) ?? null }))
      .filter((row) => row.product !== null);
  },
});

export const addCartItem = mutation({
  args: {
    sessionToken: tokenArg, productId: v.number(), quantity: v.number(),
    size: v.string(), color: v.string(), negotiatedPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    if (!Number.isInteger(args.quantity) || args.quantity < 1 || args.quantity > 20) throw new Error("Quantity must be 1–20.");
    const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", args.productId)).unique();
    if (!product) throw new Error("Product unavailable.");
    if (product.stock !== undefined && product.stock < args.quantity) throw new Error("Not enough stock.");
    if (product.sizes.length && !product.sizes.includes(args.size)) throw new Error("Selected size unavailable.");
    const rows = await ctx.db.query("cartItems").withIndex("by_user_product", (q) => q.eq("userEmail", email).eq("productId", args.productId)).collect();
    const match = rows.find((row) => row.size === args.size && row.color === args.color);
    const quantity = (match?.quantity ?? 0) + args.quantity;
    const totalForProduct = rows.reduce((sum, row) => sum + row.quantity, 0) + args.quantity;
    if (product.stock !== undefined && totalForProduct > product.stock) throw new Error("Not enough remaining stock.");
    const now = Date.now();
    if (match) await ctx.db.patch(match._id, {
      quantity: Math.min(20, quantity), updatedAt: now,
      ...(args.negotiatedPrice === undefined ? {} : { negotiatedPrice: args.negotiatedPrice }),
    });
    else await ctx.db.insert("cartItems", {
      userEmail: email, productId: args.productId, quantity: args.quantity, size: args.size, color: args.color,
      ...(args.negotiatedPrice === undefined ? {} : { negotiatedPrice: args.negotiatedPrice }),
      addedAt: now, updatedAt: now,
    });
    return { ok: true };
  },
});

export const updateCartQuantity = mutation({
  args: { sessionToken: tokenArg, cartItemId: v.id("cartItems"), quantity: v.number() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const row = await ctx.db.get(args.cartItemId);
    if (!row || row.userEmail !== email) throw new Error("Cart item not found.");
    if (!Number.isInteger(args.quantity) || args.quantity < 0 || args.quantity > 20) throw new Error("Quantity must be 0–20.");
    if (args.quantity === 0) await ctx.db.delete(row._id);
    else {
      const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", row.productId)).unique();
      if (!product) throw new Error("Product unavailable.");
      if (product.stock !== undefined) {
        const others = await ctx.db.query("cartItems").withIndex("by_user_product", (q) => q.eq("userEmail", email).eq("productId", row.productId)).collect();
        const reservedElsewhere = others.filter((item) => item._id !== row._id).reduce((sum, item) => sum + item.quantity, 0);
        if (reservedElsewhere + args.quantity > product.stock) throw new Error("Not enough remaining stock.");
      }
      await ctx.db.patch(row._id, { quantity: args.quantity, updatedAt: Date.now() });
    }
    return { ok: true };
  },
});

export const removeCartItem = mutation({
  args: { sessionToken: tokenArg, cartItemId: v.id("cartItems") },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const row = await ctx.db.get(args.cartItemId);
    if (row && row.userEmail === email) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

export const mergeGuestCart = mutation({
  args: {
    sessionToken: tokenArg, migrationId: v.string(),
    lines: v.array(v.object({ productId: v.number(), quantity: v.number(), size: v.string(), color: v.string() })),
  },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const migrationId = args.migrationId.trim().slice(0, 100);
    if (!migrationId) throw new Error("Invalid cart migration.");
    const prior = await ctx.db.query("cartMigrations")
      .withIndex("by_user_migration", (q) => q.eq("userEmail", email).eq("migrationId", migrationId)).unique();
    if (prior) return { alreadyMerged: true };
    const products = await ctx.db.query("products").collect();
    const existing = await ctx.db.query("cartItems").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    const additions = new Map<string, { productId: number; quantity: number; size: string; color: string }>();
    for (const line of args.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) throw new Error("Invalid guest quantity.");
      const product = products.find((p) => p.id === line.productId);
      if (!product) throw new Error("A guest cart product is unavailable.");
      if (product.sizes.length && !product.sizes.includes(line.size)) throw new Error("A guest cart size is unavailable.");
      const key = [line.productId, line.size, line.color].join(":");
      const old = additions.get(key);
      additions.set(key, { ...line, quantity: Math.min(20, (old?.quantity ?? 0) + line.quantity) });
    }
    const byProduct = new Map<number, number>();
    for (const line of additions.values()) byProduct.set(line.productId, (byProduct.get(line.productId) ?? 0) + line.quantity);
    for (const [id, amount] of byProduct) {
      const product = products.find((p) => p.id === id)!;
      const current = existing.filter((row) => row.productId === id).reduce((sum, row) => sum + row.quantity, 0);
      if (product.stock !== undefined && current + amount > product.stock) throw new Error(product.name + " does not have enough stock to merge.");
    }
    const now = Date.now();
    for (const line of additions.values()) {
      const match = existing.find((row) => row.productId === line.productId && row.size === line.size && row.color === line.color);
      if (match) await ctx.db.patch(match._id, { quantity: Math.min(20, match.quantity + line.quantity), updatedAt: now });
      else await ctx.db.insert("cartItems", { userEmail: email, ...line, addedAt: now, updatedAt: now });
    }
    await ctx.db.insert("cartMigrations", { userEmail: email, migrationId, createdAt: now });
    return { alreadyMerged: false };
  },
});

export const createOrderFromCart = mutation({
  args: { sessionToken: tokenArg, shippingAddress: addressValidator, paymentMethod: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const a = args.shippingAddress;
    if (!a.name.trim() || !/^\d{10}$/.test(a.phone.replace(/\D/g, "")) || !a.line1.trim() ||
      !a.city.trim() || !a.state.trim() || !/^\d{6}$/.test(a.postalCode.trim())) {
      throw new Error("Enter a valid name, 10-digit phone, full address and 6-digit PIN.");
    }
    if (!["upi", "cod"].includes(args.paymentMethod)) throw new Error("Unsupported payment method.");
    const cart = await ctx.db.query("cartItems").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    if (!cart.length) throw new Error("Your cart is empty.");
    const products = await ctx.db.query("products").collect();
    const totals = new Map<number, number>();
    for (const row of cart) totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantity);
    for (const [id, qty] of totals) {
      const product = products.find((p) => p.id === id);
      if (!product) throw new Error("A product in the cart is unavailable.");
      if (product.stock !== undefined && product.stock < qty) throw new Error(product.name + " is out of stock for that quantity.");
    }
    const items = cart.map((row) => {
      const product = products.find((p) => p.id === row.productId)!;
      if (product.sizes.length && !product.sizes.includes(row.size)) throw new Error(product.name + " is no longer available in size " + row.size);
      return {
        productId: product.id, name: product.name, brand: product.brand, img: product.img,
        unitPrice: row.negotiatedPrice ?? product.price, quantity: row.quantity, size: row.size, color: row.color,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const shippingFee = subtotal >= 2000 ? 0 : 99;
    const total = subtotal + shippingFee;
    const now = Date.now();
    const orderNumber = "SFC-" + now.toString(36).toUpperCase();
    const orderId = await ctx.db.insert("orders", {
      userEmail: email, orderNumber, items, subtotal, shippingFee, total,
      paymentMethod: args.paymentMethod, paymentStatus: "unpaid", status: "placed",
      shippingAddress: {
        name: a.name.trim(), phone: a.phone.replace(/\D/g, ""), line1: a.line1.trim(),
        city: a.city.trim(), state: a.state.trim(), postalCode: a.postalCode.trim(),
      },
      createdAt: now, updatedAt: now,
    });
    await Promise.all(cart.map((row) => ctx.db.delete(row._id)));
    await Promise.all([...totals.entries()].map(async ([id, qty]) => {
      const product = products.find((p) => p.id === id)!;
      if (product.stock !== undefined) await ctx.db.patch(product._id, { stock: Math.max(0, product.stock - qty), updatedAt: now });
    }));
    await notify(ctx, email, "order", "Order placed", "Order " + orderNumber + " was saved. Payment is pending.");
    return { orderId, orderNumber, total };
  },
});

export const ordersForUser = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("orders").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ─── BARGAINING AND CUSTOM-SIZE PRE-ORDERS ────────────────────────────────────

export const submitBargainOffer = mutation({
  args: { sessionToken: tokenArg, productId: v.number(), offer: v.number(), size: v.string(), color: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", args.productId)).unique();
    if (!product) throw new Error("Product unavailable.");
    if (!Number.isFinite(args.offer) || args.offer < Math.ceil(product.price * .5) || args.offer >= product.price) throw new Error("Offer must be between 50% and 99% of list price.");
    if (product.stock !== undefined && product.stock < 1) throw new Error("Out of stock; request a pre-order instead.");
    const counter = Math.round(product.price * .93);
    const status = args.offer >= counter ? "accepted" : "countered";
    const now = Date.now();
    const bargainId = await ctx.db.insert("bargains", {
      userEmail: email, productId: product.id, productName: product.name,
      listPrice: product.price, customerOffer: args.offer, counterOffer: status === "accepted" ? args.offer : counter,
      status, attempts: 1, createdAt: now, updatedAt: now,
    });
    if (status === "accepted") {
      await ctx.db.insert("cartItems", {
        userEmail: email, productId: product.id, quantity: 1, size: args.size, color: args.color,
        negotiatedPrice: args.offer, addedAt: now, updatedAt: now,
      });
    }
    await notify(ctx, email, "bargain", status === "accepted" ? "Offer accepted" : "Seller counter-offer",
      status === "accepted" ? "Your demo offer for " + product.name + " was accepted." : "Demo counter-offer: ₹" + counter, product.id);
    return { bargainId, status, counterOffer: status === "accepted" ? args.offer : counter };
  },
});

export const replyToBargain = mutation({
  args: { sessionToken: tokenArg, bargainId: v.id("bargains"), action: v.string(), counterOffer: v.optional(v.number()), size: v.string(), color: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const row = await ctx.db.get(args.bargainId);
    if (!row || row.userEmail !== email) throw new Error("Negotiation not found.");
    const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", row.productId)).unique();
    if (!product) throw new Error("Product unavailable.");
    const now = Date.now();
    if (args.action === "accept") {
      if (product.stock !== undefined && product.stock < 1) throw new Error("Product is now out of stock.");
      const price = row.counterOffer ?? row.customerOffer;
      await ctx.db.patch(row._id, { status: "accepted", updatedAt: now });
      await ctx.db.insert("cartItems", {
        userEmail: email, productId: row.productId, quantity: 1, size: args.size, color: args.color,
        negotiatedPrice: price, addedAt: now, updatedAt: now,
      });
      return { status: "accepted", agreedPrice: price };
    }
    if (args.action === "counter") {
      if (args.counterOffer === undefined || args.counterOffer < Math.ceil(row.listPrice * .5) || args.counterOffer >= row.listPrice) throw new Error("Invalid counter-offer.");
      const counter = Math.max(args.counterOffer, Math.round(row.listPrice * .9));
      await ctx.db.patch(row._id, { customerOffer: args.counterOffer, counterOffer: counter, attempts: row.attempts + 1, status: "countered", updatedAt: now });
      return { status: "countered", counterOffer: counter };
    }
    await ctx.db.patch(row._id, { status: "closed", updatedAt: now });
    return { status: "closed" };
  },
});

export const createPreOrder = mutation({
  args: {
    sessionToken: tokenArg, productId: v.number(), size: v.string(), quantity: v.number(),
    customMeasurements: v.optional(measurementsValidator), notes: v.string(),
  },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", args.productId)).unique();
    if (!product) throw new Error("Product unavailable.");
    if (!Number.isInteger(args.quantity) || args.quantity < 1 || args.quantity > 10) throw new Error("Quantity must be 1–10.");
    if (args.customMeasurements && Object.values(args.customMeasurements).some((x) => x <= 0 || x > 300)) throw new Error("Measurements must be 1–300 cm.");
    const now = Date.now();
    const id = await ctx.db.insert("preOrders", {
      userEmail: email, productId: product.id, productName: product.name, size: args.size,
      ...(args.customMeasurements ? { customMeasurements: args.customMeasurements } : {}),
      quantity: args.quantity, notes: args.notes.trim().slice(0, 500), status: "requested", createdAt: now, updatedAt: now,
    });
    await notify(ctx, email, "preorder", "Pre-order request saved", product.name + " size request is awaiting retailer confirmation.", product.id);
    return { id, status: "requested" };
  },
});

export const preOrdersForUser = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("preOrders").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ─── WISHLIST ALERTS AND NOTIFICATIONS ────────────────────────────────────────

export const setWishlistAlerts = mutation({
  args: { sessionToken: tokenArg, productId: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("wishlistItems").withIndex("by_user_product", (q) => q.eq("userEmail", email).eq("productId", args.productId)).collect();
    if (!rows.length) throw new Error("Save this product to your wishlist first.");
    await ctx.db.patch(rows[0]._id, { alertsEnabled: args.enabled });
    return { enabled: args.enabled };
  },
});

export const wishlistAlertSettings = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("wishlistItems").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    return rows.map((row) => ({ productId: row.productId, enabled: row.alertsEnabled !== false }));
  },
});

export const refreshWishlistAlerts = mutation({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const items = await ctx.db.query("wishlistItems").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    const products = await ctx.db.query("products").collect();
    let generated = 0;
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const stock = product.stock ?? 0;
      if (item.alertsEnabled !== false && item.lastKnownPrice !== undefined && product.price < item.lastKnownPrice) {
        await notify(ctx, email, "price_drop", "Wishlist price dropped", product.name + " is now ₹" + product.price, product.id); generated++;
      }
      if (item.alertsEnabled !== false && item.lastKnownStock === 0 && stock > 0) {
        await notify(ctx, email, "back_in_stock", "Back in stock", product.name + " is available again.", product.id); generated++;
      }
      if (item.alertsEnabled !== false && item.lastKnownStock !== undefined && item.lastKnownStock > 2 && stock > 0 && stock <= 2) {
        await notify(ctx, email, "low_stock", "Almost sold out", product.name + ": only " + stock + " left.", product.id); generated++;
      }
      if (item.alertsEnabled !== false && item.lastKnownDiscount !== undefined && item.lastKnownDiscount < 30 && product.discount >= 30) {
        await notify(ctx, email, "sale", "Sale alert", product.name + " is now " + product.discount + "% off.", product.id); generated++;
      }
      await ctx.db.patch(item._id, { lastKnownPrice: product.price, lastKnownStock: stock, lastKnownDiscount: product.discount });
    }
    return { generated };
  },
});

export const notificationsForUser = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("userNotifications").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const markNotificationRead = mutation({
  args: { sessionToken: tokenArg, notificationId: v.id("userNotifications") },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userEmail !== email) throw new Error("Notification not found.");
    await ctx.db.patch(row._id, { isRead: true }); return { ok: true };
  },
});

export const markAllNotificationsRead = mutation({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("userNotifications").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    await Promise.all(rows.filter((r) => !r.isRead).map((r) => ctx.db.patch(r._id, { isRead: true })));
    return { count: rows.filter((r) => !r.isRead).length };
  },
});

// ─── COMMUNITY, OUTFITS, EVENTS AND CHAT ──────────────────────────────────────

export const createCollectionRequest = mutation({
  args: { sessionToken: tokenArg, title: v.string(), category: v.string(), details: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const title = args.title.trim().replace(/\s+/g, " ");
    const category = args.category.trim();
    if (title.length < 4 || title.length > 100 || args.details.trim().length > 500) throw new Error("Check request title and details.");
    const rows = await ctx.db.query("collectionRequests").collect();
    const existing = rows.find((r) => r.title.toLowerCase() === title.toLowerCase() && r.category.toLowerCase() === category.toLowerCase());
    const now = Date.now();
    if (existing) {
      const votes = await ctx.db.query("requestVotes").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
      if (votes.some((v) => v.requestId === existing.id)) return { id: existing.id, duplicate: true };
      await ctx.db.insert("requestVotes", { userEmail: email, requestId: existing.id, createdAt: now });
      await ctx.db.patch(existing._id, { votes: existing.votes + 1, interested: existing.interested + 1 });
      return { id: existing.id, duplicate: true };
    }
    const id = now * 1000 + Math.floor(Math.random() * 1000);
    await ctx.db.insert("collectionRequests", {
      id, title, category, votes: 1, interested: 1, status: "In Review", img: "",
      creator: email.split("@")[0], userEmail: email, details: args.details.trim(), createdAt: now,
    });
    await ctx.db.insert("requestVotes", { userEmail: email, requestId: id, createdAt: now });
    return { id, duplicate: false };
  },
});

export const toggleCommunityVote = mutation({
  args: { sessionToken: tokenArg, requestId: v.number() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const request = (await ctx.db.query("collectionRequests").collect()).find((r) => r.id === args.requestId);
    if (!request) throw new Error("Request not found.");
    const votes = await ctx.db.query("requestVotes").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    const existing = votes.find((r) => r.requestId === args.requestId);
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(request._id, { votes: Math.max(0, request.votes - 1) });
      return { voted: false };
    }
    await ctx.db.insert("requestVotes", { userEmail: email, requestId: args.requestId, createdAt: Date.now() });
    await ctx.db.patch(request._id, { votes: request.votes + 1 });
    return { voted: true };
  },
});

export const voteDesign = mutation({
  args: { sessionToken: tokenArg, cardId: v.number() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const card = (await ctx.db.query("votingCards").collect()).find((c) => c.id === args.cardId);
    if (!card) throw new Error("Design not found.");
    const rows = await ctx.db.query("cardLikes").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    const existing = rows.find((r) => r.cardId === args.cardId);
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(card._id, { likes: Math.max(0, card.likes - 1) });
      return { voted: false };
    }
    await ctx.db.insert("cardLikes", { userEmail: email, cardId: args.cardId, createdAt: Date.now() });
    await ctx.db.patch(card._id, { likes: card.likes + 1 });
    return { voted: true };
  },
});

export const saveOutfit = mutation({
  args: { sessionToken: tokenArg, name: v.string(), productIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const ids = [...new Set(args.productIds)];
    if (!ids.length || ids.length > 12) throw new Error("Choose 1–12 products.");
    const products = await ctx.db.query("products").collect();
    if (ids.some((id) => !products.some((p) => p.id === id))) throw new Error("One product is unavailable.");
    return await ctx.db.insert("savedOutfits", { userEmail: email, name: args.name.trim().slice(0, 80) || "My outfit", productIds: ids, createdAt: Date.now() });
  },
});

export const savedOutfitsForUser = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("savedOutfits").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    const products = await ctx.db.query("products").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map((row) => ({
      ...row, products: row.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean),
    }));
  },
});

export const saveEventShoppingList = mutation({
  args: { sessionToken: tokenArg, event: v.string(), budget: v.number(), productIds: v.array(v.number()) },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    if (!Number.isFinite(args.budget) || args.budget < 1 || args.budget > 1000000) throw new Error("Enter a valid budget.");
    const products = await ctx.db.query("products").collect();
    const ids = [...new Set(args.productIds)].filter((id) => products.some((p) => p.id === id));
    if (!ids.length || ids.length > 20) throw new Error("Choose 1–20 available products.");
    const total = ids.reduce((sum, id) => sum + products.find((p) => p.id === id)!.price, 0);
    if (total > args.budget) throw new Error("Selection exceeds the budget.");
    return await ctx.db.insert("eventShoppingLists", { userEmail: email, event: args.event, budget: args.budget, productIds: ids, createdAt: Date.now() });
  },
});

export const eventListsForUser = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("eventShoppingLists").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    const products = await ctx.db.query("products").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map((row) => ({
      ...row, products: row.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean),
    }));
  },
});

export const chatHistory = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    return await ctx.db.query("shoppingChats").withIndex("by_user", (q) => q.eq("userEmail", email)).unique();
  },
});

export const appendChatMessage = mutation({
  args: { sessionToken: tokenArg, role: v.string(), text: v.string(), productIds: v.optional(v.array(v.number())) },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    if (!["user", "assistant"].includes(args.role)) throw new Error("Invalid chat role.");
    const text = args.text.trim().slice(0, 2000);
    if (!text) throw new Error("Message cannot be empty.");
    const existing = await ctx.db.query("shoppingChats").withIndex("by_user", (q) => q.eq("userEmail", email)).unique();
    const now = Date.now();
    const message = { role: args.role, text, ...(args.productIds ? { productIds: args.productIds.slice(0, 12) } : {}), createdAt: now };
    if (existing) await ctx.db.patch(existing._id, { messages: [...existing.messages, message].slice(-80), updatedAt: now });
    else await ctx.db.insert("shoppingChats", { userEmail: email, messages: [message], updatedAt: now });
    return { ok: true };
  },
});

// ─── VIRTUAL WARDROBE FILE STORAGE ────────────────────────────────────────────

export const generateWardrobeUploadUrl = mutation({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => { await requireCustomer(ctx, args.sessionToken); return await ctx.storage.generateUploadUrl(); },
});

export const saveWardrobeItem = mutation({
  args: { sessionToken: tokenArg, storageId: v.id("_storage"), category: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const id = await ctx.db.insert("wardrobeItems", {
      userEmail: email, storageId: args.storageId, category: args.category, label: args.label.trim().slice(0, 80) || "Wardrobe item", createdAt: Date.now(),
    });
    return { id };
  },
});

export const wardrobeForUser = query({
  args: { sessionToken: tokenArg },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db.query("wardrobeItems").withIndex("by_user", (q) => q.eq("userEmail", email)).collect();
    return await Promise.all(rows.map(async (row) => ({ ...row, imageUrl: await ctx.storage.getUrl(row.storageId) })));
  },
});

export const deleteWardrobeItem = mutation({
  args: { sessionToken: tokenArg, itemId: v.id("wardrobeItems") },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const row = await ctx.db.get(args.itemId);
    if (!row || row.userEmail !== email) throw new Error("Wardrobe item not found.");
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
    return { ok: true };
  },
});
