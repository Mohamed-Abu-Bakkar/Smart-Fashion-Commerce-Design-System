import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const catalog = internalQuery({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return products.map((p) => ({ id:p.id,name:p.name,brand:p.brand,category:p.category,price:p.price,material:p.material,desc:p.desc,colors:p.colors,sizes:p.sizes,stock:p.stock??null,status:p.status??"Active" }));
  },
});

export const search = action({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    const prompt=args.prompt.trim();
    if(prompt.length<3||prompt.length>500) throw new Error("Search must be between 3 and 500 characters.");
    const key=process.env.GROQ_API_KEY;
    if(!key) throw new Error("AI Stylist is not configured. Add GROQ_API_KEY to Convex environment variables.");
    const catalog=await ctx.runQuery(internal.aiStylist.catalog,{});
    const compact=catalog.map((p)=>({id:p.id,name:p.name,brand:p.brand,category:p.category,price:p.price,material:p.material,description:p.desc,colours:p.colors,sizes:p.sizes,stock:p.stock}));
    const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"llama-3.3-70b-versatile",temperature:0.15,response_format:{type:"json_object"},messages:[
      {role:"system",content:"You are Smart Fashion's product retrieval assistant. Match user intent to ONLY the supplied catalogue. Interpret occasion, style, comfort, material, colour, fit, size and budget. Do not invent products, stock, prices, features or sizes. Include out-of-stock products when relevant. Return JSON only: { \"message\": string, \"matches\": [{ \"id\": number, \"reason\": string }] }. Return at most 6 matches, best first. If nothing fits, return an empty matches array and explain why."},
      {role:"user",content:JSON.stringify({request:prompt,catalogue:compact})}
    ]})});
    if(!response.ok){const detail=await response.text();throw new Error(`Groq request failed (${response.status}): ${detail.slice(0,200)}`);}
    const payload=await response.json();const raw=payload.choices?.[0]?.message?.content;
    if(typeof raw!=="string")throw new Error("AI Stylist returned an invalid response.");
    let parsed:any;try{parsed=JSON.parse(raw);}catch{throw new Error("AI Stylist could not parse the recommendation response.");}
    const byId=new Map(catalog.map((p)=>[p.id,p]));
    const matches=(Array.isArray(parsed.matches)?parsed.matches:[]).filter((m:any)=>Number.isInteger(m.id)&&byId.has(m.id)).slice(0,6).map((m:any)=>({...byId.get(m.id)!,reason:String(m.reason??"Matches your request.")}));
    return {message:typeof parsed.message==="string"?parsed.message:"Here are the closest catalogue matches.",matches};
  },
});
