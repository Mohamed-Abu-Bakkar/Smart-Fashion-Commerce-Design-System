import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    id: v.number(),
    name: v.string(),
    brand: v.string(),
    price: v.number(),
    original: v.number(),
    discount: v.number(),
    rating: v.number(),
    reviews: v.number(),
    img: v.string(),
    category: v.string(),
    colors: v.array(v.string()),
    sizes: v.array(v.string()),
    isNew: v.boolean(),
    isTrending: v.boolean(),
    material: v.string(),
    desc: v.string(),
    // Optional catalog metadata already present on stored/admin-managed products.
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    gallery: v.optional(v.array(v.string())),
    priceHistory: v.optional(v.array(v.object({
      month: v.string(),
      price: v.number(),
    }))),
    sku: v.optional(v.string()),
    sort: v.optional(v.number()),
    status: v.optional(v.string()),
    stock: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_product_id", ["id"])
    .index("by_category", ["category"]),

  revenueDaily: defineTable({
    day: v.string(),
    rev: v.number(),
    orders: v.number(),
    sort: v.number(),
  }).index("by_sort", ["sort"]),

  sizeDemand: defineTable({
    size: v.string(),
    demand: v.number(),
    sort: v.number(),
  }).index("by_sort", ["sort"]),

  collectionRequests: defineTable({
    id: v.number(),
    title: v.string(),
    cat¶»§q«^