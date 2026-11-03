# AI Stylist setup

The customer AI Stylist uses a Vercel serverless endpoint and Convex. The Groq key remains server-side and is never sent to the browser.

## Configure Groq

1. Open the linked Vercel project.
2. Add GROQ_API_KEY as a server-side environment variable for every environment that should run the AI Stylist.
3. Set VITE_CONVEX_URL to the Convex deployment containing the Smart Fashion customer, usage, and product-search functions.
4. Deploy the Vercel application and Convex functions to the matching environments.

Do not add the Groq key to a VITE_* variable, source files, Git commits, or the customer app.

## Search behaviour

1. A customer writes naturally, for example: “I need a black casual hoodie under ₹2,000, size M”.
2. Groq GPT-OSS interprets the request and returns structured search intent: keywords, category, colour, material, style, size, and budget filters. Private reasoning is not returned.
3. If a photo is attached, Groq Qwen vision extracts visible garment attributes. Those attributes are included in the search intent.
4. The Vercel endpoint passes only those search terms and filters to the Convex searchProducts query. It does not send the full catalogue to the model.
5. Convex searches existing products across product name, brand, category, description, material, colour, size, and tags; it scores matching records and returns the best real products.
6. The UI displays the terms it understood and the actual matching product cards from the store. Product names, images, prices, available sizes, and stock are never invented by the AI.

The current implementation scans the products table and ranks matching records. Before the catalogue grows substantially, move the same matching logic to a dedicated Convex search index and paginate results.

## Limits and privacy

- The endpoint checks the signed-in customer session and uses the Convex usage guard (5 requests/minute and 40 requests/day).
- Photos are resized in the browser, sent to Groq for clothing analysis, and are not persisted by this feature.
- If Groq intent extraction is temporarily unavailable, the service falls back to direct keyword matching rather than returning unrelated products.
- Request failures are logged with a Vercel request ID and error metadata. Customer prompts, photos, session tokens, and API keys are not logged.
