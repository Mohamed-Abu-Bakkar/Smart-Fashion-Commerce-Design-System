import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type SessionUser = { name: string; email: string; guest: boolean };

export type AuthError = { message: string; code?: string; demoCode?: string };

type AuthBackend = {
  live: boolean;
  signup(name: string, email: string, passwordHash: string): Promise<{ email: string; demoCode: string }>;
  verifyOtp(email: string, code: string): Promise<SessionUser>;
  resendOtp(email: string): Promise<{ email: string; demoCode: string }>;
  login(email: string, passwordHash: string): Promise<SessionUser>;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const SESSION_KEY = "sf-session";
const LOCAL_USERS_KEY = "sf-users";
const LOCAL_OTP_KEY = "sf-otp";

export async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${email.trim().toLowerCase()}::${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

type LocalUser = { name: string; email: string; passwordHash: string; verified: boolean };

function loadLocalUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// ─── LOCAL (OFFLINE) BACKEND ─────────────────────────────────────────────────

const localBackend: AuthBackend = {
  live: false,
  async signup(name, email, passwordHash) {
    email = email.trim().toLowerCase();
    const users = loadLocalUsers();
    if (users.some((u) => u.email === email && u.verified))
      throw { message: "An account with this email already exists. Please sign in." } as AuthError;
    const rest = users.filter((u) => u.email !== email);
    rest.push({ name: name.trim(), email, passwordHash, verified: false });
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(rest));
    const demoCode = makeCode();
    localStorage.setItem(LOCAL_OTP_KEY, JSON.stringify({ email, code: demoCode, at: Date.now() }));
    return { email, demoCode };
  },
  async verifyOtp(email, code) {
    email = email.trim().toLowerCase();
    const raw = localStorage.getItem(LOCAL_OTP_KEY);
    const rec = raw ? JSON.parse(raw) : null;
    if (!rec || rec.email !== email) throw { message: "No code was requested. Please resend it." } as AuthError;
    if (Date.now() - rec.at > 5 * 60 * 1000) throw { message: "Code expired. Please resend it." } as AuthError;
    if (rec.code !== code.trim()) throw { message: "Incorrect code. Try again." } as AuthError;
    const users = loadLocalUsers();
    const user = users.find((u) => u.email === email);
    if (!user) throw { message: "Account not found. Please sign up first." } as AuthError;
    user.verified = true;
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    localStorage.removeItem(LOCAL_OTP_KEY);
    return { name: user.name, email: user.email, guest: false };
  },
  async resendOtp(email) {
    email = email.trim().toLowerCase();
    const demoCode = makeCode();
    localStorage.setItem(LOCAL_OTP_KEY, JSON.stringify({ email, code: demoCode, at: Date.now() }));
    return { email, demoCode };
  },
  async login(email, passwordHash) {
    email = email.trim().toLowerCase();
    const user = loadLocalUsers().find((u) => u.email === email);
    if (!user) throw { message: "No account found with this email. Please create one.", code: "no_account" } as AuthError;
    if (user.passwordHash !== passwordHash)
      throw { message: "Incorrect password. Try again.", code: "wrong_password" } as AuthError;
    if (!user.verified) {
      const { demoCode } = await this.resendOtp(email);
      throw { message: "Please verify your email first. A new code was sent.", code: "needs_verification", demoCode } as AuthError;
    }
    return { name: user.name, email: user.email, guest: false };
  },
};

// ─── LIVE (CONVEX) BACKEND ───────────────────────────────────────────────────

function LiveAuthBackend({ children }: { children: ReactNode }) {
  const requestSignup = useMutation(api.auth.requestSignup);
  const verify = useMutation(api.auth.verifyOtp);
  const resend = useMutation(api.auth.resendOtp);
  const loginMut = useMutation(api.auth.login);

  const backend = useMemo<AuthBackend>(
    () => ({
      live: true,
      async signup(name, email, passwordHash) {
        return await requestSignup({ name, email, passwordHash });
      },
      async verifyOtp(email, code) {
        const u = await verify({ email, code });
        return { ...u, guest: false };
      },
      async resendOtp(email) {
        return await resend({ email });
      },
      async login(email, passwordHash) {
        try {
          const u = await loginMut({ email, passwordHash });
          return { ...u, guest: false };
        } catch (e: any) {
          const data = e?.data;
          throw {
            message: authErrorMessage(e),
            code: typeof data === "object" ? data?.code : undefined,
            demoCode: typeof data === "object" ? data?.demoCode : undefined,
          } as AuthError;
        }
      },
    }),
    [requestSignup, verify, resend, loginMut],
  );

  return <AuthBackendContext.Provider value={backend}>{children}</AuthBackendContext.Provider>;
}

// ─── PROVIDER + HOOK ─────────────────────────────────────────────────────────

const AuthBackendContext = createContext<AuthBackend>(localBackend);

export function AuthProvider({ children }: { children: ReactNode }) {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
  const [user, setUser] = useState<SessionUser | null>(loadSession);

  const session = useMemo(
    () => ({
      user,
      setUser: (u: SessionUser | null) => {
        setUser(u);
        try {
          if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
          else localStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
      },
    }),
    [user],
  );

  const inner = (
    <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>
  );
  if (!url) return <AuthBackendContext.Provider value={localBackend}>{inner}</AuthBackendContext.Provider>;
  return (
    <LiveAuthBackend>
      {inner}
    </LiveAuthBackend>
  );
}

const AuthSessionContext = createContext<{
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
}>({ user: null, setUser: () => {} });

export function useAuth() {
  const backend = useContext(AuthBackendContext);
  const { user, setUser } = useContext(AuthSessionContext);

  return useMemo(
    () => ({
      user,
      live: backend.live,
      async signup(name: string, email: string, password: string) {
        const passwordHash = await hashPassword(email, password);
        return await backend.signup(name, email, passwordHash);
      },
      async verifyOtp(email: string, code: string) {
        const u = await backend.verifyOtp(email, code);
        setUser(u);
        return u;
      },
      async resendOtp(email: string) {
        return await backend.resendOtp(email);
      },
      async login(email: string, password: string) {
        const passwordHash = await hashPassword(email, password);
        const u = await backend.login(email, passwordHash);
        setUser(u);
        return u;
      },
      enterGuest() {
        const u: SessionUser = { name: "Guest", email: "", guest: true };
        setUser(u);
        return u;
      },
      signOut() {
        setUser(null);
      },
    }),
    [backend, user, setUser],
  );
}

export function authErrorMessage(e: any): string {
  const data = e?.data;
  if (typeof data === "object" && data?.message) return data.message;
  if (typeof data === "string") return data;
  if (typeof e?.message === "string") return e.message;
  return "Something went wrong. Try again.";
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
