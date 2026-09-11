import { query } from "./_generated/server";
import { v } from "convex/values";

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
