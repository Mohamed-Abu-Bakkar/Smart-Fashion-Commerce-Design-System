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

export type ShippingAddress = {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
};

const CART_KEY = "sf-guest-cart-v1";
const MIGRATION_KEY = "sf-guest-cart-migration-v1";

type GuestLine = Omit<CartLine, "cartItemId">;

function loadGuestCart(): GuestLine[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as GuestLine[];
  } catch {
    return [];
  }
}

function getMigrationId() {
  try {
    let value = localStorage.getItem(MIGRATION_KEY);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(MIGRATION_KEY, value);
    }
    return value;
  } catch {
    return "sf-cart-" + Date.now().toString(36);
  }
}

export function useCommerce() {
  const { user } = useAuth();
  const sessionToken = user && !user.guest ? user.sessionToken ?? null : null;
  const products = useShopData().products;

  const cloudCart = useQuery(api.commerce.cartForUser, sessionToken ? { sessionToken } : "skip");
  const cloudOrders = useQuery(api.commerce.ordersForUser, sessionToken ? { sessionToken } : "skip");

  const addCloud = useMutation(api.commerce.addCartItem);
  const removeCloud = useMutation(api.commerce.removeCartItem);
  const updateCloud = useMutation(api.commerce.updateCartQuantity);
  const mergeCloud = useMutation(api.commerce.mergeGuestCart);
  const createOrderCloud = useMutation(api.commerce.createOrderFromCart);

  const [guestCart, setGuestCart] = useState<GuestLine[]>(loadGuestCart);

  useEffect(() => {
    if (!sessionToken) {
      try { localStorage.setItem(CART_KEY, JSON.stringify(guestCart)); } catch { /* storage unavailable */ }
      return;
    }
    if (!guestCart.length) return;

    const migrationId = getMigrationId();
    void mergeCloud({
      sessionToken,
      migrationId,
      lines: guestCart.map(({ productId, quantity, size, color }) => ({ productId, quantity, size, color })),
    }).then(() => {
      setGuestCart([]);
      try {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(MIGRATION_KEY);
      } catch { /* storage unavailable */ }
    }).catch(() => {
      // Retain the guest cart locally until a retry can succeed.
    });
  }, [sessionToken, guestCart, mergeCloud]);

  const cart = useMemo<CartLine[]>(() => {
    if (sessionToken) {
      return (cloudCart ?? []).flatMap((row: any) => {
        if (!row.product) return [];
        return [{
          key: String(row._id),
          cartItemId: row._id as Id<"cartItems">,
          productId: row.productId,
          product: row.product as Product,
          quantity: row.quantity,
          size: row.size,
          color: row.color,
          unitPrice: row.negotiatedPrice ?? row.product.price,
        }];
      });
    }
    return guestCart.flatMap((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) return [];
      return [{ ...line, product, unitPrice: line.unitPrice ?? product.price }];
    });
  }, [sessionToken, cloudCart, guestCart, products]);

  const addToCart = useCallback(async (
    product: Product,
    quantity = 1,
    size = product.sizes[0] ?? "M",
    color = product.colors[0] ?? "Default",
    negotiatedPrice?: number,
  ) => {
    if (sessionToken) {
      await addCloud({
        sessionToken, productId: product.id, quantity, size, color,
        ...(negotiatedPrice === undefined ? {} : { negotiatedPrice }),
      });
      return;
    }
    const key = String(product.id) + ":" + size + ":" + color;
    setGuestCart((previous) => {
      const match = previous.find((line) => line.key === key);
      if (match) {
        return previous.map((line) => line.key === key
          ? { ...line, quantity: Math.min(20, line.quantity + quantity), unitPrice: negotiatedPrice ?? product.price }
          : line);
      }
      return [...previous, {
        key, productId: product.id, product, quantity, size, color,
        unitPrice: negotiatedPrice ?? product.price,
      }];
    });
  }, [sessionToken, addCloud]);

  const removeFromCart = useCallback(async (line: CartLine) => {
    if (sessionToken && line.cartItemId) {
      await removeCloud({ sessionToken, cartItemId: line.cartItemId });
    } else {
      setGuestCart((previous) => previous.filter((item) => item.key !== line.key));
    }
  }, [sessionToken, removeCloud]);

  const setQuantity = useCallback(async (line: CartLine, quantity: number) => {
    if (sessionToken && line.cartItemId) {
      await updateCloud({ sessionToken, cartItemId: line.cartItemId, quantity });
    } else {
      setGuestCart((previous) => quantity <= 0
        ? previous.filter((item) => item.key !== line.key)
        : previous.map((item) => item.key === line.key ? { ...item, quantity: Math.min(20, quantity) } : item));
    }
  }, [sessionToken, updateCloud]);

  const placeOrder = useCallback(async (shippingAddress: ShippingAddress, paymentMethod: "upi" | "cod") => {
    if (!sessionToken) throw new Error("Sign in to save an order and sync it across devices.");
    if (!cart.length) throw new Error("Your cart is empty.");
    return await createOrderCloud({ sessionToken, shippingAddress, paymentMethod });
  }, [sessionToken, cart.length, createOrderCloud]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return {
    sessionToken,
    cart,
    cartCount: cart.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    shippingFee: subtotal >= 2000 || subtotal === 0 ? 0 : 99,
    orders: sessionToken ? cloudOrders ?? [] : [],
    addToCart,
    removeFromCart,
    setQuantity,
    placeOrder,
  };
}
