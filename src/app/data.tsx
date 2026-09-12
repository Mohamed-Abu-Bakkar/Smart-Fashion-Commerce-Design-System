import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { Tag, Package, Sparkles, Users, type LucideIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./auth";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type Product = {
  id: number;
  name: string;
  brand: string;
  price: number;
  original: number;
  discount: number;
  rating: number;
  reviews: number;
  img: string;
  category: string;
  colors: string[];
  sizes: string[];
  isNew: boolean;
  isTrending: boolean;
  material: string;
  desc: string;
};

export type RevenueRow = { day: string; rev: number; orders: number; sort: number };
export type SizeRow = { size: string; demand: number; sort: number };

export type CollectionRequest = {
  id: number;
  title: string;
  category: string;
  votes: number;
  interested: number;
  status: string;
  img: string;
  creator: string;
};

export type VotingCard = {
  id: number;
  designer: string;
  title: string;
  likes: number;
  comments: number;
  launch: string;
  img: string;
  progress: number;
};

export type NotificationItem = {
  title: string;
  sub: string;
  time: string;
  unread: boolean;
};

export type ProductReview = {
  author: string;
  rating: number;
  date: string;
  text: string;
  avatar: string;
};

export type NotificationGroup = {
  title: string;
  color: string;
  icon: LucideIcon;
  items: NotificationItem[];
};

// ─── FALLBACK DATA (original mock data — used until Convex is configured) ────

export const FALLBACK_PRODUCTS: Product[] = [
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
    img: "https://bifocalmedia.com/app/uploads/2024/11/Void-DC-Hoodie-Walsby-front.jpg?w=400&h=520&fit=crop&auto=format",
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

export const FALLBACK_REVENUE: RevenueRow[] = [
  { day: "Mon", rev: 12400, orders: 34, sort: 0 },
  { day: "Tue", rev: 18200, orders: 51, sort: 1 },
  { day: "Wed", rev: 9800, orders: 28, sort: 2 },
  { day: "Thu", rev: 24600, orders: 67, sort: 3 },
  { day: "Fri", rev: 31200, orders: 89, sort: 4 },
  { day: "Sat", rev: 28900, orders: 78, sort: 5 },
  { day: "Sun", rev: 19700, orders: 54, sort: 6 },
];

export const FALLBACK_SIZES: SizeRow[] = [
  { size: "XS", demand: 18, sort: 0 },
  { size: "S", demand: 34, sort: 1 },
  { size: "M", demand: 58, sort: 2 },
  { size: "L", demand: 47, sort: 3 },
  { size: "XL", demand: 29, sort: 4 },
  { size: "XXL", demand: 12, sort: 5 },
];

export const FALLBACK_REQUESTS: CollectionRequest[] = [
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

export const FALLBACK_VOTING: VotingCard[] = [
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

export const FALLBACK_NOTIFICATIONS: NotificationGroup[] = [  {
    title: "Price Alerts", color: "#f59e0b", icon: Tag,
    items: [
      { title: "Shadow Bomber dropped 8%", sub: "Now ₹3,299 · Was ₹3,599", time: "2h ago", unread: true },
      { title: "Void Hoodie back in stock", sub: "Size M · Limited units", time: "5h ago", unread: true },
    ],
  },
  {
    title: "Order Updates", color: "#10b981", icon: Package,
    items: [
      { title: "Your order is packed", sub: "#SFC-2025-7841 · Out for delivery tomorrow", time: "Yesterday", unread: false },
      { title: "Order delivered!", sub: "#SFC-2025-7823 · Tap to rate", time: "Jan 10", unread: false },
    ],
  },
  {
    title: "AI Suggestions", color: "#7B61FF", icon: Sparkles,
    items: [
      { title: "New drops match your aesthetic", sub: "12 products added to your feed", time: "3h ago", unread: true },
      { title: "Flash sale starting in 2h", sub: "Items on your wishlist are 30% off", time: "4h ago", unread: false },
    ],
  },
  {
    title: "Community", color: "#ec4899", icon: Users,
    items: [
      { title: "Your collection request got 50 votes!", sub: '"Dark Academia SS25" is trending', time: "1d ago", unread: false },
      { title: "Riya S. voted on your pick", sub: "Phantom Runner · Community top pick", time: "2d ago", unread: false },
    ],
  },
];

export const FALLBACK_REVIEWS: ProductReview[] = [
  { author: "Riya S.", rating: 5, date: "Jan 10", text: "Absolutely stunning quality. The fit is perfect and the fabric feels premium.", avatar: "RS" },
  { author: "Arjun K.", rating: 4, date: "Jan 7", text: "Great product, slightly oversized but that's the aesthetic. Highly recommend.", avatar: "AK" },
  { author: "Priya M.", rating: 5, date: "Dec 29", text: "Worth every rupee. The dark colorway is exactly as shown in photos.", avatar: "PM" },
];

// ─── SHOP DATA CONTEXT ───────────────────────────────────────────────────────
export type ShopData = {
  products: Product[];
  revenue: RevenueRow[];
  sizeDemand: SizeRow[];
  collectionRequests: CollectionRequest[];
  votingCards: VotingCard[];
  notificationGroups: NotificationGroup[];
  /** true when served from Convex instead of local fallback */
  live: boolean;
};

const NOTIF_ICONS: Record<string, LucideIcon> = {
  tag: Tag,
  package: Package,
  sparkles: Sparkles,
  users: Users,
};

export function groupNotifications(
  flat: { group: string; color: string; icon: string; title: string; sub: string; time: string; unread: boolean }[],
): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const n of flat) {
    let g = groups.find((x) => x.title === n.group);
    if (!g) {
      g = { title: n.group, color: n.color, icon: NOTIF_ICONS[n.icon] ?? Tag, items: [] };
      groups.push(g);
    }
    g.items.push({ title: n.title, sub: n.sub, time: n.time, unread: n.unread });
  }
  return groups;
}

const FALLBACK_DATA: ShopData = {
  products: FALLBACK_PRODUCTS,
  revenue: FALLBACK_REVENUE,
  sizeDemand: FALLBACK_SIZES,
  collectionRequests: FALLBACK_REQUESTS,
  votingCards: FALLBACK_VOTING,
  notificationGroups: FALLBACK_NOTIFICATIONS,
  live: false,
};

const ShopDataContext = createContext<ShopData>(FALLBACK_DATA);

function LiveShopData({ children, live }: { children: ReactNode; live: boolean }) {
  const skip = live ? undefined : ("skip" as const);
  const products = useQuery(api.shop.listProducts, skip as any) ?? FALLBACK_PRODUCTS;
  const revenue = useQuery(api.shop.revenueWeekly, skip as any) ?? FALLBACK_REVENUE;
  const sizeDemand = useQuery(api.shop.sizeDemand, skip as any) ?? FALLBACK_SIZES;
  const collectionRequests = useQuery(api.shop.collectionRequests, skip as any) ?? FALLBACK_REQUESTS;
  const votingCards = useQuery(api.shop.votingCards, skip as any) ?? FALLBACK_VOTING;
  const flatNotifs = useQuery(api.shop.notifications, skip as any);

  const value = useMemo<ShopData>(
    () => ({
      products,
      revenue,
      sizeDemand,
      collectionRequests,
      votingCards,
      notificationGroups: flatNotifs ? groupNotifications(flatNotifs) : FALLBACK_NOTIFICATIONS,
      live,
    }),
    [products, revenue, sizeDemand, collectionRequests, votingCards, flatNotifs, live],
  );

  return <ShopDataContext.Provider value={value}>{children}</ShopDataContext.Provider>;
}

export function ShopDataProvider({ children }: { children: ReactNode }) {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
  // Always provide a client so hooks are safe; queries are skipped when unconfigured
  // and the UI falls back to local mock data.
  const client = useMemo(
    () => new ConvexReactClient(url ?? "https://placeholder.convex.cloud"),
    [url],
  );
  return (
    <ConvexProvider client={client}>
      <LiveShopData live={!!url}>{children}</LiveShopData>
    </ConvexProvider>
  );
}

export function useShopData(): ShopData {
  return useContext(ShopDataContext);
}

const GUEST_WISHLIST = [1, 3, 4];

/** Per-user wishlist ids. Guests get local-only state; signed-in users get live DB rows. */
export function useWishlist() {
  const { user } = useAuth();
  const email = user && !user.guest ? user.email : null;
  const liveIds = useQuery(api.shop.wishlistIds, email ? { userEmail: email } : "skip");
  const toggleLive = useMutation(api.shop.toggleWishlist);
  const [guestIds, setGuestIds] = useState<number[]>(GUEST_WISHLIST);

  const toggleGuest = useCallback((id: number) => {
    setGuestIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const toggle = useCallback(
    (id: number) => {
      if (!email) {
        toggleGuest(id);
        return Promise.resolve({ wishlisted: !guestIds.includes(id) });
      }
      return toggleLive({ userEmail: email, productId: id });
    },
    [email, toggleLive, toggleGuest, guestIds],
  );

  return useMemo(
    () => ({ ids: email ? (liveIds ?? []) : guestIds, toggle, live: !!email }),
    [email, liveIds, guestIds, toggle],
  );
}

/** Per-user community votes & card likes. Guests get local-only state. */
export function useVotes() {
  const { user } = useAuth();
  const email = user && !user.guest ? user.email : null;
  const liveLiked = useQuery(api.shop.likedCardIds, email ? { userEmail: email } : "skip");
  const liveVoted = useQuery(api.shop.votedRequestIds, email ? { userEmail: email } : "skip");
  const toggleLikeLive = useMutation(api.shop.toggleCardLike);
  const toggleVoteLive = useMutation(api.shop.toggleRequestVote);
  const [guestLiked, setGuestLiked] = useState<number[]>([]);
  const [guestVoted, setGuestVoted] = useState<number[]>([]);

  const toggleCardLike = useCallback(
    (cardId: number) => {
      if (!email) {
        setGuestLiked((prev) => (prev.includes(cardId) ? prev.filter((i) => i !== cardId) : [...prev, cardId]));
        return Promise.resolve({ liked: !guestLiked.includes(cardId) });
      }
      return toggleLikeLive({ userEmail: email, cardId });
    },
    [email, toggleLikeLive, guestLiked],
  );

  const toggleRequestVote = useCallback(
    (requestId: number) => {
      if (!email) {
        setGuestVoted((prev) => (prev.includes(requestId) ? prev.filter((i) => i !== requestId) : [...prev, requestId]));
        return Promise.resolve({ voted: !guestVoted.includes(requestId) });
      }
      return toggleVoteLive({ userEmail: email, requestId });
    },
    [email, toggleVoteLive, guestVoted],
  );

  return useMemo(
    () => ({
      likedCards: email ? (liveLiked ?? []) : guestLiked,
      votedRequests: email ? (liveVoted ?? []) : guestVoted,
      toggleCardLike,
      toggleRequestVote,
      live: !!email,
    }),
    [email, liveLiked, liveVoted, guestLiked, guestVoted, toggleCardLike, toggleRequestVote],
  );
}
