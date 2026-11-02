import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type SessionUser = { name: string; email: string; guest: boolean; sessionToken?: string };

export type AuthError = { message: string; code?: string; demoCode?: string };

type AuthBackend = {
  live: boolean;
  signup(name: string, email: string, passwordHash: string): Promise<{ email: string; demoCode: string }>;
  verifyOtp(email: string, code: string): Promise<SessionUser>;
  resendOtp(email: string): Promise<{ email: string; demoCode: string }>;
  login(email: string, passwordHash: string): Promise<SessionUser>;
  revokeSession(sessionToken: string): Promise<void>;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const SESSION_KEY = "sf-session";
const LOCAL_USERS_KEY = "sf-users";
const LOCAL_OTP_KEY = "sf-otp";

export async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${email.trim().toLowerCase()}::${password}`);
  const diges���q�^