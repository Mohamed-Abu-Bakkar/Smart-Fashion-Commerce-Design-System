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
    category: v.string(),
    votes: v.number(),
    interested: v.number(),
    status: v.string(),
    img: v.string(),
    creator: v.string(),
    userEmail: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  }).index("by_created", ["createdAt"]),

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
    // Backward-compatible fields present on existing demo/admin-managed users.
    role: v.optional(v.string()),
    blocked: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  adminSessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_token_hash", ["tokenHash"]).index("by_user", ["userId"]),

  customerSessions: defineTable({
    userEmail: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_token", ["tokenHash"]).index("by_user", ["userEmail"]),

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
    alertsEnabled: v.optional(v.boolean()),
    lastKnownPrice: v.optional(v.number()),
    lastKnownStock: v.optional(v.number()),
    lastKnownDiscount: v.optional(v.number()),
  }).index("by_user", ["userEmail"]).index("by_user_product", ["userEmail", "productId"]),

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

  cartItems: defineTable({
    userEmail: v.string(), productId: v.number(), quantity: v.number(),
    size: v.string(), color: v.string(), negotiatedPrice: v.optional(v.number()),
    addedAt: v.number(), updatedAt: v.number(),
  }).index("by_user", ["userEmail"]).index("by_user_product", ["userEmail", "productId"]),

  orders: defineTable({
    userEmail: v.string(), orderNumber: v.string(),
    items: v.array(v.object({
      productId: v.number(), name: v.string(), brand: v.string(), img: v.string(),
      unitPrice: v.number(), quantity: v.number(), size: v.string(), color: v.string(),
    })),
    subtotal: v.number(), shippingFee: v.number(), total: v.number(),
    paymentMethod: v.string(), paymentStatus: v.string(), status: v.string(),
    shippingAddress: v.object({
      name: v.string(), phone: v.string(), line1: v.string(),
      city: v.string(), state: v.string(), postalCode: v.string(),
    }),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_user", ["userEmail"]),

  bargains: defineTable({
    userEmail: v.string(), productId: v.number(), productName: v.string(),
    listPrice: v.number(), customerOffer: v.number(), counterOffer: v.optional(v.number()),
    status: v.string(), attempts: v.number(), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_user", ["userEmail"]),

  preOrders: defineTable({
    userEmail: v.string(), productId: v.number(), productName: v.string(),
    size: v.string(),
    customMeasurements: v.optional(v.object({
      height: v.number(), chest: v.number(), waist: v.number(), shoulder: v.number(), sleeve: v.number(),
    })),
    quantity: v.number(), notes: v.string(), status: v.string(),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_user", ["userEmail"]),

  userNotifications: defineTable({
    userEmail: v.string(), kind: v.string(), title: v.string(), body: v.string(),
    productId: v.optional(v.number()), isRead: v.boolean(), createdAt: v.number(),
  }).index("by_user", ["userEmail"]),

  savedOutfits: defineTable({
    userEmail: v.string(), name: v.string(), productIds: v.array(v.number()), createdAt: v.number(),
  }).index("by_user", ["userEmail"]),

  eventShoppingLists: defineTable({
    userEmail: v.string(), event: v.string(), budget: v.number(),
    productIds: v.array(v.number()), createdAt: v.number(),
  }).index("by_user", ["userEmail"]),

  shoppingChats: defineTable({
    userEmail: v.string(), messages: v.array(v.object({
      role: v.string(), text: v.string(), productIds: v.optional(v.array(v.number())), createdAt: v.number(),
    })), updatedAt: v.number(),
  }).index("by_user", ["userEmail"]),

  wardrobeItems: defineTable({
    userEmail: v.string(), storageId: v.id("_storage"), category: v.string(),
    label: v.string(), createdAt: v.number(),
  }).index("by_user", ["userEmail"]),

  cartMigrations: defineTable({
    userEmail: v.string(), migrationId: v.string(), createdAt: v.number(),
  }).index("by_user_migration", ["userEmail", "migrationId"]),

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
