import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ArrowLeft, BellRing, CalendarDays, Check, Heart, ImagePlus, MessageCircle, Ruler, Shirt, Sparkles, ThumbsUp, Trash2 } from "lucide-react";
import type { Product } from "./data";

type Section = "preorders" | "wishlist" | "community" | "outfits" | "events" | "wardrobe" | "assistant" | "price-history";

const sections: { id: Section; label: string }[] = [
  { id: "preorders", label: "Pre-orders" },
  { id: "wishlist", label: "Wishlist alerts" },
  { id: "community", label: "Community" },
  { id: "outfits", label: "Outfits" },
  { id: "events", label: "Events" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "assistant", label: "Assistant" },
  { id: "price-history", label: "Price history" },
];

const money = (value: number) => "₹" + value.toLocaleString("en-IN");

export function SmartCommerceExtras({
  products,
  sessionToken,
  userName,
  wishlistedIds,
  onBack,
  onProduct,
}: {
  products: Product[];
  sessionToken?: string;
  userName: string;
  wishlistedIds: number[];
  onBack: () => void;
  onProduct: (product: Product) => void;
}) {
  const token = sessionToken;
  const [section, setSection] = useState<Section>("preorders");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const preOrders = useQuery(api.commerce.preOrdersForUser, token ? { token } : "skip");
  const alertSettings = useQuery(api.commerce.wishlistAlertSettings, token ? { token } : "skip");
  const notifications = useQuery(api.commerce.notificationsForUser, token ? { token } : "skip");
  const requests = useQuery(api.commerce.communityRequestsForUser, token ? { token } : "skip");
  const designCards = useQuery(api.shop.votingCards, {});
  const outfits = useQuery(api.commerce.savedOutfitsForUser, token ? { token } : "skip");
  const eventLists = useQuery(api.commerce.eventListsForUser, token ? { token } : "skip");
  const wardrobe = useQuery(api.commerce.wardrobeForUser, token ? { token } : "skip");
  const chat = useQuery(api.commerce.chatHistory, token ? { token } : "skip");

  const createPreOrder = useMutation(api.commerce.createPreOrder);
  const setWishlistAlerts = useMutation(api.commerce.setWishlistAlerts);
  const refreshWishlistAlerts = useMutation(api.commerce.refreshWishlistAlerts);
  const markNotificationRead = useMutation(api.commerce.markNotificationRead);
  const markAllNotificationsRead = useMutation(api.commerce.markAllNotificationsRead);
  const createCollectionRequest = useMutation(api.commerce.createCollectionRequest);
  const toggleCommunityVote = useMutation(api.commerce.toggleCommunityVote);
  const voteDesign = useMutation(api.commerce.voteDesign);
  const saveOutfit = useMutation(api.commerce.saveOutfit);
  const saveEventShoppingList = useMutation(api.commerce.saveEventShoppingList);
  const generateWardrobeUploadUrl = useMutation(api.commerce.generateWardrobeUploadUrl);
  const saveWardrobeItem = useMutation(api.commerce.saveWardrobeItem);
  const deleteWardrobeItem = useMutation(api.commerce.deleteWardrobeItem);
  const appendChatMessage = useMutation(api.commerce.appendChatMessage);

  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const product = products.find((item) => item.id === productId) ?? products[0];
  const [size, setSize] = useState(product?.sizes?.[0] ?? "M");
  const [customSize, setCustomSize] = useState(false);
  const [measurements, setMeasurements] = useState({ height: "170", chest: "92", waist: "78", shoulder: "42", sleeve: "60" });
  const [preOrderQuantity, setPreOrderQuantity] = useState("1");
  const [preOrderNotes, setPreOrderNotes] = useState("");

  const [communityTitle, setCommunityTitle] = useState("");
  const [communityCategory, setCommunityCategory] = useState("Casual");
  const [communityDetails, setCommunityDetails] = useState("");

  const [outfitName, setOutfitName] = useState("My outfit");
  const [outfitIds, setOutfitIds] = useState<number[]>([]);
  const [eventName, setEventName] = useState("Wedding");
  const [eventBudget, setEventBudget] = useState("5000");
  const [eventIds, setEventIds] = useState<number[]>([]);

  const [wardrobeLabel, setWardrobeLabel] = useState("");
  const [wardrobeCategory, setWardrobeCategory] = useState("Tops");
  const [chatInput, setChatInput] = useState("");
  const [historyProductId, setHistoryProductId] = useState(products[0]?.id ?? 0);

  const alertMap = useMemo(
    () => new Map((alertSettings ?? []).map((item: any) => [item.productId, item.enabled])),
    [alertSettings],
  );
  const selectedOutfitTotal = products.filter((item) => outfitIds.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
  const selectedEventTotal = products.filter((item) => eventIds.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
  const historyProduct = products.find((item) => item.id === historyProductId) ?? products[0];
  const recordedHistory = ((historyProduct as any)?.priceHistory ?? []) as { month: string; price: number }[];
  const historicalValues = recordedHistory.map((point) => point.price).filter(Number.isFinite);
  const unreadCount = (notifications ?? []).filter((item: any) => !item.isRead).length;

  const run = async (action: () => Promise<any>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const submitPreOrder = () => {
    if (!token || !product) return;
    void run(() => createPreOrder({
      token,
      productId: product.id,
      size: customSize ? "Custom" : size,
      ...(customSize ? { customMeasurements: {
        height: Number(measurements.height), chest: Number(measurements.chest),
        waist: Number(measurements.waist), shoulder: Number(measurements.shoulder),
        sleeve: Number(measurements.sleeve),
      } } : {}),
      quantity: Number(preOrderQuantity),
      notes: preOrderNotes,
    }), "Your pre-order request has been saved for retailer confirmation.");
  };

  const toggleOutfit = (id: number) => setOutfitIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleEvent = (id: number) => setEventIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const sendChat = () => {
    if (!token || !chatInput.trim()) return;
    const message = chatInput.trim();
    setChatInput("");
    void run(() => appendChatMessage({ token, text: message }), "Your conversation has been saved.");
  };

  const uploadWardrobe = async (file?: File) => {
    if (!token || !file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const url = await generateWardrobeUploadUrl({ token });
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Image upload failed. Try again.");
      const payload = await response.json();
      await saveWardrobeItem({ token, storageId: payload.storageId, category: wardrobeCategory, label: wardrobeLabel });
      setWardrobeLabel("");
      setNotice("The wardrobe image has been saved.");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "The image could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const nav = (id: Section) => {
    setSection(id);
    setError("");
    setNotice("");
  };

  const card = "bg-card border border-border rounded-2xl p-4";
  const button = "bg-[#7B61FF] text-white rounded-xl px-4 py-3 text-xs font-bold disabled:opacity-40";
  const field = "w-full bg-secondary border border-border rounded-xl px-3 py-3 text-foreground text-sm";

  const content = (() => {
    switch (section) {
      case "preorders":
        return <div className="space-y-4">
          <div className={card + " space-y-3"}>
            <div className="flex items-center gap-2"><Ruler size={17} className="text-[#7B61FF]"/><h2 className="text-foreground text-sm font-semibold">Custom-size pre-order</h2></div>
            <p className="text-muted-foreground text-[11px]">Request a standard size or submit measurements for a size not currently listed. The retailer must confirm production and lead time.</p>
            <select className={field} value={product?.id ?? 0} onChange={(e) => { const next = products.find((item) => item.id === Number(e.target.value)); if (next) { setProductId(next.id); setSize(next.sizes?.[0] ?? "M"); } }}>
              {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.price)}</option>)}
            </select>
            {product && <div className="flex items-center gap-3"><img src={product.img} alt={product.name} className="w-14 h-16 rounded-lg object-cover"/><div><p className="text-foreground text-xs font-semibold">{product.name}</p><p className="text-muted-foreground text-[10px]">Current listed price {money(product.price)}</p></div></div>}
            <div className="flex gap-2">
              <button onClick={() => setCustomSize(false)} className={(customSize ? "bg-secondary text-foreground" : "bg-[#7B61FF] text-white") + " flex-1 rounded-xl py-2.5 text-xs font-semibold"}>Standard size</button>
              <button onClick={() => setCustomSize(true)} className={(!customSize ? "bg-secondary text-foreground" : "bg-[#7B61FF] text-white") + " flex-1 rounded-xl py-2.5 text-xs font-semibold"}>Custom measurements</button>
            </div>
            {!customSize ? <select className={field} value={size} onChange={(e) => setSize(e.target.value)}>{(product?.sizes?.length ? product.sizes : ["XS","S","M","L","XL","XXL"]).map((value) => <option key={value}>{value}</option>)}</select>
              : <div className="grid grid-cols-2 gap-2">{(Object.keys(measurements) as (keyof typeof measurements)[]).map((key) => <label key={key} className="text-muted-foreground text-[10px] capitalize">{key} (cm)<input type="number" min="20" max="250" value={measurements[key]} onChange={(e) => setMeasurements((old) => ({ ...old, [key]: e.target.value }))} className={field + " mt-1"}/></label>)}</div>}
            <label className="text-muted-foreground text-xs">Quantity<input type="number" min="1" max="10" value={preOrderQuantity} onChange={(e) => setPreOrderQuantity(e.target.value)} className={field + " mt-1"}/></label>
            <textarea value={preOrderNotes} onChange={(e) => setPreOrderNotes(e.target.value)} maxLength={500} placeholder="Fit preferences or tailoring notes (optional)" className={field + " min-h-20"}/>
            <button disabled={!token || busy || !product} onClick={submitPreOrder} className={button}>Save pre-order request</button>
            {!token && <p className="text-amber-600 text-[10px]">Sign in to save a pre-order to your account.</p>}
          </div>
          <div className="space-y-2"><h3 className="text-foreground text-sm font-semibold">Your requests</h3>
            {(preOrders ?? []).length === 0 ? <p className="text-muted-foreground text-xs">No pre-orders saved yet.</p> : preOrders!.map((item: any) => <div key={item._id} className={card}><div className="flex justify-between gap-2"><b className="text-foreground text-xs">{item.productName}</b><span className="text-[#7B61FF] text-[9px] uppercase">{item.status}</span></div><p className="text-muted-foreground text-[10px] mt-1">{item.size} · Qty {item.quantity}</p>{item.notes && <p className="text-muted-foreground text-[10px] mt-1">{item.notes}</p>}</div>)}
          </div>
        </div>;

      case "wishlist":
        return <div className="space-y-3">
          <div className={card + " space-y-2"}>
            <div className="flex items-center gap-2"><BellRing size={17} className="text-[#7B61FF]"/><h2 className="text-foreground text-sm font-semibold">Wishlist alerts</h2></div>
            <p className="text-muted-foreground text-[11px]">Alerts compare recorded catalog prices, stock and discount values when you check. They are not continuous push notifications.</p>
            <button disabled={!token || busy} onClick={() => token && void run(() => refreshWishlistAlerts({ token }), "Wishlist checked against the current catalog.")} className={button}>Check catalog now</button>
          </div>
          {wishlistedIds.map((id) => {
            const item = products.find((p) => p.id === id);
            if (!item) return null;
            const enabled = alertMap.get(id) !== false;
            return <div key={id} className={card + " flex items-center gap-3"}>
              <img src={item.img} alt={item.name} className="w-12 h-14 rounded-lg object-cover"/>
              <div className="flex-1 min-w-0"><p className="text-foreground text-xs font-semibold">{item.name}</p><p className="text-muted-foreground text-[10px]">{money(item.price)}</p></div>
              <button disabled={!token || busy} onClick={() => token && void run(() => setWishlistAlerts({ token, productId: id, enabled: !enabled }), enabled ? "Alert disabled." : "Alert enabled.")} className={(enabled ? "bg-[#7B61FF] text-white" : "bg-secondary text-foreground") + " rounded-lg px-3 py-2 text-[10px] font-semibold"}>{enabled ? "Alerts on" : "Alerts off"}</button>
            </div>;
          })}
          {wishlistedIds.length === 0 && <p className="text-muted-foreground text-xs">Save a product to your wishlist first, then enable its alerts here.</p>}
          <div className={card + " space-y-2"}>
            <div className="flex items-center justify-between"><h3 className="text-foreground text-sm font-semibold">Personal notification inbox</h3><button disabled={!token || busy || !unreadCount} onClick={() => token && void run(() => markAllNotificationsRead({ token }), "All notifications marked as read.")} className="text-[#7B61FF] text-[10px] font-semibold">Mark all read</button></div>
            {(notifications ?? []).length === 0 ? <p className="text-muted-foreground text-xs">No alert notifications yet.</p> : notifications!.map((item: any) => <button key={item._id} onClick={() => token && !item.isRead && void run(() => markNotificationRead({ token, notificationId: item._id }), "Notification marked as read.")} className="w-full text-left border-t border-border py-2">
              <div className="flex justify-between gap-2"><b className="text-foreground text-xs">{item.title}</b>{!item.isRead && <span className="w-2 h-2 rounded-full bg-[#7B61FF]"/>}</div><p className="text-muted-foreground text-[10px] mt-1">{item.body}</p><p className="text-muted-foreground text-[9px] mt-1">{new Date(item.createdAt).toLocaleString()}</p>
            </button>)}
          </div>
        </div>;

      case "community":
        return <div className="space-y-4">
          <div className={card + " space-y-3"}>
            <h2 className="text-foreground text-sm font-semibold">Request a collection</h2>
            <input value={communityTitle} onChange={(e) => setCommunityTitle(e.target.value)} maxLength={100} placeholder="e.g. Extended-size winter jackets" className={field}/>
            <select value={communityCategory} onChange={(e) => setCommunityCategory(e.target.value)} className={field}>{["Casual","Formal","Streetwear","Footwear","Accessories","Outerwear"].map((value) => <option key={value}>{value}</option>)}</select>
            <textarea value={communityDetails} onChange={(e) => setCommunityDetails(e.target.value)} maxLength={500} placeholder="Describe fit, design or style requirements" className={field + " min-h-20"}/>
            <button disabled={!token || busy || communityTitle.trim().length < 5} onClick={() => token && void run(async () => { await createCollectionRequest({ token, title: communityTitle, category: communityCategory, details: communityDetails }); setCommunityTitle(""); setCommunityDetails(""); }, "Collection request saved. Duplicate requests are grouped together.")} className={button}>Submit collection request</button>
          </div>
          <h3 className="text-foreground text-sm font-semibold">Community requests</h3>
          {(requests ?? []).map((item: any) => <div key={item._id} className={card}>
            <p className="text-foreground text-sm font-semibold">{item.title}</p><p className="text-muted-foreground text-[10px] mt-1">{item.category} · {item.status} · {item.votes} votes · {item.interested} interested</p>{item.details && <p className="text-muted-foreground text-xs mt-2">{item.details}</p>}
            <button disabled={!token || busy} onClick={() => token && void run(() => toggleCommunityVote({ token, requestId: item.id }), "Community vote updated.")} className="text-[#7B61FF] text-xs font-bold mt-3">Vote for this collection</button>
          </div>)}
          <h3 className="text-foreground text-sm font-semibold">Design voting</h3>
          {(designCards ?? []).map((item: any) => <div key={item.id} className={card + " flex items-center gap-3"}>
            <img src={item.img} alt={item.title} className="w-14 h-14 rounded-lg object-cover"/>
            <div className="flex-1"><p className="text-foreground text-xs font-semibold">{item.title}</p><p className="text-muted-foreground text-[10px]">{item.designer} · {item.likes} likes</p><button disabled={!token || busy} onClick={() => token && void run(() => voteDesign({ token, cardId: item.id }), "Design vote updated.")} className="text-[#7B61FF] text-[10px] mt-1">Vote for design</button></div>
          </div>)}
        </div>;

      case "outfits":
        return <div className="space-y-3">
          <div className={card + " space-y-3"}>
            <h2 className="text-foreground text-sm font-semibold">Build an outfit</h2>
            <input value={outfitName} onChange={(e) => setOutfitName(e.target.value)} maxLength={60} className={field} placeholder="Outfit name"/>
            <div className="space-y-2">{products.map((item) => <label key={item.id} className="flex items-center gap-3 border-b border-border pb-2">
              <input type="checkbox" checked={outfitIds.includes(item.id)} onChange={() => toggleOutfit(item.id)}/>
              <img src={item.img} alt={item.name} className="w-11 h-12 rounded-lg object-cover"/>
              <span className="text-foreground text-xs flex-1">{item.name}</span><span className="text-[#7B61FF] text-[10px]">{money(item.price)}</span>
            </label>)}</div>
            <div className="flex justify-between text-xs text-foreground"><span>{outfitIds.length} selected</span><b>{money(selectedOutfitTotal)}</b></div>
            <button disabled={!token || busy || !outfitIds.length} onClick={() => token && void run(async () => { await saveOutfit({ token, name: outfitName, productIds: outfitIds }); setOutfitIds([]); }, "Outfit saved.")} className={button}>Save outfit</button>
          </div>
          <h3 className="text-foreground text-sm font-semibold">Saved outfits</h3>
          {(outfits ?? []).map((item: any) => <div key={item._id} className={card}><b className="text-foreground text-xs">{item.name}</b><div className="flex gap-2 mt-2 overflow-x-auto">{item.products.map((p: any) => <img key={p.id} src={p.img} alt={p.name} title={p.name} className="w-14 h-16 rounded-lg object-cover"/>)}</div></div>)}
        </div>;

      case "events":
        return <div className="space-y-3">
          <div className={card + " space-y-3"}>
            <div className="flex items-center gap-2"><CalendarDays size={17} className="text-[#7B61FF]"/><h2 className="text-foreground text-sm font-semibold">Event shopping planner</h2></div>
            <select value={eventName} onChange={(e) => { setEventName(e.target.value); setEventIds([]); }} className={field}>{["Wedding","College","Office","Gym","Vacation","Party","Festival"].map((value) => <option key={value}>{value}</option>)}</select>
            <label className="text-muted-foreground text-xs">Budget (₹)<input type="number" min="1" value={eventBudget} onChange={(e) => setEventBudget(e.target.value)} className={field + " mt-1"}/></label>
            <div className="space-y-2">{products.map((item) => <label key={item.id} className="flex items-center gap-3 border-b border-border pb-2">
              <input type="checkbox" checked={eventIds.includes(item.id)} onChange={() => toggleEvent(item.id)}/>
              <img src={item.img} alt={item.name} className="w-11 h-12 rounded-lg object-cover"/>
              <span className="text-foreground text-xs flex-1">{item.name}</span><span className="text-[#7B61FF] text-[10px]">{money(item.price)}</span>
            </label>)}</div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Selected total</span><b className="text-foreground">{money(selectedEventTotal)}</b></div>
            {selectedEventTotal > Number(eventBudget) && <p className="text-red-500 text-[10px]">The selected products exceed this budget.</p>}
            <button disabled={!token || busy || !eventIds.length || selectedEventTotal > Number(eventBudget)} onClick={() => token && void run(async () => { await saveEventShoppingList({ token, event: eventName, budget: Number(eventBudget), productIds: eventIds }); setEventIds([]); }, "Event list saved.")} className={button}>Save event list</button>
          </div>
          <h3 className="text-foreground text-sm font-semibold">Saved event lists</h3>
          {(eventLists ?? []).map((item: any) => <div key={item._id} className={card}><b className="text-foreground text-xs">{item.event}</b><p className="text-muted-foreground text-[10px] mt-1">{item.products.length} items · budget {money(item.budget)}</p></div>)}
        </div>;

      case "wardrobe":
        return <div className="space-y-3">
          <div className={card + " space-y-3"}>
            <div className="flex items-center gap-2"><Shirt size={17} className="text-[#7B61FF]"/><h2 className="text-foreground text-sm font-semibold">Virtual wardrobe</h2></div>
            <p className="text-muted-foreground text-[11px]">Upload photos and label each item. Product matches use your selected category; images are not analysed by computer vision.</p>
            <input value={wardrobeLabel} onChange={(e) => setWardrobeLabel(e.target.value)} maxLength={80} placeholder="Item name (optional)" className={field}/>
            <select value={wardrobeCategory} onChange={(e) => setWardrobeCategory(e.target.value)} className={field}>{["Tops","Bottoms","Outerwear","Shoes","Accessories","Dresses"].map((value) => <option key={value}>{value}</option>)}</select>
            <label className={button + " block text-center cursor-pointer"}>{busy ? "Uploading..." : "Choose photo"}<input type="file" accept="image/*" className="hidden" disabled={!token || busy} onChange={(e) => void uploadWardrobe(e.target.files?.[0])}/></label>
          </div>
          {(wardrobe ?? []).map((item: any) => <div key={item._id} className={card + " flex gap-3 items-center"}>
            <img src={item.imageUrl ?? ""} alt={item.label} className="w-16 h-16 rounded-xl object-cover"/>
            <div className="flex-1"><b className="text-foreground text-xs">{item.label}</b><p className="text-muted-foreground text-[10px]">{item.category}</p></div>
            <button disabled={!token || busy} onClick={() => token && void run(() => deleteWardrobeItem({ token, itemId: item._id }), "Wardrobe item deleted.")} className="text-red-500"><Trash2 size={15}/></button>
          </div>)}
          {(wardrobe ?? []).length > 0 && <div className={card}><h3 className="text-foreground text-xs font-semibold mb-2">Products from the same category</h3>{products.filter((p) => {
            const categories = new Set((wardrobe ?? []).map((item: any) => item.category));
            return [...categories].some((category) => p.category.toLowerCase().includes(category.toLowerCase().replace(/s$/, "")));
          }).slice(0, 5).map((item) => <button key={item.id} onClick={() => onProduct(item)} className="flex items-center gap-2 w-full py-2 text-left"><img src={item.img} alt={item.name} className="w-9 h-10 rounded-lg object-cover"/><span className="text-foreground text-xs flex-1">{item.name}</span><span className="text-[#7B61FF] text-[10px]">{money(item.price)}</span></button>)}</div>}
        </div>;

      case "assistant":
        return <div className="flex flex-col gap-3">
          <div className={card}><div className="flex items-center gap-2"><MessageCircle size={17} className="text-[#7B61FF]"/><h2 className="text-foreground text-sm font-semibold">Shopping assistant</h2></div><p className="text-muted-foreground text-[11px] mt-1">Describe a category or budget. Recommendations are rule-based matches from the current catalog, not a connected LLM.</p></div>
          <div className="space-y-3">
            {(chat?.messages ?? []).map((message: any, index: number) => <div key={index} className={(message.role === "user" ? "ml-7 bg-[#7B61FF] text-white" : "mr-5 bg-card border border-border text-foreground") + " rounded-2xl p-3"}>
              <p className="text-xs">{message.text}</p>
              {message.productIds?.length ? <div className="mt-2 space-y-2">{message.productIds.map((id: number) => products.find((p) => p.id === id)).filter(Boolean).map((item: any) => <button key={item.id} onClick={() => onProduct(item)} className="flex gap-2 items-center w-full text-left"><img src={item.img} alt={item.name} className="w-9 h-10 rounded-lg object-cover"/><span className="text-xs flex-1">{item.name}</span><span className="text-[10px]">{money(item.price)}</span></button>)}</div> : null}
            </div>)}
          </div>
          <div className="flex gap-2"><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Office outfit under ₹3000..." className={field + " min-w-0"}/><button disabled={!token || busy || !chatInput.trim()} onClick={sendChat} className={button}>Send</button></div>
        </div>;

      case "price-history":
        return <div className={card + " space-y-3"}>
          <h2 className="text-foreground text-sm font-semibold">Recorded price history</h2>
          <p className="text-muted-foreground text-[11px]">This view only shows catalog snapshots already recorded by the store. No price forecast or artificial history is generated.</p>
          <select value={historyProductId} onChange={(e) => setHistoryProductId(Number(e.target.value))} className={field}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          {recordedHistory.length > 0 ? <>
            <div className="grid grid-cols-3 gap-2">{[
              { label: "Lowest", value: Math.min(...historicalValues) },
              { label: "Average", value: historicalValues.reduce((sum, value) => sum + value, 0) / historicalValues.length },
              { label: "Highest", value: Math.max(...historicalValues) },
            ].map((item) => <div key={item.label}><p className="text-muted-foreground text-[9px]">{item.label}</p><b className="text-foreground text-xs">{money(item.value)}</b></div>)}</div>
            {recordedHistory.map((point, index) => <div key={String(point.month) + index} className="flex justify-between border-t border-border py-2"><span className="text-muted-foreground text-xs">{point.month}</span><b className="text-foreground text-xs">{money(point.price)}</b></div>)}
          </> : <p className="text-muted-foreground text-xs">No recorded price snapshots are available for this product yet.</p>}
        </div>;
    }
  })();

  return <div className="h-full flex flex-col bg-background">
    <header className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground"><ArrowLeft size={16}/></button>
      <div className="flex-1 min-w-0"><h1 className="text-foreground font-bold text-base">Smart Commerce</h1><p className="text-muted-foreground text-[10px]">{userName} · Saved customer features</p></div>
      <span className="text-[#7B61FF] text-[10px] font-bold">{unreadCount} new</span>
    </header>
    <nav className="flex-shrink-0 flex gap-2 overflow-x-auto px-5 py-3 border-b border-border scrollbar-hide">
      {sections.map((item) => <button key={item.id} onClick={() => nav(item.id)} className={(section === item.id ? "bg-[#7B61FF] text-white" : "bg-secondary text-foreground") + " rounded-full px-3 py-2 text-[10px] whitespace-nowrap"}>{item.label}</button>)}
    </nav>
    <main className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      {!token && <p className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl p-3 text-xs mb-3">Sign in to save changes to your account. These features use secure customer sessions and are not available in guest mode.</p>}
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl p-3 text-xs mb-3">{error}</div>}
      {notice && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-3 text-xs mb-3">{notice}</div>}
      {busy && <p className="text-muted-foreground text-[10px] mb-2">Saving…</p>}
      {content}
    </main>
  </div>;
}
