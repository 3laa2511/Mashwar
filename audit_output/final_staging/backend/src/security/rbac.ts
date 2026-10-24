/**
 * Mashwar — Role-Based Access Control (RBAC) & Security Policies
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 */

export type UserRole =
  | 'owner'               // Platform Owner (full authority)
  | 'operations_dispatcher' // Hub Dispatcher & Operations Manager
  | 'support_agent'       // Customer Support Agent
  | 'captain'             // Delivery Captain
  | 'customer'            // End Customer
  | 'merchant';           // Restaurant / Store Partner

export type SecurityPermission =
  | 'manage_pricing'
  | 'manage_system_settings'
  | 'manage_zones'
  | 'manage_merchants'
  | 'manage_captain_accounts'
  | 'settle_cash_remittance'
  | 'manual_dispatch_override'
  | 'manage_complaints'
  | 'cancel_order'
  | 'view_audit_logs'
  | 'view_hub_analytics'
  | 'accept_dispatch_offer'
  | 'update_delivery_status'
  | 'manage_own_store'
  | 'create_order'
  | 'request_quote';

export const ROLE_PERMISSIONS: Record<UserRole, SecurityPermission[]> = {
  owner: [
    'manage_pricing',
    'manage_system_settings',
    'manage_zones',
    'manage_merchants',
    'manage_captain_accounts',
    'settle_cash_remittance',
    'manual_dispatch_override',
    'manage_complaints',
    'cancel_order',
    'view_audit_logs',
    'view_hub_analytics',
  ],
  operations_dispatcher: [
    'manage_zones',
    'manage_merchants',
    'manage_captain_accounts',
    'settle_cash_remittance',
    'manual_dispatch_override',
    'manage_complaints',
    'cancel_order',
    'view_audit_logs',
    'view_hub_analytics',
  ],
  support_agent: [
    'manage_complaints',
    'cancel_order',
    'view_hub_analytics',
  ],
  captain: [
    'accept_dispatch_offer',
    'update_delivery_status',
  ],
  customer: [
    'create_order',
    'request_quote',
    'cancel_order', // Restricted to pre-pickup
  ],
  merchant: [
    'manage_own_store',
    'create_order',
    'request_quote',
    'cancel_order',
  ],
};

export class AccessControlGuard {
  /**
   * Evaluates whether a given role holds the requested permission.
   */
  public static hasPermission(role: UserRole, permission: SecurityPermission): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  }

  /**
   * Enforces permission and throws an authorization error if denied.
   */
  public static checkPermission(role: UserRole, permission: SecurityPermission): void {
    if (!this.hasPermission(role, permission)) {
      const err = new Error(
        `صلاحية مرفوضة: الدور '${role}' لا يملك إذن '${permission}' لتنفيذ هذه العملية على النظام.`
      );
      (err as any).code = 'INSUFFICIENT_PERMISSIONS';
      (err as any).statusCode = 403;
      throw err;
    }
  }

  /**
   * Checks if an actor can cancel a specific order depending on its status.
   */
  public static canCancelOrder(role: UserRole, currentOrderStatus: string): boolean {
    if (role === 'owner' || role === 'operations_dispatcher' || role === 'support_agent') {
      return currentOrderStatus !== 'delivered' && currentOrderStatus !== 'cancelled';
    }
    if (role === 'merchant') {
      return (
        currentOrderStatus === 'created' ||
        currentOrderStatus === 'accepted_by_store' ||
        currentOrderStatus === 'preparing' ||
        currentOrderStatus === 'searching_captain'
      );
    }
    if (role === 'customer') {
      // Customers cannot cancel once store started preparing or captain is assigned/en route
      return currentOrderStatus === 'created' || currentOrderStatus === 'searching_captain';
    }
    return false;
  }
}
