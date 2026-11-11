/**
 * System-wide Constants and Enums
 */

export const ROLES = {
  PLATFORM_OWNER_DISTRIBUTOR: 'platform_owner_distributor',
  DISTRIBUTOR: 'distributor',
  DEALER: 'dealer',
  RETAILER: 'retailer',
  CUSTOMER: 'customer',
  INFLUENCER: 'influencer',
  STAFF: 'staff',
  // Legacy / future aliases
  DISTRIBUTOR_STAFF: 'distributor_staff',
  DEALER_STAFF: 'dealer_staff',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const DISTRIBUTOR_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const DEALER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REJECTED: 'rejected',
} as const;

export const DEALER_TYPE = {
  DEALER: 'dealer',
  RETAILER: 'retailer',
} as const;

export const DEALER_SOURCE = {
  SELF_REGISTERED: 'self_registered',
  CREATED_BY_DISTRIBUTOR: 'created_by_distributor',
  CREATED_BY_DEALER: 'created_by_dealer',
} as const;

export const CUSTOMER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REJECTED: 'rejected',
} as const;

export const CUSTOMER_CREATED_BY_TYPE = {
  DEALER: 'dealer',
  DISTRIBUTOR: 'distributor',
  SELF: 'self',
  STAFF: 'staff',
} as const;

export const STAFF_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const STAFF_EMPLOYER_TYPE = {
  DISTRIBUTOR: 'distributor',
  DEALER: 'dealer',
} as const;

export const INVOICE_APPROVAL_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const INFLUENCER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export const INFLUENCER_SOURCE = {
  CREATED_BY_DEALER: 'created_by_dealer',
  CREATED_BY_DISTRIBUTOR: 'created_by_distributor',
  SELF_REGISTERED: 'self_registered',
} as const;

export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  DISCONTINUED: 'discontinued',
} as const;

export const PURCHASE_STATUS = {
  PENDING: 'pending',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
} as const;

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PENDING: 'pending',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const TERMINAL_INVOICE_STATUSES = [
  INVOICE_STATUS.DELIVERED,
  INVOICE_STATUS.CANCELLED,
] as const;

export const INVENTORY_MOVEMENT_REASONS = {
  DISTRIBUTOR_PURCHASE: 'distributor_purchase',
  DEALER_SALE: 'dealer_sale',
  CUSTOMER_SALE: 'customer_sale',
  RETURN: 'return',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  IN_TRANSIT_HOLD: 'in_transit_hold',
  IN_TRANSIT_CANCELLED: 'in_transit_cancelled',
} as const;

export const POINTS_REASONS = {
  WELCOME_BONUS: 'welcome_bonus',
  ORDER_PURCHASE: 'order_purchase',
  REFERRAL_BONUS: 'referral_bonus',
  INFLUENCER_COMMISSION: 'influencer_commission',
  REDEMPTION_DEBIT: 'redemption_debit',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
} as const;

export const REDEMPTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
} as const;

export const REGISTRATION_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
