/**
 * All available platform permissions.
 * Super Admin gets "*" which bypasses all checks.
 * Custom roles get a subset of these.
 */

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: "dashboard.view",

  // Bookings
  BOOKINGS_VIEW: "bookings.view",
  BOOKINGS_MANAGE: "bookings.manage",
  BOOKINGS_FORCE_COMPLETE: "bookings.force_complete",
  BOOKINGS_REFUND: "bookings.refund",

  // Disputes
  DISPUTES_VIEW: "disputes.view",
  DISPUTES_MANAGE: "disputes.manage",

  // Pros (groomers)
  PROS_VIEW: "pros.view",
  PROS_MANAGE: "pros.manage",

  // Customers
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",

  // Payouts
  PAYOUTS_VIEW: "payouts.view",
  PAYOUTS_MANAGE: "payouts.manage",

  // Catalog (services + zones)
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",

  // Settings
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE_OPS: "settings.manage_ops",
  SETTINGS_MANAGE_FINANCE: "settings.manage_finance",

  // Team
  TEAM_VIEW: "team.view",
  TEAM_MANAGE: "team.manage",

  // Analytics
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_EXPORT: "analytics.export",

  // Advances
  ADVANCES_VIEW: "advances.view",
  ADVANCES_MANAGE: "advances.manage",

  // Subscriptions
  SUBSCRIPTIONS_VIEW: "subscriptions.view",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",

  // Notes
  NOTES_VIEW: "notes.view",
  NOTES_MANAGE: "notes.manage",

  // Activity log
  ACTIVITY_VIEW: "activity.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** All permission values as a flat array (for UI dropdowns) */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Grouped permissions for the role editor UI */
export const PERMISSION_GROUPS: Record<string, { label: string; permissions: { key: Permission; label: string }[] }> = {
  dashboard: {
    label: "Dashboard",
    permissions: [
      { key: PERMISSIONS.DASHBOARD_VIEW, label: "View dashboard" },
    ],
  },
  bookings: {
    label: "Bookings",
    permissions: [
      { key: PERMISSIONS.BOOKINGS_VIEW, label: "View bookings" },
      { key: PERMISSIONS.BOOKINGS_MANAGE, label: "Manage bookings (assign, update)" },
      { key: PERMISSIONS.BOOKINGS_FORCE_COMPLETE, label: "Force-complete bookings" },
      { key: PERMISSIONS.BOOKINGS_REFUND, label: "Initiate refunds" },
    ],
  },
  disputes: {
    label: "Disputes",
    permissions: [
      { key: PERMISSIONS.DISPUTES_VIEW, label: "View disputes" },
      { key: PERMISSIONS.DISPUTES_MANAGE, label: "Resolve disputes" },
    ],
  },
  pros: {
    label: "Beauty Pros",
    permissions: [
      { key: PERMISSIONS.PROS_VIEW, label: "View pro profiles" },
      { key: PERMISSIONS.PROS_MANAGE, label: "Manage pros (edit, verify, strike)" },
    ],
  },
  customers: {
    label: "Customers",
    permissions: [
      { key: PERMISSIONS.CUSTOMERS_VIEW, label: "View customers" },
      { key: PERMISSIONS.CUSTOMERS_MANAGE, label: "Manage customers (block, credit)" },
    ],
  },
  payouts: {
    label: "Payouts",
    permissions: [
      { key: PERMISSIONS.PAYOUTS_VIEW, label: "View payouts & earnings" },
      { key: PERMISSIONS.PAYOUTS_MANAGE, label: "Process payouts" },
    ],
  },
  catalog: {
    label: "Catalog",
    permissions: [
      { key: PERMISSIONS.CATALOG_VIEW, label: "View services & zones" },
      { key: PERMISSIONS.CATALOG_MANAGE, label: "Manage services & zones" },
    ],
  },
  settings: {
    label: "Settings",
    permissions: [
      { key: PERMISSIONS.SETTINGS_VIEW, label: "View settings" },
      { key: PERMISSIONS.SETTINGS_MANAGE_OPS, label: "Edit operational settings" },
      { key: PERMISSIONS.SETTINGS_MANAGE_FINANCE, label: "Edit financial settings" },
    ],
  },
  team: {
    label: "Team",
    permissions: [
      { key: PERMISSIONS.TEAM_VIEW, label: "View team members" },
      { key: PERMISSIONS.TEAM_MANAGE, label: "Manage team (invite, roles)" },
    ],
  },
  analytics: {
    label: "Analytics",
    permissions: [
      { key: PERMISSIONS.ANALYTICS_VIEW, label: "View analytics" },
      { key: PERMISSIONS.ANALYTICS_EXPORT, label: "Export data (CSV)" },
    ],
  },
  advances: {
    label: "Advances",
    permissions: [
      { key: PERMISSIONS.ADVANCES_VIEW, label: "View advance requests" },
      { key: PERMISSIONS.ADVANCES_MANAGE, label: "Approve/deny advances" },
    ],
  },
  subscriptions: {
    label: "Subscriptions",
    permissions: [
      { key: PERMISSIONS.SUBSCRIPTIONS_VIEW, label: "View subscriptions" },
      { key: PERMISSIONS.SUBSCRIPTIONS_MANAGE, label: "Manage subscriptions" },
    ],
  },
  notes: {
    label: "Notes",
    permissions: [
      { key: PERMISSIONS.NOTES_VIEW, label: "View internal notes" },
      { key: PERMISSIONS.NOTES_MANAGE, label: "Add/edit notes" },
    ],
  },
  activity: {
    label: "Activity Log",
    permissions: [
      { key: PERMISSIONS.ACTIVITY_VIEW, label: "View activity log" },
    ],
  },
};

/** Default role definitions used for seeding */
export const DEFAULT_ROLES = [
  {
    name: "Super Admin",
    slug: "super-admin",
    description: "Full platform access. Can manage team, roles, and all settings.",
    permissions: ["*"],
    isSystem: true,
  },
  {
    name: "Ops Manager",
    slug: "ops-manager",
    description: "Manages bookings, disputes, pros, customers, and catalog.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.BOOKINGS_VIEW,
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.BOOKINGS_FORCE_COMPLETE,
      PERMISSIONS.DISPUTES_VIEW,
      PERMISSIONS.DISPUTES_MANAGE,
      PERMISSIONS.PROS_VIEW,
      PERMISSIONS.PROS_MANAGE,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.CATALOG_VIEW,
      PERMISSIONS.CATALOG_MANAGE,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_MANAGE_OPS,
      PERMISSIONS.NOTES_VIEW,
      PERMISSIONS.NOTES_MANAGE,
    ],
    isSystem: false,
  },
  {
    name: "Pro Manager",
    slug: "pro-manager",
    description: "Onboards and manages beauty professionals.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PROS_VIEW,
      PERMISSIONS.PROS_MANAGE,
      PERMISSIONS.NOTES_VIEW,
      PERMISSIONS.NOTES_MANAGE,
    ],
    isSystem: false,
  },
  {
    name: "Support",
    slug: "support",
    description: "Handles customer queries and dispute escalation.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.BOOKINGS_VIEW,
      PERMISSIONS.DISPUTES_VIEW,
      PERMISSIONS.DISPUTES_MANAGE,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.NOTES_VIEW,
      PERMISSIONS.NOTES_MANAGE,
    ],
    isSystem: false,
  },
  {
    name: "Finance",
    slug: "finance",
    description: "Manages payouts, earnings, and financial settings.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PAYOUTS_VIEW,
      PERMISSIONS.PAYOUTS_MANAGE,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_MANAGE_FINANCE,
      PERMISSIONS.ADVANCES_VIEW,
      PERMISSIONS.ADVANCES_MANAGE,
    ],
    isSystem: false,
  },
];
