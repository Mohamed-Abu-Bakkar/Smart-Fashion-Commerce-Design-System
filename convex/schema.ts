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
    category: v.string(),
    votes: v.number(),
    interested: v.number(),
    status: v.string(),
    img: v.string(),
    creator: v.string(),
  }),

  votingCards: defineTable({
    id: v.number(),
    designer: v.string(),
    title: v.string(),
    likes: v.number(),
    comments: v.number(),
    launch: v.string(),
    img: v.string(),
    progress: v.number(),
  }),

  notifications: defineTable({
    group: v.string(),
    color: v.string(),
    icon: v.string(),
    title: v.string(),
    sub: v.string(),
    time: v.string(),
    unread: v.boolean(),
    sort: v.number(),
  }).index("by_sort", ["sort"]),

  users: defineTable({
    name: v.string(),
    email: v.string(), // lowercase
    passwordHash: v.string(),
    verified: v.boolean(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  otpCodes: defineTable({
    email: v.string(), // lowercase
    code: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  }).index("by_email", ["email"]),

  wishlistItems: defineTable({
    userEmail: v.string(), // lowercase
    productId: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userEmail"]),

  cardLikes: defineTable({
    userEmail: v.string(), // lowercase
    cardId: v.number(), // votingCards.id
    createdAt: v.number(),
  }).index("by_user", ["userEmail"]),

  requestVotes: defineTable({
    userEmail: v.string(), // lowercase
    requestId: v.number(), // collectionRequests.id
    createdAt: v.number(),
  }).index("by_user", ["userEmail"]),

  productReviews: defineTable({
    productId: v.number(),
    author: v.string(),
    rating: v.number(),
    date: v.string(),
    text: v.string(),
    avatar: v.string(),
    sort: v.number(),
  }).index("by_product", ["productId"]),
});
