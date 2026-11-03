import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireAdmin(ctx: any, token: string) {
  if (!token || token.length < 32) throw new ConvexError("Admin session required.");
  const tokenHash = await sha256(token);
  const session = await ctx.db.query("adminSessions")
    .withIndex("by_token_hash", (q: any) => q.eq("tokenHash", tokenHash)).unique();
  if (!session || session.expiresAt <= Date.now()) {
    throw new ConvexError("Admin session expired. Sign in again.");
  }
  const user = await ctx.db.get(session.userId);
  if (!user || user.role !== "admin" || !user.verified || user.blocked) {
    throw new ConvexError("This account is not authorised for admin access.");
  }
  return { user, session };
}

export const login = mutation({
  args: { email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db.query("users")
      .withIndex("by_email", (q) => q.eq("email", email)).unique();
    // Keep the response deliberately generic to avoid account enumeration.
    if (!user || user.passwordHash !== args.passwordHash || !user.verified || user.blocked || user.role !== "admin") {
      throw new ConvexError("Invalid admin credentials or account is not authorised.");
    }
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const now = Date.now();
    const tokenHash = await sha256(token);
    await ctx.db.insert("adminSessions", {
      userId: user._id, tokenHash, createdAt: now, lastSeenAt: now, expiresAt: now + SESSION_TTL_MS,
    });
    return { token, expiresAt: now + SESSION_TTL_MS, user: { name: user.name, email: user.email, role: user.role } };
  },
});

export const session = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user, session } = await requireAdmin(ctx, args.token);
    return { name: user.name, email: user.email, role: user.role, expiresAt: session.expiresAt };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token);
    const session = await ctx.db.query("adminSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});

export const bootstrap = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const [products, revenue, requests, votes, orders, bargains] = await Promise.all([
      ctx.db.query("products").order("asc").collect(),
      ctx.db.query("revenueDaily").withIndex("by_sort").collect(),
      ctx.db.query("collectionRequests").collect(),
      ctx.db.query("votingCards").collect(),
      ctx.db.query("orders").order("desc").take(200),
      ctx.db.query("bargainSessions").order("desc").take(200),
    ]);
    const orderDetails = await Promise.all(orders.map(async (order: any) => ({ ...order, items: await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect() })));
    const bargainDetails = await Promise.all(bargains.map(async (bargain: any) => ({ ...bargain, customer: ((await ctx.db.get(bargain.userId)) as { name?: string } | null)?.name ?? "Customer", items: await ctx.db.query("bargainItems").withIndex("by_bargain", (q) => q.eq("bargainId", bargain._id)).collect() })));
    return { products, revenue, requests, votes, orders: orderDetails, bargains: bargainDetails };
  },
});

export const createProduct = mutation({
  args: {
    token: v.string(), name: v.string(), category: v.string(), price: v.number(),
    stock: v.number(), img: v.string(), desc: v.string(), minSellingPrice: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const name = args.name.trim();
    const category = args.category.trim();
    const desc = args.desc.trim();
    if (name.length < 2 || category.length < 2 || desc.length < 20 || !Number.isFinite(args.price) || args.price <= 0 ||
        !Number.isFinite(args.minSellingPrice) || args.minSellingPrice <= 0 || args.minSellingPrice > args.price ||
        !Number.isInteger(args.stock) || args.stock < 0) {
      throw new ConvexError("Enter a description (at least 20 characters), valid price, minimum selling price not above list price, and stock quantity.");
    }
    const all = await ctx.db.query("products").collect();
    const id = all.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const now = Date.now();
    const doc = {
      id, name, brand: "Smart Fashion", price: args.price, original: args.price,
      discount: 0, rating: 0, reviews: 0, img: args.img, category,
      colors: ["#111111"], sizes: ["S", "M", "L", "XL"], isNew: true, isTrending: false,
      material: "Not specified", desc, minSellingPrice: args.minSellingPrice, createdAt: now, updatedAt: now,
      sku: "SF-" + String(id).padStart(5, "0"), stock: args.stock,
      status: "Draft",
    };
    const rowId = await ctx.db.insert("products", doc);
    return { rowId, id, sku: doc.sku };
  },
});

export const updateProductStock = mutation({
  args: { token: v.string(), productId: v.number(), stock: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    if (!Number.isInteger(args.stock) || args.stock < 0) throw new ConvexError("Stock must be a non-negative whole number.");
    const product = await ctx.db.query("products")
      .withIndex("by_product_id", (q) => q.eq("id", args.productId)).unique();
    if (!product) throw new ConvexError("Product not found.");
    await ctx.db.patch(product._id, { stock: args.stock, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const updateCollectionRequest = mutation({
  args: { token: v.string(), requestId: v.number(), status: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const allowed = ["In Review", "Approved", "In Production", "Rejected"];
    if (!allowed.includes(args.status)) throw new ConvexError("Invalid collection request status.");
    const request = await ctx.db.query("collectionRequests")
      .filter((q) => q.eq(q.field("id"), args.requestId)).first();
    if (!request) throw new ConvexError("Collection request not found.");
    await ctx.db.patch(request._id, { status: args.status });
    return { ok: true };
  },
});

export const updateProductMinimumPrice = mutation({
  args: { token: v.string(), productId: v.number(), minSellingPrice: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const product = await ctx.db.query("products").withIndex("by_product_id", (q) => q.eq("id", args.productId)).unique();
    if (!product) throw new ConvexError("Product not found.");
    if (!Number.isFinite(args.minSellingPrice) || args.minSellingPrice <= 0 || args.minSellingPrice > product.price) {
      throw new ConvexError("Minimum selling price must be positive and cannot exceed the current list price.");
    }
    await ctx.db.patch(product._id, { minSellingPrice: args.minSellingPrice, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const updateOrderStatus = mutation({
  args: { token: v.string(), orderId: v.id("orders"), status: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const allowed = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!allowed.includes(args.status)) throw new ConvexError("Invalid order status.");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");
    await ctx.db.patch(order._id, { orderStatus: args.status });
    return { ok: true };
  },
});
