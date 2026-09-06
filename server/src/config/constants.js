/**
 * System-wide Constants and Enums
 */

const ROLES = Object.freeze({
  PLATFORM_OWNER_DISTRIBUTOR: 'platform_owner_distributor',
  DISTRIBUTOR: 'distributor',
  DEALER: 'dealer',
  CUSTOMER: 'customer',
  INFLUENCER: 'influencer',
  // Future roles
  DISTRIBUTOR_STAFF: 'distributor_staff',
  DEALER_STAFF: 'dealer_staff',
});

const DISTRIBUTOR_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
});

const DEALER_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REJECTED: 'rejected',
});

const DEALER_TYPE = Object.freeze({
  WHOLESALER: 'wholesaler',
  RETAILER: 'retailer',
  BOTH: 'both',
});

const DEALER_SOURCE = Object.freeze({
  SELF_REGISTERED: 'self_registered',
  CREATED_BY_DISTRIBUTOR: 'created_by_distributor',
});

const CUSTOMER_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REJECTED: 'rejected',
});

const CUSTOMER_CREATED_BY_TYPE = Object.freeze({
  DEALER: 'dealer',
  DISTRIBUTOR: 'distributor',
  SELF: 'self',
});

const INFLUENCER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const INFLUENCER_SOURCE = Object.freeze({
  CREATED_BY_DEALER: 'created_by_dealer',
  CREATED_BY_DISTRIBUTOR: 'created_by_distributor',
  SELF_REGISTERED: 'self_registered',
});

const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  DISCONTINUED: 'discontinued',
});

const PURCHASE_STATUS = Object.freeze({
  PENDING: 'pending',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
});

const INVOICE_STATUS = Object.freeze({
  PENDING: 'pending',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

const TERMINAL_INVOICE_STATUSES = Object.freeze([
  INVOICE_STATUS.DELIVERED,
  INVOICE_STATUS.CANCELLED,
]);

const INVENTORY_MOVEMENT_REASONS = Object.freeze({
  DISTRIBUTOR_PURCHASE: 'distributor_purchase',
  DEALER_SALE: 'dealer_sale',
  CUSTOMER_SALE: 'customer_sale',
  RETURN: 'return',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  IN_TRANSIT_HOLD: 'in_transit_hold',
  IN_TRANSIT_CANCELLED: 'in_transit_cancelled',
});

const POINTS_REASONS = Object.freeze({
  WELCOME_BONUS: 'welcome_bonus',
  ORDER_PURCHASE: 'order_purchase',
  REFERRAL_BONUS: 'referral_bonus',
  INFLUENCER_COMMISSION: 'influencer_commission',
  REDEMPTION_DEBIT: 'redemption_debit',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
});

const REDEMPTION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
});

const REGISTRATION_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

module.exports = {
  ROLES,
  DISTRIBUTOR_STATUS,
  DEALER_STATUS,
  DEALER_TYPE,
  DEALER_SOURCE,
  CUSTOMER_STATUS,
  CUSTOMER_CREATED_BY_TYPE,
  INFLUENCER_STATUS,
  INFLUENCER_SOURCE,
  PRODUCT_STATUS,
  PURCHASE_STATUS,
  INVOICE_STATUS,
  TERMINAL_INVOICE_STATUSES,
  INVENTORY_MOVEMENT_REASONS,
  POINTS_REASONS,
  REDEMPTION_STATUS,
  REGISTRATION_REQUEST_STATUS,
  PAGINATION,
};
