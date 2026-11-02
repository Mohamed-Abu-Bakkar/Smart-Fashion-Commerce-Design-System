import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function makeSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSession(ctx: any, user: { name: string; email: string }) {
  const token = makeSessionToken();
  const now = Date.now();
  await ctx.db.insert("userSessions", {
    userEmail: user.email,
    tokenHash: await hashSessionToken(token),
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
  });
  return { name: user.name, email: user.email, sessionToken: token };
}

export const revokeSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return { ok: true };
    const tokenHash = await hashSessionToken(args.sessionToken);
    const session = await ctx.db.query("userSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});


function makeCode() {
  return String(¶»§q«^