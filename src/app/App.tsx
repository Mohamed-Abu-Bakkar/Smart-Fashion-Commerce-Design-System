import { useState, useEffect, useRef } from "react";
import {
  Search, Bell, Heart, ShoppingBag, Home, Compass,
  Sparkles, ChevronRight, Star, ArrowLeft, Share2,
  Plus, Minus, X, Zap, MapPin, CreditCard, Mic,
  Camera, Send, Bot, Tag, TrendingUp, Flame, Check,
  ShieldCheck, Truck, RotateCcw, Settings, LogOut,
  SlidersHorizontal, User, BarChart2, Award, MessageCircle,
  Filter, Eye, RefreshCw, ChevronDown, Package,
  Ruler, Users, ThumbsUp, Layers, Mail, Lock,
  Clock, Inbox, Store, Shirt, ArrowUpRight,
  Sun, Moon, Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, BarChart, Bar,
} from "recharts";

// ─── DATA (Convex-backed; local mock fallback until VITE_CONVEX_URL is set) ────
import {
  FALLBACK_PRODUCTS as PRODUCTS,
  FALLBACK_REVENUE as REVENUE_DATA,
  FALLBACK_SIZES as SIZE_DEMAND,
  useShopData,
  type Product,
} from "./data";
import { useAuth, authErrorMessage, initialsOf, type SessionUser } from "./auth";
type AppState = "splash" | "onboarding" | "login" | "otp" | "main";
type MainTab = "home" | "discover" | "ai" | "wishlist" | "profile";
type Screen =
  | MainTab
  | "product" | "bargain" | "cart" | "checkout" | "orders"
  | "notifications" | "custom-size" | "community" | "outfit-builder"
  | "wardrobe" | "retailer";

// ─── UTILS ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const PP = { fontFamily: "Poppins, sans-serif" };

function StarRating({ rating, size = 10 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size}
          className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} />
      ))}
    </div>
  );
}

// ─── THEME TOGGLE ────────────────────────────────────────────────────────────

const THEME_ORDER = ["system", "light", "dark"] as const;
type ThemeChoice = (typeof THEME_ORDER)[number];

function ThemeCycleButton() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const current = (theme === "light" || theme === "dark" ? theme : "system") as ThemeChoice;
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  const Icon = resolvedTheme === "dark" ? Moon : current === "system" ? Monitor : Sun;
  return (
    <button onClick={() => setTheme(next)} aria-label={`Theme: ${current}. Switch to ${next}`}
      title={`Theme: ${current} → ${next}`}
      className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center relative">
      <Icon size={15} className="text-muted-foreground" />
    </button>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const current = theme === "light" || theme === "dark" ? theme : "system";
  const opts: { id: ThemeChoice; Icon: typeof Sun; label: string }[] = [
    { id: "light", Icon: Sun, label: "Light" },
    { id: "system", Icon: Monitor, label: "Auto" },
    { id: "dark", Icon: Moon, label: "Dark" },
  ];
  return (
    <div>
      <p className="text-muted-foreground/70 text-[9px] font-bold tracking-[0.15em] uppercase mb-2 px-1">Appearance</p>
      <div className="bg-card border border-border rounded-2xl p-1.5 flex gap-1">
        {opts.map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setTheme(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${current === id ? "bg-[#7B61FF] text-white" : "text-muted-foreground"}`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PRODUCT CARD ────────────────────────────────────────────────────────────

function PCard({ p, onTap, wishlisted, onWishlist, width = "160px" }: {
  p: Product; onTap: () => void; wishlisted: boolean;
  onWishlist: () => void; width?: string;
}) {
  return (
    <div onClick={onTap}
      className="rounded-2xl overflow-hidden bg-card border border-border cursor-pointer group flex-shrink-0"
      style={{ width }}>
      <div className="relative overflow-hidden bg-secondary" style={{ aspectRatio: "3/4" }}>
        <img src={p.img} alt={p.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {p.isNew && <span className="bg-[#7B61FF] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">New</span>}
          {p.isTrending && <span className="bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Hot</span>}
        </div>
        <div className="absolute top-2 right-2 bg-[#7B61FF] rounded-full w-9 h-9 flex items-center justify-center">
          <span className="text-foreground text-[10px] font-bold">-{p.discount}%</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onWishlist(); }}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <Heart size={13} className={wishlisted ? "fill-[#7B61FF] text-[#7B61FF]" : "text-white/70"} />
        </button>
      </div>
      <div className="p-2.5">
        <p className="text-[9px] text-[#7B61FF] font-semibold tracking-widest uppercase mb-0.5">{p.brand}</p>
        <p className="text-foreground text-xs font-semibold leading-tight mb-1 truncate">{p.name}</p>
        <div className="flex items-center gap-1 mb-1.5">
          <StarRating rating={p.rating} />
          <span className="text-[9px] text-muted-foreground">({p.reviews})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-foreground font-bold text-sm">{fmt(p.price)}</span>
          <span className="text-muted-foreground/70 text-[10px] line-through">{fmt(p.original)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH SCREENS
// ═══════════════════════════════════════════════════════════════════════════

function SplashScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 rounded-full bg-[#7B61FF]/15 blur-[100px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-[#7B61FF] to-[#3a2ab5] flex items-center justify-center shadow-2xl shadow-[#7B61FF]/30">
          <Sparkles size={40} className="text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-foreground text-3xl font-bold tracking-tight" style={PP}>Smart Fashion</h1>
          <p className="text-[#7B61FF] text-sm font-semibold tracking-[0.3em] uppercase mt-1">Commerce</p>
        </div>
        <p className="text-muted-foreground/70 text-xs tracking-wide">AI-powered fashion for the bold</p>
      </div>
      <div className="absolute bottom-20 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#7B61FF] animate-pulse"
            style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>
    </div>
  );
}

const ONBOARDING_SLIDES = [
  {
    img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&h=900&fit=crop&auto=format",
    icon: Bot, tag: "AI SHOPPING", title: "Your Personal\nAI Stylist",
    desc: "Describe your vibe in natural language. Our AI curates perfect outfits across thousands of products — instantly.",
    accent: "#7B61FF",
  },
  {
    img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=900&fit=crop&auto=format",
    icon: Zap, tag: "SMART BARGAIN", title: "Negotiate\nLike a Pro",
    desc: "AI-powered bargaining analyses market prices and helps you negotiate the best deal with real sellers.",
    accent: "#f59e0b",
  },
  {
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=900&fit=crop&auto=format",
    icon: Ruler, tag: "CUSTOM SIZE", title: "Clothes That\nFit Perfectly",
    desc: "Input your exact measurements for made-to-order pieces. No more returns for wrong sizing.",
    accent: "#10b981",
  },
  {
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=900&fit=crop&auto=format",
    icon: Sparkles, tag: "WISHLIST AI", title: "Never Miss\na Drop",
    desc: "AI predicts price drops, restocks, and drops you alerts before everyone else. Smart shopping on autopilot.",
    accent: "#ec4899",
  },
];

function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0);
  const s = ONBOARDING_SLIDES[slide];
  const Icon = s.icon;

  const next = () => {
    if (slide < 3) setSlide(slide + 1);
    else onDone();
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <img src={s.img} alt={s.tag}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/95" />

      {/* Skip */}
      <div className="relative z-10 flex justify-end px-5 pt-4">
        <button onClick={onDone} className="text-white/60 text-xs font-semibold tracking-wide">Skip</button>
      </div>

      {/* Bottom card */}
      <div className="relative z-10 mt-auto bg-gradient-to-t from-black to-transparent pt-16 px-6 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: s.accent }}>
            <Icon size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.2em]" style={{ color: s.accent }}>{s.tag}</span>
        </div>
        <h2 className="text-white text-3xl font-bold leading-tight mb-3" style={{ ...PP, whiteSpace: "pre-line" }}>
          {s.title}
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">{s.desc}</p>

        {/* Dots */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {ONBOARDING_SLIDES.map((_, i) => (
              <div key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: i === slide ? "24px" : "6px", background: i === slide ? s.accent : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
          <button onClick={next}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
            style={{ background: s.accent }}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onAuthenticated, onSignupStarted, onGuest }: {
  onAuthenticated: (u: SessionUser) => void;
  onSignupStarted: (email: string, demoCode: string) => void;
  onGuest: () => void;
}) {
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (m: "login" | "signup") => { setMode(m); setError(""); };

  const submit = async () => {
    setError("");
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (pass.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const u = await auth.login(cleanEmail, pass);
        onAuthenticated(u);
      } else {
        const { email: em, demoCode } = await auth.signup(name, cleanEmail, pass);
        onSignupStarted(em, demoCode);
      }
    } catch (e: any) {
      if (e?.code === "needs_verification" && e?.demoCode) {
        onSignupStarted(cleanEmail, e.demoCode);
        return;
      }
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto scrollbar-hide">
      {/* Top art */}
      <div className="relative h-48 overflow-hidden flex-shrink-0">
        <img src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=400&fit=crop&auto=format"
          alt="Fashion" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="absolute bottom-6 left-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-xl bg-[#7B61FF] flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-foreground font-bold text-sm" style={PP}>Smart Fashion</span>
          </div>
          <p className="text-muted-foreground text-xs">Premium AI-powered shopping</p>
        </div>
      </div>

      <div className="flex-1 px-6 pt-4 pb-8">
        {/* Mode toggle */}
        <div className="flex bg-secondary rounded-2xl p-1 mb-6">
          {["login", "signup"].map((m) => (
            <button key={m} onClick={() => switchMode(m as any)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${mode === m ? "bg-[#7B61FF] text-white" : "text-muted-foreground"}`}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <h2 className="text-foreground text-2xl font-bold mb-1" style={PP}>
          {mode === "login" ? "Welcome back" : "Join the club"}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          {mode === "login" ? "Sign in to your account" : "Create your style profile"}
        </p>

        {/* Fields */}
        <div className="space-y-3 mb-4">
          {mode === "signup" && (
            <div className="flex items-center bg-secondary border border-border rounded-2xl px-4 py-3.5 gap-3">
              <User size={15} className="text-muted-foreground flex-shrink-0" />
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Full name" autoComplete="name" onKeyDown={(e) => e.key === "Enter" && submit()}
                className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/60" />
            </div>
          )}
          <div className="flex items-center bg-secondary border border-border rounded-2xl px-4 py-3.5 gap-3">
            <Mail size={15} className="text-muted-foreground flex-shrink-0" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address" autoComplete="email" onKeyDown={(e) => e.key === "Enter" && submit()} className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/60" />
          </div>
          <div className="flex items-center bg-secondary border border-border rounded-2xl px-4 py-3.5 gap-3">
            <Lock size={15} className="text-muted-foreground flex-shrink-0" />
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
              placeholder="Password" autoComplete={mode === "login" ? "current-password" : "new-password"} onKeyDown={(e) => e.key === "Enter" && submit()} className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/60" />
          </div>
        </div>

        {mode === "login" && (
          <button className="text-[#7B61FF] text-xs font-semibold mb-5">Forgot password?</button>
        )}

        {error !== "" && (
          <p className="text-red-400 text-xs font-medium mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{error}</p>
        )}

        <button onClick={submit} disabled={busy}
          className={`w-full py-4 rounded-2xl font-bold text-sm mb-5 transition-all ${busy ? "bg-secondary text-muted-foreground/70" : "bg-[#7B61FF] text-white"}`}>
          {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-foreground/[0.06]" />
          <span className="text-muted-foreground/70 text-xs">or continue with</span>
          <div className="flex-1 h-px bg-foreground/[0.06]" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "Google", icon: "G" },
            { label: "Apple", icon: "" },
          ].map(({ label, icon }) => (
            <button key={label} onClick={onGuest}
              className="flex items-center justify-center gap-2 bg-secondary border border-border rounded-2xl py-3.5">
              <span className="text-foreground text-sm font-bold">{icon}</span>
              <span className="text-foreground text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>

        <button onClick={onGuest}
          className="w-full text-muted-foreground/70 text-xs text-center py-2">
          Skip for now — browse as guest
        </button>
      </div>
    </div>
  );
}

function OTPScreen({ email, demoCode, resendTick, onVerified, onBack, onResend }: {
  email: string; demoCode: string; resendTick: number;
  onVerified: (u: SessionUser) => void; onBack: () => void;
  onResend: () => Promise<string>;
}) {
  const auth = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(30);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setTimer(30);
    setOtp(["", "", "", "", "", ""]);
    setError("");
    refs.current[0]?.focus();
  }, [resendTick]);

  useEffect(() => {
    const t = setInterval(() => setTimer((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "Enter") verify();
  };

  const filled = otp.every((d) => d !== "");

  const verify = async () => {
    if (!filled || busy) return;
    setError("");
    setBusy(true);
    try {
      const u = await auth.verifyOtp(email, otp.join(""));
      onVerified(u);
    } catch (e: any) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (timer > 0 || resending) return;
    setError("");
    setResending(true);
    try {
      await onResend();
    } catch (e: any) {
      setError(authErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background px-6 pt-8">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center mb-8">
        <ArrowLeft size={17} className="text-foreground" />
      </button>
      <div className="w-16 h-16 rounded-2xl bg-[#7B61FF]/15 border border-[#7B61FF]/20 flex items-center justify-center mb-5">
        <Mail size={28} className="text-[#7B61FF]" />
      </div>
      <h2 className="text-foreground text-2xl font-bold mb-1" style={PP}>Verify Email</h2>
      <p className="text-muted-foreground text-sm mb-4">We sent a 6-digit code to<br /><span className="text-foreground font-medium">{email}</span></p>

      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3 mb-6 flex items-center gap-3">
        <Mail size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">Demo mode — no email service connected. Your code is <span className="text-foreground font-bold text-sm tracking-widest">{demoCode}</span></p>
      </div>

      {error !== "" && (
        <p className="text-red-400 text-xs font-medium mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{error}</p>
      )}

      <div className="flex gap-3 mb-8">
        {otp.map((d, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }}
            value={d} onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)} maxLength={1} inputMode="numeric"
            className="flex-1 h-14 bg-secondary border-2 rounded-2xl text-foreground text-xl font-bold text-center outline-none transition-colors"
            style={{ borderColor: d ? "#7B61FF" : "var(--border)" }} />
        ))}
      </div>

      <button onClick={verify} disabled={!filled || busy}
        className={`w-full py-4 rounded-2xl font-bold text-sm mb-4 transition-all ${filled && !busy ? "bg-[#7B61FF] text-white" : "bg-secondary text-muted-foreground/70"}`}>
        {busy ? "Verifying…" : "Verify & Continue"}
      </button>

      <div className="flex items-center justify-center gap-2">
        <span className="text-muted-foreground/70 text-sm">Didn't receive it?</span>
        {timer > 0
          ? <span className="text-muted-foreground text-sm">Resend in {timer}s</span>
          : <button onClick={resend} disabled={resending} className="text-[#7B61FF] text-sm font-semibold">{resending ? "Sending…" : "Resend OTP"}</button>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREENS
// ═══════════════════════════════════════════════════════════════════════════

function HomeScreen({ onProduct, wishlisted, onWishlist, cartCount, onCart, onNav, userName }: {
  onProduct: (p: Product) => void; wishlisted: number[];
  onWishlist: (id: number) => void; cartCount: number; onCart: () => void;
  onNav: (s: Screen) => void; userName: string;
}) {
  const PRODUCTS = useShopData().products; // live (Convex) with mock fallback
  const [timeLeft, setTimeLeft] = useState({ h: 2, m: 47, s: 33 });
  const [activeCat, setActiveCat] = useState("All");
  const cats = ["All", "Outerwear", "Hoodies", "Dresses", "Footwear", "T-Shirts", "Formal"];
  const pad = (n: number) => String(n).padStart(2, "0");

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((p) => {
      let { h, m, s } = p;
      s--; if (s < 0) { s = 59; m--; } if (m < 0) { m = 59; h--; }
      if (h < 0) { h = 0; m = 0; s = 0; } return { h, m, s };
    }), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-xl px-5 pt-2 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-muted-foreground text-[11px]">Good morning 👋</p>
            <h1 className="text-foreground font-bold text-lg leading-tight" style={PP}>{userName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeCycleButton />
            <button onClick={() => onNav("notifications")}
              className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center relative">
              <Bell size={15} className="text-muted-foreground" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#7B61FF] rounded-full border-2 border-background" />
            </button>
            <button onClick={onCart}
              className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center relative">
              <ShoppingBag size={15} className="text-muted-foreground" />
              {cartCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#7B61FF] rounded-full flex items-center justify-center border border-background">
                  <span className="text-[7px] text-white font-bold">{cartCount}</span>
                </div>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center bg-secondary border border-border rounded-2xl px-4 py-2.5 gap-3">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground/70 text-sm flex-1">Search clothes, brands, styles...</span>
          <div className="flex items-center gap-1 bg-[#7B61FF]/20 border border-[#7B61FF]/30 rounded-full px-2 py-0.5">
            <Sparkles size={9} className="text-[#7B61FF]" />
            <span className="text-[9px] text-[#7B61FF] font-bold">AI</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-6">
          {/* Categories */}
          <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
            <div className="flex gap-2 w-max">
              {cats.map((cat) => (
                <button key={cat} onClick={() => setActiveCat(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeCat === cat ? "bg-[#7B61FF] text-white" : "bg-secondary text-muted-foreground border border-border"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Hero */}
          <div className="relative rounded-3xl overflow-hidden h-52 bg-secondary">
            <img src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=500&fit=crop&auto=format"
              alt="New Collection" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
            <div className="absolute inset-0 p-5 flex flex-col justify-end">
              <span className="text-[#7B61FF] text-[9px] font-bold tracking-[0.2em] uppercase mb-1.5">New Season ✦ SS2025</span>
              <h2 className="text-white text-xl font-bold leading-tight mb-3" style={PP}>Dark Matter<br />Collection</h2>
              <button className="self-start bg-white text-black text-xs font-bold px-4 py-2 rounded-full">Explore Now →</button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Bot, label: "AI Stylist", action: "ai" as Screen, color: "#7B61FF" },
              { icon: Layers, label: "Outfit Build", action: "outfit-builder" as Screen, color: "#f59e0b" },
              { icon: Users, label: "Community", action: "community" as Screen, color: "#10b981" },
              { icon: Shirt, label: "My Wardrobe", action: "wardrobe" as Screen, color: "#ec4899" },
            ].map(({ icon: Icon, label, action, color }) => (
              <button key={label} onClick={() => onNav(action)}
                className="flex flex-col items-center gap-1.5 bg-card border border-border rounded-2xl p-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* AI Recommendation */}
          <div className="relative rounded-2xl overflow-hidden border border-[#7B61FF]/25 p-4 bg-gradient-to-br from-[#7B61FF]/12 via-[#4a3adb]/6 to-transparent">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#7B61FF]/8 blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-xl bg-[#7B61FF] flex items-center justify-center">
                <Bot size={12} className="text-white" />
              </div>
              <span className="text-[#7B61FF] text-[11px] font-bold tracking-wide">AI Stylist</span>
              <div className="ml-auto flex items-center gap-1 bg-[#7B61FF]/15 rounded-full px-2 py-0.5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-semibold">Live</span>
              </div>
            </div>
            <p className="text-foreground font-bold text-base mb-1" style={PP}>Curated For You</p>
            <p className="text-muted-foreground text-[11px] leading-relaxed mb-3">
              Based on your dark minimal profile — 12 new drops match your aesthetic this week.
            </p>
            <button className="bg-[#7B61FF] text-white text-xs font-bold px-4 py-2 rounded-full">
              View Collection →
            </button>
          </div>

          {/* Trending Now */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-amber-600 dark:text-amber-400" />
                <h3 className="text-foreground font-bold text-sm" style={PP}>Trending Now</h3>
              </div>
              <button className="text-[#7B61FF] text-[11px] font-semibold flex items-center gap-0.5">See all <ChevronRight size={11} /></button>
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
              <div className="flex gap-3 w-max">
                {PRODUCTS.filter((p) => p.isTrending).map((p) => (
                  <PCard key={p.id} p={p} onTap={() => onProduct(p)} wishlisted={wishlisted.includes(p.id)} onWishlist={() => onWishlist(p.id)} />
                ))}
              </div>
            </div>
          </div>

          {/* Flash Sale */}
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={15} className="fill-amber-400 text-amber-600 dark:text-amber-400" />
                <h3 className="text-foreground font-bold text-sm" style={PP}>Flash Sale</h3>
              </div>
              <div className="flex items-center gap-1">
                {[pad(timeLeft.h), pad(timeLeft.m), pad(timeLeft.s)].map((v, i) => (
                  <span key={i} className="flex items-center">
                    <span className="bg-[#7B61FF] text-white text-[11px] font-bold w-7 h-7 rounded-lg flex items-center justify-center tabular-nums">{v}</span>
                    {i < 2 && <span className="text-muted-foreground text-xs mx-0.5">:</span>}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-3 w-max">
                {PRODUCTS.slice(0, 4).map((p) => (
                  <div key={p.id} style={{ width: "130px" }} onClick={() => onProduct(p)} className="cursor-pointer group">
                    <div className="rounded-xl overflow-hidden bg-secondary mb-2 relative" style={{ aspectRatio: "1" }}>
                      <img src={p.img} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute bottom-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">-{p.discount}%</div>
                    </div>
                    <p className="text-foreground text-[11px] font-semibold leading-tight truncate">{p.name}</p>
                    <p className="text-[#7B61FF] text-[11px] font-bold">{fmt(p.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* New Arrivals */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-[#7B61FF]" />
                <h3 className="text-foreground font-bold text-sm" style={PP}>New Arrivals</h3>
              </div>
              <button className="text-[#7B61FF] text-[11px] font-semibold flex items-center gap-0.5">See all <ChevronRight size={11} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PRODUCTS.filter((p) => p.isNew).map((p) => (
                <PCard key={p.id} p={p} onTap={() => onProduct(p)} wishlisted={wishlisted.includes(p.id)} onWishlist={() => onWishlist(p.id)} width="100%" />
              ))}
            </div>
          </div>

          {/* Community Picks */}
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle size={15} className="text-[#7B61FF]" />
                <h3 className="text-foreground font-bold text-sm" style={PP}>Community Picks</h3>
              </div>
              <button onClick={() => onNav("community")} className="text-[#7B61FF] text-[10px] font-semibold">See all</button>
            </div>
            {[
              { user: "Riya S.", vote: 847, img: PRODUCTS[3].img, name: "Phantom Runner", brand: "Motion Lab" },
              { user: "Arjun K.", vote: 612, img: PRODUCTS[1].img, name: "Void Hoodie", brand: "Monochrome" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-semibold truncate">{item.name}</p>
                  <p className="text-muted-foreground text-[10px]">{item.brand} · by {item.user}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <button className="w-8 h-8 rounded-xl bg-[#7B61FF]/10 border border-[#7B61FF]/20 flex items-center justify-center">
                    <Heart size={12} className="text-[#7B61FF]" />
                  </button>
                  <span className="text-[9px] text-muted-foreground">{item.vote}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DISCOVER ────────────────────────────────────────────────────────────────

function DiscoverScreen({ onProduct, wishlisted, onWishlist }: {
  onProduct: (p: Product) => void; wishlisted: number[]; onWishlist: (id: number) => void;
}) {
  const PRODUCTS = useShopData().products; // live (Convex) with mock fallback
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("Trending");
  const [showSort, setShowSort] = useState(false);
  const cats = ["All", "Outerwear", "Hoodies", "Dresses", "Footwear", "T-Shirts", "Formal"];
  const filtered = filter === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-xl px-5 pt-2 pb-3 border-b border-border relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-foreground font-bold text-lg" style={PP}>Discover</h1>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center">
              <Filter size={14} className="text-muted-foreground" />
            </button>
            <button onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-2">
              <SlidersHorizontal size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground text-xs">{sort}</span>
              <ChevronDown size={10} className="text-muted-foreground" />
            </button>
          </div>
        </div>
        {showSort && (
          <div className="absolute top-14 right-5 z-30 bg-secondary border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
            {["Trending", "Newest", "Price ↑", "Price ↓", "Rating", "AI Recommended"].map((s) => (
              <button key={s} onClick={() => { setSort(s); setShowSort(false); }}
                className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${sort === s ? "text-[#7B61FF] font-semibold bg-[#7B61FF]/5" : "text-muted-foreground hover:bg-foreground/5"}`}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center bg-secondary border border-border rounded-2xl px-4 py-2.5 gap-3">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground/70 text-sm flex-1">Search in {filter}...</span>
          <Mic size={14} className="text-muted-foreground" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6">
          <div className="overflow-x-auto scrollbar-hide -mx-5 px-5 mb-4">
            <div className="flex gap-2 w-max">
              {cats.map((cat) => (
                <button key={cat} onClick={() => setFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filter === cat ? "bg-[#7B61FF] text-white" : "bg-secondary text-muted-foreground border border-border"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-foreground text-xs font-semibold">Price Range</p>
              <span className="text-[#7B61FF] text-xs font-bold">₹500 – ₹8,000</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-[#7B61FF] rounded-full" style={{ width: "70%" }} />
            </div>
          </div>

          <p className="text-muted-foreground/70 text-[11px] mb-4">{filtered.length} items</p>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <PCard key={p.id} p={p} onTap={() => onProduct(p)} wishlisted={wishlisted.includes(p.id)} onWishlist={() => onWishlist(p.id)} width="100%" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI SCREEN ───────────────────────────────────────────────────────────────

function AIScreen() {
  const PRODUCTS = useShopData().products; // live (Convex) with mock fallback
  const [messages, setMessages] = useState([{
    role: "ai",
    text: "Hi! I'm your AI Fashion Assistant ✨\n\nDescribe your occasion, budget, or vibe — I'll curate perfect outfits instantly.",
  }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const prompts = ["Rooftop party under ₹4000 🌙", "Minimal streetwear 🎒", "Beach look 🏖️", "All black aesthetic 🖤"];

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((p) => [...p, { role: "user", text }]);
    setInput(""); setTyping(true);
    setTimeout(() => {
      setMessages((p) => [...p, { role: "ai", text: `Perfect! Here are 4 curated looks for "${text.slice(0, 25)}${text.length > 25 ? "..." : ""}" — all matching your dark aesthetic. Tap to explore.` }]);
      setTyping(false); setShowCards(true);
    }, 1800);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-xl px-5 pt-2 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7B61FF] to-[#4a3adb] flex items-center justify-center">
            <Bot size={19} className="text-white" />
          </div>
          <div>
            <h1 className="text-foreground font-bold text-sm" style={PP}>AI Stylist</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">Online · Instant</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Camera size={17} className="text-muted-foreground" />
            <Mic size={17} className="text-muted-foreground" />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "ai" && (
              <div className="w-7 h-7 rounded-full bg-[#7B61FF] flex items-center justify-center mr-2 flex-shrink-0 mt-auto">
                <Bot size={12} className="text-white" />
              </div>
            )}
            <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${msg.role === "user" ? "bg-[#7B61FF] text-white rounded-br-sm" : "bg-secondary border border-border text-secondary-foreground rounded-bl-sm"}`}
              style={{ whiteSpace: "pre-line" }}>{msg.text}</div>
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#7B61FF] flex items-center justify-center flex-shrink-0">
              <Bot size={12} className="text-white" />
            </div>
            <div className="bg-secondary border border-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        {showCards && (
          <div className="grid grid-cols-2 gap-2">
            {PRODUCTS.slice(0, 4).map((p) => (
              <div key={p.id} className="rounded-xl overflow-hidden bg-secondary border border-border cursor-pointer">
                <div className="aspect-square overflow-hidden"><img src={p.img} alt={p.name} className="w-full h-full object-cover" /></div>
                <div className="p-2">
                  <p className="text-foreground text-[11px] font-semibold truncate">{p.name}</p>
                  <p className="text-[#7B61FF] text-[11px] font-bold">{fmt(p.price)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {messages.length <= 1 && (
        <div className="flex-shrink-0 px-5 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {prompts.map((p) => (
              <button key={p} onClick={() => send(p)}
                className="px-3 py-2 bg-secondary border border-border rounded-full text-[11px] text-muted-foreground whitespace-nowrap">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex-shrink-0 px-5 pb-4 pt-2 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-2xl px-4 py-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Describe your perfect outfit..." className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/60" />
          <button onClick={() => send(input)} className="w-7 h-7 bg-[#7B61FF] rounded-full flex items-center justify-center flex-shrink-0">
            <Send size={12} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WISHLIST ─────────────────────────────────────────────────────────────────

function WishlistScreen({ products, onProduct, onRemove }: {
  products: Product[]; onProduct: (p: Product) => void; onRemove: (id: number) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-10 text-center">
        <div className="w-20 h-20 rounded-3xl bg-secondary border border-border flex items-center justify-center mb-5">
          <Heart size={32} className="text-muted-foreground/30" />
        </div>
        <h2 className="text-foreground font-bold text-lg mb-2" style={PP}>Nothing saved yet</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">Tap the heart on any product to save it here.</p>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-foreground font-bold text-lg" style={PP}>Wishlist</h1>
          <span className="text-muted-foreground text-sm">{products.length} items</span>
        </div>
        <div className="bg-gradient-to-r from-[#7B61FF]/12 to-transparent border border-[#7B61FF]/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Sparkles size={17} className="text-[#7B61FF] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-foreground text-xs font-semibold">AI Price Prediction</p>
            <p className="text-muted-foreground text-[10px]">Shadow Bomber likely drops 10% this weekend</p>
          </div>
          <button className="text-[#7B61FF] text-xs font-bold whitespace-nowrap">Alert me</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-3">
          {products.map((p) => (
            <div key={p.id} onClick={() => onProduct(p)}
              className="bg-card border border-border rounded-2xl overflow-hidden flex cursor-pointer hover:border-[#7B61FF]/20 transition-colors">
              <div className="w-24 h-24 flex-shrink-0 bg-secondary">
                <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-[9px] text-[#7B61FF] font-bold tracking-widest uppercase mb-0.5">{p.brand}</p>
                    <p className="text-foreground text-sm font-semibold leading-tight truncate">{p.name}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onRemove(p.id); }}>
                    <X size={14} className="text-muted-foreground/70" />
                  </button>
                </div>
                <div className="flex items-center gap-1 mt-1 mb-2">
                  <StarRating rating={p.rating} />
                  <span className="text-[9px] text-muted-foreground/70">({p.reviews})</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground font-bold text-sm">{fmt(p.price)}</span>
                    <span className="text-muted-foreground/70 text-[10px] line-through">{fmt(p.original)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">Save {fmt(p.original - p.price)}</span>
                    <span className="text-amber-600 dark:text-amber-400 text-[9px]">Price drop soon</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Total potential savings</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">{fmt(products.reduce((s, p) => s + (p.original - p.price), 0))}</p>
            </div>
            <button className="bg-[#7B61FF] text-white text-xs font-bold px-4 py-2.5 rounded-xl">Buy All</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

function ProfileScreen({ onNav, user, onSignOut }: {
  onNav: (s: Screen) => void; user: SessionUser; onSignOut: () => void;
}) {
  const sections = [
    {
      title: "Shopping",
      items: [
        { icon: "📦", label: "My Orders", sub: "12 orders", action: "orders" as Screen },
        { icon: "❤️", label: "Wishlist", sub: "3 saved", action: null },
        { icon: "📐", label: "Custom Size", sub: "Add measurements", action: "custom-size" as Screen },
        { icon: "📍", label: "Addresses", sub: "2 saved", action: null },
        { icon: "💳", label: "Payment Methods", sub: "UPI, Card", action: null },
      ],
    },
    {
      title: "Style & AI",
      items: [
        { icon: "✨", label: "AI Preferences", sub: "Dark minimal", action: null },
        { icon: "👗", label: "My Wardrobe", sub: "12 items", action: "wardrobe" as Screen },
        { icon: "🏪", label: "Retailer Dashboard", sub: "Studio Noir owner", action: "retailer" as Screen },
        { icon: "👁️", label: "Recently Viewed", sub: "14 products", action: null },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: "🔔", label: "Notifications", sub: "3 unread", action: "notifications" as Screen },
        { icon: "⚙️", label: "Settings", sub: null, action: null },
        { icon: "🚪", label: "Sign Out", sub: null, action: null, danger: true },
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="relative">
          <div className="h-28 bg-gradient-to-br from-[#7B61FF]/25 via-[#4a3adb]/12 to-transparent" />
          <div className="px-5 pb-5">
            <div className="flex items-end gap-4 -mt-10">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7B61FF] to-[#4a3adb] flex items-center justify-center border-4 border-background flex-shrink-0">
                <span className="text-white text-2xl font-bold" style={PP}>{initialsOf(user.name)}</span>
              </div>
              <div className="pb-1">
                <h2 className="text-foreground font-bold text-lg leading-tight" style={PP}>{user.name}</h2>
                <p className="text-muted-foreground text-xs">{user.guest ? "Browsing as guest" : user.email}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-5 bg-card border border-border rounded-2xl p-4 mb-5">
          <div className="grid grid-cols-3 divide-x divide-border">
            {[{ label: "Orders", value: "12" }, { label: "Wishlist", value: "3" }, { label: "Reviews", value: "7" }].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center px-4">
                <span className="text-foreground font-bold text-2xl" style={PP}>{value}</span>
                <span className="text-muted-foreground text-[10px]">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-5 mb-5 bg-gradient-to-r from-[#7B61FF]/12 to-transparent border border-[#7B61FF]/20 rounded-2xl p-3.5 flex items-center gap-3">
          <Award size={19} className="text-[#7B61FF] flex-shrink-0" />
          <div>
            <p className="text-foreground text-xs font-semibold">Style DNA: Dark Minimal</p>
            <p className="text-muted-foreground text-[10px]">Studio Noir · Monochrome · Atelier Void</p>
          </div>
        </div>
        <div className="px-5 pb-6 space-y-5">
          <AppearanceSection />
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-muted-foreground/70 text-[9px] font-bold tracking-[0.15em] uppercase mb-2 px-1">{section.title}</p>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {section.items.map((item, i) => (
                  <button key={item.label}
                    onClick={() => {
                      if (item.label === "Sign Out") onSignOut();
                      else if (item.action) onNav(item.action);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-foreground/[0.03] transition-colors text-left ${i < section.items.length - 1 ? "border-b border-border" : ""}`}>
                    <span className="text-base w-5 text-center">{item.icon}</span>
                    <span className={`flex-1 text-sm font-medium ${item.danger ? "text-red-400" : "text-foreground"}`}>{item.label}</span>
                    {item.sub && <span className="text-muted-foreground/70 text-[10px]">{item.sub}</span>}
                    {!item.danger && <ChevronRight size={13} className="text-muted-foreground/30" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT DETAIL ───────────────────────────────────────────────────────────

function ProductDetailScreen({ p, onBack, wishlisted, onWishlist, onAddToCart, onBargain, onCustomSize, cartCount, onCart }: {
  p: Product; onBack: () => void; wishlisted: boolean; onWishlist: () => void;
  onAddToCart: () => void; onBargain: () => void; onCustomSize: () => void;
  cartCount: number; onCart: () => void;
}) {
  const PRODUCTS = useShopData().products; // live (Convex) with mock fallback
  const [selColor, setSelColor] = useState(0);
  const [selSize, setSelSize] = useState(1);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "reviews">("details");
  const fairPrice = Math.round(p.price * 0.88);

  const PRICE_HIST = [
    { month: "Aug", price: p.original },
    { month: "Sep", price: Math.round(p.original * 0.95) },
    { month: "Oct", price: Math.round(p.original * 0.92) },
    { month: "Nov", price: Math.round(p.original * 0.88) },
    { month: "Dec", price: Math.round(p.original * 0.72) },
    { month: "Jan", price: p.price },
  ];

  const handleAdd = () => {
    onAddToCart(); setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  const REVIEWS = [
    { name: "Riya S.", rating: 5, date: "Jan 10", text: "Absolutely stunning quality. The fit is perfect and the fabric feels premium.", avatar: "RS" },
    { name: "Arjun K.", rating: 4, date: "Jan 7", text: "Great product, slightly oversized but that's the aesthetic. Highly recommend.", avatar: "AK" },
    { name: "Priya M.", rating: 5, date: "Dec 29", text: "Worth every rupee. The dark colorway is exactly as shown in photos.", avatar: "PM" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="relative h-[360px] bg-secondary flex-shrink-0">
          <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-background/40" />
          <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-4">
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <ArrowLeft size={17} className="text-white" />
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onCart} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center relative">
                <ShoppingBag size={16} className="text-white" />
                {cartCount > 0 && <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#7B61FF] rounded-full flex items-center justify-center"><span className="text-[7px] text-white font-bold">{cartCount}</span></div>}
              </button>
              <button onClick={onWishlist} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <Heart size={16} className={wishlisted ? "fill-[#7B61FF] text-[#7B61FF]" : "text-white/70"} />
              </button>
              <button className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <Share2 size={16} className="text-white" />
              </button>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 flex gap-2">
            {p.isNew && <span className="bg-[#7B61FF] text-white text-[9px] font-bold px-2.5 py-1 rounded-full">NEW</span>}
            {p.isTrending && <span className="bg-amber-500 text-black text-[9px] font-bold px-2.5 py-1 rounded-full">TRENDING</span>}
            <span className="bg-red-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full">-{p.discount}% OFF</span>
          </div>
        </div>

        <div className="px-5 pt-5 pb-6 space-y-4">
          <div>
            <p className="text-[#7B61FF] text-[9px] font-bold tracking-[0.2em] uppercase mb-1">{p.brand}</p>
            <h1 className="text-foreground text-2xl font-bold leading-tight mb-2.5" style={PP}>{p.name}</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5"><StarRating rating={p.rating} size={12} /><span className="text-foreground font-semibold text-sm">{p.rating}</span></div>
              <span className="text-muted-foreground/70 text-xs">({p.reviews} reviews)</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">In Stock</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-foreground text-2xl font-bold">{fmt(p.price)}</span>
            <div>
              <span className="text-muted-foreground text-xs line-through block">{fmt(p.original)}</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">Save {fmt(p.original - p.price)}</span>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-semibold mb-2">Color</p>
            <div className="flex gap-2">
              {p.colors.map((c, i) => (
                <button key={i} onClick={() => setSelColor(i)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${selColor === i ? "border-[#7B61FF] scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-xs font-semibold">Size</p>
              <button onClick={onCustomSize} className="flex items-center gap-1 text-[#7B61FF] text-xs font-medium">
                <Ruler size={11} />Custom size
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.sizes.map((s, i) => (
                <button key={s} onClick={() => setSelSize(i)}
                  className={`min-w-[40px] h-9 px-3 rounded-xl text-xs font-semibold border transition-all ${selSize === i ? "bg-[#7B61FF] text-white border-[#7B61FF]" : "bg-transparent text-muted-foreground border-border"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-muted-foreground text-xs font-semibold">Qty</p>
            <div className="flex items-center gap-3 bg-secondary rounded-xl p-1 border border-border">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"><Minus size={11} className="text-foreground" /></button>
              <span className="text-foreground font-semibold w-6 text-center text-sm">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="w-7 h-7 rounded-lg bg-[#7B61FF] flex items-center justify-center"><Plus size={11} className="text-white" /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-secondary rounded-2xl p-1">
            {(["details", "reviews"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${activeTab === t ? "bg-[#7B61FF] text-white" : "text-muted-foreground"}`}>
                {t === "details" ? "Details" : `Reviews (${p.reviews})`}
              </button>
            ))}
          </div>

          {activeTab === "details" ? (
            <>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-2">About</p>
                <p className="text-foreground/75 text-xs leading-relaxed">{p.desc}</p>
                <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                  <Tag size={11} className="text-muted-foreground" />
                  <span className="text-muted-foreground text-[11px]">{p.material}</span>
                </div>
              </div>

              {/* Price History */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-foreground font-semibold text-sm mb-3">Price History</p>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={PRICE_HIST}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7B61FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)", borderRadius: "12px", fontSize: "11px" }}
                      labelStyle={{ color: "#888" }} itemStyle={{ color: "#7B61FF" }} />
                    <Area type="monotone" dataKey="price" stroke="#7B61FF" strokeWidth={2} fill="url(#priceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[{ icon: Truck, text: "Free delivery\nJan 17" }, { icon: RotateCcw, text: "30-day\nreturns" }, { icon: ShieldCheck, text: "100%\nauthentic" }].map(({ icon: Icon, text }) => (
                  <div key={text} className="bg-card border border-border rounded-xl p-2.5 flex flex-col items-center gap-1.5">
                    <Icon size={14} className="text-[#7B61FF]" />
                    <p className="text-muted-foreground text-[9px] text-center leading-tight whitespace-pre-line">{text}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {REVIEWS.map((r) => (
                <div key={r.name} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#7B61FF]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#7B61FF] text-[10px] font-bold">{r.avatar}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground text-xs font-semibold">{r.name}</span>
                        <span className="text-muted-foreground/70 text-[10px]">{r.date}</span>
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-gradient-to-r from-[#7B61FF]/12 to-transparent border border-[#7B61FF]/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#7B61FF]/15 flex items-center justify-center flex-shrink-0">
              <Sparkles size={17} className="text-[#7B61FF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-xs font-semibold">AI Bargain Available</p>
              <p className="text-muted-foreground text-[10px]">Fair price: <span className="text-[#7B61FF] font-bold">{fmt(fairPrice)}</span></p>
            </div>
            <button onClick={onBargain} className="bg-[#7B61FF] text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap">Bargain</button>
          </div>

          <div>
            <h3 className="text-foreground font-bold text-sm mb-3" style={PP}>You may also like</h3>
            <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
              <div className="flex gap-3 w-max">
                {PRODUCTS.filter((r) => r.id !== p.id).slice(0, 4).map((r) => (
                  <div key={r.id} style={{ width: "130px" }}>
                    <div className="rounded-xl overflow-hidden mb-2 bg-secondary" style={{ aspectRatio: "1" }}>
                      <img src={r.img} alt={r.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-foreground text-[11px] font-semibold truncate">{r.name}</p>
                    <p className="text-[#7B61FF] text-[11px] font-bold">{fmt(r.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 px-4 py-3 bg-background border-t border-border flex gap-2">
        <button onClick={handleAdd}
          className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all ${added ? "bg-emerald-500 text-white" : "bg-[#7B61FF] text-white"}`}>
          {added ? "✓ Added to Cart" : "Add to Cart"}
        </button>
        <button onClick={onBargain} className="px-4 py-3.5 rounded-2xl border border-[#7B61FF]/40 text-[#7B61FF] font-bold">
          <Sparkles size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── BARGAINING ───────────────────────────────────────────────────────────────

function BargainingScreen({ p, onBack }: { p: Product; onBack: () => void }) {
  const fairPrice = Math.round(p.price * 0.88);
  const counterOffer = Math.round(p.price * 0.93);
  const [offer, setOffer] = useState(fairPrice);
  const [stage, setStage] = useState<"input" | "pending" | "counter" | "accepted">("input");
  const pct = Math.min(95, Math.max(5, Math.round((1 - (offer / p.price - 0.75) / 0.25) * 100)));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center">
          <ArrowLeft size={17} className="text-white" />
        </button>
        <div>
          <h1 className="text-foreground font-bold" style={PP}>Smart Bargain</h1>
          <p className="text-muted-foreground text-[10px]">AI-powered negotiation</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">Live</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-4">
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3">
            <img src={p.img} alt={p.name} className="w-16 h-16 rounded-xl object-cover bg-secondary flex-shrink-0" />
            <div>
              <p className="text-[9px] text-[#7B61FF] font-bold tracking-widest uppercase">{p.brand}</p>
              <p className="text-foreground font-semibold text-sm">{p.name}</p>
              <p className="text-muted-foreground text-[10px]">Size M · 3 color options</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-muted-foreground text-[9px] font-bold uppercase tracking-wider mb-3">Price Analysis</p>
            <div className="space-y-2.5">
              {[
                { label: "Original Price", value: fmt(p.original), color: "text-muted-foreground" },
                { label: "Current Price", value: fmt(p.price), color: "text-foreground" },
                { label: "AI Fair Price", value: fmt(fairPrice), color: "text-[#7B61FF]", ai: true },
              ].map(({ label, value, color, ai }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{label}</span>
                    {ai && <span className="bg-[#7B61FF]/20 text-[#7B61FF] text-[8px] font-bold px-1.5 py-0.5 rounded-full">AI</span>}
                  </div>
                  <span className={`font-bold text-sm ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-[#7B61FF] flex items-center justify-center flex-shrink-0">
                <Bot size={12} className="text-white" />
              </div>
              <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex-1">
                <p className="text-secondary-foreground text-xs leading-relaxed">
                  Market data says <span className="text-[#7B61FF] font-bold">{fmt(fairPrice)}</span> is the sweet spot for the {p.name}. Sellers accept 68% of offers in this range. 🎯
                </p>
              </div>
            </div>

            {stage === "input" && (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                <p className="text-muted-foreground text-xs font-semibold">Your Offer</p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-2xl font-bold">₹</span>
                  <input type="number" value={offer} onChange={(e) => setOffer(Number(e.target.value))}
                    className="flex-1 bg-transparent text-foreground text-2xl font-bold outline-none border-b border-border pb-1" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-muted-foreground text-[10px]">Acceptance probability</p>
                    <span className={`text-xs font-bold ${pct > 60 ? "text-emerald-600 dark:text-emerald-400" : pct > 30 ? "text-amber-600 dark:text-amber-400" : "text-red-400"}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${pct > 60 ? "bg-emerald-400" : pct > 30 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[Math.round(p.price * 0.85), fairPrice, Math.round(p.price * 0.92)].map((preset) => (
                    <button key={preset} onClick={() => setOffer(preset)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${offer === preset ? "bg-[#7B61FF] text-white border-[#7B61FF]" : "border-border text-muted-foreground"}`}>
                      {fmt(preset)}
                    </button>
                  ))}
                </div>
                <button onClick={() => setStage("pending")} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl font-bold text-sm">
                  Submit Offer — {fmt(offer)}
                </button>
              </div>
            )}

            {(stage === "pending" || stage === "counter" || stage === "accepted") && (
              <div className="flex justify-end">
                <div className="bg-[#7B61FF] text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-[75%]">
                  <p className="text-sm font-semibold">My offer: {fmt(offer)}</p>
                  {stage === "pending" && <p className="text-[10px] text-white/70 mt-0.5">Waiting for response...</p>}
                </div>
              </div>
            )}
            {stage === "pending" && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><span className="text-sm">🏪</span></div>
                <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                </div>
              </div>
            )}
            {/* Auto-advance pending to counter */}
            {stage === "pending" && (() => { setTimeout(() => setStage("counter"), 2000); return null; })()}
            {(stage === "counter" || stage === "accepted") && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><span className="text-sm">🏪</span></div>
                <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex-1">
                  <p className="text-secondary-foreground text-xs leading-relaxed">
                    Thanks! My best price is <span className="text-foreground font-bold">{fmt(counterOffer)}</span> — final offer. Shall we make it a deal? 🤝
                  </p>
                </div>
              </div>
            )}
            {stage === "counter" && (
              <div className="flex gap-2">
                <button onClick={() => setStage("accepted")} className="flex-1 bg-emerald-500 text-foreground py-3 rounded-2xl font-bold text-sm">Accept {fmt(counterOffer)}</button>
                <button className="flex-1 bg-secondary border border-border text-foreground py-3 rounded-2xl font-semibold text-sm">Counter offer</button>
              </div>
            )}
            {stage === "accepted" && (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Check size={19} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Deal Accepted! 🎉</p>
                  <p className="text-muted-foreground text-[10px]">You saved {fmt(p.price - counterOffer)} off the listed price</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CART ─────────────────────────────────────────────────────────────────────

function CartScreen({ items, onBack, onCheckout, onRemove }: {
  items: Product[]; onBack: () => void; onCheckout: () => void; onRemove: (id: number) => void;
}) {
  const subtotal = items.reduce((s, p) => s + p.price, 0);
  const total = subtotal + (subtotal > 2000 ? 0 : 99);
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center">
          <ArrowLeft size={17} className="text-white" />
        </button>
        <h1 className="text-foreground font-bold flex-1" style={PP}>Cart</h1>
        <span className="text-muted-foreground text-sm">{items.length} items</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-10 text-center">
            <div className="w-20 h-20 rounded-3xl bg-secondary border border-border flex items-center justify-center mb-5">
              <ShoppingBag size={32} className="text-muted-foreground/30" />
            </div>
            <h2 className="text-foreground font-bold text-lg mb-2" style={PP}>Your cart is empty</h2>
            <p className="text-muted-foreground text-sm mb-5">Add something beautiful to get started.</p>
            <button onClick={onBack} className="bg-[#7B61FF] text-white px-6 py-3 rounded-full font-bold text-sm">Continue Shopping</button>
          </div>
        ) : (
          <div className="px-5 pt-4 pb-6 space-y-3">
            {items.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-2xl overflow-hidden flex">
                <div className="w-24 h-24 flex-shrink-0 bg-secondary"><img src={p.img} alt={p.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1 p-3 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-[9px] text-[#7B61FF] font-bold tracking-widest uppercase">{p.brand}</p>
                      <p className="text-foreground text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-muted-foreground/70 text-[10px] mt-0.5">Size M · Black</p>
                    </div>
                    <button onClick={() => onRemove(p.id)}><X size={14} className="text-muted-foreground/70" /></button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-bold text-sm">{fmt(p.price)}</span>
                    <div className="flex items-center gap-2 bg-secondary rounded-lg p-0.5">
                      <button className="w-6 h-6 rounded-md bg-muted flex items-center justify-center"><Minus size={10} className="text-foreground" /></button>
                      <span className="text-foreground text-xs font-semibold w-4 text-center">1</span>
                      <button className="w-6 h-6 rounded-md bg-[#7B61FF] flex items-center justify-center"><Plus size={10} className="text-white" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center bg-card border border-border rounded-2xl px-4 py-3 gap-3">
              <Tag size={14} className="text-muted-foreground flex-shrink-0" />
              <input placeholder="Enter coupon code" className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/60" />
              <button className="text-[#7B61FF] text-xs font-bold">Apply</button>
            </div>
            {/* Group buy */}
            <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl p-3.5 flex items-center gap-3">
              <Users size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-foreground text-xs font-semibold">Group Buy</p>
                <p className="text-muted-foreground text-[10px]">Invite 3 friends and save an extra 15%</p>
              </div>
              <button className="text-amber-600 dark:text-amber-400 text-xs font-bold">Invite</button>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
              <p className="text-foreground font-semibold text-sm">Order Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">Subtotal</span><span className="text-foreground text-xs font-medium">{fmt(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">Delivery</span><span className={`text-xs font-medium ${subtotal > 2000 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{subtotal > 2000 ? "FREE" : "₹99"}</span></div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="text-foreground font-bold text-sm">Total</span><span className="text-foreground font-bold text-sm">{fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 bg-background border-t border-border">
          <button onClick={onCheckout} className="w-full bg-[#7B61FF] text-white py-4 rounded-2xl font-bold text-sm">Checkout · {fmt(total)}</button>
        </div>
      )}
    </div>
  );
}

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────

function CheckoutScreen({ onBack, onSuccess, userName }: { onBack: () => void; onSuccess: () => void; userName: string }) {
  const [payment, setPayment] = useState("upi");
  const [placing, setPlacing] = useState(false);
  const handlePlace = () => { setPlacing(true); setTimeout(onSuccess, 2000); };
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <h1 className="text-foreground font-bold flex-1" style={PP}>Checkout</h1>
        <div className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" /><span className="text-emerald-600 dark:text-emerald-400 text-xs">Secure</span></div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><MapPin size={14} className="text-[#7B61FF]" /><p className="text-foreground font-semibold text-sm">Delivery Address</p></div>
              <button className="text-[#7B61FF] text-xs font-bold">Change</button>
            </div>
            <p className="text-foreground text-sm font-medium">{userName}</p>
            <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">42, Sunrise Apartments, Bandra West<br />Mumbai, Maharashtra 400050</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full">Home</span>
              <span className="text-muted-foreground text-[10px]">+91 98765 43210</span>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3"><Truck size={14} className="text-[#7B61FF]" /><p className="text-foreground font-semibold text-sm">Delivery</p></div>
            {[{ id: "std", label: "Standard", sub: "Jan 17–19", price: "FREE", sel: true }, { id: "exp", label: "Express", sub: "Tomorrow", price: "₹149", sel: false }].map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 cursor-pointer">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${d.sel ? "border-[#7B61FF]" : "border-muted-foreground/40"}`}>{d.sel && <div className="w-2 h-2 rounded-full bg-[#7B61FF]" />}</div>
                <div className="flex-1"><p className="text-foreground text-xs font-semibold">{d.label}</p><p className="text-muted-foreground text-[10px]">{d.sub}</p></div>
                <span className={`text-xs font-bold ${d.price === "FREE" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{d.price}</span>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3"><CreditCard size={14} className="text-[#7B61FF]" /><p className="text-foreground font-semibold text-sm">Payment</p></div>
            {[{ id: "upi", label: "UPI", sub: "GPay, PhonePe, Paytm", icon: "⚡" }, { id: "card", label: "Credit / Debit Card", sub: "Visa, Mastercard, RuPay", icon: "💳" }, { id: "wallet", label: "Wallet", sub: "₹2,400 available", icon: "👛" }, { id: "cod", label: "Cash on Delivery", sub: "Pay at doorstep", icon: "💵" }].map((m) => (
              <div key={m.id} onClick={() => setPayment(m.id)} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 cursor-pointer">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payment === m.id ? "border-[#7B61FF]" : "border-muted-foreground/40"}`}>{payment === m.id && <div className="w-2 h-2 rounded-full bg-[#7B61FF]" />}</div>
                <span className="text-base">{m.icon}</span>
                <div className="flex-1"><p className="text-foreground text-xs font-semibold">{m.label}</p><p className="text-muted-foreground text-[10px]">{m.sub}</p></div>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-foreground font-semibold text-sm mb-3">Order Total</p>
            {[{ l: "1 item", v: "₹3,299" }, { l: "Delivery", v: "FREE", g: true }, { l: "Discount (STYLE10)", v: "-₹330", g: true }].map(({ l, v, g }) => (
              <div key={l} className="flex justify-between"><span className="text-muted-foreground text-xs">{l}</span><span className={`text-xs font-medium ${g ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{v}</span></div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between"><span className="text-foreground font-bold text-sm">Total</span><span className="text-foreground font-bold text-sm">₹2,969</span></div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 px-4 py-3 bg-background border-t border-border">
        <button onClick={handlePlace} disabled={placing}
          className="w-full bg-[#7B61FF] text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-80">
          {placing ? <><RefreshCw size={15} className="animate-spin" />Placing Order...</> : "Place Order · ₹2,969"}
        </button>
      </div>
    </div>
  );
}

// ─── ORDERS ───────────────────────────────────────────────────────────────────

function OrdersScreen({ onBack }: { onBack: () => void }) {
  const PRODUCTS = useShopData().products; // live (Convex) with mock fallback
  const steps = [
    { label: "Order Placed", time: "Today, 2:34 PM", done: true },
    { label: "Payment Confirmed", time: "Today, 2:35 PM", done: true },
    { label: "Being Packed", time: "Tomorrow, Jan 14", done: false },
    { label: "Out for Delivery", time: "Jan 17", done: false },
    { label: "Delivered", time: "Jan 17", done: false },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <h1 className="text-foreground font-bold flex-1" style={PP}>Order Confirmed</h1>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pb-6 space-y-5">
          <div className="bg-gradient-to-br from-emerald-500/12 to-transparent border border-emerald-500/20 rounded-3xl p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mb-3"><Check size={28} className="text-white" strokeWidth={2.5} /></div>
            <h2 className="text-foreground font-bold text-xl mb-1" style={PP}>Order Placed! 🎉</h2>
            <p className="text-muted-foreground text-sm mb-4">Your {PRODUCTS[0].name} is on its way</p>
            <div className="bg-black/30 rounded-xl px-4 py-2"><span className="text-muted-foreground text-xs">Order ID: </span><span className="text-foreground text-xs font-mono font-bold">#SFC-2025-7842</span></div>
          </div>
          <div className="bg-card border border-border rounded-2xl flex overflow-hidden">
            <img src={PRODUCTS[0].img} alt={PRODUCTS[0].name} className="w-24 h-24 object-cover bg-secondary flex-shrink-0" />
            <div className="p-3 flex-1">
              <p className="text-[9px] text-[#7B61FF] font-bold tracking-widest uppercase">{PRODUCTS[0].brand}</p>
              <p className="text-foreground text-sm font-semibold">{PRODUCTS[0].name}</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">Size M · Bargain price applied</p>
              <p className="text-foreground font-bold text-sm mt-1">₹2,969</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-foreground font-semibold text-sm mb-4">Delivery Timeline</p>
            {steps.map((step, i) => (
              <div key={step.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? "bg-emerald-500" : "bg-muted border border-border"}`}>
                    {step.done ? <Check size={12} className="text-white" /> : <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />}
                  </div>
                  {i < steps.length - 1 && <div className={`w-0.5 h-8 mt-0.5 ${step.done ? "bg-emerald-500/40" : "bg-foreground/[0.05]"}`} />}
                </div>
                <div className="pb-6"><p className={`text-sm font-semibold ${step.done ? "text-foreground" : "text-muted-foreground/70"}`}>{step.label}</p><p className="text-muted-foreground/70 text-[10px]">{step.time}</p></div>
              </div>
            ))}
          </div>
          <button onClick={onBack} className="w-full border border-[#7B61FF]/40 text-[#7B61FF] py-3.5 rounded-2xl font-bold text-sm">Continue Shopping</button>
        </div>
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { notificationGroups: groups } = useShopData(); // live (Convex) with mock fallback

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <h1 className="text-foreground font-bold flex-1" style={PP}>Notifications</h1>
        <button className="text-[#7B61FF] text-xs font-semibold">Clear all</button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-5">
          {groups.map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.title}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={13} style={{ color: g.color }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: g.color }}>{g.title}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  {g.items.map((item, i) => (
                    <div key={item.title} className={`flex items-start gap-3 px-4 py-3.5 ${i < g.items.length - 1 ? "border-b border-border" : ""} ${item.unread ? "bg-[#7B61FF]/3" : ""}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${g.color}15`, border: `1px solid ${g.color}25` }}>
                        <Icon size={15} style={{ color: g.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-tight ${item.unread ? "text-foreground" : "text-foreground/75"}`}>{item.title}</p>
                          <span className="text-muted-foreground/70 text-[9px] whitespace-nowrap flex-shrink-0">{item.time}</span>
                        </div>
                        <p className="text-muted-foreground text-[10px] mt-0.5 leading-tight">{item.sub}</p>
                      </div>
                      {item.unread && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: g.color }} />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── CUSTOM SIZE ──────────────────────────────────────────────────────────────

function CustomSizeScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<"standard" | "custom">("standard");
  const [selSize, setSelSize] = useState("M");
  const [measurements, setMeasurements] = useState({ height: "175", chest: "95", waist: "80", shoulder: "43", sleeve: "62" });
  const [saved, setSaved] = useState(false);

  const fields = [
    { key: "height", label: "Height", unit: "cm", icon: "↕" },
    { key: "chest", label: "Chest", unit: "cm", icon: "◉" },
    { key: "waist", label: "Waist", unit: "cm", icon: "○" },
    { key: "shoulder", label: "Shoulder Width", unit: "cm", icon: "↔" },
    { key: "sleeve", label: "Sleeve Length", unit: "cm", icon: "➡" },
  ] as const;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <div>
          <h1 className="text-foreground font-bold" style={PP}>Custom Size Pre-order</h1>
          <p className="text-muted-foreground text-[10px]">Made-to-measure, just for you</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-secondary rounded-2xl p-1">
            {(["standard", "custom"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${mode === m ? "bg-[#7B61FF] text-white" : "text-muted-foreground"}`}>
                {m === "standard" ? "Standard Sizes" : "Custom Measurements"}
              </button>
            ))}
          </div>

          {mode === "standard" ? (
            <>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-foreground font-semibold text-sm mb-3">Select Your Size</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                    <button key={s} onClick={() => setSelSize(s)}
                      className={`h-12 rounded-xl text-sm font-bold border transition-all ${selSize === s ? "bg-[#7B61FF] text-white border-[#7B61FF]" : "border-border text-muted-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-2">Size {selSize} fits</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[["Chest", "88–96 cm"], ["Waist", "73–81 cm"], ["Height", "170–178 cm"], ["Hips", "90–98 cm"]].map(([k, v]) => (
                      <div key={k}><span className="text-muted-foreground/70 text-[10px]">{k}: </span><span className="text-foreground/75 text-[10px] font-semibold">{v}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Ruler size={15} className="text-[#7B61FF]" />
                <p className="text-foreground font-semibold text-sm">Your Measurements</p>
              </div>
              {fields.map(({ key, label, unit, icon }) => (
                <div key={key} className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-3">
                  <span className="text-muted-foreground text-base w-5 text-center">{icon}</span>
                  <span className="text-muted-foreground text-xs flex-1">{label}</span>
                  <input type="number"
                    value={measurements[key]}
                    onChange={(e) => setMeasurements((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-16 bg-transparent text-foreground text-sm font-bold text-right outline-none" />
                  <span className="text-muted-foreground/70 text-xs">{unit}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-3">
                <span className="text-muted-foreground text-base">📝</span>
                <input placeholder="Special notes (optional)..." className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground/60" />
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-gradient-to-r from-[#7B61FF]/12 to-transparent border border-[#7B61FF]/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-[#7B61FF]" />
              <p className="text-foreground font-semibold text-sm">Pre-order Timeline</p>
            </div>
            {[
              { label: "Order confirmed", time: "Today", done: true },
              { label: "Measurement review", time: "+2 days", done: false },
              { label: "Fabric cutting & tailoring", time: "+7 days", done: false },
              { label: "Quality check", time: "+10 days", done: false },
              { label: "Delivered", time: "+14 days", done: false },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-3 py-1.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${step.done ? "bg-[#7B61FF]" : "bg-muted-foreground/40"}`} />
                <span className={`text-xs flex-1 ${step.done ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{step.label}</span>
                <span className="text-muted-foreground/70 text-[10px]">{step.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 px-4 py-3 bg-background border-t border-border">
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${saved ? "bg-emerald-500 text-white" : "bg-[#7B61FF] text-white"}`}>
          {saved ? "✓ Measurements Saved!" : "Save & Pre-order"}
        </button>
      </div>
    </div>
  );
}

// ─── COMMUNITY ────────────────────────────────────────────────────────────────

function CommunityScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"requests" | "voting">("requests");
  const [liked, setLiked] = useState<number[]>([]);
  const { collectionRequests: requests, votingCards } = useShopData(); // live with mock fallback

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <h1 className="text-foreground font-bold" style={PP}>Community</h1>
        <button className="ml-auto bg-[#7B61FF] text-white text-xs font-bold px-3 py-1.5 rounded-full">+ Request</button>
      </div>
      <div className="flex-shrink-0 flex bg-secondary mx-5 mt-3 rounded-2xl p-1">
        {(["requests", "voting"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${tab === t ? "bg-[#7B61FF] text-white" : "text-muted-foreground"}`}>
            {t === "requests" ? "Collection Requests" : "Voting Feed"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-3">
          {tab === "requests" ? requests.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex">
                <div className="w-24 h-24 flex-shrink-0 bg-secondary"><img src={r.img} alt={r.title} className="w-full h-full object-cover" /></div>
                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-foreground text-sm font-bold leading-tight">{r.title}</p>
                      <p className="text-muted-foreground text-[10px]">{r.category} · by {r.creator}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${r.status === "Approved" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : r.status === "In Production" ? "bg-[#7B61FF]/20 text-[#7B61FF]" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-2 mb-1.5">
                    <div className="flex justify-between mb-1"><span className="text-muted-foreground text-[10px]">{r.votes.toLocaleString()} votes</span><span className="text-muted-foreground text-[10px]">{r.interested.toLocaleString()} interested</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[#7B61FF] rounded-full" style={{ width: `${Math.round(r.votes / 15)}%` }} /></div>
                  </div>
                </div>
              </div>
              <div className="flex border-t border-border">
                <button className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-[#7B61FF] transition-colors">
                  <ThumbsUp size={12} />Vote
                </button>
                <div className="w-px bg-foreground/[0.04]" />
                <button className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Users size={12} />Join Interest
                </button>
              </div>
            </div>
          )) : votingCards.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="relative h-44 bg-secondary">
                <img src={c.img} alt={c.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] text-[#7B61FF] font-bold tracking-widest uppercase mb-0.5">{c.designer}</p>
                  <p className="text-white font-bold text-base" style={PP}>{c.title}</p>
                </div>
                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <span className="text-white text-[10px] font-semibold">Launch {c.launch}</span>
                </div>
              </div>
              <div className="p-3">
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground text-[10px]">Community approval</span>
                    <span className="text-[#7B61FF] text-[10px] font-bold">{c.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[#7B61FF] rounded-full" style={{ width: `${c.progress}%` }} /></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setLiked((p) => p.includes(c.id) ? p.filter((i) => i !== c.id) : [...p, c.id])}
                      className="flex items-center gap-1">
                      <Heart size={14} className={liked.includes(c.id) ? "fill-[#7B61FF] text-[#7B61FF]" : "text-muted-foreground"} />
                      <span className="text-muted-foreground text-xs">{(c.likes + (liked.includes(c.id) ? 1 : 0)).toLocaleString()}</span>
                    </button>
                    <button className="flex items-center gap-1">
                      <MessageCircle size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground text-xs">{c.comments}</span>
                    </button>
                  </div>
                  <button className="bg-[#7B61FF] text-white text-xs font-bold px-3 py-1.5 rounded-full">Vote</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── OUTFIT BUILDER ───────────────────────────────────────────────────────────

function OutfitBuilderScreen({ onBack, onProduct }: { onBack: () => void; onProduct: (p: Product) => void }) {
  const PRODUCTS = useShopData().products; // live (Convex) with mock fallback
  const slots = [
    { label: "Top", icon: Shirt, product: PRODUCTS[1], color: "#7B61FF" },
    { label: "Bottom", icon: Layers, product: PRODUCTS[4], color: "#10b981" },
    { label: "Shoes", icon: Zap, product: PRODUCTS[3], color: "#f59e0b" },
    { label: "Jacket", icon: Shirt, product: PRODUCTS[0], color: "#ec4899" },
  ];
  const totalPrice = slots.reduce((s, sl) => s + sl.product.price, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <div>
          <h1 className="text-foreground font-bold" style={PP}>Outfit Builder</h1>
          <p className="text-muted-foreground text-[10px]">Mix & match your perfect look</p>
        </div>
        <button className="ml-auto bg-secondary border border-border text-foreground text-xs font-semibold px-3 py-1.5 rounded-full">Share</button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Outfit slots */}
          <div className="grid grid-cols-2 gap-3">
            {slots.map(({ label, product: p, color }) => (
              <div key={label} onClick={() => onProduct(p)}
                className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer group hover:border-[#7B61FF]/20 transition-colors">
                <div className="relative aspect-square bg-secondary overflow-hidden">
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-2 left-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}30`, color }}>{label}</span>
                  </div>
                  <button className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <RefreshCw size={11} className="text-white" />
                  </button>
                </div>
                <div className="p-2.5">
                  <p className="text-foreground text-[11px] font-semibold truncate">{p.name}</p>
                  <p className="font-bold text-xs" style={{ color }}>{fmt(p.price)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI suggestion */}
          <div className="bg-gradient-to-r from-[#7B61FF]/12 to-transparent border border-[#7B61FF]/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-[#7B61FF]" />
              <p className="text-foreground text-xs font-semibold">AI suggests pairing with</p>
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-2 w-max">
                {PRODUCTS.filter((p) => ![0, 1, 3, 4].includes(PRODUCTS.indexOf(p))).slice(0, 3).concat(PRODUCTS.slice(0, 2)).map((p) => (
                  <div key={p.id} className="flex-shrink-0" style={{ width: "90px" }}>
                    <div className="rounded-xl overflow-hidden mb-1.5 bg-secondary" style={{ aspectRatio: "1" }}>
                      <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-foreground text-[10px] font-semibold truncate">{p.name}</p>
                    <p className="text-[#7B61FF] text-[10px] font-bold">{fmt(p.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Style Scores */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-foreground font-semibold text-sm mb-3">AI Style Score</p>
            {[
              { label: "Cohesion", score: 92, color: "#7B61FF" },
              { label: "Trendiness", score: 87, color: "#f59e0b" },
              { label: "Versatility", score: 74, color: "#10b981" },
            ].map(({ label, score, color }) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className="text-xs font-bold" style={{ color }}>{score}/100</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 px-4 py-3 bg-background border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <div><p className="text-muted-foreground text-[10px]">Total outfit price</p><p className="text-foreground font-bold text-lg">{fmt(totalPrice)}</p></div>
          <div className="text-right"><p className="text-muted-foreground text-[10px]">You save</p><p className="text-emerald-600 dark:text-emerald-400 font-bold">{fmt(slots.reduce((s, sl) => s + (sl.product.original - sl.product.price), 0))}</p></div>
        </div>
        <button className="w-full bg-[#7B61FF] text-white py-3.5 rounded-2xl font-bold text-sm">Shop Complete Outfit</button>
      </div>
    </div>
  );
}

// ─── WARDROBE ─────────────────────────────────────────────────────────────────

function WardrobeScreen({ onBack, onProduct }: { onBack: () => void; onProduct: (p: Product) => void }) {
  const [filter, setFilter] = useState("All");
  const PRODUCTS = useShopData().products; // live (Convex) with mock fallback
  const cats = ["All", "Tops", "Bottoms", "Shoes", "Outerwear"];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <div>
          <h1 className="text-foreground font-bold" style={PP}>AI Wardrobe</h1>
          <p className="text-muted-foreground text-[10px]">12 items · 4 outfit combinations</p>
        </div>
        <button className="ml-auto w-9 h-9 rounded-full bg-[#7B61FF]/15 border border-[#7B61FF]/30 flex items-center justify-center">
          <Camera size={15} className="text-[#7B61FF]" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Upload CTA */}
          <button className="w-full border-2 border-dashed border-border rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-[#7B61FF]/40 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-[#7B61FF]/15 flex items-center justify-center">
              <Camera size={19} className="text-[#7B61FF]" />
            </div>
            <p className="text-foreground text-sm font-semibold">Upload your clothes</p>
            <p className="text-muted-foreground text-xs text-center">Take photos or import from gallery. AI identifies and organizes automatically.</p>
          </button>

          {/* AI Analysis */}
          <div className="bg-gradient-to-r from-[#7B61FF]/12 to-transparent border border-[#7B61FF]/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-[#7B61FF]" />
              <p className="text-foreground text-xs font-semibold">AI Wardrobe Analysis</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[{ label: "Items", value: "12", color: "text-foreground" }, { label: "Outfits", value: "4", color: "text-[#7B61FF]" }, { label: "Missing", value: "3", color: "text-amber-600 dark:text-amber-400" }].map(({ label, value, color }) => (
                <div key={label} className="bg-black/30 rounded-xl p-2.5 text-center">
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-muted-foreground text-[10px]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
            <div className="flex gap-2 w-max">
              {cats.map((c) => (
                <button key={c} onClick={() => setFilter(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filter === c ? "bg-[#7B61FF] text-white" : "bg-secondary text-muted-foreground border border-border"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Wardrobe grid */}
          <div className="grid grid-cols-3 gap-2">
            {PRODUCTS.map((p) => (
              <div key={p.id} onClick={() => onProduct(p)} className="cursor-pointer group">
                <div className="rounded-xl overflow-hidden bg-secondary relative" style={{ aspectRatio: "3/4" }}>
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-1.5 left-1.5">
                    <span className="text-[9px] text-white font-semibold leading-tight" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{p.name.split(" ")[0]}</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Add slot */}
            <button className="rounded-xl border-2 border-dashed border-border flex items-center justify-center hover:border-[#7B61FF]/30 transition-colors" style={{ aspectRatio: "3/4" }}>
              <Plus size={20} className="text-muted-foreground/70" />
            </button>
          </div>

          {/* Missing items */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award size={14} className="text-amber-600 dark:text-amber-400" />
              <p className="text-foreground text-sm font-semibold">AI says you're missing</p>
            </div>
            {[
              { name: "White minimal sneakers", reason: "Pairs with 8 of your items" },
              { name: "Tailored black trousers", reason: "Complete 3 outfit gaps" },
              { name: "Beige overshirt", reason: "Adds layering versatility" },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Plus size={14} className="text-muted-foreground" /></div>
                <div className="flex-1">
                  <p className="text-foreground text-xs font-semibold">{item.name}</p>
                  <p className="text-muted-foreground text-[10px]">{item.reason}</p>
                </div>
                <button className="text-[#7B61FF] text-xs font-bold">Shop</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RETAILER DASHBOARD ───────────────────────────────────────────────────────

function RetailerDashboard({ onBack }: { onBack: () => void }) {
  const { products: PRODUCTS, revenue: REVENUE_DATA, sizeDemand: SIZE_DEMAND } = useShopData(); // live with mock fallback
  const stats = [
    { label: "Revenue", value: "₹1,44,200", change: "+18%", up: true },
    { label: "Orders", value: "401", change: "+12%", up: true },
    { label: "Returns", value: "23", change: "-4%", up: false },
    { label: "Wishlisted", value: "1,892", change: "+31%", up: true },
  ];

  const insights = [
    { icon: TrendingUp, text: "Size M Shadow Bomber demand up 34% — restock suggested", color: "#7B61FF" },
    { icon: Flame, text: "Flash sale on Hoodies drove 2.3x more orders this week", color: "#f59e0b" },
    { icon: Users, text: "89 users have requested a \"Summer Linen\" collection", color: "#10b981" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><ArrowLeft size={17} className="text-foreground" /></button>
        <div>
          <h1 className="text-foreground font-bold" style={PP}>Retailer Dashboard</h1>
          <p className="text-muted-foreground text-[10px]">Studio Noir · Jan 2025</p>
        </div>
        <button className="ml-auto w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center">
          <Settings size={15} className="text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
                <p className="text-muted-foreground text-[10px] mb-1">{s.label}</p>
                <p className="text-foreground font-bold text-lg" style={PP}>{s.value}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ArrowUpRight size={11} className={s.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-400 rotate-180"} />
                  <span className={`text-[10px] font-semibold ${s.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"}`}>{s.change} this week</span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-foreground font-semibold text-sm">Weekly Revenue</p>
              <span className="text-[#7B61FF] text-xs font-bold">₹1,44,200 total</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={REVENUE_DATA}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7B61FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)", borderRadius: "12px", fontSize: "11px" }}
                  labelStyle={{ color: "#888" }} itemStyle={{ color: "#7B61FF" }} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                <Area type="monotone" dataKey="rev" stroke="#7B61FF" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Size demand */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-foreground font-semibold text-sm mb-3">Size Demand Heatmap</p>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={SIZE_DEMAND} barSize={24}>
                <XAxis dataKey="size" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)", borderRadius: "10px", fontSize: "11px" }}
                  cursor={{ fill: "rgba(123,97,255,0.08)" }} />
                <Bar dataKey="demand" fill="#7B61FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* AI Insights */}
          <div className="space-y-2">
            <p className="text-foreground font-semibold text-sm">AI Insights</p>
            {insights.map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-start gap-3 bg-card border border-border rounded-2xl p-3.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <p className="text-foreground/75 text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Bargaining requests */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-foreground font-semibold text-sm">Bargain Requests</p>
              <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">7 pending</span>
            </div>
            {PRODUCTS.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <img src={p.img} alt={p.name} className="w-10 h-10 rounded-xl object-cover bg-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-semibold truncate">{p.name}</p>
                  <p className="text-muted-foreground text-[10px]">Offered {fmt(Math.round(p.price * 0.88))}</p>
                </div>
                <div className="flex gap-1.5">
                  <button className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Accept</button>
                  <button className="px-2.5 py-1 rounded-lg bg-foreground/[0.04] text-muted-foreground text-[10px] font-bold">Decline</button>
                </div>
              </div>
            ))}
          </div>

          {/* Top selling */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-foreground font-semibold text-sm mb-3">Top Selling Products</p>
            {[
              { name: "Shadow Bomber", units: 89, revenue: 293211, img: PRODUCTS[0].img },
              { name: "Void Hoodie", units: 134, revenue: 254466, img: PRODUCTS[1].img },
              { name: "Obsidian Blazer", units: 41, revenue: 225459, img: PRODUCTS[5].img },
            ].map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <span className="text-muted-foreground/70 text-sm font-bold w-4 text-center">{i + 1}</span>
                <img src={item.img} alt={item.name} className="w-10 h-10 rounded-xl object-cover bg-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-semibold truncate">{item.name}</p>
                  <p className="text-muted-foreground text-[10px]">{item.units} units sold</p>
                </div>
                <p className="text-[#7B61FF] text-xs font-bold">{fmt(item.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const { products: liveProducts } = useShopData(); // live (Convex) with mock fallback
  const auth = useAuth();
  const [appState, setAppState] = useState<AppState>("splash");
  const [screen, setScreen] = useState<Screen>("home");
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product>(PRODUCTS[0]);
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [wishlisted, setWishlisted] = useState<number[]>([1, 3, 4]);
  const [pending, setPending] = useState<{ email: string; code: string } | null>(null);
  const [resendTick, setResendTick] = useState(0);

  // Auto-advance from splash — resume session when one exists
  useEffect(() => {
    if (appState === "splash") {
      const t = setTimeout(() => setAppState(auth.user ? "main" : "onboarding"), 2500);
      return () => clearTimeout(t);
    }
  }, [appState]);

  const isMainScreen = (["home", "discover", "ai", "wishlist", "profile"] as Screen[]).includes(screen);

  const navigate = (s: Screen) => setScreen(s);
  const goBack = () => {
    if (screen === "product") setScreen(activeTab);
    else if (screen === "bargain") setScreen("product");
    else if (screen === "cart") setScreen(activeTab);
    else if (screen === "checkout") setScreen("cart");
    else if (screen === "orders") { setActiveTab("profile"); setScreen("profile"); }
    else setScreen(activeTab);
  };

  const openProduct = (p: Product) => { setSelectedProduct(p); setScreen("product"); };
  const toggleWishlist = (id: number) =>
    setWishlisted((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const addToCart = (p: Product) =>
    setCartItems((prev) => (prev.find((i) => i.id === p.id) ? prev : [...prev, p]));
  const handleTab = (tab: MainTab) => { setActiveTab(tab); setScreen(tab); };

  const showLogin = () => (
    <LoginScreen
      onAuthenticated={() => setAppState("main")}
      onSignupStarted={(email, code) => {
        setPending({ email, code });
        setResendTick(0);
        setAppState("otp");
      }}
      onGuest={() => {
        auth.enterGuest();
        setAppState("main");
      }}
    />
  );

  const renderContent = () => {
    // Auth flow
    if (appState === "splash") return <SplashScreen />;
    if (appState === "onboarding") return <OnboardingScreen onDone={() => setAppState("login")} />;
    if (appState === "login") return showLogin();
    if (appState === "otp") {
      if (!pending) return showLogin();
      return (
        <OTPScreen
          key={pending.email}
          email={pending.email}
          demoCode={pending.code}
          resendTick={resendTick}
          onVerified={() => setAppState("main")}
          onBack={() => setAppState("login")}
          onResend={async () => {
            const { demoCode } = await auth.resendOtp(pending.email);
            setPending({ email: pending.email, code: demoCode });
            setResendTick((t) => t + 1);
            return demoCode;
          }}
        />
      );
    }

    // Main app screens
    switch (screen) {
      case "home": return <HomeScreen onProduct={openProduct} wishlisted={wishlisted} onWishlist={toggleWishlist} cartCount={cartItems.length} onCart={() => navigate("cart")} onNav={navigate} userName={auth.user?.name ?? "Guest"} />;
      case "discover": return <DiscoverScreen onProduct={openProduct} wishlisted={wishlisted} onWishlist={toggleWishlist} />;
      case "ai": return <AIScreen />;
      case "wishlist": return <WishlistScreen products={liveProducts.filter((p) => wishlisted.includes(p.id))} onProduct={openProduct} onRemove={toggleWishlist} />;
      case "profile": return <ProfileScreen onNav={navigate} user={auth.user ?? { name: "Guest", email: "", guest: true }} onSignOut={() => { auth.signOut(); setActiveTab("home"); setScreen("home"); setAppState("login"); }} />;
      case "product": return <ProductDetailScreen p={selectedProduct} onBack={goBack} wishlisted={wishlisted.includes(selectedProduct.id)} onWishlist={() => toggleWishlist(selectedProduct.id)} onAddToCart={() => addToCart(selectedProduct)} onBargain={() => navigate("bargain")} onCustomSize={() => navigate("custom-size")} cartCount={cartItems.length} onCart={() => navigate("cart")} />;
      case "bargain": return <BargainingScreen p={selectedProduct} onBack={goBack} />;
      case "cart": return <CartScreen items={cartItems} onBack={goBack} onCheckout={() => navigate("checkout")} onRemove={(id) => setCartItems((prev) => prev.filter((i) => i.id !== id))} />;
      case "checkout": return <CheckoutScreen onBack={goBack} onSuccess={() => { setCartItems([]); navigate("orders"); }} userName={auth.user?.name ?? "Guest"} />;
      case "orders": return <OrdersScreen onBack={goBack} />;
      case "notifications": return <NotificationsScreen onBack={goBack} />;
      case "custom-size": return <CustomSizeScreen onBack={goBack} />;
      case "community": return <CommunityScreen onBack={goBack} />;
      case "outfit-builder": return <OutfitBuilderScreen onBack={goBack} onProduct={openProduct} />;
      case "wardrobe": return <WardrobeScreen onBack={goBack} onProduct={openProduct} />;
      case "retailer": return <RetailerDashboard onBack={goBack} />;
      default: return null;
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>

      {/* Bottom Nav — only in main app, main tabs */}
        {appState === "main" && isMainScreen && (
          <div className="flex-shrink-0 flex items-center justify-around px-4 pt-2 pb-1 bg-background/95 backdrop-blur-xl border-t border-border">
            {(([
              { id: "home", Icon: Home, label: "Home" },
              { id: "discover", Icon: Compass, label: "Discover" },
              { id: "ai", Icon: Sparkles, label: "AI" },
              { id: "wishlist", Icon: Heart, label: "Wishlist" },
              { id: "profile", Icon: User, label: "Profile" },
            ]) as { id: MainTab; Icon: typeof Home; label: string }[]).map(({ id, Icon, label }) => (
              <button key={id} onClick={() => handleTab(id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${activeTab === id ? "text-[#7B61FF]" : "text-muted-foreground/70"}`}>
                {id === "ai" ? (
                  <div className={`w-10 h-10 rounded-[16px] flex items-center justify-center transition-all ${activeTab === "ai" ? "bg-[#7B61FF] shadow-lg shadow-[#7B61FF]/40" : "bg-secondary border border-border"}`}>
                    <Icon size={17} className={activeTab === "ai" ? "text-white" : "text-muted-foreground"} />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Icon size={19} strokeWidth={activeTab === id ? 2.5 : 1.5} />
                      {id === "wishlist" && wishlisted.length > 0 && (
                        <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-[#7B61FF] rounded-full flex items-center justify-center border border-background">
                          <span className="text-[7px] text-white font-bold">{wishlisted.length}</span>
                        </div>
                      )}
                      {id === "home" && cartItems.length > 0 && (
                        <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center border border-background">
                          <span className="text-[7px] text-white font-bold">{cartItems.length}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-medium">{label}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
