import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const sessionArg = v.string();

const shippingValidator = v.object({
  name: v.string(),
  phone: v.string(),
  line1: v.string(),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
});

const measurementsValidator = v.object({
  height: v.number(),
  chest: v.number(),
  waist: v.number(),
  shoulder: v.number(),
  sleeve: v.number(),
});


async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireUserEmail(ctx: any, token: string) {
  if (!token || token.length < 32) throw new Error("Your session is missing. Sign in again.");
  const tokenHash = await hashSessionToken(token);
  const session = await ctx.db.query("userSessions")
    .withIndex("by_token", (q: any) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!session || session.expiresAt <= Date.now()) throw new Error("Your session expired. Sign in again.");
  const user = await ctx.db.query("users")
    .withIndex("by_email", (q: any) => q.eq("email", session.userEmail))
    .unique();
  if (!user || !user.verified) throw new Error("Your account is unavailable. Sign in again.");
  if (user.blocked === true) throw new Error("This account is currently blocked.");
  return user.email;
}

async function notify(ctx: any¶»§q«^