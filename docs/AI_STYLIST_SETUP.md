# AI Stylist setup

The customer AI Stylist uses a Convex server action to call Groq. The Groq key is never sent to the browser.

## Configure Groq

1. Open the Convex dashboard for the deployment used by Smart Fashion.
2. Open **Settings → Environment Variables**.
3. Add `GROQ_API_KEY` with the API key from your Groq account.
4. Deploy the Convex functions after the new `convex/aiStylist.ts` module is committed.

For a local Convex development deployment, use:

```bash
npx convex env set GROQ_API_KEY your_groq_api_key
```

Do not add the key to `VITE_*` variables, source files, GitHub commits, or the customer app.

## Search behaviour

- Groq interprets natural-language requests and ranks the supplied catalogue.
- Product name, description, category, material, colours, sizes and price are supplied as context.
- The server returns only IDs that exist in the current Convex catalogue.
- Current stock is read from Convex; out-of-stock products remain eligible and can be wishlisted.
- This first version uses LLM catalogue ranking, not embeddings or a vector database.
- If the Groq key is absent or the provider is unavailable, the UI displays an error rather than silently showing unrelated products.
