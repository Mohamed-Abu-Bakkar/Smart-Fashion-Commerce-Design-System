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
  Sun, Moon, Monitor, Wallet, Banknote,
  MoveVertical, MoveHorizontal, ArrowRight, Circle, NotebookPen,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, BarChart, Bar,
} from "recharts";

// â”€â”€â”€ DATA (Convex-backed; local mock fallback until VITE_CONVEX_URL is set) â”€â”€â”€â”€
import {
  FALLBACK_PRODUCTS as PRODUCTS,
  FALLBACK_REVENUE as REVENUE_DATA,
  FALLBACK_SIZES as SIZE_DEMAND,
  FALLBACK_REVIEWS,
  useShopData,
  useWishlist,
  useVotes,
  type Product,
  type ProductReview,
} from "./data";
import { useAuth, authErrorMessage, initialsOf, type SessionUser } from "./auth";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCommerce, type CartLine } from "./commerce";
type AppState = "splash" | "onboarding" | "login" | "otp" | "main";
type MainTab = "home" | "discover" | "ai" | "wishlist" | "profile";
type ¶»§q«^