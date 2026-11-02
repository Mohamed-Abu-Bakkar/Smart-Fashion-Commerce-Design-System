/**
 * Admin API boundary.
 * The current Convex schema has storefront-facing product, collection-request,
 * voting and notification queries, but no admin authentication/RBAC or admin
 * mutations. Keep privileged writes behind server-side authorization before
 * connecting this interface to production data.
 */
export type AdminCapability =
  | "products.read" | "products.write" | "inventory.write"
  | "orders.read" | "orders.fulfil" | "bargaining.manage"
  | "preorders.manage" | "collections.manage" | "community.manage"
  | "customers.read" | "analytics.read" | "campaigns.manage";

export interface AdminSession {
  subject: string;
  roles: Array<"owner" | "admin" | "catalog" | "fulfilment" | "support" | "analyst">;
  capabilities: AdminCapability[];
}

export interface AdminApi {
  getSession(): Promise<AdminSession | null>;
  hasCapability(capability: AdminCapability): boolean;
}

/** Placeholder intentionally fails closed until a verified admin session exists. */
export const adminApi: AdminApi = {
  async getSession() { return null; },
  hasCapability() { return false; },
};
