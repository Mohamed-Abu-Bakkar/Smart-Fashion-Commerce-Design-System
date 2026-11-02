import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function newSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashCustomerToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createCustomerSession(ctx: any, user: { name: string; email: string }) {
  const token = newSessionToken();
  const now = Date.now();
  await ctx.db.insert("customerSessions", {
    userEmail: user.email,
    tokenHash: await hashCustomerToken(token),
    expiresAt: now + CUSTOMER_SESSION_TTL_MS,
    createdAt: now,
  });
  return { name: user.name, email: user.email, sessionToken: token };
}

export const revokeCustomerSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return { ok: true };
    const tokenHash = await hashCustomerToken(args.sessionToken);
    const session = await ctx.db.query("customerSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});


function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function issueCode(ctx: any, email: string) {
  const old = await ctx.db
    .query("otpCodes")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .collect();
  await Promise.all(old.map((o: any) => ctx.db.delete(o._id)));
  const code = makeCode();
  await ctx.db.insert("otpCodes", {
    email,
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  // Demo mode: the code is returned so the UI can display it.
  // In production, send it via an email provider here and do NOT return it.
  return code;
}

export const requestSignup = mutation({
  args: { name: v.string(), email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const name = args.name.trim();
    if (name.length < 2) throw new Error("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (args.passwordHash.length < 8) throw new Error("Invalid credentials.");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing?.verified) throw new Error("An account with this email already exists. Please sign in.");

    if (existing) {
      await ctx.db.patch(existing._id, { name, passwordHash: args.passwordHash });
    } else {
      await ctx.db.insert("users", {
        name,
        email,
        passwordHash: args.passwordHash,
        verified: false,
        createdAt: Date.now(),
      });
    }
    const code = await issueCode(ctx, email);
    return { email, demoCode: code };
  },
});

export const verifyOtp = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const record = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!record) throw new Error("No code was requested. Please resend it.");
    if (Date.now() > record.expiresAt) {
      await ctx.db.delete(record._id);
      throw new Error("Code expired. Please resend it.");
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await ctx.db.delete(record._id);
      throw new Error("Too many attempts. Please resend a new code.");
    }
    if (record.code !== args.code.trim()) {
      await ctx.db.patch(record._id, { attempts: record.attempts + 1 });
      throw new Error("Incorrect code. Try again.");
    }
    await ctx.db.delete(record._id);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new Error("Account not found. Please sign up first.");
    if (!user.verified) await ctx.db.patch(user._id, { verified: true });
    return await createCustomerSession(ctx, user);
  },
});

export const resendOtp = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const code = await issueCode(ctx, email);
    return { email, demoCode: code };
  },
});

export const login = mutation({
  args: { email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) {
      throw new ConvexError({
        code: "no_account",
        message: "No account found with this email. Please create one.",
      });
    }
    if (user.blocked === true) {
      throw new ConvexError({ code: "blocked", message: "This account is currently blocked. Contact support." });
    }
    if (user.passwordHash !== args.passwordHash) {
      throw new ConvexError({ code: "wrong_password", message: "Incorrect password. Try again." });
    }
    if (!user.verified) {
      const code = await issueCode(ctx, email);
      throw new ConvexError({
        code: "needs_verification",
        message: "Please verify your email first. A new code was sent.",
        demoCode: code,
      });
    }
    return await createCustomerSession(ctx, user);
  },
});
