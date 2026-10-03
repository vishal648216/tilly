// Taily - Centralized Permissions & Role-Based Access Control (RBAC)
// Phase 1: Secure Multi-Tenant Architecture

export const PERMISSIONS = {
  // Sales
  SALES_VIEW: "SALES_VIEW",
  SALES_CREATE: "SALES_CREATE",
  SALES_EDIT: "SALES_EDIT",
  SALES_CANCEL: "SALES_CANCEL",
  SALES_RETURN: "SALES_RETURN",

  // Purchases
  PURCHASE_VIEW: "PURCHASE_VIEW",
  PURCHASE_CREATE: "PURCHASE_CREATE",
  PURCHASE_EDIT: "PURCHASE_EDIT",
  PURCHASE_CANCEL: "PURCHASE_CANCEL",
  PURCHASE_RETURN: "PURCHASE_RETURN",

  // Products & Inventory
  PRODUCT_VIEW: "PRODUCT_VIEW",
  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_EDIT: "PRODUCT_EDIT",
  STOCK_VIEW: "STOCK_VIEW",
  STOCK_ADJUST: "STOCK_ADJUST",
  STOCK_TRANSFER: "STOCK_TRANSFER",

  // Parties (Customers & Suppliers)
  PARTY_VIEW: "PARTY_VIEW",
  PARTY_CREATE: "PARTY_CREATE",
  PARTY_EDIT: "PARTY_EDIT",

  // Payments & Cash Flow
  PAYMENT_VIEW: "PAYMENT_VIEW",
  PAYMENT_CREATE: "PAYMENT_CREATE",

  // Expenses
  EXPENSE_VIEW: "EXPENSE_VIEW",
  EXPENSE_CREATE: "EXPENSE_CREATE",

  // Accounting & Ledger
  ACCOUNTING_VIEW: "ACCOUNTING_VIEW",
  VOUCHER_CREATE: "VOUCHER_CREATE",

  // Reports & GST
  REPORT_VIEW: "REPORT_VIEW",
  GST_VIEW: "GST_VIEW",

  // Administration & Tenant Settings
  USER_MANAGE: "USER_MANAGE",
  ROLE_MANAGE: "ROLE_MANAGE",
  SETTINGS_MANAGE: "SETTINGS_MANAGE",
  COMPANY_MANAGE: "COMPANY_MANAGE",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  COMPANY_ADMIN: "COMPANY_ADMIN",
  ACCOUNTANT: "ACCOUNTANT",
  SALES_USER: "SALES_USER",
  PURCHASE_USER: "PURCHASE_USER",
  INVENTORY_USER: "INVENTORY_USER",
  VIEWER: "VIEWER",
  CUSTOM_ROLE: "CUSTOM_ROLE",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Canonical Role-to-Permissions Mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],

  COMPANY_ADMIN: [...ALL_PERMISSIONS],

  ACCOUNTANT: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.PARTY_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.VOUCHER_CREATE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.GST_VIEW,
  ],

  SALES_USER: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.SALES_CANCEL,
    PERMISSIONS.SALES_RETURN,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.PARTY_VIEW,
    PERMISSIONS.PARTY_CREATE,
    PERMISSIONS.PARTY_EDIT,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
  ],

  PURCHASE_USER: [
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PURCHASE_EDIT,
    PERMISSIONS.PURCHASE_CANCEL,
    PERMISSIONS.PURCHASE_RETURN,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.PARTY_VIEW,
    PERMISSIONS.PARTY_CREATE,
    PERMISSIONS.PARTY_EDIT,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
  ],

  INVENTORY_USER: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_ADJUST,
    PERMISSIONS.STOCK_TRANSFER,
  ],

  VIEWER: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.PARTY_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.GST_VIEW,
  ],

  CUSTOM_ROLE: [],
};

/**
 * Resolves permissions for a user given their role and optional custom permissions
 */
export function getRolePermissions(role: string, customPermissionsJson?: string | null): Permission[] {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.COMPANY_ADMIN) {
    return [...ALL_PERMISSIONS];
  }

  if (role === ROLES.CUSTOM_ROLE && customPermissionsJson) {
    try {
      const parsed = JSON.parse(customPermissionsJson);
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is Permission => Object.values(PERMISSIONS).includes(p));
      }
    } catch {
      return [];
    }
  }

  const normalizedRole = role.toUpperCase() as Role;
  return ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * Checks if a role/custom permission set contains the specified permission
 */
export function hasPermission(
  role: string,
  permission: Permission,
  customPermissionsJson?: string | null
): boolean {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.COMPANY_ADMIN) {
    return true;
  }

  const permissions = getRolePermissions(role, customPermissionsJson);
  return permissions.includes(permission);
}
