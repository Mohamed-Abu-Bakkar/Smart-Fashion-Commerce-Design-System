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
