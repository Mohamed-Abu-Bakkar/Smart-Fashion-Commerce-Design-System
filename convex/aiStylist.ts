import { query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Called by the Vercel AI endpoint before it uses the server-side Groq key.
 * It intentionally returns no email, password hash, session data, or user ID.
 */
export const authenticate = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (args.token.length < 32 || args.token.length > 128) return null;

    const tokenHash = await sha256(args.token);
    const session = await ctx.db
      .query("customerSessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (!session || session.expiresAt <= Date.now()) return null;

    const user = await ctx.db.get(session.userId);
    if (!user || !user.verified || user.blocked) return null;

    return { name: user.name };
  },
});

/**
 * Return only catalogue fields required for stylist matching.
 * The Vercel function performs a second, server-side allow-list check on
 * every model-suggested product ID before returning any recommendation.
 */
export const catalog = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return products
      .filter((product) => !["archived", "inactive", "draft"].includes((product.status ?? "").toLowerCase()))
      .slice(0, 200)
      .map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        material: product.material,
        description: product.desc,
        colours: product.colors,
        sizes: product.sizes,
        stock: product.stock ?? null,
        status: product.status ?? "Active",
      }));
  },
});
