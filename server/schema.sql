-- ============================================================================
-- Rabbit Alley POS - Single Schema (run this file only)
-- ============================================================================
-- One-time setup: creates database, all tables, roles, permissions, seed data.
-- Run this single file in HeidiSQL (or mysql client) for a complete setup.
--
-- Default Accounts (see bottom of file): MGR001, WTR001, BAR001 / password
-- ============================================================================

-- Create and use database
CREATE DATABASE IF NOT EXISTS rabbit_alley_pos
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE rabbit_alley_pos;

-- ============================================================================
-- SCHEMA: Tables
-- ============================================================================

-- Roles (guard: web for web app)
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  guard VARCHAR(32) NOT NULL DEFAULT 'web',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_roles_name_guard (name, guard)
);

-- Permissions (all permission names used by the app)
CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_permissions_name (name)
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Branches (multi-branch support)
CREATE TABLE IF NOT EXISTS branches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) NOT NULL,
  address VARCHAR(255) DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_branches_code (code)
);

-- Users (staff with login: employee_id, email, password; branch_id = which branch they work at)
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NOT NULL DEFAULT 1,
  nickname VARCHAR(64) DEFAULT NULL,
  allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
  hourly DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- New fields for commission/incentive system
  budget DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,  -- % commission on ladies drinks
  incentive_rate DECIMAL(10,2) NOT NULL DEFAULT 0,  -- Fixed amount per ladies drink
  table_incentive DECIMAL(10,2) NOT NULL DEFAULT 0, -- Incentive per table served
  has_quota TINYINT(1) NOT NULL DEFAULT 0,          -- 1 = has quota, 0 = no quota
  quota_amount DECIMAL(10,2) NOT NULL DEFAULT 0,    -- Quota target amount
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_employee_id (employee_id),
  UNIQUE KEY uk_users_email (email),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
);

-- POS tables (per branch; areas: Lounge, Club, LD). PK (branch_id, id) = same table code per branch.
CREATE TABLE IF NOT EXISTS pos_tables (
  branch_id INT UNSIGNED NOT NULL DEFAULT 1,
  id VARCHAR(16) NOT NULL,
  name VARCHAR(32) NOT NULL,
  area ENUM('Lounge','Club','LD') NOT NULL,
  status ENUM('available','occupied') NOT NULL DEFAULT 'available',
  current_order_id VARCHAR(32) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (branch_id, id),
  KEY idx_pos_tables_branch (branch_id),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
);

-- Products (with optimized indexes for fast lookups)
-- sub_category: optional (e.g. "1pc", "2pc", "Gravy") for fastfood-style options under a category
CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(512) DEFAULT NULL,
  category VARCHAR(64) NOT NULL,
  sub_category VARCHAR(64) DEFAULT NULL,
  department VARCHAR(32) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_products_sku (sku),
  KEY idx_products_category (category),
  KEY idx_products_sub_category (sub_category),
  KEY idx_products_department (department),
  KEY idx_products_status (status),
  KEY idx_products_name (name(50))
);

-- Orders (for dashboard stats and reports; branch_id scopes to branch)
CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id INT UNSIGNED NOT NULL DEFAULT 1,
  table_id VARCHAR(16) DEFAULT NULL,
  table_visit_id INT UNSIGNED DEFAULT NULL,
  status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(32) DEFAULT NULL,  -- cash, gcash, debit, credit, bank
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  employee_id VARCHAR(32) DEFAULT NULL,
  order_date DATE NOT NULL,
  voided_at TIMESTAMP NULL DEFAULT NULL,
  voided_by INT UNSIGNED DEFAULT NULL,
  voided_by_name VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_branch (branch_id),
  KEY idx_orders_date (order_date),
  KEY idx_orders_status (status),
  KEY idx_orders_table (table_id),
  KEY idx_orders_table_visit (branch_id, table_id, table_visit_id),
  KEY idx_orders_employee (employee_id),
  KEY idx_orders_date_status (order_date, status),
  KEY idx_orders_payment_method (payment_method),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
);

-- Order Items (items in each order)
-- special_request: guest note (e.g. no onions). is_voided/voided_by/voided_at/voided_by_name for per-item void.
CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED DEFAULT NULL,
  product_name VARCHAR(128) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  department VARCHAR(32) NOT NULL DEFAULT 'Bar',
  sent_to_dept TINYINT(1) NOT NULL DEFAULT 0,
  is_complimentary TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = complimentary/free item
  served_by INT UNSIGNED DEFAULT NULL,             -- Staff who served this (for commission)
  special_request VARCHAR(512) DEFAULT NULL,        -- Guest note per item
  is_voided TINYINT(1) NOT NULL DEFAULT 0,
  voided_by INT UNSIGNED DEFAULT NULL,
  voided_at TIMESTAMP NULL DEFAULT NULL,
  voided_by_name VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  KEY idx_order_items_order (order_id)
);

-- Discounts (type: Standalone/Applied; category: Seasonal, VIP, Senior, PWD, Happy Hour, Promo)
CREATE TABLE IF NOT EXISTS discounts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  type ENUM('Standalone','Applied') NOT NULL,
  category VARCHAR(32) DEFAULT NULL,
  applicable_to ENUM('Order','Product','Item','Category') NOT NULL DEFAULT 'Order',
  value VARCHAR(32) NOT NULL,
  valid_from DATE DEFAULT NULL,
  valid_to DATE DEFAULT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  creator_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_discounts_status (status),
  KEY idx_discounts_category (category)
);

-- Payouts (payroll report)
CREATE TABLE IF NOT EXISTS payouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
  hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  commission DECIMAL(10,2) NOT NULL DEFAULT 0,
  incentives DECIMAL(10,2) NOT NULL DEFAULT 0,
  adjustments DECIMAL(10,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  incentives_breakdown JSON DEFAULT NULL,
  adjustments_breakdown JSON DEFAULT NULL,
  deductions_breakdown JSON DEFAULT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('draft','approved') NOT NULL DEFAULT 'draft',
  approved_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_payouts_period (period_from, period_to)
);

-- ============================================================================
-- SHIFT MANAGEMENT TABLES
-- ============================================================================

-- Shifts (cashier shift tracking; branch_id scopes to branch)
CREATE TABLE IF NOT EXISTS shifts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NOT NULL DEFAULT 1,
  shift_date DATE NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME DEFAULT NULL,
  status ENUM('open','closed','approved') NOT NULL DEFAULT 'open',
  opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Calculated totals during shift
  total_cash_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_card_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_gcash_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_bank_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_refunds DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_voids DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Cash count at close
  expected_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  actual_cash DECIMAL(12,2) DEFAULT NULL,
  cash_variance DECIMAL(12,2) DEFAULT NULL,
  variance_reason VARCHAR(512) DEFAULT NULL,
  -- Approval
  approved_by INT UNSIGNED DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  KEY idx_shifts_branch (branch_id),
  KEY idx_shifts_user_date (user_id, shift_date),
  KEY idx_shifts_status (status)
);

-- Cash Count Details (denomination breakdown)
CREATE TABLE IF NOT EXISTS cash_counts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_id INT UNSIGNED NOT NULL,
  denomination VARCHAR(32) NOT NULL,  -- e.g., '1000', '500', '200', '100', '50', '20', '10', '5', '1', '0.25'
  quantity INT NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
);

-- ============================================================================
-- PAYMENT MANAGEMENT TABLES
-- ============================================================================

-- Refunds (track all refunds)
CREATE TABLE IF NOT EXISTS refunds (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  original_payment_method VARCHAR(32) NOT NULL,
  refund_amount DECIMAL(12,2) NOT NULL,
  refund_method VARCHAR(32) NOT NULL,  -- cash, original_method, store_credit
  reason VARCHAR(512) NOT NULL,
  status ENUM('pending','approved','completed','rejected') NOT NULL DEFAULT 'pending',
  requested_by INT UNSIGNED NOT NULL,
  approved_by INT UNSIGNED DEFAULT NULL,
  shift_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  KEY idx_refunds_order (order_id),
  KEY idx_refunds_status (status)
);

-- Payment Voids (voided/cancelled payments)
CREATE TABLE IF NOT EXISTS payment_voids (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  voided_amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(512) NOT NULL,
  status ENUM('pending','approved','completed','rejected') NOT NULL DEFAULT 'pending',
  requested_by INT UNSIGNED NOT NULL,
  approved_by INT UNSIGNED DEFAULT NULL,
  shift_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  KEY idx_voids_order (order_id),
  KEY idx_voids_status (status)
);

-- Split Payments (for split bill tracking)
CREATE TABLE IF NOT EXISTS split_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  split_number INT NOT NULL,  -- 1, 2, 3... for each split
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  paid_at DATETIME DEFAULT NULL,
  processed_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_split_order (order_id)
);

-- Payment Conversions (track digital->cash conversions, e.g. pasahod)
CREATE TABLE IF NOT EXISTS payment_conversions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id INT UNSIGNED NOT NULL DEFAULT 1,
  shift_id INT UNSIGNED DEFAULT NULL,
  from_method VARCHAR(32) NOT NULL COMMENT 'gcash, maya, bank, bpi, debit, credit, online',
  to_method VARCHAR(32) NOT NULL DEFAULT 'cash',
  amount DECIMAL(12,2) NOT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  converted_by VARCHAR(64) DEFAULT NULL,
  converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_conversions_branch (branch_id),
  KEY idx_conversions_shift (shift_id),
  KEY idx_conversions_date (converted_at),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
);

-- Charge/Utang (credit) transactions - track who owes and payment status
CREATE TABLE IF NOT EXISTS charge_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id INT UNSIGNED NOT NULL DEFAULT 1,
  order_ids VARCHAR(255) DEFAULT NULL,
  customer_name VARCHAR(128) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  charged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME DEFAULT NULL,
  charged_by VARCHAR(64) DEFAULT NULL,
  paid_by VARCHAR(64) DEFAULT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  KEY idx_charges_branch (branch_id),
  KEY idx_charges_customer (customer_name(64)),
  KEY idx_charges_status (status),
  KEY idx_charges_date (charged_at),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
);

-- Table Transfers (track order movements between tables)
CREATE TABLE IF NOT EXISTS table_transfers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  from_table VARCHAR(16) NOT NULL,
  to_table VARCHAR(16) NOT NULL,
  transfer_type ENUM('move','merge','split') NOT NULL DEFAULT 'move',
  transferred_by INT UNSIGNED NOT NULL,
  reason VARCHAR(256) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_transfer_order (order_id)
);

-- ============================================================================
-- ATTENDANCE (time-in/time-out for payroll hours)
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  time_in DATETIME NOT NULL,
  time_out DATETIME DEFAULT NULL,
  break_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  notes VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_attendance_user_date (user_id, work_date),
  KEY idx_attendance_date (work_date),
  KEY idx_attendance_user_date (user_id, work_date)
);

-- ============================================================================
-- AUDIT LOGS (track all employee actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED DEFAULT NULL,
  employee_id VARCHAR(32) DEFAULT NULL,
  user_name VARCHAR(128) DEFAULT NULL,
  role_name VARCHAR(64) DEFAULT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) DEFAULT NULL,
  entity_id VARCHAR(64) DEFAULT NULL,
  details JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  branch_id INT UNSIGNED DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_user (user_id),
  KEY idx_audit_employee (employee_id),
  KEY idx_audit_action (action),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_branch (branch_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
);

-- ============================================================================
-- SETTINGS (business and POS configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(64) NOT NULL,
  setting_value TEXT,
  category VARCHAR(32) DEFAULT 'general',
  description VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_settings_key (setting_key)
);

INSERT INTO settings (setting_key, setting_value, category, description) VALUES
('business_name', 'Rabbit Alley', 'business', 'Business name'),
('business_address', '123 Main Street, Manila, Philippines', 'business', 'Business address'),
('business_contact', '+63 912 345 6789', 'business', 'Contact number'),
('vat_tin', '123-456-789-000', 'business', 'VAT TIN number'),
('receipt_footer', 'Thank you for visiting Rabbit Alley!', 'receipt', 'Receipt footer message'),
('tax_rate', '12', 'tax', 'Tax rate percentage (VAT)'),
('service_charge_mode', 'percent', 'charges', 'Service charge mode: percent or fixed'),
('service_charge_value', '10', 'charges', 'Service charge value'),
('card_surcharge', '2', 'charges', 'Card surcharge percentage')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ============================================================================
-- PRINTERS (network/USB printers added in the system — optional, .env also supported)
-- ============================================================================
CREATE TABLE IF NOT EXISTS printers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT 'Display name (e.g. Receipt Counter 1)',
  interface VARCHAR(255) NOT NULL COMMENT 'tcp://IP:9100 or printer:WindowsPrinterName',
  type VARCHAR(32) NOT NULL DEFAULT 'epson' COMMENT 'epson, star, brother, etc.',
  branch_id INT UNSIGNED DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_printers_branch (branch_id),
  KEY idx_printers_active (active)
);

-- ============================================================================
-- PRODUCT AREA PRICES (Lounge, Club, LD - different price per area)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_area_prices (
  product_id INT UNSIGNED NOT NULL,
  area VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, area),
  CONSTRAINT fk_product_area_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_area CHECK (area IN ('Lounge','Club','LD'))
);

-- ============================================================================
-- MIGRATION: Add sub_category to products (run once if upgrading)
-- ============================================================================
-- Uncomment and run if your products table does not have sub_category yet:
-- ALTER TABLE products ADD COLUMN sub_category VARCHAR(64) DEFAULT NULL AFTER category;
-- ALTER TABLE products ADD KEY idx_products_sub_category (sub_category);

-- ============================================================================
-- MIGRATION: Order void + per-item void + special_request (run once if upgrading)
-- ============================================================================
-- Orders: ALTER TABLE orders ADD COLUMN voided_at TIMESTAMP NULL DEFAULT NULL AFTER order_date, ADD COLUMN voided_by INT UNSIGNED DEFAULT NULL, ADD COLUMN voided_by_name VARCHAR(128) DEFAULT NULL;
-- Table visit (sales report grouping): ALTER TABLE orders ADD COLUMN table_visit_id INT UNSIGNED DEFAULT NULL AFTER table_id, ADD KEY idx_orders_table_visit (branch_id, table_id, table_visit_id);
-- Order items: ALTER TABLE order_items ADD COLUMN special_request VARCHAR(512) DEFAULT NULL AFTER served_by, ADD COLUMN is_voided TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN voided_by INT UNSIGNED DEFAULT NULL, ADD COLUMN voided_at TIMESTAMP NULL DEFAULT NULL, ADD COLUMN voided_by_name VARCHAR(128) DEFAULT NULL;

-- ============================================================================
-- MIGRATIONS TRACKING (legacy - single schema run)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_migration_name (migration_name)
);

-- ============================================================================
-- SEED DATA: Roles
-- ============================================================================

INSERT INTO roles (id, name, guard) VALUES
(1, 'Administrator', 'web'),
(2, 'Staff', 'web'),
(3, 'Operations Staff', 'web')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================================
-- SEED DATA: Permissions
-- ============================================================================

INSERT INTO permissions (id, name, description) VALUES
(1, 'view_dashboard', 'View dashboard and table map'),
(2, 'manage_products', 'Create, edit, delete products'),
(3, 'view_products', 'View product list and details'),
(4, 'manage_staff', 'Create, edit, delete staff; create login'),
(5, 'view_staff', 'View staff list and details'),
(6, 'edit_orders_after_send', 'Edit order after sent to departments'),
(7, 'view_orders', 'View orders and order details'),
(8, 'accept_payments', 'Process payments'),
(9, 'view_payments', 'View payment history'),
(10, 'print_receipts', 'Print customer receipts'),
(11, 'request_voids', 'Request void of item/order'),
(12, 'approve_voids', 'Approve or reject void requests'),
(13, 'view_voids', 'View void requests and history'),
(14, 'request_discounts', 'Create standalone or applied discounts'),
(15, 'approve_discounts', 'Approve or reject discount requests'),
(16, 'view_discounts', 'View all discounts'),
(17, 'manage_commission_rules', 'Create/edit commission rules'),
(18, 'view_commission_rules', 'View commission rules'),
(19, 'assign_ld_sales_to_staff', 'Assign LD sales to staff'),
(20, 'view_own_sales', 'View own sales for commission'),
(21, 'manage_payroll', 'Manage payroll configuration'),
(22, 'view_payroll', 'View payroll report and payouts'),
(23, 'compute_daily_payouts', 'Run daily payout computation'),
(24, 'adjust_payouts', 'Edit draft payouts; approve payouts'),
(25, 'view_reports', 'View Sales and Payroll reports'),
(26, 'export_reports', 'Export reports (PDF, Excel, CSV)'),
(27, 'view_bar_queue', 'View bar queue'),
(28, 'view_kitchen_queue', 'View kitchen queue'),
(29, 'mark_bar_items_done', 'Mark bar items as done'),
(30, 'mark_kitchen_items_done', 'Mark kitchen items as done'),
(31, 'reprint_bar_ticket', 'Reprint bar ticket'),
(32, 'reprint_kitchen_ticket', 'Reprint kitchen ticket'),
(33, 'manage_ld_staff', 'Manage LD staff'),
(34, 'view_ld_sales', 'View LD sales'),
(35, 'adjust_ld_credit_with_audit', 'Adjust LD credit with audit trail'),
(36, 'finalize_end_of_day', 'Finalize end of day'),
(37, 'view_audit_logs', 'View audit logs'),
(38, 'manage_settings', 'Update business settings'),
(39, 'manage_pos', 'Access POS (view orders, process payments)'),
(40, 'create_orders', 'Create new orders and add items at POS'),
(41, 'edit_orders_before_send', 'Edit/remove items on draft orders'),
(42, 'send_to_departments', 'Send orders to Kitchen/Bar/LD'),
-- Shift Management Permissions
(43, 'close_shift', 'Close cashier shift and submit cash count'),
(44, 'view_shift_summary', 'View shift summary and X reading'),
(45, 'approve_cash_discrepancy', 'Approve cash discrepancy explanations'),
(46, 'print_shift_report', 'Print X/Z shift reports'),
-- Payment Management Permissions
(47, 'refund_payments', 'Process refunds to customers'),
(48, 'void_payments', 'Void/cancel payments'),
(49, 'split_bill', 'Split bill across multiple payments'),
(50, 'transfer_table_orders', 'Transfer orders between tables / merge tables'),
(51, 'access_attendance', 'View and manage attendance (time-in/time-out)')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ============================================================================
-- SEED DATA: Role Permissions
-- ============================================================================

-- Administrator (role_id=1) gets all permissions EXCEPT: floor ops (40,41,42), shifts (43-46), attendance (51)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE id NOT IN (40, 41, 42, 43, 44, 45, 46, 51);

-- Staff (role_id=2) permissions - Floor staff, add items, send to departments (no discounts - Manager only)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(2, 1),  -- view_dashboard
(2, 3),  -- view_products
(2, 5),  -- view_staff
(2, 7),  -- view_orders
(2, 11), -- request_voids
(2, 13), -- view_voids
(2, 19), -- assign_ld_sales_to_staff
(2, 20), -- view_own_sales
(2, 27), -- view_bar_queue
(2, 28), -- view_kitchen_queue
(2, 39), -- manage_pos
(2, 40), -- create_orders
(2, 41), -- edit_orders_before_send
(2, 42), -- send_to_departments
(2, 51); -- access_attendance

-- Operations Staff / Cashier (role_id=3) permissions - Process payments, print receipts, queue actions, shift management
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(3, 1),  -- view_dashboard
(3, 3),  -- view_products
(3, 5),  -- view_staff
(3, 7),  -- view_orders
(3, 8),  -- accept_payments
(3, 9),  -- view_payments
(3, 10), -- print_receipts
(3, 13), -- view_voids
(3, 16), -- view_discounts
(3, 27), -- view_bar_queue
(3, 28), -- view_kitchen_queue
(3, 29), -- mark_bar_items_done
(3, 30), -- mark_kitchen_items_done
(3, 31), -- reprint_bar_ticket
(3, 32), -- reprint_kitchen_ticket
(3, 39), -- manage_pos
-- Shift Management for Cashiers
(3, 43), -- close_shift
(3, 44), -- view_shift_summary
(3, 46), -- print_shift_report
-- Payment Management for Cashiers
(3, 49), -- split_bill
(3, 50), -- transfer_table_orders
(3, 51); -- access_attendance

-- ============================================================================
-- SEED DATA: Branches (multi-branch)
-- ============================================================================

INSERT INTO branches (id, name, code, active) VALUES (1, 'Main Branch', 'MAIN', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================================
-- SEED DATA: Users - Rabbit Alley Staff (bcrypt hash for "password")
-- Default password for all accounts: "password". All assigned to branch_id 1.
-- ============================================================================

INSERT INTO users (employee_id, name, email, password_hash, role_id, branch_id, nickname, allowance, hourly, active) VALUES
-- MANAGERS / ADMIN (role_id = 1)
('MGR001', 'Angelo Val Morante', 'gelo@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 1, 1, 'Gelo', 500, 0, 1),
('MGR002', 'Jedd Kris Paul Patio', 'jedd@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 1, 1, 'Jedd', 500, 0, 1),
('MGR003', 'Len Gabriel Liwanag', 'gab@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 1, 1, 'Gab', 500, 0, 1),
('MGR004', 'Martin Tolentino', 'monk@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 1, 1, 'Monk', 500, 0, 1),

-- WAITERS (role_id = 2 - Staff)
('WTR001', 'Christian', 'christian@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Christian', 350, 50, 1),
('WTR002', 'Jhovi', 'jhovi@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Jhovi', 350, 50, 1),
('WTR003', 'Keith', 'keith@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Keith', 350, 50, 1),
('WTR004', 'Marlon', 'marlon@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Marlon', 350, 50, 1),

-- WAITRESS (role_id = 2 - Staff)
('WTS001', 'Nikka', 'nikka@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Nikka', 350, 50, 1),
('WTS002', 'Yuna', 'yuna@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Yuna', 350, 50, 1),
('WTS003', 'Kath', 'kath@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Kath', 350, 50, 1),
('WTS004', 'Joy', 'joy@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Joy', 350, 50, 1),

-- BARTENDERS (role_id = 3 - Operations Staff / Cashier)
('BAR001', 'Toyskie', 'toyskie@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 3, 1, 'Toyskie', 400, 60, 1),
('BAR002', 'Romgel', 'romgel@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 3, 1, 'Romgel', 400, 60, 1),

-- MODELS / LADIES (role_id = 2 - Staff; these are the LD hostesses selectable in the POS)
('MDL001', 'Angelica Santos',  'angelica@rabbitalley.local', '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Angel',  300, 0, 1),
('MDL002', 'Bianca Reyes',     'bianca@rabbitalley.local',   '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Bianca', 300, 0, 1),
('MDL003', 'Clarisse Dela Cruz','clarisse@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Cla',    300, 0, 1),
('MDL004', 'Diana Villanueva', 'diana@rabbitalley.local',    '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Diana',  300, 0, 1),
('MDL005', 'Elena Cruz',       'elena@rabbitalley.local',    '$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG', 2, 1, 'Elena',  300, 0, 1)

ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  role_id = VALUES(role_id),
  branch_id = VALUES(branch_id),
  nickname = VALUES(nickname),
  allowance = VALUES(allowance),
  hourly = VALUES(hourly),
  active = VALUES(active);

-- ============================================================================
-- SEED DATA: POS Tables (Lounge, Club, LD) - Branch 1
-- ============================================================================

INSERT INTO pos_tables (branch_id, id, name, area, status, current_order_id) VALUES
(1, 'L1', 'L1', 'Lounge', 'available', NULL),
(1, 'L2', 'L2', 'Lounge', 'available', NULL),
(1, 'L3', 'L3', 'Lounge', 'available', NULL),
(1, 'L4', 'L4', 'Lounge', 'available', NULL),
(1, 'L5', 'L5', 'Lounge', 'available', NULL),
(1, 'L6', 'L6', 'Lounge', 'available', NULL),
(1, 'C1', 'C1', 'Club', 'available', NULL),
(1, 'C2', 'C2', 'Club', 'available', NULL),
(1, 'C3', 'C3', 'Club', 'available', NULL),
(1, 'C4', 'C4', 'Club', 'available', NULL),
(1, 'C5', 'C5', 'Club', 'available', NULL),
(1, 'C6', 'C6', 'Club', 'available', NULL),
(1, 'C7', 'C7', 'Club', 'available', NULL),
(1, 'C8', 'C8', 'Club', 'available', NULL),
(1, 'LD1', 'LD1', 'LD', 'available', NULL),
(1, 'LD2', 'LD2', 'LD', 'available', NULL),
(1, 'LD3', 'LD3', 'LD', 'available', NULL),
(1, 'LD4', 'LD4', 'LD', 'available', NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  area = VALUES(area);

-- ============================================================================
-- SEED DATA: Products - Rabbit Alley Garden Bar & Bistro Menu
-- ============================================================================

INSERT INTO products (sku, name, description, category, department, price, cost, commission, status) VALUES
-- SOUPS
('SOUP-001', 'Sinigang na Kambing', 'Best Seller', 'Soups', 'Kitchen', 558.00, 300.00, 0.00, 'active'),
('SOUP-002', 'Crab and Corn Soup (Regular)', '', 'Soups', 'Kitchen', 138.00, 70.00, 0.00, 'active'),
('SOUP-003', 'Crab and Corn Soup (Large)', '', 'Soups', 'Kitchen', 488.00, 250.00, 0.00, 'active'),
('SOUP-004', 'Cream of Mushroom Soup (Regular)', '', 'Soups', 'Kitchen', 138.00, 70.00, 0.00, 'active'),
('SOUP-005', 'Cream of Mushroom Soup (Large)', '', 'Soups', 'Kitchen', 488.00, 250.00, 0.00, 'active'),
('SOUP-006', 'Braised Beef Wonton Soup (Regular)', 'Best Seller', 'Soups', 'Kitchen', 268.00, 140.00, 0.00, 'active'),
('SOUP-007', 'Braised Beef Wonton Soup (Large)', 'Best Seller', 'Soups', 'Kitchen', 488.00, 250.00, 0.00, 'active'),

-- SALAD & SANDWICHES
('SAL-001', 'Kani Salad (Regular)', 'Best Seller', 'Salad & Sandwiches', 'Kitchen', 258.00, 130.00, 0.00, 'active'),
('SAL-002', 'Kani Salad (Sharing)', 'Best Seller', 'Salad & Sandwiches', 'Kitchen', 488.00, 250.00, 0.00, 'active'),
('SAL-003', 'Cucumber Salad', '', 'Salad & Sandwiches', 'Kitchen', 158.00, 80.00, 0.00, 'active'),
('SAL-004', 'RabbitAlley Salad (Regular)', '', 'Salad & Sandwiches', 'Kitchen', 208.00, 100.00, 0.00, 'active'),
('SAL-005', 'RabbitAlley Salad (Sharing)', '', 'Salad & Sandwiches', 'Kitchen', 388.00, 200.00, 0.00, 'active'),
('SAL-006', 'Shawarma Salad', '', 'Salad & Sandwiches', 'Kitchen', 168.00, 85.00, 0.00, 'active'),
('SAL-007', 'Angus Beef Burger', '', 'Salad & Sandwiches', 'Kitchen', 388.00, 200.00, 0.00, 'active'),
('SAL-008', 'Hangar Shawarma', 'Best Seller', 'Salad & Sandwiches', 'Kitchen', 188.00, 95.00, 0.00, 'active'),
('SAL-009', 'Kebab Shawarma', '', 'Salad & Sandwiches', 'Kitchen', 208.00, 105.00, 0.00, 'active'),
('SAL-010', 'Quesadilla - Four Cheese', '', 'Salad & Sandwiches', 'Kitchen', 158.00, 80.00, 0.00, 'active'),
('SAL-011', 'Quesadilla - Shawarma Beef', '', 'Salad & Sandwiches', 'Kitchen', 188.00, 95.00, 0.00, 'active'),
('SAL-012', 'Quesadilla - Pepperoni', '', 'Salad & Sandwiches', 'Kitchen', 208.00, 105.00, 0.00, 'active'),
('SAL-013', 'Quesadilla - Creamy Spinach', '', 'Salad & Sandwiches', 'Kitchen', 208.00, 105.00, 0.00, 'active'),
('SAL-014', 'Chicken Burger - Original', '', 'Salad & Sandwiches', 'Kitchen', 188.00, 95.00, 0.00, 'active'),
('SAL-015', 'Chicken Burger - Flavored', '', 'Salad & Sandwiches', 'Kitchen', 208.00, 105.00, 0.00, 'active'),

-- STARTERS / BAR BITES
('START-001', 'Mixed Nuts', '', 'Starters / Bar Bites', 'Bar', 138.00, 70.00, 0.00, 'active'),
('START-002', 'Mixed Fruits', '', 'Starters / Bar Bites', 'Kitchen', 258.00, 130.00, 0.00, 'active'),
('START-003', 'Crackers Platter', '', 'Starters / Bar Bites', 'Bar', 138.00, 70.00, 0.00, 'active'),
('START-004', 'Street Food Platter', '', 'Starters / Bar Bites', 'Kitchen', 188.00, 95.00, 0.00, 'active'),
('START-005', 'Sizzling Cheese Corn', '', 'Starters / Bar Bites', 'Kitchen', 218.00, 110.00, 0.00, 'active'),
('START-006', 'Dumplings in Chili Oil', 'Best Seller', 'Starters / Bar Bites', 'Kitchen', 178.00, 90.00, 0.00, 'active'),
('START-007', 'Sizzling Tofu', '', 'Starters / Bar Bites', 'Kitchen', 198.00, 100.00, 0.00, 'active'),
('START-008', 'Flavored Fries', 'BBQ / Cheese / Sour Cream', 'Starters / Bar Bites', 'Kitchen', 188.00, 95.00, 0.00, 'active'),
('START-009', 'Shawarma Fries', '', 'Starters / Bar Bites', 'Kitchen', 208.00, 105.00, 0.00, 'active'),
('START-010', 'RA Nachos', 'Best Seller', 'Starters / Bar Bites', 'Kitchen', 238.00, 120.00, 0.00, 'active'),
('START-011', 'Shawarma Nachos', '', 'Starters / Bar Bites', 'Kitchen', 258.00, 130.00, 0.00, 'active'),
('START-012', 'Jalapeno Cheese Sticks', '', 'Starters / Bar Bites', 'Kitchen', 198.00, 100.00, 0.00, 'active'),
('START-013', 'Salmon Sashimi', 'Best Seller', 'Starters / Bar Bites', 'Kitchen', 338.00, 170.00, 0.00, 'active'),
('START-014', 'Tokwat Baboy', 'Best Seller', 'Starters / Bar Bites', 'Kitchen', 318.00, 160.00, 0.00, 'active'),
('START-015', 'Chicharong Bulaklak', 'Best Seller', 'Starters / Bar Bites', 'Kitchen', 248.00, 125.00, 0.00, 'active'),
('START-016', 'Creamy Spinach Dip', '', 'Starters / Bar Bites', 'Kitchen', 258.00, 130.00, 0.00, 'active'),
('START-017', 'RabbitAlley Tacos', 'Sisig / Habanero Chicken / Camaron', 'Starters / Bar Bites', 'Kitchen', 238.00, 120.00, 0.00, 'active'),

-- PASTA
('PASTA-001', 'Porcini and Truffle Pasta (Regular)', 'Best Seller', 'Pasta', 'Kitchen', 448.00, 225.00, 0.00, 'active'),
('PASTA-002', 'Porcini and Truffle Pasta (Sharing)', 'Best Seller', 'Pasta', 'Kitchen', 888.00, 450.00, 0.00, 'active'),
('PASTA-003', 'Gambas al Ajillo Pasta (Regular)', '', 'Pasta', 'Kitchen', 368.00, 185.00, 0.00, 'active'),
('PASTA-004', 'Gambas al Ajillo Pasta (Sharing)', '', 'Pasta', 'Kitchen', 708.00, 355.00, 0.00, 'active'),
('PASTA-005', 'Creamy Carbonara (Regular)', 'Best Seller', 'Pasta', 'Kitchen', 308.00, 155.00, 0.00, 'active'),
('PASTA-006', 'Creamy Carbonara (Sharing)', 'Best Seller', 'Pasta', 'Kitchen', 598.00, 300.00, 0.00, 'active'),
('PASTA-007', 'Shrimp in Aligue Pasta (Regular)', '', 'Pasta', 'Kitchen', 408.00, 205.00, 0.00, 'active'),
('PASTA-008', 'Shrimp in Aligue Pasta (Sharing)', '', 'Pasta', 'Kitchen', 798.00, 400.00, 0.00, 'active'),
('PASTA-009', 'Spanish Sardines Pasta (Regular)', '', 'Pasta', 'Kitchen', 458.00, 230.00, 0.00, 'active'),
('PASTA-010', 'Spanish Sardines Pasta (Sharing)', '', 'Pasta', 'Kitchen', 888.00, 445.00, 0.00, 'active'),
('PASTA-011', 'Cannelloni Bolognese (Regular)', '', 'Pasta', 'Kitchen', 458.00, 230.00, 0.00, 'active'),
('PASTA-012', 'Cannelloni Bolognese (Sharing)', '', 'Pasta', 'Kitchen', 888.00, 445.00, 0.00, 'active'),

-- CHICKEN
('CHKN-001', 'Grilled Thai Chicken (Regular)', '', 'Chicken', 'Kitchen', 258.00, 130.00, 0.00, 'active'),
('CHKN-002', 'Grilled Thai Chicken (Sharing)', '', 'Chicken', 'Kitchen', 488.00, 245.00, 0.00, 'active'),
('CHKN-003', 'Chicken Katsu', '', 'Chicken', 'Kitchen', 328.00, 165.00, 0.00, 'active'),
('CHKN-004', 'Chicken Katsu Curry', '', 'Chicken', 'Kitchen', 388.00, 195.00, 0.00, 'active'),
('CHKN-005', 'Chicken Parmiggiana (Regular)', '', 'Chicken', 'Kitchen', 298.00, 150.00, 0.00, 'active'),
('CHKN-006', 'Chicken Parmiggiana (Sharing)', '', 'Chicken', 'Kitchen', 488.00, 245.00, 0.00, 'active'),
('CHKN-007', 'Kanto Fried Chicken (Regular)', 'Best Seller', 'Chicken', 'Kitchen', 308.00, 155.00, 0.00, 'active'),
('CHKN-008', 'Kanto Fried Chicken (Sharing)', 'Best Seller', 'Chicken', 'Kitchen', 588.00, 295.00, 0.00, 'active'),
('CHKN-009', 'Fried Chicken Wings (Half)', 'Best Seller', 'Chicken', 'Kitchen', 398.00, 200.00, 0.00, 'active'),
('CHKN-010', 'Fried Chicken Wings (Full)', 'Best Seller', 'Chicken', 'Kitchen', 658.00, 330.00, 0.00, 'active'),

-- SEAFOOD
('SEA-001', 'Creamy Garlic Shrimp', '', 'Seafood', 'Kitchen', 398.00, 200.00, 0.00, 'active'),
('SEA-002', 'Fish and Chips', '', 'Seafood', 'Kitchen', 328.00, 165.00, 0.00, 'active'),
('SEA-003', 'Baked Garlic Tahong', '', 'Seafood', 'Kitchen', 428.00, 215.00, 0.00, 'active'),
('SEA-004', 'Shrimp Tempura', '', 'Seafood', 'Kitchen', 298.00, 150.00, 0.00, 'active'),
('SEA-005', 'Garlic Butter Shrimp', 'Best Seller', 'Seafood', 'Kitchen', 368.00, 185.00, 0.00, 'active'),
('SEA-006', 'Shrimp in Aligue Butter', '', 'Seafood', 'Kitchen', 388.00, 195.00, 0.00, 'active'),
('SEA-007', 'Gambas Al Ajillo', 'Best Seller', 'Seafood', 'Kitchen', 358.00, 180.00, 0.00, 'active'),
('SEA-008', 'Salted Egg Shrimp', '', 'Seafood', 'Kitchen', 398.00, 200.00, 0.00, 'active'),
('SEA-009', 'Fried Calamares (Regular)', '', 'Seafood', 'Kitchen', 348.00, 175.00, 0.00, 'active'),
('SEA-010', 'Fried Calamares (Large)', '', 'Seafood', 'Kitchen', 668.00, 335.00, 0.00, 'active'),

-- PORK
('PORK-001', 'Pork Tonkatsu Platter', '', 'Pork', 'Kitchen', 548.00, 275.00, 0.00, 'active'),
('PORK-002', 'Sizzling Pork Sisig', 'Best Seller', 'Pork', 'Kitchen', 268.00, 135.00, 0.00, 'active'),
('PORK-003', 'Sausage & Peppers', '', 'Pork', 'Kitchen', 298.00, 150.00, 0.00, 'active'),
('PORK-004', 'Crispy Pata Platter', 'Best Seller', 'Pork', 'Kitchen', 1088.00, 545.00, 0.00, 'active'),
('PORK-005', 'Kare-Kare Crispy Pata', '', 'Pork', 'Kitchen', 1188.00, 595.00, 0.00, 'active'),
('PORK-006', 'Lechon Kawali', '', 'Pork', 'Kitchen', 448.00, 225.00, 0.00, 'active'),
('PORK-007', 'Binondo Kikiam', 'Best Seller', 'Pork', 'Kitchen', 448.00, 225.00, 0.00, 'active'),
('PORK-008', 'Grilled Hungarian Sausage', '', 'Pork', 'Kitchen', 268.00, 135.00, 0.00, 'active'),
('PORK-009', 'Lechon Macau', 'Best Seller', 'Pork', 'Kitchen', 368.00, 185.00, 0.00, 'active'),
('PORK-010', 'Pork BBQ Skewers', '', 'Pork', 'Kitchen', 308.00, 155.00, 0.00, 'active'),
('PORK-011', 'Grilled Pork Chops (Regular)', '', 'Pork', 'Kitchen', 348.00, 175.00, 0.00, 'active'),
('PORK-012', 'Grilled Pork Chops (Large)', '', 'Pork', 'Kitchen', 548.00, 275.00, 0.00, 'active'),

-- BEEF / OTHERS
('BEEF-001', 'Grilled Wagyu Cubes', 'Best Seller', 'Beef / Others', 'Kitchen', 438.00, 220.00, 0.00, 'active'),
('BEEF-002', 'Steak and Fries', 'Best Seller', 'Beef / Others', 'Kitchen', 1088.00, 545.00, 0.00, 'active'),
('BEEF-003', 'Beef Chelo Kebab', '', 'Beef / Others', 'Kitchen', 288.00, 145.00, 0.00, 'active'),
('BEEF-004', 'Beef Truffle Lengua', 'Best Seller', 'Beef / Others', 'Kitchen', 498.00, 250.00, 0.00, 'active'),
('BEEF-005', 'Beef BBQ Skewers', '', 'Beef / Others', 'Kitchen', 498.00, 250.00, 0.00, 'active'),
('BEEF-006', 'Kaldereta - Beef', '', 'Beef / Others', 'Kitchen', 558.00, 280.00, 0.00, 'active'),
('BEEF-007', 'Kambing', '', 'Beef / Others', 'Kitchen', 598.00, 300.00, 0.00, 'active'),

-- GROUP MEALS
('GRP-001', 'RabbitAlley Sampler', 'Good for 8-10 pax', 'Group Meals', 'Kitchen', 4000.00, 2000.00, 0.00, 'active'),
('GRP-002', 'Inuman Sampler', 'Good for 8-10 pax', 'Group Meals', 'Kitchen', 4000.00, 2000.00, 0.00, 'active'),
('GRP-003', 'Filipino Sampler', 'Good for 6-8 pax', 'Group Meals', 'Kitchen', 3099.00, 1550.00, 0.00, 'active'),
('GRP-004', 'International Sampler', 'Good for 8-10 pax', 'Group Meals', 'Kitchen', 4000.00, 2000.00, 0.00, 'active'),
('GRP-005', 'Asian Cuisine Sampler', 'Good for 8-10 pax', 'Group Meals', 'Kitchen', 4000.00, 2000.00, 0.00, 'active'),

-- HARD LIQUOR
('LIQ-001', 'Soju', '', 'Hard Liquor', 'Bar', 500.00, 250.00, 50.00, 'active'),
('LIQ-002', 'The BaR Premium Dry Gin', 'Pink Gin / Lime Gin', 'Hard Liquor', 'Bar', 900.00, 450.00, 90.00, 'active'),
('LIQ-003', 'GSM Blue Mojito 1L', '', 'Hard Liquor', 'Bar', 1000.00, 500.00, 100.00, 'active'),
('LIQ-004', 'Alfonso I Light', '', 'Hard Liquor', 'Bar', 1300.00, 650.00, 130.00, 'active'),
('LIQ-005', 'Fundador Light', '', 'Hard Liquor', 'Bar', 1500.00, 750.00, 150.00, 'active'),
('LIQ-006', 'Bacardi Superior', '', 'Hard Liquor', 'Bar', 1700.00, 850.00, 170.00, 'active'),
('LIQ-007', 'Bacardi Gold', '', 'Hard Liquor', 'Bar', 1700.00, 850.00, 170.00, 'active'),
('LIQ-008', 'Jose Cuervo', '', 'Hard Liquor', 'Bar', 2200.00, 1100.00, 220.00, 'active'),
('LIQ-009', 'Jose Cuervo 1L', '', 'Hard Liquor', 'Bar', 3000.00, 1500.00, 300.00, 'active'),
('LIQ-010', 'JW Black Label', '', 'Hard Liquor', 'Bar', 3200.00, 1600.00, 320.00, 'active'),
('LIQ-011', 'Jack Daniels Whiskey', '', 'Hard Liquor', 'Bar', 3700.00, 1850.00, 370.00, 'active'),
('LIQ-012', 'JW Double Black', '', 'Hard Liquor', 'Bar', 4200.00, 2100.00, 420.00, 'active'),
('LIQ-013', 'JW Blue Label', '', 'Hard Liquor', 'Bar', 14000.00, 7000.00, 1400.00, 'active'),
('LIQ-014', 'Hennessy VS', '', 'Hard Liquor', 'Bar', 4200.00, 2100.00, 420.00, 'active'),
('LIQ-015', 'Dalmore 12 yrs', '', 'Hard Liquor', 'Bar', 6900.00, 3450.00, 690.00, 'active'),

-- WINES
('WINE-001', 'Yellow Tail Pink Moscato', '', 'Wines', 'Bar', 2000.00, 1000.00, 200.00, 'active'),
('WINE-002', 'Yellow Tail Moscato', '', 'Wines', 'Bar', 2000.00, 1000.00, 200.00, 'active'),
('WINE-003', 'Yellow Tail Merlot', '', 'Wines', 'Bar', 2000.00, 1000.00, 200.00, 'active'),

-- BEERS
('BEER-001', 'San Miguel Light', '', 'Beers', 'Bar', 150.00, 75.00, 15.00, 'active'),
('BEER-002', 'San Miguel Pale Pilsen', '', 'Beers', 'Bar', 150.00, 75.00, 15.00, 'active'),
('BEER-003', 'San Miguel Apple', '', 'Beers', 'Bar', 150.00, 75.00, 15.00, 'active'),
('BEER-004', 'Red Horse Stallion', '', 'Beers', 'Bar', 200.00, 100.00, 20.00, 'active'),
('BEER-005', 'Smirnoff Mule', '', 'Beers', 'Bar', 200.00, 100.00, 20.00, 'active'),
('BEER-006', 'SML/SMB/SMA Bucket', '6 bottles', 'Beers', 'Bar', 598.00, 300.00, 60.00, 'active'),
('BEER-007', 'RH/Mule Bucket', '6 bottles', 'Beers', 'Bar', 720.00, 360.00, 72.00, 'active'),

-- NON-ALCOHOLIC
('NA-001', 'Bottled Water', '', 'Non-Alcoholic', 'Bar', 75.00, 38.00, 0.00, 'active'),
('NA-002', 'Soda (Can)', '', 'Non-Alcoholic', 'Bar', 90.00, 45.00, 0.00, 'active'),
('NA-003', 'Soda (Carafe)', '', 'Non-Alcoholic', 'Bar', 250.00, 125.00, 0.00, 'active'),
('NA-004', 'Soda (Bottle)', '', 'Non-Alcoholic', 'Bar', 300.00, 150.00, 0.00, 'active'),
('NA-005', 'Coffee', '', 'Non-Alcoholic', 'Bar', 128.00, 65.00, 0.00, 'active'),
('NA-006', 'Iced Coffee', '', 'Non-Alcoholic', 'Bar', 168.00, 85.00, 0.00, 'active'),
('NA-007', 'Iced Tea (Regular)', '', 'Non-Alcoholic', 'Bar', 90.00, 45.00, 0.00, 'active'),
('NA-008', 'Iced Tea (Pitcher)', '', 'Non-Alcoholic', 'Bar', 250.00, 125.00, 0.00, 'active'),
('NA-009', 'Cucumber Lemonade (Regular)', '', 'Non-Alcoholic', 'Bar', 90.00, 45.00, 0.00, 'active'),
('NA-010', 'Cucumber Lemonade (Pitcher)', '', 'Non-Alcoholic', 'Bar', 250.00, 125.00, 0.00, 'active'),
('NA-011', 'Candy', '', 'Non-Alcoholic', 'Bar', 25.00, 13.00, 0.00, 'active'),
('NA-012', 'Cigarettes', '', 'Non-Alcoholic', 'Bar', 250.00, 125.00, 0.00, 'active'),

-- PROMOS (Happy Hour)
('PROMO-001', 'Happy Hour SML/SMB/SMA (Bottle)', 'Lounge 6PM-9PM', 'Promos', 'Bar', 80.00, 40.00, 8.00, 'active'),
('PROMO-002', 'Happy Hour SML/SMB/SMA (Bucket)', 'Lounge 6PM-9PM', 'Promos', 'Bar', 450.00, 225.00, 45.00, 'active'),
('PROMO-003', 'Happy Hour RH/Mule (Bottle)', 'Lounge 6PM-9PM', 'Promos', 'Bar', 100.00, 50.00, 10.00, 'active'),
('PROMO-004', 'Happy Hour RH/Mule (Bucket)', 'Lounge 6PM-9PM', 'Promos', 'Bar', 550.00, 275.00, 55.00, 'active'),

-- ============================================================================
-- ALL YOU CAN EAT SUNDAYS - WINGS (Sundays Only)
-- ============================================================================
('AYCE-001', 'AYCE Wings Sunday Special', 'All You Can Eat Wings - Sundays Only', 'AYCE Sundays', 'Kitchen', 648.00, 300.00, 65.00, 'active'),

-- AYCE WINGS FLAVORS (Add-on orders for tracking, price included in AYCE)
('AYCE-W01', 'Wings - Original', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W02', 'Wings - Classic Buffalo', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W03', 'Wings - Honey Mustard', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W04', 'Wings - Texas BBQ', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W05', 'Wings - Honey Sriracha', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W06', 'Wings - Honey Garlic', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W07', 'Wings - Soy Garlic', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W08', 'Wings - Garlic Parmesan', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W09', 'Wings - Memphis Dry Rub', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W10', 'Wings - Cheesy Cheetos', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W11', 'Wings - Salted Egg', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W12', 'Wings - Wasabi', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W13', 'Wings - Galbi', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W14', 'Wings - Gochu Jang', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W15', 'Wings - Garlic Pesto', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W16', 'Wings - Sour Cream', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W17', 'Wings - Kamikaze', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W18', 'Wings - Habanero Buffalo', 'AYCE Sunday Flavor - SPICY', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W19', 'Wings - Carolina Reaper', 'AYCE Sunday Flavor - EXTREME SPICY', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-W20', 'Wings - Carolina Mop Sauce', 'AYCE Sunday Flavor', 'AYCE Wings', 'Kitchen', 0.00, 0.00, 0.00, 'active'),

-- AYCE SIDES (Add-on orders for tracking, price included in AYCE)
('AYCE-S01', 'Side - Mexican Corn', 'AYCE Sunday Side', 'AYCE Sides', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-S02', 'Side - Mac & Cheese', 'AYCE Sunday Side', 'AYCE Sides', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-S03', 'Side - Shawarma Rice', 'AYCE Sunday Side', 'AYCE Sides', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-S04', 'Side - Coleslaw', 'AYCE Sunday Side', 'AYCE Sides', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-S05', 'Side - Fries', 'AYCE Sunday Side', 'AYCE Sides', 'Kitchen', 0.00, 0.00, 0.00, 'active'),
('AYCE-S06', 'Side - Iced Tea', 'AYCE Sunday Side', 'AYCE Sides', 'Bar', 0.00, 0.00, 0.00, 'active'),
('AYCE-S07', 'Side - Rice', 'AYCE Sunday Side', 'AYCE Sides', 'Kitchen', 0.00, 0.00, 0.00, 'active'),

-- LADIES DRINK (LD) - Commission-based drinks ordered for hostess/model
('LD-001', 'San Mig Light',         'Ladies Drink - Beer', 'Ladies Drink', 'LD', 350.00, 150.00, 50.00, 'active'),
('LD-002', 'San Mig Pale Pilsen',   'Ladies Drink - Beer', 'Ladies Drink', 'LD', 350.00, 150.00, 50.00, 'active'),
('LD-003', 'Red Horse',             'Ladies Drink - Beer', 'Ladies Drink', 'LD', 350.00, 150.00, 50.00, 'active'),
('LD-004', 'Coke Float',            'Ladies Drink - Softdrink', 'Ladies Drink', 'LD', 250.00, 100.00, 40.00, 'active'),
('LD-005', 'Iced Tea',              'Ladies Drink - Non-Alcoholic', 'Ladies Drink', 'LD', 200.00, 80.00, 35.00, 'active'),
('LD-006', 'House Wine (Red)',      'Ladies Drink - Wine', 'Ladies Drink', 'LD', 450.00, 200.00, 70.00, 'active'),
('LD-007', 'House Wine (White)',    'Ladies Drink - Wine', 'Ladies Drink', 'LD', 450.00, 200.00, 70.00, 'active'),
('LD-008', 'Vodka Soda',            'Ladies Drink - Cocktail', 'Ladies Drink', 'LD', 400.00, 180.00, 60.00, 'active'),
('LD-009', 'Gin Tonic',             'Ladies Drink - Cocktail', 'Ladies Drink', 'LD', 400.00, 180.00, 60.00, 'active'),
('LD-010', 'Margarita',             'Ladies Drink - Cocktail', 'Ladies Drink', 'LD', 500.00, 220.00, 75.00, 'active'),
('LD-011', 'Mojito',                'Ladies Drink - Cocktail', 'Ladies Drink', 'LD', 500.00, 220.00, 75.00, 'active'),
('LD-012', 'Strawberry Daiquiri',   'Ladies Drink - Cocktail', 'Ladies Drink', 'LD', 500.00, 220.00, 75.00, 'active'),
('LD-013', 'Sex on the Beach',      'Ladies Drink - Cocktail', 'Ladies Drink', 'LD', 550.00, 240.00, 80.00, 'active'),
('LD-014', 'Blue Lagoon',           'Ladies Drink - Cocktail', 'Ladies Drink', 'LD', 550.00, 240.00, 80.00, 'active'),
('LD-015', 'Tequila Shot',          'Ladies Drink - Shot', 'Ladies Drink', 'LD', 300.00, 120.00, 50.00, 'active')

ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  category = VALUES(category),
  department = VALUES(department),
  price = VALUES(price),
  cost = VALUES(cost),
  commission = VALUES(commission),
  status = VALUES(status);

-- ============================================================================
-- SEED DATA: Sample Discounts
-- ============================================================================

INSERT INTO discounts (name, type, category, applicable_to, value, valid_from, valid_to, status, creator_id) VALUES
('Senior Citizen', 'Standalone', 'Senior', 'Order', '20%', NULL, NULL, 'approved', 1),
('PWD Discount', 'Standalone', 'PWD', 'Order', '20%', NULL, NULL, 'approved', 1),
('Happy Hour', 'Applied', 'Happy Hour', 'Product', '₱50.00', NULL, NULL, 'approved', 1),
('VIP Member', 'Standalone', 'VIP', 'Order', '15%', NULL, NULL, 'approved', 1),
('Summer Promo', 'Applied', 'Seasonal', 'Category', '10%', '2024-03-01', '2024-05-31', 'pending', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  type = VALUES(type),
  category = VALUES(category),
  applicable_to = VALUES(applicable_to),
  value = VALUES(value),
  valid_from = VALUES(valid_from),
  valid_to = VALUES(valid_to),
  status = VALUES(status);

-- ============================================================================
-- SEED DATA: Sample Orders (for testing reports) - Branch 1
-- ============================================================================

INSERT INTO orders (branch_id, table_id, status, subtotal, discount, tax, total, employee_id, order_date) VALUES
(1, 'L1', 'paid', 500.00, 0.00, 60.00, 560.00, 'WTR001', CURDATE()),
(1, 'C3', 'paid', 800.00, 50.00, 90.00, 840.00, 'WTS001', CURDATE()),
(1, 'LD2', 'pending', 1200.00, 0.00, 144.00, 1344.00, 'WTR002', CURDATE())
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  subtotal = VALUES(subtotal),
  discount = VALUES(discount),
  tax = VALUES(tax),
  total = VALUES(total);

-- ============================================================================
-- SETUP COMPLETE! - Rabbit Alley Garden Bar & Bistro POS
-- ============================================================================
-- 
-- Staff Accounts (all passwords: "password"):
--
-- MANAGERS:
--   MGR001 (Gelo)  - Angelo Val Morante - General Manager
--   MGR002 (Jedd)  - Jedd Kris Paul Patio - Officer in Charge
--   MGR003 (Gab)   - Len Gabriel Liwanag - Manager
--   MGR004 (Monk)  - Martin Tolentino - Owner
--
-- WAITERS:
--   WTR001 - Christian
--   WTR002 - Jhovi
--   WTR003 - Keith
--   WTR004 - Marlon
--
-- WAITRESSES:
--   WTS001 - Nikka
--   WTS002 - Yuna
--   WTS003 - Kath
--   WTS004 - Joy
--
-- BARTENDERS:
--   BAR001 - Toyskie
--   BAR002 - Romgel
--
-- MODELS / LADIES (LD hostesses, selectable in POS Ladies Drink):
--   MDL001 - Angelica Santos  (Angel)
--   MDL002 - Bianca Reyes     (Bianca)
--   MDL003 - Clarisse Dela Cruz (Cla)
--   MDL004 - Diana Villanueva (Diana)
--   MDL005 - Elena Cruz       (Elena)
--
-- To start:
--   1. Run this SQL script in HeidiSQL
--   2. Start API server: cd server && npm run dev
--   3. Start frontend: npm run dev
--   4. Login with any employee ID above + password "password"
--
-- ============================================================================
