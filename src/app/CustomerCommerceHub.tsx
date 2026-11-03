import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./auth";
import { useShopData, useWishlist, type Product } from "./data";
import type { CartLine, ShippingAddress } from "./useCommerce";

type Section =
  | "overview" | "cart" | "checkout" | "bargain" | "preorder" | "orders" | "wishlist"
  | "notifications" | "community" | "outfits" | "wardrobe" | "events" | "assistant";

type Commerce = {
  sessionToken: string | null;
  cart: CartLine[];
  cartCount: number;
  subtotal: number;
  shippingFee: number;
  orders: any[];
  addToCart: (product: Product, quantity?: number, size?: string, color?: string, negotiatedPrice?: number) => Promise<void>;
  removeFromCart: (line: CartLine) => Promise<void>;
  setQuantity: (line: CartLine, quantity: number) => Promise<void>;
  placeOrder: (address: ShippingAddress, method: "upi" | "cod") => Promise<any>;
};

const currency = (value: number) => "₹" + value.toLocaleString("en-IN");
const sections: { id: Section; title: string; detail: string }[] = [
  { id: "cart", title: "Cart & checkout", detail: "Variants, quantities and saved orders" },
  { id: "bargain", title: "Smart bargaining", detail: "Offer, counter and accept" },
  { id: "preorder", title: "Custom-size pre-order", detail: "Standard sizes or measurements" },
  { id: "orders", title: "My orders", detail: "Order history and payment status" },
  { id: "wishlist", title: "Wishlist alerts", detail: "Price, discount and stock changes" },
  { id: "notifications", title: "Notifications", detail: "Personal activity and alerts" },
  { id: "community", title: "Fashion community", detail: "Request collections and vote" },
  { id: "outfits", title: "Outfit builder", detail: "Save combinations" },
  { id: "wardrobe", title: "Virtual wardrobe", detail: "Upload and manage clothing photos" },
  { id: "events", title: "Event shopping", detail: "Build lists within a budget" },
  { id: "assistant", title: "Shopping assistant", detail: "Catalog recommendations and saved chat" },
];

export function CustomerCommerceHub({
  initialSection = "overview",
  selectedProduct,
  commerce,
  onBack,
  onProduct,
}: {
  initialSection?: Section;
  selectedProduct: Product;
  commerce: Commerce;
  onBack: () => void;
  onProduct: (product: Product) => void;
}) {
  const { user } = useAuth();
  const token = commerce.sessionToken;
  const { products, collectionRequests: fallbackRequests, votingCards: fallbackCards } = useShopData();
  const wishlist = useWishlist();

  const [section, setSection] = useState<Section>(initialSection);
  const [productId, setProductId] = useState(selectedProduct.id);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSection(initialSection); }, [initialSection]);
  useEffect(() => { if (selectedProduct?.id) setProductId(selectedProduct.id); }, [selectedProduct?.id]);

  const product = products.find((item) => item.id === productId) ?? selectedProduct ?? products[0];

  const orders = commerce.orders;
  const notifications = useQuery(api.commerce.notificationsForUser, token ? { sessionToken: token } : "skip");
  const preOrders = useQuery(api.commerce.preOrdersForUser, token ? { sessionToken: token } : "skip");
  const bargains = useQuery(api.commerce.bargainsForUser, token ? { sessionToken: token } : "skip");
  const outfits = useQuery(api.commerce.savedOutfitsForUser, token ? { sessionToken: token } : "skip");
  const wardrobe = useQuery(api.commerce.wardrobeForUser, token ? { sessionToken: token } : "skip");
  const eventLists = useQuery(api.commerce.eventListsForUser, token ? { sessionToken: token } : "skip");
  const chatHistory = useQuery(api.commerce.chatHistory, token ? { sessionToken: token } : "skip");
  const communityRequests = useQuery(api.shop.collectionRequests, {});
  const designCards = useQuery(api.shop.votingCards, {});

  const submitBargain = useMutation(api.commerce.submitBargainOffer);
  const replyBargain = useMutation(api.commerce.replyToBargain);
  const createPreOrder = useMutation(api.commerce.createPreOrder);
  const setWishlistAlerts = useMutation(api.commerce.setWishlistAlerts);
  const getWishlistAlertSettings = useQuery(api.commerce.wishlistAlertSettings, token ? { sessionToken: token } : "skip");
  const refreshWishlistAlerts = useMutation(api.commerce.refreshWishlistAlerts);
  const markRead = useMutation(api.commerce.markNotificationRead);
  const markAllRead = useMutation(api.commerce.markAllNotificationsRead);
  const createRequest = useMutation(api.commerce.createCollectionRequest);
  const toggleCommunityVote = useMutation(api.commerce.toggleCommunityVote);
  const voteDesign = useMutation(api.commerce.voteDesign);
  const saveOutfit = useMutation(api.commerce.saveOutfit);
  const saveEventList = useMutation(api.commerce.saveEventShoppingList);
  const appendChat = useMutation(api.commerce.appendChatMessage);
  const uploadUrl = useMutation(api.commerce.generateWardrobeUploadUrl);
  const saveWardrobeItem = useMutation(api.commerce.saveWardrobeItem);
  const deleteWardrobeItem = useMutation(api.commerce.deleteWardrobeItem);

  const [offer, setOffer] = useState("");
  const [counterOffer, setCounterOffer] = useState("");
  const [activeBargain, setActiveBargain] = useState<any>(null);
  const [size, setSize] = useState(selectedProduct.sizes?.[0] ?? "M");
  const [color, setColor] = useState(selectedProduct.colors?.[0] ?? "Default");
  const [customSize, setCustomSize] = useState(false);
  const [measurements, setMeasurements] = useState({ height: "170", chest: "92", waist: "78", shoulder: "42", sleeve: "60" });
  const [preOrderNotes, setPreOrderNotes] = useState("");
  const [address, setAddress] = useState<ShippingAddress>({ name: user?.name ?? "", phone: "", line1: "", city: "", state: "", postalCode: "" });
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "cod">("upi");
  const [communityTitle, setCommunityTitle] = useState("");
  const [communityCategory, setCommunityCategory] = useState("Casual");
  const [communityDetails, setCommunityDetails] = useState("");
  const [outfitName, setOutfitName] = useState("My outfit");
  const [outfitIds, setOutfitIds] = useState<number[]>([]);
  const [eventName, setEventName] = useState("Wedding");
  const [eventBudget, setEventBudget] = useState("5000");
  const [eventIds, setEventIds] = useState<number[]>([]);
  const [wardrobeCategory, setWardrobeCategory] = useState("Tops");
  const [wardrobeLabel, setWardrobeLabel] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [guestMessages, setGuestMessages] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("sf-guest-chat-v1") ?? "[]"); } catch { return []; }
  });

  const showError = (value: unknown) => setError(value instanceof Error ? value.message : "Something went wrong. Please try again.");
  const requireCloud = () => {
    if (!token) {
      setError("Sign in with a verified account while the Convex backend is configured to save this feature across devices.");
      return false;
    }
    return true;
  };
  const run = async (action: () => Promise<any>, success?: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await action();
      if (success) setNotice(success);
      return result;
    } catch (e) { showError(e); return null; }
    finally { setBusy(false); }
  };

  const alertSettings = new Map((getWishlistAlertSettings ?? []).map((item: any) => [item.productId, item.enabled]));
  const wishlistProducts = products.filter((item) => wishlist.ids.includes(item.id));
  const savedMessages = chatHistory?.messages ?? [];
  const messages = token ? savedMessages : guestMessages;

  const wishlistAlert = async (id: number, enabled: boolean) => {
    if (!requireCloud()) return;
    await run(() => setWishlistAlerts({ sessionToken: token!, productId: id, enabled }), enabled ? "Wishlist alert enabled." : "Wishlist alert paused.");
  };

  const submitOffer = async () => {
    if (!requireCloud()) return;
    const amount = Number(offer);
    const result = await run(() => submitBargain({
      sessionToken: token!, productId: product.id, offer: amount, size, color,
    }));
    if (result) {
      setActiveBargain({ _id: result.bargainId, status: result.status, counterOffer: result.counterOffer });
      setNotice(result.status === "accepted" ? "Offer accepted. The negotiated item has been added to your cart." : "Offer saved. A demo seller counter-offer is shown below.");
    }
  };

  const respondToOffer = async (action: "accept" | "counter" | "reject") => {
    if (!requireCloud() || !activeBargain?._id) return;
    const result = await run(() => replyBargain({
      sessionToken: token!, bargainId: activeBargain._id, action,
      ...(action === "counter" ? { counterOffer: Number(counterOffer) } : {}),
      size, color,
    }));
    if (result) setActiveBargain({ ...activeBargain, status: result.status, counterOffer: result.agreedPrice ?? result.counterOffer ?? activeBargain.counterOffer });
  };

  const submitPreOrder = async () => {
    if (!requireCloud()) return;
    await run(() => createPreOrder({
      sessionToken: token!, productId: product.id, size, quantity: 1, notes: preOrderNotes,
      ...(customSize ? { customMeasurements: {
        height: Number(measurements.height), chest: Number(measurements.chest), waist: Number(measurements.waist),
        shoulder: Number(measurements.shoulder), sleeve: Number(measurements.sleeve),
      } } : {}),
    }), "Pre-order request saved. Retailer confirmation is still required; no payment was taken.");
    setPreOrderNotes("");
  };

  const checkout = async () => {
    if (!requireCloud()) return;
    const result = await run(() => commerce.placeOrder(address, paymentMethod), "Order saved. Payment remains pending until a provider or delivery collection confirms it.");
    if (result) setSection("orders");
  };

  const submitCommunityRequest = async () => {
    if (!requireCloud()) return;
    await run(() => createRequest({ sessionToken: token!, title: communityTitle, category: communityCategory, details: communityDetails }), "Collection request recorded.");
    setCommunityTitle(""); setCommunityDetails("");
  };

  const toggleOutfit = (id: number) => setOutfitIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const saveCurrentOutfit = async () => {
    if (!requireCloud()) return;
    await run(() => saveOutfit({ sessionToken: token!, name: outfitName, productIds: outfitIds }), "Outfit saved to your account.");
  };

  const eventRecommendations = useMemo(() => {
    const limit = Number(eventBudget);
    const groups: Record<string, string[]> = {
      Wedding: ["formal", "dress", "footwear", "outerwear"],
      College: ["casual", "hoodie", "t-shirt", "footwear"],
      Office: ["formal", "outerwear", "footwear"],
      Gym: ["footwear", "t-shirt", "hoodie"],
      Vacation: ["casual", "dress", "footwear"],
      Party: ["dress", "formal", "footwear"],
    };
    const selected = groups[eventName] ?? ["casual"];
    let total = 0;
    const result: Product[] = [];
    for (const item of products.filter((p) => selected.some((word) => p.category.toLowerCase().includes(word))).sort((a, b) => b.rating - a.rating)) {
      if (result.length >= 6) break;
      if (total + item.price <= limit) { result.push(item); total += item.price; }
    }
    return result;
  }, [products, eventBudget, eventName]);

  const saveEvent = async () => {
    if (!requireCloud()) return;
    await run(() => saveEventList({ sessionToken: token!, event: eventName, budget: Number(eventBudget), productIds: eventIds }), "Event shopping list saved.");
  };

  const uploadWardrobe = async (file?: File) => {
    if (!file) return;
    if (!requireCloud()) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const upload = await uploadUrl({ sessionToken: token! });
      const response = await fetch(upload, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Wardrobe image upload failed.");
      const saved = await response.json();
      await saveWardrobeItem({ sessionToken: token!, storageId: saved.storageId, category: wardrobeCategory, label: wardrobeLabel.trim() || file.name });
      setWardrobeLabel(""); setNotice("Wardrobe photo saved.");
    } catch (e) { showError(e); }
    finally { setBusy(false); }
  };

  const recommendationsFor = (text: string) => {
    const lower = text.toLowerCase();
    let terms = ["casual", "hoodie", "t-shirt"];
    if (/wedding|formal|office|interview/.test(lower)) terms = ["formal", "dress", "footwear", "outerwear"];
    else if (/gym|workout|running/.test(lower)) terms = ["footwear", "t-shirt", "hoodie"];
    else if (/beach|vacation|trip|holiday/.test(lower)) terms = ["casual", "dress", "footwear"];
    else if (/party|night/.test(lower)) terms = ["dress", "formal", "footwear"];
    const budgetMatch = lower.match(/(?:under|below|within|budget of)\s*₹?\s*([\d,]+)/);
    const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : Number.POSITIVE_INFINITY;
    let sum = 0;
    return products.filter((p) => terms.some((term) => p.category.toLowerCase().includes(term)))
      .sort((a, b) => b.rating - a.rating)
      .filter((p) => {
        if (sum + p.price > budget) return false;
        sum += p.price;
        return true;
      }).slice(0, 5);
  };

  const sendChat = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setChatInput("");
    const matches = recommendationsFor(text);
    const ids = matches.map((item) => item.id);
    const total = matches.reduce((sum, item) => sum + item.price, 0);
    const answer = matches.length
      ? "I found " + matches.length + " catalog matches. Estimated listed total: " + currency(total) + ". This is a rules-based catalog recommendation, not a connected LLM or live-stock prediction."
      : "I couldn't find a match in the current catalog for that budget. Try a wider style or higher budget.";
    if (token) {
      await run(async () => {
        await appendChat({ sessionToken: token, role: "user", text });
        await appendChat({ sessionToken: token, role: "assistant", text: answer, productIds: ids });
      });
    } else {
      const next = [...guestMessages, { role: "user", text, createdAt: Date.now() }, { role: "assistant", text: answer, productIds: ids, createdAt: Date.now() }];
      setGuestMessages(next);
      try { localStorage.setItem("sf-guest-chat-v1", JSON.stringify(next)); } catch { /* storage unavailable */ }
    }
  };

  const nav = (id: Section) => { setSection(id); setError(""); setNotice(""); };

  const productPicker = (
    <select value={productId} onChange={(event) => {
      const next = products.find((item) => item.id === Number(event.target.value));
      if (next) { setProductId(next.id); setSize(next.sizes[0] ?? "M"); setColor(next.colors[0] ?? "Default"); }
    }} className="w-full bg-secondary border border-border rounded-xl px-3 py-3 text-foreground text-sm">
      {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {currency(item.price)}</option>)}
    </select>
  );

  const productGrid = (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {products.map((item) => <button key={item.id} onClick={() => onProduct(item)} className="text-left bg-card border border-border rounded-2xl overflow-hidden">
        <img src={item.img} alt={item.name} className="w-full aspect-[4/5] object-cover" />
        <div className="p-3"><p className="text-foreground text-xs font-semibold">{item.name}</p><p className="text-muted-foreground text-[10px]">{item.brand}</p><p className="text-[#7B61FF] text-sm font-bold mt-1">{currency(item.price)}</p></div>
      </button>)}
    </div>
  );

  const content = (() => {
    switch (section) {
      case "overview":
        return <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#17152a] to-[#30245d] text-white p-5">
            <p className="text-[10px] tracking-[.2em] uppercase text-white/60">Smart Fashion Commerce</p>
            <h2 className="text-2xl font-bold mt-2">Shop beyond the checkout.</h2>
            <p className="text-white/70 text-xs mt-2">Your cart, negotiations, custom sizing, wardrobe and style community in one place.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => nav("cart")} className="bg-white text-[#17152a] px-4 py-2.5 rounded-xl text-xs font-bold">Open cart ({commerce.cartCount})</button>
              <button onClick={() => nav("assistant")} className="bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold">Ask stylist</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {sections.map((item) => <button key={item.id} onClick={() => nav(item.id)} className="text-left bg-card border border-border rounded-2xl p-4">
              <p className="text-foreground text-sm font-semibold">{item.title}</p><p className="text-muted-foreground text-[10px] mt-1">{item.detail}</p>
            </button>)}
          </div>
          <h3 className="text-foreground text-sm font-semibold">Choose a product to negotiate, pre-order or build a look</h3>
          {productGrid}
        </div>;

      case "cart":
        return <div className="space-y-3">
          {commerce.cart.length === 0 ? <p className="text-muted-foreground text-sm py-10 text-center">Your cart is empty.</p> : <>
            {commerce.cart.map((line) => <div key={line.key} className="bg-card border border-border rounded-2xl p-3 flex gap-3">
              <img src={line.product.img} alt={line.product.name} className="w-20 h-24 rounded-xl object-cover" />
              <div className="flex-1 min-w-0"><div className="flex justify-between"><p className="text-foreground text-sm font-semibold">{line.product.name}</p><button onClick={() => void commerce.removeFromCart(line)} className="text-muted-foreground">Remove</button></div>
                <p className="text-muted-foreground text-[10px] mt-1">Size {line.size} · {line.color}</p><p className="text-[#7B61FF] font-bold text-sm mt-1">{currency(line.unitPrice)}</p>
                <div className="flex items-center gap-3 mt-2"><button onClick={() => void commerce.setQuantity(line, Math.max(0, line.quantity - 1))} className="w-7 h-7 bg-secondary rounded-lg">−</button><span className="text-foreground text-xs">{line.quantity}</span><button onClick={() => void commerce.setQuantity(line, Math.min(20, line.quantity + 1))} className="w-7 h-7 bg-secondary rounded-lg">+</button><span className="ml-auto text-foreground text-xs font-bold">{currency(line.unitPrice * line.quantity)}</span></div>
              </div>
            </div>)}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>{currency(commerce.subtotal)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Shipping</span><span>{commerce.shippingFee ? currency(commerce.shippingFee) : "Free"}</span></div>
              <div className="flex justify-between border-t border-border pt-2"><b className="text-foreground">Total</b><b className="text-[#7B61FF]">{currency(commerce.subtotal + commerce.shippingFee)}</b></div>
              <button onClick={() => nav("checkout" as Section)} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl text-sm font-bold">Continue to checkout</button>
            </div>
          </>}
        </div>;

      case "bargain":
        return <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <label className="text-muted-foreground text-xs">Product</label>{productPicker}
            <div className="flex gap-3 items-center"><img src={product.img} alt={product.name} className="w-16 h-16 rounded-xl object-cover"/><div><p className="text-foreground text-sm font-semibold">{product.name}</p><p className="text-muted-foreground text-xs">List price {currency(product.price)}</p></div></div>
            <label className="text-muted-foreground text-xs">Your offer (₹)</label>
            <input type="number" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={String(Math.round(product.price * .88))} className="w-full bg-secondary border border-border rounded-xl px-3 py-3 text-foreground text-sm"/>
            <p className="text-muted-foreground text-[10px]">The current demo seller rule counters offers below 93% of list price. This is a transparent simulation, not a live seller or AI service.</p>
            <button disabled={busy} onClick={() => void submitOffer()} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl text-xs font-bold">Submit offer</button>
          </div>
          {activeBargain && <div className="bg-card border border-border rounded-2xl p-4 space-y-3"><p className="text-foreground text-sm font-bold">Negotiation status: {activeBargain.status}</p>{activeBargain.status === "countered" && <>
            <p className="text-2xl font-bold text-[#7B61FF]">{currency(activeBargain.counterOffer)}</p>
            <button onClick={() => void respondToOffer("accept")} className="w-full bg-emerald-600 text-white py-3 rounded-xl text-xs font-bold">Accept and add to cart</button>
            <div className="flex gap-2"><input type="number" value={counterOffer} onChange={(e) => setCounterOffer(e.target.value)} placeholder="Your counter (₹)" className="flex-1 min-w-0 bg-secondary rounded-xl px-3 text-foreground text-sm"/><button onClick={() => void respondToOffer("counter")} className="bg-secondary border border-border rounded-xl px-3 text-xs">Counter</button></div>
            <button onClick={() => void respondToOffer("reject")} className="text-muted-foreground text-xs">Decline</button>
          </>}</div>}
          {bargains?.length ? <div><h3 className="text-foreground text-sm font-semibold mb-2">Previous offers</h3>{bargains.slice(0,5).map((item: any) => <div key={item._id} className="bg-card border border-border rounded-xl p-3 mb-2 flex justify-between"><span className="text-foreground text-xs">{item.productName} · {currency(item.customerOffer)}</span><span className="text-[#7B61FF] text-[10px] uppercase">{item.status}</span></div>)}</div> : null}
        </div>;

      case "preorder":
        return <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <label className="text-muted-foreground text-xs">Product</label>{productPicker}
          <div className="flex items-center gap-3"><img src={product.img} alt={product.name} className="w-14 h-14 rounded-xl object-cover"/><div><p className="text-foreground text-sm font-semibold">{product.name}</p><p className="text-muted-foreground text-xs">{currency(product.price)}</p></div></div>
          <div className="flex gap-2">{["Standard", "Custom measurements"].map((name, i) => <button key={name} onClick={() => setCustomSize(i === 1)} className={(customSize === (i === 1) ? "bg-[#7B61FF] text-white" : "bg-secondary text-foreground") + " flex-1 py-2.5 rounded-xl text-xs font-semibold"}>{name}</button>)}</div>
          <div className="grid grid-cols-4 gap-2">{(product.sizes.length ? product.sizes : ["XS", "S", "M", "L", "XL", "XXL"]).map((value) => <button key={value} onClick={() => setSize(value)} className={(size === value ? "bg-[#7B61FF] text-white" : "bg-secondary text-foreground") + " rounded-lg py-2 text-xs"}>{value}</button>)}</div>
          {customSize && <div className="grid grid-cols-2 gap-2">{(Object.keys(measurements) as (keyof typeof measurements)[]).map((key) => <label key={key} className="bg-secondary rounded-xl p-3"><span className="block text-muted-foreground text-[10px] capitalize">{key} (cm)</span><input type="number" value={measurements[key]} onChange={(e) => setMeasurements((old) => ({ ...old, [key]: e.target.value }))} className="w-full mt-1 bg-transparent text-foreground text-sm"/></label>)}</div>}
          <textarea value={preOrderNotes} onChange={(e) => setPreOrderNotes(e.target.value)} placeholder="Tailoring notes (optional)" className="w-full bg-secondary border border-border rounded-xl p-3 text-foreground text-xs min-h-20"/>
          <button disabled={busy} onClick={() => void submitPreOrder()} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl text-xs font-bold">Save pre-order request</button>
          <p className="text-muted-foreground text-[10px]">No payment is taken. The retailer must confirm availability and lead time.</p>
          {preOrders?.length ? <div className="space-y-2 pt-3 border-t border-border"><h3 className="text-foreground text-sm font-semibold">Your requests</h3>{preOrders.map((item: any) => <div key={item._id} className="flex justify-between bg-secondary rounded-xl p-3"><span className="text-foreground text-xs">{item.productName} · {item.size}</span><span className="text-[#7B61FF] text-[10px] uppercase">{item.status}</span></div>)}</div> : null}
        </div>;

      case "checkout":
        return <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-foreground text-sm font-semibold">Delivery address</h3>
          {(Object.keys(address) as (keyof ShippingAddress)[]).map((key) => <input key={key} value={address[key]} placeholder={key === "line1" ? "House / street address" : key === "postalCode" ? "6-digit PIN code" : key} onChange={(e) => setAddress((old) => ({ ...old, [key]: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-3 text-foreground text-sm"/>)}
          <h3 className="text-foreground text-sm font-semibold pt-2">Payment method</h3>
          <div className="grid grid-cols-2 gap-2">{(["upi", "cod"] as const).map((method) => <button key={method} onClick={() => setPaymentMethod(method)} className={(paymentMethod === method ? "border-[#7B61FF] bg-[#7B61FF]/10" : "border-border bg-secondary") + " border rounded-xl p-3 text-left"}><p className="text-foreground text-xs font-semibold uppercase">{method === "upi" ? "UPI" : "Cash on delivery"}</p><p className="text-muted-foreground text-[9px]">{method === "upi" ? "Pending; gateway not configured" : "Collected on delivery"}</p></button>)}</div>
          <p className="text-muted-foreground text-xs">Order total: {currency(commerce.subtotal + commerce.shippingFee)}</p>
          <button disabled={busy || !commerce.cart.length} onClick={() => void checkout()} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl text-xs font-bold">Save order</button>
          <p className="text-muted-foreground text-[10px]">This records an unpaid order; no payment is charged.</p>
        </div>;

      case "orders":
        return <div className="space-y-3">{orders.length === 0 ? <p className="text-muted-foreground text-center py-10 text-sm">No orders yet.</p> : orders.map((order: any) => <div key={order._id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <div className="flex justify-between"><div><p className="text-foreground text-sm font-semibold">{order.orderNumber}</p><p className="text-muted-foreground text-[10px]">{new Date(order.createdAt).toLocaleString()}</p></div><span className="text-[#7B61FF] text-[10px] uppercase">{order.status}</span></div>
          {order.items.map((item: any, i: number) => <div key={i} className="flex items-center gap-2"><img src={item.img} alt={item.name} className="w-10 h-10 rounded-lg object-cover"/><span className="text-foreground text-xs flex-1">{item.name} · {item.size} × {item.quantity}</span><span className="text-foreground text-xs">{currency(item.unitPrice * item.quantity)}</span></div>)}
          <div className="border-t border-border pt-2 flex justify-between"><span className="text-muted-foreground text-xs">Payment: {order.paymentStatus}</span><b className="text-foreground text-sm">{currency(order.total)}</b></div>
        </div>)}</div>;

      case "wishlist":
        return <div className="space-y-3">
          {wishlistProducts.length === 0 ? <p className="text-muted-foreground text-sm py-10 text-center">Your wishlist is empty. Save products from the shop first.</p> : wishlistProducts.map((item) => <div key={item.id} className="bg-card border border-border rounded-2xl p-3 flex gap-3">
            <img src={item.img} alt={item.name} className="w-16 h-20 rounded-xl object-cover"/>
            <div className="flex-1"><p className="text-foreground text-sm font-semibold">{item.name}</p><p className="text-[#7B61FF] text-xs font-bold">{currency(item.price)}</p><div className="flex gap-2 mt-2"><button onClick={() => void wishlist.toggle(item.id)} className="text-muted-foreground text-[10px]">Remove</button><button onClick={() => void commerce.addToCart(item)} className="text-[#7B61FF] text-[10px] font-bold">Add to cart</button><button onClick={() => void wishlistAlert(item.id, alertSettings.get(item.id) !== false)} className="text-foreground text-[10px]">{alertSettings.get(item.id) === false ? "Enable alerts" : "Pause alerts"}</button></div></div>
          </div>)}
          <button disabled={busy || !token} onClick={() => void run(() => refreshWishlistAlerts({ sessionToken: token! }), "Wishlist alerts checked against the current catalog.")} className="w-full bg-secondary border border-border text-foreground py-3 rounded-xl text-xs">Check catalog for changes</button>
        </div>;

      case "notifications":
        return <div className="space-y-2">
          <div className="flex justify-end"><button onClick={() => token && void run(() => markAllRead({ sessionToken: token }), "All notifications marked as read.")} className="text-[#7B61FF] text-xs font-semibold">Mark all read</button></div>
          {(notifications ?? []).length === 0 ? <p className="text-muted-foreground text-sm py-10 text-center">No personal notifications yet.</p> : notifications!.map((item: any) => <button key={item._id} onClick={() => token && !item.isRead && void markRead({ sessionToken: token, notificationId: item._id })} className="w-full text-left bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between"><b className="text-foreground text-xs">{item.title}</b>{!item.isRead && <span className="w-2 h-2 bg-[#7B61FF] rounded-full"/>}</div><p className="text-muted-foreground text-xs mt-1">{item.body}</p><p className="text-muted-foreground text-[9px] mt-2">{new Date(item.createdAt).toLocaleString()}</p>
          </button>)}
        </div>;

      case "community":
        return <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2"><h3 className="text-foreground text-sm font-semibold">Request a new collection</h3><input value={communityTitle} onChange={(e) => setCommunityTitle(e.target.value)} placeholder="e.g. Extended-size winter jackets" className="w-full bg-secondary rounded-xl p-3 text-foreground text-sm"/><select value={communityCategory} onChange={(e) => setCommunityCategory(e.target.value)} className="w-full bg-secondary rounded-xl p-3 text-foreground text-sm">{["Casual", "Formal", "Streetwear", "Footwear", "Accessories"].map((item) => <option key={item}>{item}</option>)}</select><textarea value={communityDetails} onChange={(e) => setCommunityDetails(e.target.value)} placeholder="Style, fit and design details" className="w-full bg-secondary rounded-xl p-3 text-foreground text-xs min-h-16"/><button disabled={busy} onClick={() => void submitCommunityRequest()} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl text-xs font-bold">Submit request</button></div>
          <h3 className="text-foreground text-sm font-semibold">Community requests</h3>
          {(communityRequests ?? fallbackRequests).map((item: any) => <div key={item._id ?? item.id} className="bg-card border border-border rounded-xl p-3"><p className="text-foreground text-sm font-semibold">{item.title}</p><p className="text-muted-foreground text-[10px]">{item.category} · {item.status} · {item.votes} votes</p>{item.details && <p className="text-muted-foreground text-xs mt-2">{item.details}</p>}<button disabled={!token} onClick={() => token && void run(() => toggleCommunityVote({ sessionToken: token, requestId: item.id }), "Vote updated.")} className="text-[#7B61FF] text-xs font-bold mt-2">Vote for this collection</button></div>)}
          <h3 className="text-foreground text-sm font-semibold">Design voting</h3>
          {(designCards ?? fallbackCards).map((item: any) => <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex gap-3"><img src={item.img} alt={item.title} className="w-16 h-16 rounded-xl object-cover"/><div className="flex-1"><p className="text-foreground text-xs font-semibold">{item.title}</p><p className="text-muted-foreground text-[10px]">{item.designer} · {item.likes} votes</p><button disabled={!token} onClick={() => token && void run(() => voteDesign({ sessionToken: token, cardId: item.id }), "Design vote recorded.")} className="text-[#7B61FF] text-xs mt-2">Vote for design</button></div></div>)}
        </div>;

      case "outfits":
        return <div className="space-y-3"><input value={outfitName} onChange={(e) => setOutfitName(e.target.value)} className="w-full bg-secondary border border-border rounded-xl p-3 text-foreground text-sm" placeholder="Outfit name"/><p className="text-muted-foreground text-xs">Select products to combine in one outfit.</p>{products.map((item) => <label key={item.id} className="bg-card border border-border rounded-xl p-2 flex items-center gap-3"><input type="checkbox" checked={outfitIds.includes(item.id)} onChange={() => toggleOutfit(item.id)}/><img src={item.img} alt={item.name} className="w-12 h-12 rounded-lg object-cover"/><span className="text-foreground text-xs flex-1">{item.name}</span><span className="text-[#7B61FF] text-xs">{currency(item.price)}</span></label>)}<div className="flex justify-between text-sm text-foreground"><span>{outfitIds.length} items</span><b>{currency(products.filter((item) => outfitIds.includes(item.id)).reduce((sum, item) => sum + item.price, 0))}</b></div><button disabled={busy || !outfitIds.length} onClick={() => void saveCurrentOutfit()} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl text-xs font-bold">Save outfit</button>
          <h3 className="text-foreground text-sm font-semibold pt-3">Saved outfits</h3>{(outfits ?? []).map((item: any) => <div key={item._id} className="bg-card border border-border rounded-xl p-3"><b className="text-foreground text-xs">{item.name}</b><p className="text-muted-foreground text-[10px] mt-1">{item.products.map((p: Product) => p.name).join(" · ")}</p></div>)}
        </div>;

      case "events":
        return <div className="space-y-3"><div className="bg-card border border-border rounded-2xl p-4 space-y-2"><label className="text-muted-foreground text-xs">Occasion</label><select value={eventName} onChange={(e) => { setEventName(e.target.value); setEventIds([]); }} className="w-full bg-secondary rounded-xl p-3 text-foreground text-sm">{["Wedding", "College", "Office", "Gym", "Vacation", "Party"].map((item) => <option key={item}>{item}</option>)}</select><label className="text-muted-foreground text-xs">Budget (₹)</label><input type="number" value={eventBudget} onChange={(e) => setEventBudget(e.target.value)} className="w-full bg-secondary rounded-xl p-3 text-foreground text-sm"/><p className="text-muted-foreground text-[10px]">Suggestions use product category and listed price rules, not a connected generative AI.</p></div>
          {eventRecommendations.map((item) => <label key={item.id} className="bg-card border border-border rounded-xl p-3 flex gap-3 items-center"><input type="checkbox" checked={eventIds.includes(item.id)} onChange={() => setEventIds((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id])}/><img src={item.img} alt={item.name} className="w-12 h-12 rounded-lg object-cover"/><span className="text-foreground text-xs flex-1">{item.name}</span><span className="text-[#7B61FF] text-xs">{currency(item.price)}</span><button type="button" onClick={() => void commerce.addToCart(item)} className="text-[#7B61FF] text-[10px]">Add</button></label>)}
          <p className="text-foreground text-xs">Selected total: {currency(products.filter((item) => eventIds.includes(item.id)).reduce((sum, item) => sum + item.price, 0))}</p><button disabled={busy || !eventIds.length} onClick={() => void saveEvent()} className="w-full bg-[#7B61FF] text-white py-3 rounded-xl text-xs font-bold">Save event list</button>
          {(eventLists ?? []).map((item: any) => <div key={item._id} className="bg-card border border-border rounded-xl p-3"><b className="text-foreground text-xs">{item.event}</b><p className="text-muted-foreground text-[10px]">Budget {currency(item.budget)} · {item.products.length} saved items</p></div>)}
        </div>;

      case "wardrobe":
        return <div className="space-y-3"><div className="bg-card border border-border rounded-2xl p-4 space-y-3"><h3 className="text-foreground text-sm font-semibold">Upload a clothing photo</h3><input value={wardrobeLabel} onChange={(e) => setWardrobeLabel(e.target.value)} placeholder="Item name (optional)" className="w-full bg-secondary rounded-xl p-3 text-foreground text-sm"/><select value={wardrobeCategory} onChange={(e) => setWardrobeCategory(e.target.value)} className="w-full bg-secondary rounded-xl p-3 text-foreground text-sm">{["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "Dresses"].map((item) => <option key={item}>{item}</option>)}</select><label className="block bg-[#7B61FF] text-white text-center py-3 rounded-xl text-xs font-bold">{busy ? "Uploading…" : "Choose photo"}<input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => void uploadWardrobe(e.target.files?.[0])}/></label></div>
          {(wardrobe ?? []).map((item: any) => <div key={item._id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"><img src={item.imageUrl ?? ""} alt={item.label} className="w-16 h-16 object-cover rounded-xl"/><div className="flex-1"><b className="text-foreground text-xs">{item.label}</b><p className="text-muted-foreground text-[10px]">{item.category}</p></div><button onClick={() => token && void run(() => deleteWardrobeItem({ sessionToken: token, itemId: item._id }), "Wardrobe item deleted.")} className="text-red-400 text-xs">Delete</button></div>)}
        </div>;

      case "assistant":
        return <div className="flex flex-col min-h-[65vh]"><div className="flex-1 space-y-3">
          {messages.map((message: any, index: number) => <div key={index} className={(message.role === "user" ? "ml-8 bg-[#7B61FF] text-white" : "mr-6 bg-card border border-border text-foreground") + " p-3 rounded-2xl"}><p className="text-xs">{message.text}</p>
            {message.productIds?.length ? <div className="mt-2 space-y-2">{message.productIds.map((id: number) => products.find((item) => item.id === id)).filter(Boolean).map((item: Product) => <div key={item.id} className="flex gap-2 items-center"><img src={item.img} alt={item.name} className="w-9 h-9 rounded-lg object-cover"/><span className="text-xs flex-1">{item.name} · {currency(item.price)}</span><button onClick={() => void commerce.addToCart(item)} className="text-[#7B61FF] text-[10px]">Add</button></div>)}</div> : null}
          </div>)}
          {!messages.length && <p className="text-muted-foreground text-xs">Describe an event, style or budget. Recommendations are based on the current catalog and transparent rules.</p>}
        </div><div className="sticky bottom-0 bg-background border-t border-border pt-3 flex gap-2"><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendChat(chatInput); }} placeholder="Example: office outfit under ₹3000" className="flex-1 min-w-0 bg-secondary rounded-xl px-3 py-3 text-foreground text-xs"/><button disabled={busy || !chatInput.trim()} onClick={() => void sendChat(chatInput)} className="bg-[#7B61FF] text-white px-4 rounded-xl text-xs">Send</button></div></div>;

      default: return null;
    }
  })();

  return <div className="h-full flex flex-col bg-background">
    <header className="flex-shrink-0 flex items-center gap-3 px-5 pt-4 pb-4 border-b border-border">
      <button onClick={section === "overview" ? onBack : () => nav("overview")} className="w-9 h-9 rounded-full bg-secondary border border-border text-foreground">←</button>
      <div className="flex-1 min-w-0"><h1 className="text-foreground font-bold text-base">Smart Commerce</h1><p className="text-muted-foreground text-[10px]">{section === "overview" ? "Customer features and saved activity" : sections.find((item) => item.id === section)?.title}</p></div>
      <button onClick={() => nav("cart")} className="bg-secondary border border-border rounded-xl px-3 py-2 text-foreground text-xs">Cart {commerce.cartCount}</button>
    </header>
    <nav className="flex-shrink-0 overflow-x-auto flex gap-2 px-5 py-3 border-b border-border">
      <button onClick={() => nav("overview")} className="bg-secondary border border-border rounded-full px-3 py-2 text-foreground text-[10px]">Overview</button>
      {sections.map((item) => <button key={item.id} onClick={() => nav(item.id)} className={(section === item.id ? "bg-[#7B61FF] text-white" : "bg-secondary text-foreground") + " border border-border rounded-full px-3 py-2 whitespace-nowrap text-[10px]"}>{item.title}</button>)}
    </nav>
    <main className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      {(!token && section !== "overview") && <p className="text-amber-600 dark:text-amber-400 text-[10px] mb-3">Guest mode: local cart and chat are retained on this device. Cloud records require a verified sign-in and a configured Convex backend.</p>}
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl p-3 text-xs mb-3">{error}<button onClick={() => setError("")} className="float-right">Dismiss</button></div>}
      {notice && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 text-xs mb-3">{notice}</div>}
      {content}
    </main>
  </div>;
}
