/** Shared admin access contracts. Authorization is enforced in convex/adminAuth.ts. */
export type AdminCapability =
  | "products.read" | "products.write" | "inventory.write"
  | "orders.read" | "orders.fulfil" | "bargaining.manage"
  | "preorders.manage" | "collections.manage" | "community.manage"
  | "customers.read" | "analytics.read" | "campaigns.manage";

export interface AdminSession {
  subject: string;
  roles: Array<"admin">;
  capabilities: AdminCapability[];
}

/**
 * UI capability checks are convenience only. Every protected backend operation
 * must independently validate the session token and current users.role.
 */
export function hasAdminRole(session: AdminSession | null): boolean {
  return Boolean(session?.roles.includes("admin"));
}
