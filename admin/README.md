# SF Commerce Admin

A separate Vite + React admin application for Smart Fashion Commerce.

## Run locally

```bash
cd admin
npm install
npm run dev
```

For a type check and production build:

```bash
npm run typecheck
npm run build
```

Open http://localhost:4174. To use the existing public Convex reads, copy `.env.example` to `.env` and set `VITE_CONVEX_URL` to the same deployment URL used by the storefront.

## Current integration status

The dashboard uses demonstration data by default. When `VITE_CONVEX_URL` is configured, it reads the existing public `revenueWeekly`, `collectionRequests`, and `votingCards` Convex queries. Revenue totals/KPIs, products, stock, orders, bargaining, pre-orders, customers, and campaigns remain preview data because the existing backend does not expose those admin operations. No admin writes are sent to Convex. See `src/lib/adminApi.ts` for the fail-closed admin integration boundary.

Before production: implement server-side admin authentication, role-based access control, and admin-scoped Convex queries/mutations. Do not rely on hiding UI controls for access control. Add inventory and order data models and business rules before enabling fulfilment actions.

## Deploy separately

For a separate Vercel deployment, import this same repository and set the project Root Directory to `admin`. The storefront deployment remains rooted at the repository root.
