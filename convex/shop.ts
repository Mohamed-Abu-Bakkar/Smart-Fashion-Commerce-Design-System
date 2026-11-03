import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function requireCustomer(ctx: any, token: string) {
  if (!token || token.length < 32) throw new Error("Sign in to continue.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const session = await ctx.db.query("customerSessions")
    .withIndex("by_token", (q: any) => q.eq("tokenHash", tokenHash)).unique();
  if (!session || session.expiresAt <= Date.now()) throw new Error("Your session expired. Sign in again.");
  const user = await ctx.db.query("users").withIndex("by_email", (q: any) => q.eq("email", session.userEmail)).unique();
  if (!user || !user.verified || user.blocked === true) throw new Error("Your account is unavailable.");
  return user.email as string;
}


export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").order("asc").collect();
  },
});

export const getProduct = query({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_product_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

export const trendingProducts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect();
    return all.filter((p) => p.isTrending);
  },
});

export const newProducts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect();
    return all.filter((p) => p.isNew);
  },
});

export const productsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    if (args.category === "All") return await ctx.db.query("products").collect();
    return await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

export const revenueWeekly = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("revenueDaily").withIndex("by_sort").collect();
  },
});

export const sizeDemand = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sizeDemand").withIndex("by_sort").collect();
  },
});

export const collectionRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("collectionRequests").collect();
  },
});

export const votingCards = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("votingCards").collect();
  },
});

export const notifications = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("notifications").withIndex("by_sort").collect();
  },
});

// ─── PER-USER: WISHLIST ──────────────────────────────────────────────────────

export const wishlistIds = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user", (q) => q.eq("userEmail", email))
      .collect();
    return rows.map((r) => r.productId);
  },
});

export const toggleWishlist = mutation({
  args: { sessionToken: v.string(), productId: v.number() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("wishlistItems")
      .withIndex("by_user", (q) => q.eq("userEmail", email))
      .collect();
    const existing = rows.find((r) => r.productId === args.productId);
    if (existing) {
      await ctx.db.delete(existing._id);
      return { wishlisted: false };
    }
    await ctx.db.insert("wishlistItems", { userEmail: email, productId: args.productId, createdAt: Date.now() });
    return { wishlisted: true };
  },
});

// ─── PER-USER: COMMUNITY VOTES & LIKES ───────────────────────────────────────

export const likedCardIds = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("cardLikes")
      .withIndex("by_user", (q) => q.eq("userEmail", email))
      .collect();
    return rows.map((r) => r.cardId);
  },
});

export const toggleCardLike = mutation({
  args: { sessionToken: v.string(), cardId: v.number() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("cardLikes")
      .withIndex("by_user", (q) => q.eq("userEmail", email))
      .collect();
    const existing = rows.find((r) => r.cardId === args.cardId);
    const card = (await ctx.db.query("votingCards").collect()).find((c) => c.id === args.cardId);
    if (existing) {
      await ctx.db.delete(existing._id);
      if (card) await ctx.db.patch(card._id, { likes: Math.max(0, card.likes - 1) });
      return { liked: false };
    }
    await ctx.db.insert("cardLikes", { userEmail: email, cardId: args.cardId, createdAt: Date.now() });
    if (card) await ctx.db.patch(card._id, { likes: card.likes + 1 });
    return { liked: true };
  },
});

export const votedRequestIds = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("requestVotes")
      .withIndex("by_user", (q) => q.eq("userEmail", email))
      .collect();
    return rows.map((r) => r.requestId);
  },
});

export const toggleRequestVote = mutation({
  args: { sessionToken: v.string(), requestId: v.number() },
  handler: async (ctx, args) => {
    const email = await requireCustomer(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("requestVotes")
      .withIndex("by_user", (q) => q.eq("userEmail", email))
      .collect();
    const existing = rows.find((r) => r.requestId === args.requestId);
    const req = (await ctx.db.query("collectionRequests").collect()).find((c) => c.id === args.requestId);
    if (existing) {
      await ctx.db.delete(existing._id);
      if (req) await ctx.db.patch(req._id, { votes: Math.max(0, req.votes - 1) });
      return { voted: false };
    }
    await ctx.db.insert("requestVotes", { userEmail: email, requestId: args.requestId, createdAt: Date.now() });
    if (req) await ctx.db.patch(req._id, { votes: req.votes + 1 });
    return { voted: true };
  },
});

// ─── PRODUCT REVIEWS ─────────────────────────────────────────────────────────

export const reviewsForProduct = query({
  args: { productId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("productReviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
  },
});
