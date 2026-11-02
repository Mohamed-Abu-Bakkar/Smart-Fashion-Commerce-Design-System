import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "./auth";
import { useShopData, type Product } from "./data";

export type CartLine = {
  key: string;
  cartItemId?: Id<"cartItems">;
  productId: number;
  product: Product;
  quantity: number;
  size: string;
  color: string;
  unitPrice: number;
};

const GUEST_CART_KEY = "sf-guest-cart-v1";
const GUEST_CART_MIGRATION_KEY = "sf-guest-cart-migration-v1";
function getGuestCartMigrationId() {
  try {
    let id = localStorage.getItem(GUEST_CART_MIGRATION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_CART_MIGRATION_KEY, id);
    }
    return id;
  } catch {
    return "guest-cart-" + Date.now().toString(36);
  }
}
function loadGuestCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) as CartLine[] : [];
  } catch {
    return [];
  }
}

export function useCommerce() {
  const { user } = useAuth();
  const email = user && !user.guest ? user.email.trim().toLowerCase() : null;
  const sessionToken = user && !user.guest ? user.sessionToken ?? null : null;
  const products = useShopData().products;
  const cloudCart = useQuery(api.commerce.cartForUser, sessionToken ? { sessionToken } : "skip");
  const cloudOrders = useQuery(ap¶»§q«^