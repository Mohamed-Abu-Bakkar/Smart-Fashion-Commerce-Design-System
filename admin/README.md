# SF Commerce Admin

A separate Vite + React admin application for Smart Fashion Commerce.

## Run locally

```bash
cd admin
pnpm install
pnpm dev
```

Open http://localhost:4174.

## Current integration status

The dashboard ships with clearly identified demonstration data. The repository currently exposes customer-facing Convex shop/auth functionality, but not admin-scoped product, inventory, order, bargaining, preorder, voting, or analytics operations. No admin writes are sent to the customer backend. See `src/lib/adminApi.ts` for the typed integration boundary.

Before production: implement server-side admin authorization and Convex admin queries/mutations; never rely on hiding UI controls for access control. Configure `VITE_CONVEX_URL` only after the authorization model is ready.
