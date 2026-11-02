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

Copy `.env.example` to `.env` and set `VITE_CONVEX_URL` to the storefront's Convex deployment URL.

## Admin access

Admin sign-in uses the existing `users` table. The account must be verified, unblocked, and have `role: "admin"`. Customer login remains separate. The admin backend issues a random eight-hour session token, stores only its SHA-256 digest, and checks the account role on each protected query or mutation. The browser keeps the token in session storage and signs out by revoking it.

Do not set a user's role from the browser. Assign or change the role only through a trusted database/admin operation. Do not put credentials or deployment keys in source control.

## Live functionality currently connected

- Admin login, session validation and logout.
- Authenticated product catalogue read.
- Create product drafts in Convex.
- Update product stock quantities in Convex.
- Move collection requests into the `In Review` state.
- Read existing revenue history and community vote data.

The existing database does not yet contain order, bargaining, pre-order, campaign or customer-activity records. Those screens still contain illustrative preview data and must not be used to fulfil real orders or make operational decisions. Revenue history is live, but headline sales/customer KPI values and several analytics cards are still sample values.

## Deploying the backend

The Convex schema and functions are in the repository's `convex/` directory. Add a GitHub Actions repository secret named `CONVEX_DEPLOY_KEY` to enable the workflow at `.github/workflows/convex-deploy.yml`. Obtain the deployment key from the Convex deployment settings. Until that secret is configured and the workflow succeeds, the new `adminSessions` table and `adminAuth` functions are committed but are **not live** in Convex.

The separate Vercel project uses Root Directory `admin` and needs `VITE_CONVEX_URL` set to the same Convex deployment as the storefront.

## Remaining product-readiness work

1. Deploy the Convex schema and functions, then test admin login with the existing verified `admin` user.
2. Replace the legacy client-side SHA-256 password scheme with a modern password hashing/authentication design; migrate existing users without breaking customer sign-in.
3. Define and implement order, line-item, payment/refund, inventory movement, bargaining, pre-order, and campaign schemas and business rules before enabling those modules.
4. Add audit logging, login throttling, session cleanup, backup/restore checks, and operational monitoring.
5. Add automated integration tests for role denial, blocked/unverified users, session expiry/revocation, and each admin mutation.

## Deploy separately

Import this repository into Vercel with Root Directory set to `admin`. The storefront deployment remains rooted at the repository root.
