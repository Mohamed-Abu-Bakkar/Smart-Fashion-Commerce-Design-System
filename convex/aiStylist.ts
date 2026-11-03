import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

const MAX_REQUESTS_PER_MINUTE = 5;
const MAX_REQUESTS_PER_DAY = 40;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requireCustomer(ctx: any, token: string) {
  if (!token || token.length < 32 || token.length > 128) {
    throw new ConvexError("Please sign in to use the AI Stylist.");
  }

  const tokenHash = await sha256(token);
  const session = await ctx.db
    .query("customerSessions")
    .withIndex("by_token_hash", (q: any) => q.eq("tokenHash", tokenHash))
    .unique();

  if (!session || session.expiresAt <= Date.now()) {
    throw new ConvexError("Your session expired. Sign in again.");
  }

  const user = await ctx.db.get(session.userId);
  if (!user || !user.verified || user.blocked) {
    throw new ConvexError("Your account is not authorised to use the AI Stylist.");
  }
  return user;
}

/**
 * Enforce per-account Groq usage limits inside an atomic Convex mutation.
 * One AI Stylist request can call both the vision and reasoning models.
 */
export const consumeRequest = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCustomer(ctx, args.token);
    const now = Date.now();
    const minuteStart = Math.floor(now / 60_000) * 60_000;
    const today = new Date(now);
    const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

    const usage = await ctx.db
      .query("aiStylistUsage")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const minuteCount = usage?.minuteStart === minuteStart ? usage.minuteCount : 0;
    const dayCount = usage?.dayStart === dayStart ? usage.dayCount : 0;

    if (minuteCount >= MAX_REQUESTS_PER_MINUTE) {
      throw new ConvexError("AI Stylist rate limit reached. Please wait a minute and try again.");
    }
    if (dayCount >= MAX_REQUESTS_PER_DAY) {
      throw new ConvexError("AI Stylist daily limit reached. Please try again tomorrow.");
    }

    const nextMinuteCount = minuteCount + 1;
    const nextDayCount = dayCount + 1;
    const patch = {
      minuteStart,
      minuteCount: nextMinuteCount,
      dayStart,
      dayCount: nextDayCount,
      updatedAt: now,
    };

    if (usage) {
      await ctx.db.patch(usage._id, patch);
    } else {
      await ctx.db.insert("aiStylistUsage", { userId: user._id, ...patch });
    }

    return {
      remainingThisMinute: MAX_REQUESTS_PER_MINUTE - nextMinuteCount,
      remainingToday: MAX_REQUESTS_PER_DAY - nextDayCount,
    };
  },
});

/**
 * Return only catalogue fields required for stylist matching.
 * The Vercel function allow-lists every model-suggested product ID before
 * returning recommendations.
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
