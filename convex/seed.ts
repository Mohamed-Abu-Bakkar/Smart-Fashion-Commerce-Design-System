import { mutation } from "./_generated/server";

// Full catalog snapshot mirrored from the app's original mock data
// (src/app/data.tsx FALLBACK_*). Re-running is safe: it skips when seeded.
const PRODUCTS = [
  {
    id: 1, name: "Shadow Bomber", brand: "Studio Noir",
    price: 3299, original: 4899, discount: 33, rating: 4.9, reviews: 284,
    img: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=520&fit=crop&auto=format",
    category: "Outerwear", colors: ["#111111", "#7B3F00", "#1a3040"],
    sizes: ["XS", "S", "M", "L", "XL"], isNew: true, isTrending: true,
    material: "100% Italian Nylon Shell",
    desc: "The Shadow Bomber redefines urban outerwear. Crafted from premium Italian nylon with satin luster finish, moving with you without compromising structure.",
  },
  {
    id: 2, name: "Void Hoodie", brand: "Monochrome",
    price: 1899, original: 2499, discount: 24, rating: 4.7, reviews: 412,
    img: "https://bifocalmedia.com/app/uploads/2024/11/Void-DC-Hoodie-Walsby-front.jpg",
    category: "Hoodies", colors: ["#111111", "#f0ede8", "#7B61FF"],
    sizes: ["S", "M", "L", "XL", "XXL"], isNew: false, isTrending: true,
    material: "380GSM French Terry Cotton",
    desc: "Heavyweight comfort meets minimalist design. 380GSM French terry construction for exceptional warmth without bulk.",
  },
  {
    id: 3, name: "Eclipse Dress", brand: "Form Studio",
    price: 2799, original: 3499, discount: 20, rating: 4.8, reviews: 193,
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=520&fit=crop&auto=format",
    category: "Dresses", colors: ["#111111", "#1a1a2e", "#2d1b4e"],
    sizes: ["XS", "S", "M", "L"], isNew: true, isTrending: false,
    material: "Viscose-Elastane Blend",
    desc: "The Eclipse Dress flows with architectural precision. Bias cut construction skims the body while allowing full range of movement.",
  },
  {
    id: 4, name: "Phantom Runner", brand: "Motion Lab",
    price: 4999, original: 6500, discount: 23, rating: 4.9, reviews: 671,
    img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=520&fit=crop&auto=format",
    category: "Footwear", colors: ["#f5f5f5", "#111111", "#7B61FF"],
    sizes: ["38", "39", "40", "41", "42", "43", "44"], isNew: false, isTrending: true,
    material: "Engineered Mesh Upper",
    desc: "Track-bred performance meets street aesthetics. ReactFoam midsole delivers responsive cushioning across all surfaces.",
  },
  {
    id: 5, name: "Flux Tee", brand: "Basics Lab",
    price: 899, original: 1199, discount: 25, rating: 4.6, reviews: 892,
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=520&fit=crop&auto=format",
    category: "T-Shirts", colors: ["#111111", "#f5f5f0", "#3d3d3d"],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"], isNew: false, isTrending: false,
    material: "220GSM Supima Cotton",
    desc: "The definitive oversized tee. 220GSM Supima cotton delivers exceptional softness that deepens with every wash.",
  },
  {
    id: 6, name: "Obsidian Blazer", brand: "Atelier Void",
    price: 5499, original: 7999, discount: 31, rating: 4.8, reviews: 156,
    img: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=520&fit=crop&auto=format",
    category: "Formal", colors: ["#111111", "#1c1c1c", "#2c2c2c"],
    sizes: ["XS", "S", "M", "L", "XL"], isNew: true, isTrending: false,
    material: "Italian Wool-Silk Blend",
    desc: "Half-canvas construction ensures the Obsidian Blazer molds to your body over time. Premium wool-silk blend with refined hand.",
  },
];

const REVENUE = [
  { day: "Mon", rev: 12400, orders: 34, sort: 0 },
  { day: "Tue", rev: 18200, orders: 51, sort: 1 },
  { day: "Wed", rev: 9800, orders: 28, sort: 2 },
  { day: "Thu", rev: 24600, orders: 67, sort: 3 },
  { day: "Fri", rev: 31200, orders: 89, sort: 4 },
  { day: "Sat", rev: 28900, orders: 78, sort: 5 },
  { day: "Sun", rev: 19700, orders: 54, sort: 6 },
];

const SIZES = [
  { size: "XS", demand: 18, sort: 0 },
  { size: "S", demand: 34, sort: 1 },
  { size: "M", demand: 58, sort: 2 },
  { size: "L", demand: 47, sort: 3 },
  { size: "XL", demand: 29, sort: 4 },
  { size: "XXL", demand: 12, sort: 5 },
];

const REQUESTS = [
  {
    id: 1, title: "Dark Academia SS25", category: "Formal",
    votes: 1247, interested: 892, status: "In Review",
    img: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=520&fit=crop&auto=format",
    creator: "Aryan M.",
  },
  {
    id: 2, title: "Y2K Revival Collection", category: "Casual",
    votes: 934, interested: 671, status: "Approved",
    img: "https://bifocalmedia.com/app/uploads/2024/11/Void-DC-Hoodie-Walsby-front.jpg?w=400&h=520&fit=crop&auto=format",
    creator: "Riya S.",
  },
  {
    id: 3, title: "Monochrome Minimalist", category: "All",
    votes: 723, interested: 512, status: "In Production",
    img: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=520&fit=crop&auto=format",
    creator: "Priya M.",
  },
];

const VOTING = [
  {
    id: 1, designer: "Studio Noir", title: "Obsidian Series",
    likes: 3241, comments: 87, launch: "Feb 2025",
    img: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=520&fit=crop&auto=format",
    progress: 78,
  },
  {
    id: 2, designer: "Form Studio", title: "Glass & Shadow",
    likes: 2109, comments: 54, launch: "Mar 2025",
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=520&fit=crop&auto=format",
    progress: 51,
  },
  {
    id: 3, designer: "Motion Lab", title: "Velocity Pack",
    likes: 1834, comments: 43, launch: "Apr 2025",
    img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=520&fit=crop&auto=format",
    progress: 34,
  },
];

const NOTIFICATIONS = [
  { group: "Price Alerts", color: "#f59e0b", icon: "tag", title: "Shadow Bomber dropped 8%", sub: "Now ₹3,299 · Was ₹3,599", time: "2h ago", unread: true, sort: 0 },
  { group: "Price Alerts", color: "#f59e0b", icon: "tag", title: "Void Hoodie back in stock", sub: "Size M · Limited units", time: "5h ago", unread: true, sort: 1 },
  { group: "Order Updates", color: "#10b981", icon: "package", title: "Your order is packed", sub: "#SFC-2025-7841 · Out for delivery tomorrow", time: "Yesterday", unread: false, sort: 2 },
  { group: "Order Updates", color: "#10b981", icon: "package", title: "Order delivered!", sub: "#SFC-2025-7823 · Tap to rate", time: "Jan 10", unread: false, sort: 3 },
  { group: "AI Suggestions", color: "#7B61FF", icon: "sparkles", title: "New drops match your aesthetic", sub: "12 products added to your feed", time: "3h ago", unread: true, sort: 4 },
  { group: "AI Suggestions", color: "#7B61FF", icon: "sparkles", title: "Flash sale starting in 2h", sub: "Items on your wishlist are 30% off", time: "4h ago", unread: false, sort: 5 },
  { group: "Community", color: "#ec4899", icon: "users", title: "Your collection request got 50 votes!", sub: '"Dark Academia SS25" is trending', time: "1d ago", unread: false, sort: 6 },
  { group: "Community", color: "#ec4899", icon: "users", title: "Riya S. voted on your pick", sub: "Phantom Runner · Community top pick", time: "2d ago", unread: false, sort: 7 },
];

const REVIEW_TEXTS = [
  { author: "Riya S.", rating: 5, date: "Jan 10", text: "Absolutely stunning quality. The fit is perfect and the fabric feels premium.", avatar: "RS", sort: 0 },
  { author: "Arjun K.", rating: 4, date: "Jan 7", text: "Great product, slightly oversized but that's the aesthetic. Highly recommend.", avatar: "AK", sort: 1 },
  { author: "Priya M.", rating: 5, date: "Dec 29", text: "Worth every rupee. The dark colorway is exactly as shown in photos.", avatar: "PM", sort: 2 },
];

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    const seedTable = async (table: any, docs: any[]) => {
      const existing = await ctx.db.query(table).first();
      if (existing) {
        counts[table] = -1; // already seeded, skipped
        return;
      }
      for (const d of docs) await ctx.db.insert(table, d);
      counts[table] = docs.length;
    };

    await seedTable("products", PRODUCTS);
    await seedTable("revenueDaily", REVENUE);
    await seedTable("sizeDemand", SIZES);
    await seedTable("collectionRequests", REQUESTS);
    await seedTable("votingCards", VOTING);
    await seedTable("notifications", NOTIFICATIONS);
    await seedTable(
      "productReviews",
      PRODUCTS.flatMap((p) => REVIEW_TEXTS.map((r) => ({ productId: p.id, ...r }))),
    );

    // Demo-shopper starter data (only when the demo account exists)
    const demo = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", "demo@sfcommerce.app"))
      .unique();
    if (demo) {
      const hasWishlist = await ctx.db
        .query("wishlistItems")
        .withIndex("by_user", (q: any) => q.eq("userEmail", demo.email))
        .first();
      if (!hasWishlist) {
        for (const productId of [1, 3, 4]) {
          await ctx.db.insert("wishlistItems", { userEmail: demo.email, productId, createdAt: Date.now() });
        }
        counts.demoWishlist = 3;
      }
      const hasLikes = await ctx.db
        .query("cardLikes")
        .withIndex("by_user", (q: any) => q.eq("userEmail", demo.email))
        .first();
      if (!hasLikes) {
        await ctx.db.insert("cardLikes", { userEmail: demo.email, cardId: 1, createdAt: Date.now() });
        counts.demoLikes = 1;
      }
      const hasVotes = await ctx.db
        .query("requestVotes")
        .withIndex("by_user", (q: any) => q.eq("userEmail", demo.email))
        .first();
      if (!hasVotes) {
        await ctx.db.insert("requestVotes", { userEmail: demo.email, requestId: 1, createdAt: Date.now() });
        counts.demoVotes = 1;
      }
    }

    const seeded = Object.values(counts).some((c) => c > 0);
    return { seeded, counts };
  },
});
