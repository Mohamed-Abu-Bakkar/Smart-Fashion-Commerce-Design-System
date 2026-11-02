import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  priceHistory?: { month: string; price: number }[];
  stock?: number;
  tags?: string[];
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
���q�^