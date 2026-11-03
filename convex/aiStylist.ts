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

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function colourSearchTerms(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [normalizeSearchText(value)];

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max < 55) return ["black", "dark"];
  if (min > 225) return ["white", "light"];
  if (max - min < 22) return ["grey", "gray", max < 105 ? "charcoal" : "silver"];
  if (r > 50 && r > g * 1.25 && g > b * 1.25 && r < 200) return ["brown", "tan"];
  if (r > 210 && g > 175 && b < 145) return ["beige", "tan", "cream"];
  if (r > g * 1.25 && b > g * 1.25) return ["purple", "violet"];
  if (b > r * 1.2 && b > g * 1.05) return ["blue", max < 125 ? "navy" : "blue"];
  if (g > r * 1.15 && g > b * 1.1) return ["green"];
  if (r > g * 1.35 && r > b * 1.2) return ["red", "burgundy"];
  if (r > 190 && g > 100 && b > 130 && b > g * 1.05) return ["pink"];
  if (r > 190 && g > 115 && g > b * 1.25) return ["orange"];
  if (r > 185 && g > 175 && b < 120) return ["yellow", "gold"];
  return ["coloured"];
}

function normalizeRequestedSize(value: string) {
  const size = normalizeSearchText(value);
  const aliases: Record<string, string> = {
    small: "s",
    medium: "m",
    large: "l",
    "extra small": "xs",
    "extra large": "xl",
    "2xl": "xxl",
    "3xl": "xxxl",
  };
  return aliases[size] ?? size;
}

/**
 * Searches real catalogue records using the structured intent extracted by
 * the AI Stylist. No model-generated product data is returned to customers.
 * This bounded scan is suitable for the current catalogue; use a search index
 * and pagination before the store grows to thousands of products.
 */
export const searchProducts = query({
  args: {
    keywords: v.array(v.string()),
    categories: v.array(v.string()),
    colours: v.array(v.string()),
    materials: v.array(v.string()),
    sizes: v.array(v.string()),
    styles: v.array(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const keywords = args.keywords.slice(0, 12).map(normalizeSearchText).filter(Boolean);
    const categories = args.categories.slice(0, 5).map(normalizeSearchText).filter(Boolean);
    const colours = args.colours.slice(0, 5).map(normalizeSearchText).filter(Boolean);
    const materials = args.materials.slice(0, 5).map(normalizeSearchText).filter(Boolean);
    const styles = args.styles.slice(0, 6).map(normalizeSearchText).filter(Boolean);
    const requestedSizes = args.sizes.slice(0, 5).map(normalizeRequestedSize).filter(Boolean);
    const products = await ctx.db.query("products").collect();

    const scored = products
      .filter((product) => !["archived", "inactive", "draft"].includes((product.status ?? "").toLowerCase()))
      .filter((product) => args.minPrice === undefined || product.price >= args.minPrice)
      .filter((product) => args.maxPrice === undefined || product.price <= args.maxPrice)
      .filter((product) => {
        if (!requestedSizes.length) return true;
        const available = product.sizes.map(normalizeRequestedSize);
        return requestedSizes.some((size) => available.includes(size));
      })
      .map((product) => {
        const colourTerms = product.colors.flatMap(colourSearchTerms);
        const searchableFields = {
          name: normalizeSearchText(product.name),
          brand: normalizeSearchText(product.brand),
          category: normalizeSearchText(product.category),
          material: normalizeSearchText(product.material),
          description: normalizeSearchText(product.desc),
          colours: colourTerms.join(" "),
          sizes: product.sizes.map(normalizeSearchText).join(" "),
          tags: (product.tags ?? []).map(normalizeSearchText).join(" "),
        };
        const allText = Object.values(searchableFields).join(" ");
        const allTokens = new Set(allText.split(" ").filter(Boolean));
        let score = 0;
        const matchedKeywords: string[] = [];

        for (const keyword of keywords) {
          const tokens = keyword.split(" ").filter((token) => token.length > 2);
          let termMatched = false;

          if (searchableFields.name.includes(keyword)) {
            score += 9;
            termMatched = true;
          }
          if (searchableFields.category.includes(keyword)) {
            score += 7;
            termMatched = true;
          }
          if (searchableFields.material.includes(keyword)) {
            score += 5;
            termMatched = true;
          }
          if (searchableFields.colours.includes(keyword)) {
            score += 5;
            termMatched = true;
          }
          if (searchableFields.tags.includes(keyword)) {
            score += 4;
            termMatched = true;
          }
          if (searchableFields.brand.includes(keyword)) {
            score += 3;
            termMatched = true;
          }
          if (searchableFields.description.includes(keyword)) {
            score += 2;
            termMatched = true;
          }

          for (const token of tokens) {
            if (allTokens.has(token)) {
              score += 1;
              termMatched = true;
            }
          }
          if (termMatched) matchedKeywords.push(keyword);
        }

        for (const category of categories) {
          if (category && searchableFields.category.includes(category)) score += 8;
        }
        for (const colour of colours) {
          const terms = colourSearchTerms(colour);
          if (terms.some((term) => searchableFields.colours.includes(term))) score += 6;
        }
        for (const material of materials) {
          if (material && searchableFields.material.includes(material)) score += 5;
        }
        for (const style of styles) {
          if (style && allText.includes(style)) score += 2;
        }
        if (requestedSizes.length) score += 3;

        const reasonParts: string[] = [];
        if (matchedKeywords.length) reasonParts.push("Matches " + [...new Set(matchedKeywords)].slice(0, 3).join(", "));
        if (requestedSizes.length) reasonParts.push("available in " + requestedSizes.join("/"));
        if (args.maxPrice !== undefined) reasonParts.push("within your budget");

        return {
          product,
          score,
          matchedKeywords: [...new Set(matchedKeywords)],
          reason: reasonParts.join(" · ") || "Matches your product filters",
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating || a.product.price - b.product.price)
      .slice(0, 8);

    return scored.map(({ product, reason, matchedKeywords }) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      original: product.original,
      discount: product.discount,
      rating: product.rating,
      reviews: product.reviews,
      img: product.img,
      material: product.material,
      desc: product.desc,
      colors: product.colors,
      sizes: product.sizes,
      stock: product.stock ?? null,
      status: product.status ?? "Active",
      tags: product.tags ?? [],
      role: product.category,
      reason,
      matchedKeywords,
    }));
  },
});
