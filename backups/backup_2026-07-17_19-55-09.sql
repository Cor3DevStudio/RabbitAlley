-- Rabbit Alley POS Database Backup
-- Generated on 2026-07-17T11:55:09.787Z
-- Database: rabbit_alley_pos
-- Host: localhost

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------
-- Table structure for table `attendance`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `work_date` date NOT NULL,
  `time_in` datetime NOT NULL,
  `time_out` datetime DEFAULT NULL,
  `break_minutes` int(10) unsigned NOT NULL DEFAULT 0,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_attendance_user_date` (`user_id`,`work_date`),
  KEY `idx_attendance_date` (`work_date`),
  KEY `idx_attendance_user_date` (`user_id`,`work_date`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `attendance`
INSERT INTO `attendance` VALUES
(1,5,'2026-07-15 16:00:00','2026-07-16 15:24:52',NULL,0,NULL,'2026-07-16 15:24:52','2026-07-16 15:24:52'),
(2,1,'2026-07-15 16:00:00','2026-07-16 15:24:59',NULL,0,NULL,'2026-07-16 15:24:59','2026-07-16 15:24:59'),
(3,1,'2026-07-16 16:00:00','2026-07-17 11:54:34',NULL,0,NULL,'2026-07-17 11:54:34','2026-07-17 11:54:34');

-- ------------------------------------------------------
-- Table structure for table `audit_logs`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `employee_id` varchar(32) DEFAULT NULL,
  `user_name` varchar(128) DEFAULT NULL,
  `role_name` varchar(64) DEFAULT NULL,
  `action` varchar(64) NOT NULL,
  `entity_type` varchar(64) DEFAULT NULL,
  `entity_id` varchar(64) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `branch_id` int(10) unsigned DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_employee` (`employee_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_created` (`created_at`),
  KEY `idx_audit_branch` (`branch_id`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `2` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `audit_logs`
INSERT INTO `audit_logs` VALUES
(1,5,'WTR001','Christian','Staff','auth_login','user','5',NULL,NULL,1,'2026-07-16 15:24:52'),
(2,1,'MGR001','Angelo Val Morante','Administrator','auth_login','user','1',NULL,NULL,1,'2026-07-16 15:24:59'),
(3,1,'MGR001','Angelo Val Morante','Administrator','auth_login','user','1',NULL,NULL,1,'2026-07-17 11:54:34'),
(4,1,'MGR001','Angelo Val Morante','Administrator','table_pay_all','table','C6','{"orderIds":["8"],"paymentMethod":"split_payment","total":2135,"splits":[{"amount":1500,"paymentMethod":"cash"},{"amount":635,"paymentMethod":"bank"}]}','::1',1,'2026-07-17 11:55:00');

-- ------------------------------------------------------
-- Table structure for table `branches`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `code` varchar(32) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branches_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `branches`
INSERT INTO `branches` VALUES
(1,'Main Branch','MAIN',NULL,1,'2026-07-16 15:23:47','2026-07-16 15:23:47');

-- ------------------------------------------------------
-- Table structure for table `cash_counts`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `cash_counts`;
CREATE TABLE `cash_counts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `shift_id` int(10) unsigned NOT NULL,
  `denomination` varchar(32) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `shift_id` (`shift_id`),
  CONSTRAINT `1` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `cash_counts`

-- ------------------------------------------------------
-- Table structure for table `charge_transactions`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `charge_transactions`;
CREATE TABLE `charge_transactions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `order_ids` varchar(255) DEFAULT NULL,
  `customer_name` varchar(128) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` enum('pending','paid') NOT NULL DEFAULT 'pending',
  `charged_at` timestamp NULL DEFAULT current_timestamp(),
  `paid_at` datetime DEFAULT NULL,
  `charged_by` varchar(64) DEFAULT NULL,
  `paid_by` varchar(64) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_charges_branch` (`branch_id`),
  KEY `idx_charges_customer` (`customer_name`(64)),
  KEY `idx_charges_status` (`status`),
  KEY `idx_charges_date` (`charged_at`),
  CONSTRAINT `1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `charge_transactions`

-- ------------------------------------------------------
-- Table structure for table `discounts`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `discounts`;
CREATE TABLE `discounts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `type` enum('Standalone','Applied') NOT NULL,
  `category` varchar(32) DEFAULT NULL,
  `applicable_to` enum('Order','Product','Item','Category') NOT NULL DEFAULT 'Order',
  `value` varchar(32) NOT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `creator_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_discounts_status` (`status`),
  KEY `idx_discounts_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `discounts`
INSERT INTO `discounts` VALUES
(1,'Senior Citizen','Standalone','Senior','Order','20%',NULL,NULL,'approved',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(2,'PWD Discount','Standalone','PWD','Order','20%',NULL,NULL,'approved',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(3,'Happy Hour','Applied','Happy Hour','Product','₱50.00',NULL,NULL,'approved',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(4,'VIP Member','Standalone','VIP','Order','15%',NULL,NULL,'approved',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(5,'Summer Promo','Applied','Seasonal','Category','10%','2024-02-29 16:00:00','2024-05-30 16:00:00','pending',1,'2026-07-16 15:23:47','2026-07-16 15:23:47');

-- ------------------------------------------------------
-- Table structure for table `order_items`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(10) unsigned NOT NULL,
  `product_id` int(10) unsigned DEFAULT NULL,
  `product_sku` varchar(64) DEFAULT NULL,
  `product_price_id` int(10) unsigned DEFAULT NULL,
  `product_name` varchar(128) NOT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `department` varchar(32) NOT NULL DEFAULT 'Bar',
  `sent_to_dept` tinyint(1) NOT NULL DEFAULT 0,
  `is_complimentary` tinyint(1) NOT NULL DEFAULT 0,
  `served_by` int(10) unsigned DEFAULT NULL,
  `special_request` varchar(512) DEFAULT NULL,
  `is_voided` tinyint(1) NOT NULL DEFAULT 0,
  `voided_by` int(10) unsigned DEFAULT NULL,
  `voided_at` timestamp NULL DEFAULT NULL,
  `voided_by_name` varchar(128) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_sku` (`product_sku`),
  CONSTRAINT `1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `order_items`
INSERT INTO `order_items` VALUES
(1,4,165,'LD-001',NULL,'San Mig Light',8,'350.00','0.00','2800.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(2,4,165,'LD-001',NULL,'San Mig Light',6,'350.00','0.00','2100.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(3,6,165,'LD-001',NULL,'San Mig Light',4,'350.00','0.00','1400.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(4,7,165,'LD-001',NULL,'San Mig Light',5,'350.00','0.00','1750.00','LD',1,0,17,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(5,7,23,'START-001',NULL,'Mixed Nuts',2,'138.00','0.00','276.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(6,8,165,'LD-001',NULL,'San Mig Light',5,'350.00','0.00','1750.00','LD',1,0,17,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(7,9,165,'LD-001',NULL,'San Mig Light',3,'350.00','0.00','1050.00','LD',1,0,15,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(8,10,165,'LD-001',NULL,'San Mig Light',5,'350.00','0.00','1750.00','LD',1,0,16,NULL,1,1,'2026-07-16 07:05:50','Angelo Val Morante','2026-07-16 15:23:50'),
(9,10,23,'START-001',NULL,'Mixed Nuts',1,'138.00','0.00','138.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(10,11,23,'START-001',NULL,'Mixed Nuts',2,'138.00','0.00','276.00','Bar',1,0,NULL,NULL,1,1,'2026-07-16 05:58:50','Angelo Val Morante','2026-07-16 15:23:50'),
(11,11,1,'SOUP-001',NULL,'Sinigang na Kambing',1,'558.00','0.00','558.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(12,12,1,'SOUP-001',NULL,'Sinigang na Kambing',2,'558.00','0.00','1116.00','Kitchen',1,0,NULL,NULL,1,1,'2026-07-16 07:11:50','Angelo Val Morante','2026-07-16 15:23:50'),
(13,12,23,'START-001',NULL,'Mixed Nuts',1,'138.00','0.00','138.00','Bar',1,0,NULL,NULL,1,1,'2026-07-16 07:11:50','Angelo Val Morante','2026-07-16 15:23:50'),
(14,13,23,'START-001',NULL,'Mixed Nuts',3,'138.00','0.00','414.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(15,14,23,'START-001',NULL,'Mixed Nuts',2,'138.00','0.00','276.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50');

-- ------------------------------------------------------
-- Table structure for table `order_number_sequences`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `order_number_sequences`;
CREATE TABLE `order_number_sequences` (
  `branch_id` int(10) unsigned NOT NULL,
  `seq_date` date NOT NULL,
  `last_seq` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`branch_id`,`seq_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `order_number_sequences`

-- ------------------------------------------------------
-- Table structure for table `orders`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `order_number` varchar(32) DEFAULT NULL,
  `table_id` varchar(16) DEFAULT NULL,
  `table_visit_id` int(10) unsigned DEFAULT NULL,
  `session_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('pending','paid') NOT NULL DEFAULT 'pending',
  `payment_method` varchar(32) DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `employee_id` varchar(32) DEFAULT NULL,
  `order_date` date NOT NULL,
  `voided_at` timestamp NULL DEFAULT NULL,
  `voided_by` int(10) unsigned DEFAULT NULL,
  `voided_by_name` varchar(128) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_branch_number` (`branch_id`,`order_number`),
  KEY `idx_orders_branch` (`branch_id`),
  KEY `idx_orders_date` (`order_date`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_table` (`table_id`),
  KEY `idx_orders_table_visit` (`branch_id`,`table_id`,`table_visit_id`),
  KEY `idx_orders_session` (`session_id`),
  KEY `idx_orders_employee` (`employee_id`),
  KEY `idx_orders_date_status` (`order_date`,`status`),
  KEY `idx_orders_payment_method` (`payment_method`),
  CONSTRAINT `1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `orders`
INSERT INTO `orders` VALUES
(1,1,NULL,'L1',1,12,'paid',NULL,'500.00','0.00','60.00','560.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 15:23:47','2026-07-16 15:24:45'),
(2,1,NULL,'C3',2,11,'paid',NULL,'800.00','50.00','90.00','840.00','WTS001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 15:23:47','2026-07-16 15:24:45'),
(3,1,NULL,'LD1',3,1,'pending',NULL,'1200.00','0.00','144.00','1344.00','WTR002','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 15:23:47','2026-07-16 15:24:59'),
(4,1,NULL,'LD1',3,1,'pending','seed_verify_all','4900.00','0.00','0.00','4900.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 06:33:50','2026-07-16 15:24:59'),
(6,1,NULL,'LD3',6,3,'pending','seed_verify_all','1400.00','0.00','0.00','1400.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 06:48:50','2026-07-16 15:23:50'),
(7,1,NULL,'C6',7,4,'paid','seed_verify_all','2026.00','0.00','0.00','2026.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 05:13:50','2026-07-16 15:23:50'),
(8,1,NULL,'C6',8,5,'paid','split_payment','1750.00','0.00','210.00','2135.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 06:58:50','2026-07-17 11:55:00'),
(9,1,NULL,'L1',9,6,'paid','seed_verify_all','1050.00','0.00','0.00','1050.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 05:43:50','2026-07-16 15:23:50'),
(10,1,NULL,'LD4',10,7,'pending','seed_verify_all','138.00','0.00','0.00','138.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 07:03:50','2026-07-16 15:23:50'),
(11,1,NULL,'C3',11,8,'paid','seed_verify_all','558.00','0.00','0.00','558.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 05:53:50','2026-07-16 15:23:50'),
(12,1,NULL,'L4',12,9,'pending','seed_verify_all','0.00','0.00','0.00','0.00','WTR001','2026-07-15 16:00:00','2026-07-16 07:11:50',1,'Angelo Val Morante','2026-07-16 07:08:50','2026-07-16 15:23:50'),
(13,1,NULL,'C1',13,10,'paid','seed_verify_all','414.00','0.00','0.00','414.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 05:03:50','2026-07-16 15:23:50'),
(14,1,NULL,'C1',13,10,'pending','seed_verify_all','276.00','0.00','0.00','276.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 07:01:50','2026-07-16 15:23:50');

-- ------------------------------------------------------
-- Table structure for table `payment_conversions`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `payment_conversions`;
CREATE TABLE `payment_conversions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `shift_id` int(10) unsigned DEFAULT NULL,
  `from_method` varchar(32) NOT NULL COMMENT 'gcash, maya, bank, bpi, debit, credit, online',
  `to_method` varchar(32) NOT NULL DEFAULT 'cash',
  `amount` decimal(12,2) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `converted_by` varchar(64) DEFAULT NULL,
  `converted_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_conversions_branch` (`branch_id`),
  KEY `idx_conversions_shift` (`shift_id`),
  KEY `idx_conversions_date` (`converted_at`),
  CONSTRAINT `1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `2` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `payment_conversions`

-- ------------------------------------------------------
-- Table structure for table `payment_voids`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `payment_voids`;
CREATE TABLE `payment_voids` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(10) unsigned NOT NULL,
  `payment_method` varchar(32) NOT NULL,
  `voided_amount` decimal(12,2) NOT NULL,
  `reason` varchar(512) NOT NULL,
  `status` enum('pending','approved','completed','rejected') NOT NULL DEFAULT 'pending',
  `requested_by` int(10) unsigned NOT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `shift_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `shift_id` (`shift_id`),
  KEY `idx_voids_order` (`order_id`),
  KEY `idx_voids_status` (`status`),
  CONSTRAINT `1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `4` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `payment_voids`
INSERT INTO `payment_voids` VALUES
(1,11,'cash','276.00','Duplicate charge','completed',1,NULL,1,'2026-07-16 15:23:50','2026-07-16 05:59:50');

-- ------------------------------------------------------
-- Table structure for table `payouts`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `payouts`;
CREATE TABLE `payouts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `period_from` date NOT NULL,
  `period_to` date NOT NULL,
  `allowance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `hours` decimal(5,2) NOT NULL DEFAULT 0.00,
  `commission` decimal(10,2) NOT NULL DEFAULT 0.00,
  `incentives` decimal(10,2) NOT NULL DEFAULT 0.00,
  `adjustments` decimal(10,2) NOT NULL DEFAULT 0.00,
  `deductions` decimal(10,2) NOT NULL DEFAULT 0.00,
  `incentives_breakdown` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`incentives_breakdown`)),
  `adjustments_breakdown` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`adjustments_breakdown`)),
  `deductions_breakdown` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`deductions_breakdown`)),
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('draft','approved') NOT NULL DEFAULT 'draft',
  `approved_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_payouts_period` (`period_from`,`period_to`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `payouts`
INSERT INTO `payouts` VALUES
(1,16,'2026-07-15 16:00:00','2026-07-15 16:00:00','1500.00','0.00','1800.00','3100.00','0.00','0.00','[{"title":"Bianca — table target bonus","amount":100},{"title":"Bianca — VIP guest bonus","amount":150},{"title":"Bianca — weekend shift bonus","amount":200},{"title":"Bianca — referral bonus","amount":75},{"title":"Bianca — attendance bonus","amount":50},{"title":"Bianca — sales milestone","amount":125},{"title":"Bianca — manager discretion","amount":100}]','[]','[]','7200.00','draft',NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(2,17,'2026-07-15 16:00:00','2026-07-15 16:00:00','1500.00','0.00','1000.00','3100.00','200.00','150.00','[{"title":"Cla — table target bonus","amount":100},{"title":"Cla — VIP guest bonus","amount":150},{"title":"Cla — weekend shift bonus","amount":200},{"title":"Cla — referral bonus","amount":75},{"title":"Cla — attendance bonus","amount":50},{"title":"Cla — sales milestone","amount":125},{"title":"Cla — manager discretion","amount":100}]','[{"title":"Transport allowance","amount":200}]','[{"title":"Cash advance","amount":150}]','6450.00','approved',NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(3,15,'2026-07-15 16:00:00','2026-07-15 16:00:00','1500.00','0.00','300.00','3100.00','0.00','0.00','[{"title":"Angel — table target bonus","amount":100},{"title":"Angel — VIP guest bonus","amount":150},{"title":"Angel — weekend shift bonus","amount":200},{"title":"Angel — referral bonus","amount":75},{"title":"Angel — attendance bonus","amount":50},{"title":"Angel — sales milestone","amount":125},{"title":"Angel — manager discretion","amount":100}]','[]','[]','5700.00','draft',NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50');

-- ------------------------------------------------------
-- Table structure for table `permissions`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permissions_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `permissions`
INSERT INTO `permissions` VALUES
(1,'view_dashboard','View dashboard and table map','2026-07-16 15:23:47'),
(2,'manage_products','Create, edit, delete products','2026-07-16 15:23:47'),
(3,'view_products','View product list and details','2026-07-16 15:23:47'),
(4,'manage_staff','Create, edit, delete staff; create login','2026-07-16 15:23:47'),
(5,'view_staff','View staff list and details','2026-07-16 15:23:47'),
(6,'edit_orders_after_send','Edit order after sent to departments','2026-07-16 15:23:47'),
(7,'view_orders','View orders and order details','2026-07-16 15:23:47'),
(8,'accept_payments','Process payments','2026-07-16 15:23:47'),
(9,'view_payments','View payment history','2026-07-16 15:23:47'),
(10,'print_receipts','Print customer receipts','2026-07-16 15:23:47'),
(11,'request_voids','Request void of item/order','2026-07-16 15:23:47'),
(12,'approve_voids','Approve or reject void requests','2026-07-16 15:23:47'),
(13,'view_voids','View void requests and history','2026-07-16 15:23:47'),
(14,'request_discounts','Create standalone or applied discounts','2026-07-16 15:23:47'),
(15,'approve_discounts','Approve or reject discount requests','2026-07-16 15:23:47'),
(16,'view_discounts','View all discounts','2026-07-16 15:23:47'),
(17,'manage_commission_rules','Create/edit commission rules','2026-07-16 15:23:47'),
(18,'view_commission_rules','View commission rules','2026-07-16 15:23:47'),
(19,'assign_ld_sales_to_staff','Assign LD sales to staff','2026-07-16 15:23:47'),
(20,'view_own_sales','View own sales for commission','2026-07-16 15:23:47'),
(21,'manage_payroll','Manage payroll configuration','2026-07-16 15:23:47'),
(22,'view_payroll','View payroll report and payouts','2026-07-16 15:23:47'),
(23,'compute_daily_payouts','Run daily payout computation','2026-07-16 15:23:47'),
(24,'adjust_payouts','Edit draft payouts; approve payouts','2026-07-16 15:23:47'),
(25,'view_reports','View Sales and Payroll reports','2026-07-16 15:23:47'),
(26,'export_reports','Export reports (PDF, Excel, CSV)','2026-07-16 15:23:47'),
(27,'view_bar_queue','View bar queue','2026-07-16 15:23:47'),
(28,'view_kitchen_queue','View kitchen queue','2026-07-16 15:23:47'),
(29,'mark_bar_items_done','Mark bar items as done','2026-07-16 15:23:47'),
(30,'mark_kitchen_items_done','Mark kitchen items as done','2026-07-16 15:23:47'),
(31,'reprint_bar_ticket','Reprint bar ticket','2026-07-16 15:23:47'),
(32,'reprint_kitchen_ticket','Reprint kitchen ticket','2026-07-16 15:23:47'),
(33,'manage_ld_staff','Manage LD staff','2026-07-16 15:23:47'),
(34,'view_ld_sales','View LD sales','2026-07-16 15:23:47'),
(35,'adjust_ld_credit_with_audit','Adjust LD credit with audit trail','2026-07-16 15:23:47'),
(36,'finalize_end_of_day','Finalize end of day','2026-07-16 15:23:47'),
(37,'view_audit_logs','View audit logs','2026-07-16 15:23:47'),
(38,'manage_settings','Update business settings','2026-07-16 15:23:47'),
(39,'manage_pos','Access POS (view orders, process payments)','2026-07-16 15:23:47'),
(40,'create_orders','Create new orders and add items at POS','2026-07-16 15:23:47'),
(41,'edit_orders_before_send','Edit/remove items on draft orders','2026-07-16 15:23:47'),
(42,'send_to_departments','Send orders to Kitchen/Bar/LD','2026-07-16 15:23:47'),
(43,'close_shift','Close cashier shift and submit cash count','2026-07-16 15:23:47'),
(44,'view_shift_summary','View shift summary and X reading','2026-07-16 15:23:47'),
(45,'approve_cash_discrepancy','Approve cash discrepancy explanations','2026-07-16 15:23:47'),
(46,'print_shift_report','Print X/Z shift reports','2026-07-16 15:23:47'),
(47,'refund_payments','Process refunds to customers','2026-07-16 15:23:47'),
(48,'void_payments','Void/cancel payments','2026-07-16 15:23:47'),
(49,'split_bill','Split bill across multiple payments','2026-07-16 15:23:47'),
(50,'transfer_table_orders','Transfer orders between tables / merge tables','2026-07-16 15:23:47'),
(51,'access_attendance','View and manage attendance (time-in/time-out)','2026-07-16 15:23:47');

-- ------------------------------------------------------
-- Table structure for table `pos_tables`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `pos_tables`;
CREATE TABLE `pos_tables` (
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `id` varchar(16) NOT NULL,
  `name` varchar(32) NOT NULL,
  `area` enum('Lounge','Club','LD') NOT NULL,
  `status` enum('available','occupied') NOT NULL DEFAULT 'available',
  `current_order_id` varchar(32) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`branch_id`,`id`),
  KEY `idx_pos_tables_branch` (`branch_id`),
  CONSTRAINT `1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `pos_tables`
INSERT INTO `pos_tables` VALUES
(1,'C1','C1','Club','occupied','14','2026-07-16 15:23:50'),
(1,'C2','C2','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'C3','C3','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'C4','C4','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'C5','C5','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'C6','C6','Club','available',NULL,'2026-07-17 11:55:00'),
(1,'C7','C7','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'C8','C8','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'L1','L1','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L2','L2','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L3','L3','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L4','L4','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L5','L5','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L6','L6','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'LD1','LD1','LD','occupied','3','2026-07-16 15:24:59'),
(1,'LD2','LD2','LD','available',NULL,'2026-07-16 15:24:59'),
(1,'LD3','LD3','LD','occupied','6','2026-07-16 15:23:50'),
(1,'LD4','LD4','LD','occupied','10','2026-07-16 15:23:50');

-- ------------------------------------------------------
-- Table structure for table `printers`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `printers`;
CREATE TABLE `printers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL COMMENT 'Display name (e.g. Receipt Counter 1)',
  `interface` varchar(255) NOT NULL COMMENT 'tcp://IP:9100 or printer:WindowsPrinterName',
  `type` varchar(32) NOT NULL DEFAULT 'epson' COMMENT 'epson, star, brother, etc.',
  `branch_id` int(10) unsigned DEFAULT 1,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_printers_branch` (`branch_id`),
  KEY `idx_printers_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `printers`

-- ------------------------------------------------------
-- Table structure for table `product_area_prices`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `product_area_prices`;
CREATE TABLE `product_area_prices` (
  `product_id` int(10) unsigned NOT NULL,
  `area` varchar(20) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`product_id`,`area`),
  CONSTRAINT `fk_product_area_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_area` CHECK (`area` in ('Lounge','Club','LD'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `product_area_prices`

-- ------------------------------------------------------
-- Table structure for table `product_prices`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `product_prices`;
CREATE TABLE `product_prices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` int(10) unsigned NOT NULL,
  `label` varchar(64) NOT NULL DEFAULT 'Regular',
  `area` varchar(20) DEFAULT NULL COMMENT 'Optional Lounge|Club|LD auto-match',
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `effective_from` date DEFAULT NULL,
  `effective_to` date DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_product_prices_product` (`product_id`),
  KEY `idx_product_prices_area` (`product_id`,`area`),
  CONSTRAINT `fk_product_prices_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=180 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `product_prices`
INSERT INTO `product_prices` VALUES
(1,1,'Regular',NULL,'558.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(2,2,'Regular',NULL,'138.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(3,3,'Regular',NULL,'488.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(4,4,'Regular',NULL,'138.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(5,5,'Regular',NULL,'488.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(6,6,'Regular',NULL,'268.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(7,7,'Regular',NULL,'488.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(8,8,'Regular',NULL,'258.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(9,9,'Regular',NULL,'488.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(10,10,'Regular',NULL,'158.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(11,11,'Regular',NULL,'208.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(12,12,'Regular',NULL,'388.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(13,13,'Regular',NULL,'168.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(14,14,'Regular',NULL,'388.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(15,15,'Regular',NULL,'188.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(16,16,'Regular',NULL,'208.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(17,17,'Regular',NULL,'158.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(18,18,'Regular',NULL,'188.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(19,19,'Regular',NULL,'208.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(20,20,'Regular',NULL,'208.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(21,21,'Regular',NULL,'188.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(22,22,'Regular',NULL,'208.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(23,23,'Regular',NULL,'138.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(24,24,'Regular',NULL,'258.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(25,25,'Regular',NULL,'138.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(26,26,'Regular',NULL,'188.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(27,27,'Regular',NULL,'218.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(28,28,'Regular',NULL,'178.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(29,29,'Regular',NULL,'198.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(30,30,'Regular',NULL,'188.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(31,31,'Regular',NULL,'208.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(32,32,'Regular',NULL,'238.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(33,33,'Regular',NULL,'258.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(34,34,'Regular',NULL,'198.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(35,35,'Regular',NULL,'338.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(36,36,'Regular',NULL,'318.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(37,37,'Regular',NULL,'248.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(38,38,'Regular',NULL,'258.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(39,39,'Regular',NULL,'238.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(40,40,'Regular',NULL,'448.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(41,41,'Regular',NULL,'888.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(42,42,'Regular',NULL,'368.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(43,43,'Regular',NULL,'708.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(44,44,'Regular',NULL,'308.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(45,45,'Regular',NULL,'598.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(46,46,'Regular',NULL,'408.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(47,47,'Regular',NULL,'798.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(48,48,'Regular',NULL,'458.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(49,49,'Regular',NULL,'888.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(50,50,'Regular',NULL,'458.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(51,51,'Regular',NULL,'888.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(52,52,'Regular',NULL,'258.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(53,53,'Regular',NULL,'488.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(54,54,'Regular',NULL,'328.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(55,55,'Regular',NULL,'388.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(56,56,'Regular',NULL,'298.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(57,57,'Regular',NULL,'488.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(58,58,'Regular',NULL,'308.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(59,59,'Regular',NULL,'588.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(60,60,'Regular',NULL,'398.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(61,61,'Regular',NULL,'658.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(62,62,'Regular',NULL,'398.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(63,63,'Regular',NULL,'328.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(64,64,'Regular',NULL,'428.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(65,65,'Regular',NULL,'298.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(66,66,'Regular',NULL,'368.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(67,67,'Regular',NULL,'388.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(68,68,'Regular',NULL,'358.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(69,69,'Regular',NULL,'398.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(70,70,'Regular',NULL,'348.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(71,71,'Regular',NULL,'668.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(72,72,'Regular',NULL,'548.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(73,73,'Regular',NULL,'268.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(74,74,'Regular',NULL,'298.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(75,75,'Regular',NULL,'1088.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(76,76,'Regular',NULL,'1188.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(77,77,'Regular',NULL,'448.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(78,78,'Regular',NULL,'448.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(79,79,'Regular',NULL,'268.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(80,80,'Regular',NULL,'368.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(81,81,'Regular',NULL,'308.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(82,82,'Regular',NULL,'348.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(83,83,'Regular',NULL,'548.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(84,84,'Regular',NULL,'438.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(85,85,'Regular',NULL,'1088.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(86,86,'Regular',NULL,'288.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(87,87,'Regular',NULL,'498.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(88,88,'Regular',NULL,'498.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(89,89,'Regular',NULL,'558.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(90,90,'Regular',NULL,'598.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(91,91,'Regular',NULL,'4000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(92,92,'Regular',NULL,'4000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(93,93,'Regular',NULL,'3099.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(94,94,'Regular',NULL,'4000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(95,95,'Regular',NULL,'4000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(96,96,'Regular',NULL,'500.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(97,97,'Regular',NULL,'900.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(98,98,'Regular',NULL,'1000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(99,99,'Regular',NULL,'1300.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(100,100,'Regular',NULL,'1500.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(101,101,'Regular',NULL,'1700.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(102,102,'Regular',NULL,'1700.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(103,103,'Regular',NULL,'2200.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(104,104,'Regular',NULL,'3000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(105,105,'Regular',NULL,'3200.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(106,106,'Regular',NULL,'3700.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(107,107,'Regular',NULL,'4200.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(108,108,'Regular',NULL,'14000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(109,109,'Regular',NULL,'4200.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(110,110,'Regular',NULL,'6900.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(111,111,'Regular',NULL,'2000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(112,112,'Regular',NULL,'2000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(113,113,'Regular',NULL,'2000.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(114,114,'Regular',NULL,'150.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(115,115,'Regular',NULL,'150.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(116,116,'Regular',NULL,'150.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(117,117,'Regular',NULL,'200.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(118,118,'Regular',NULL,'200.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(119,119,'Regular',NULL,'598.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(120,120,'Regular',NULL,'720.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(121,121,'Regular',NULL,'75.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(122,122,'Regular',NULL,'90.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(123,123,'Regular',NULL,'250.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(124,124,'Regular',NULL,'300.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(125,125,'Regular',NULL,'128.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(126,126,'Regular',NULL,'168.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(127,127,'Regular',NULL,'90.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(128,128,'Regular',NULL,'250.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(129,129,'Regular',NULL,'90.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(130,130,'Regular',NULL,'250.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(131,131,'Regular',NULL,'25.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(132,132,'Regular',NULL,'250.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(133,133,'Regular',NULL,'80.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(134,134,'Regular',NULL,'450.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(135,135,'Regular',NULL,'100.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(136,136,'Regular',NULL,'550.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(137,137,'Regular',NULL,'648.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(138,138,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(139,139,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(140,140,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(141,141,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(142,142,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(143,143,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(144,144,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(145,145,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(146,146,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(147,147,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(148,148,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(149,149,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(150,150,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(151,151,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(152,152,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(153,153,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(154,154,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(155,155,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(156,156,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(157,157,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(158,158,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(159,159,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(160,160,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(161,161,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(162,162,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(163,163,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(164,164,'Regular',NULL,'0.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(165,165,'Regular',NULL,'350.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(166,166,'Regular',NULL,'350.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(167,167,'Regular',NULL,'350.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(168,168,'Regular',NULL,'250.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(169,169,'Regular',NULL,'200.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(170,170,'Regular',NULL,'450.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(171,171,'Regular',NULL,'450.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(172,172,'Regular',NULL,'400.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(173,173,'Regular',NULL,'400.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(174,174,'Regular',NULL,'500.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(175,175,'Regular',NULL,'500.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(176,176,'Regular',NULL,'500.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(177,177,'Regular',NULL,'550.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(178,178,'Regular',NULL,'550.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(179,179,'Regular',NULL,'300.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45');

-- ------------------------------------------------------
-- Table structure for table `product_stock`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `product_stock`;
CREATE TABLE `product_stock` (
  `product_id` int(10) unsigned NOT NULL,
  `qty_on_hand` decimal(12,3) NOT NULL DEFAULT 0.000,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`product_id`),
  CONSTRAINT `fk_product_stock_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `product_stock`
INSERT INTO `product_stock` VALUES
(1,'0.000','2026-07-16 15:24:45'),
(2,'0.000','2026-07-16 15:24:45'),
(3,'0.000','2026-07-16 15:24:45'),
(4,'0.000','2026-07-16 15:24:45'),
(5,'0.000','2026-07-16 15:24:45'),
(6,'0.000','2026-07-16 15:24:45'),
(7,'0.000','2026-07-16 15:24:45'),
(8,'0.000','2026-07-16 15:24:45'),
(9,'0.000','2026-07-16 15:24:45'),
(10,'0.000','2026-07-16 15:24:45'),
(11,'0.000','2026-07-16 15:24:45'),
(12,'0.000','2026-07-16 15:24:45'),
(13,'0.000','2026-07-16 15:24:45'),
(14,'0.000','2026-07-16 15:24:45'),
(15,'0.000','2026-07-16 15:24:45'),
(16,'0.000','2026-07-16 15:24:45'),
(17,'0.000','2026-07-16 15:24:45'),
(18,'0.000','2026-07-16 15:24:45'),
(19,'0.000','2026-07-16 15:24:45'),
(20,'0.000','2026-07-16 15:24:45'),
(21,'0.000','2026-07-16 15:24:45'),
(22,'0.000','2026-07-16 15:24:45'),
(23,'0.000','2026-07-16 15:24:45'),
(24,'0.000','2026-07-16 15:24:45'),
(25,'0.000','2026-07-16 15:24:45'),
(26,'0.000','2026-07-16 15:24:45'),
(27,'0.000','2026-07-16 15:24:45'),
(28,'0.000','2026-07-16 15:24:45'),
(29,'0.000','2026-07-16 15:24:45'),
(30,'0.000','2026-07-16 15:24:45'),
(31,'0.000','2026-07-16 15:24:45'),
(32,'0.000','2026-07-16 15:24:45'),
(33,'0.000','2026-07-16 15:24:45'),
(34,'0.000','2026-07-16 15:24:45'),
(35,'0.000','2026-07-16 15:24:45'),
(36,'0.000','2026-07-16 15:24:45'),
(37,'0.000','2026-07-16 15:24:45'),
(38,'0.000','2026-07-16 15:24:45'),
(39,'0.000','2026-07-16 15:24:45'),
(40,'0.000','2026-07-16 15:24:45'),
(41,'0.000','2026-07-16 15:24:45'),
(42,'0.000','2026-07-16 15:24:45'),
(43,'0.000','2026-07-16 15:24:45'),
(44,'0.000','2026-07-16 15:24:45'),
(45,'0.000','2026-07-16 15:24:45'),
(46,'0.000','2026-07-16 15:24:45'),
(47,'0.000','2026-07-16 15:24:45'),
(48,'0.000','2026-07-16 15:24:45'),
(49,'0.000','2026-07-16 15:24:45'),
(50,'0.000','2026-07-16 15:24:45'),
(51,'0.000','2026-07-16 15:24:45'),
(52,'0.000','2026-07-16 15:24:45'),
(53,'0.000','2026-07-16 15:24:45'),
(54,'0.000','2026-07-16 15:24:45'),
(55,'0.000','2026-07-16 15:24:45'),
(56,'0.000','2026-07-16 15:24:45'),
(57,'0.000','2026-07-16 15:24:45'),
(58,'0.000','2026-07-16 15:24:45'),
(59,'0.000','2026-07-16 15:24:45'),
(60,'0.000','2026-07-16 15:24:45'),
(61,'0.000','2026-07-16 15:24:45'),
(62,'0.000','2026-07-16 15:24:45'),
(63,'0.000','2026-07-16 15:24:45'),
(64,'0.000','2026-07-16 15:24:45'),
(65,'0.000','2026-07-16 15:24:45'),
(66,'0.000','2026-07-16 15:24:45'),
(67,'0.000','2026-07-16 15:24:45'),
(68,'0.000','2026-07-16 15:24:45'),
(69,'0.000','2026-07-16 15:24:45'),
(70,'0.000','2026-07-16 15:24:45'),
(71,'0.000','2026-07-16 15:24:45'),
(72,'0.000','2026-07-16 15:24:45'),
(73,'0.000','2026-07-16 15:24:45'),
(74,'0.000','2026-07-16 15:24:45'),
(75,'0.000','2026-07-16 15:24:45'),
(76,'0.000','2026-07-16 15:24:45'),
(77,'0.000','2026-07-16 15:24:45'),
(78,'0.000','2026-07-16 15:24:45'),
(79,'0.000','2026-07-16 15:24:45'),
(80,'0.000','2026-07-16 15:24:45'),
(81,'0.000','2026-07-16 15:24:45'),
(82,'0.000','2026-07-16 15:24:45'),
(83,'0.000','2026-07-16 15:24:45'),
(84,'0.000','2026-07-16 15:24:45'),
(85,'0.000','2026-07-16 15:24:45'),
(86,'0.000','2026-07-16 15:24:45'),
(87,'0.000','2026-07-16 15:24:45'),
(88,'0.000','2026-07-16 15:24:45'),
(89,'0.000','2026-07-16 15:24:45'),
(90,'0.000','2026-07-16 15:24:45'),
(91,'0.000','2026-07-16 15:24:45'),
(92,'0.000','2026-07-16 15:24:45'),
(93,'0.000','2026-07-16 15:24:45'),
(94,'0.000','2026-07-16 15:24:45'),
(95,'0.000','2026-07-16 15:24:45'),
(96,'0.000','2026-07-16 15:24:45'),
(97,'0.000','2026-07-16 15:24:45'),
(98,'0.000','2026-07-16 15:24:45'),
(99,'0.000','2026-07-16 15:24:45'),
(100,'0.000','2026-07-16 15:24:45'),
(101,'0.000','2026-07-16 15:24:45'),
(102,'0.000','2026-07-16 15:24:45'),
(103,'0.000','2026-07-16 15:24:45'),
(104,'0.000','2026-07-16 15:24:45'),
(105,'0.000','2026-07-16 15:24:45'),
(106,'0.000','2026-07-16 15:24:45'),
(107,'0.000','2026-07-16 15:24:45'),
(108,'0.000','2026-07-16 15:24:45'),
(109,'0.000','2026-07-16 15:24:45'),
(110,'0.000','2026-07-16 15:24:45'),
(111,'0.000','2026-07-16 15:24:45'),
(112,'0.000','2026-07-16 15:24:45'),
(113,'0.000','2026-07-16 15:24:45'),
(114,'0.000','2026-07-16 15:24:45'),
(115,'0.000','2026-07-16 15:24:45'),
(116,'0.000','2026-07-16 15:24:45'),
(117,'0.000','2026-07-16 15:24:45'),
(118,'0.000','2026-07-16 15:24:45'),
(119,'0.000','2026-07-16 15:24:45'),
(120,'0.000','2026-07-16 15:24:45'),
(121,'0.000','2026-07-16 15:24:45'),
(122,'0.000','2026-07-16 15:24:45'),
(123,'0.000','2026-07-16 15:24:45'),
(124,'0.000','2026-07-16 15:24:45'),
(125,'0.000','2026-07-16 15:24:45'),
(126,'0.000','2026-07-16 15:24:45'),
(127,'0.000','2026-07-16 15:24:45'),
(128,'0.000','2026-07-16 15:24:45'),
(129,'0.000','2026-07-16 15:24:45'),
(130,'0.000','2026-07-16 15:24:45'),
(131,'0.000','2026-07-16 15:24:45'),
(132,'0.000','2026-07-16 15:24:45'),
(133,'0.000','2026-07-16 15:24:45'),
(134,'0.000','2026-07-16 15:24:45'),
(135,'0.000','2026-07-16 15:24:45'),
(136,'0.000','2026-07-16 15:24:45'),
(137,'0.000','2026-07-16 15:24:45'),
(138,'0.000','2026-07-16 15:24:45'),
(139,'0.000','2026-07-16 15:24:45'),
(140,'0.000','2026-07-16 15:24:45'),
(141,'0.000','2026-07-16 15:24:45'),
(142,'0.000','2026-07-16 15:24:45'),
(143,'0.000','2026-07-16 15:24:45'),
(144,'0.000','2026-07-16 15:24:45'),
(145,'0.000','2026-07-16 15:24:45'),
(146,'0.000','2026-07-16 15:24:45'),
(147,'0.000','2026-07-16 15:24:45'),
(148,'0.000','2026-07-16 15:24:45'),
(149,'0.000','2026-07-16 15:24:45'),
(150,'0.000','2026-07-16 15:24:45'),
(151,'0.000','2026-07-16 15:24:45'),
(152,'0.000','2026-07-16 15:24:45'),
(153,'0.000','2026-07-16 15:24:45'),
(154,'0.000','2026-07-16 15:24:45'),
(155,'0.000','2026-07-16 15:24:45'),
(156,'0.000','2026-07-16 15:24:45'),
(157,'0.000','2026-07-16 15:24:45'),
(158,'0.000','2026-07-16 15:24:45'),
(159,'0.000','2026-07-16 15:24:45'),
(160,'0.000','2026-07-16 15:24:45'),
(161,'0.000','2026-07-16 15:24:45'),
(162,'0.000','2026-07-16 15:24:45'),
(163,'0.000','2026-07-16 15:24:45'),
(164,'0.000','2026-07-16 15:24:45'),
(165,'-5.000','2026-07-17 11:55:00'),
(166,'0.000','2026-07-16 15:24:45'),
(167,'0.000','2026-07-16 15:24:45'),
(168,'0.000','2026-07-16 15:24:45'),
(169,'0.000','2026-07-16 15:24:45'),
(170,'0.000','2026-07-16 15:24:45'),
(171,'0.000','2026-07-16 15:24:45'),
(172,'0.000','2026-07-16 15:24:45'),
(173,'0.000','2026-07-16 15:24:45'),
(174,'0.000','2026-07-16 15:24:45'),
(175,'0.000','2026-07-16 15:24:45'),
(176,'0.000','2026-07-16 15:24:45'),
(177,'0.000','2026-07-16 15:24:45'),
(178,'0.000','2026-07-16 15:24:45'),
(179,'0.000','2026-07-16 15:24:45');

-- ------------------------------------------------------
-- Table structure for table `products`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `sku` varchar(64) NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` varchar(512) DEFAULT NULL,
  `category` varchar(64) NOT NULL,
  `sub_category` varchar(64) DEFAULT NULL,
  `department` varchar(32) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `commission` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_sku` (`sku`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_sub_category` (`sub_category`),
  KEY `idx_products_department` (`department`),
  KEY `idx_products_status` (`status`),
  KEY `idx_products_name` (`name`(50))
) ENGINE=InnoDB AUTO_INCREMENT=180 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `products`
INSERT INTO `products` VALUES
(1,'SOUP-001','Sinigang na Kambing','Best Seller','Soups',NULL,'Kitchen','558.00','300.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(2,'SOUP-002','Crab and Corn Soup (Regular)','','Soups',NULL,'Kitchen','138.00','70.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(3,'SOUP-003','Crab and Corn Soup (Large)','','Soups',NULL,'Kitchen','488.00','250.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(4,'SOUP-004','Cream of Mushroom Soup (Regular)','','Soups',NULL,'Kitchen','138.00','70.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(5,'SOUP-005','Cream of Mushroom Soup (Large)','','Soups',NULL,'Kitchen','488.00','250.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(6,'SOUP-006','Braised Beef Wonton Soup (Regular)','Best Seller','Soups',NULL,'Kitchen','268.00','140.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(7,'SOUP-007','Braised Beef Wonton Soup (Large)','Best Seller','Soups',NULL,'Kitchen','488.00','250.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(8,'SAL-001','Kani Salad (Regular)','Best Seller','Salad & Sandwiches',NULL,'Kitchen','258.00','130.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(9,'SAL-002','Kani Salad (Sharing)','Best Seller','Salad & Sandwiches',NULL,'Kitchen','488.00','250.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(10,'SAL-003','Cucumber Salad','','Salad & Sandwiches',NULL,'Kitchen','158.00','80.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(11,'SAL-004','RabbitAlley Salad (Regular)','','Salad & Sandwiches',NULL,'Kitchen','208.00','100.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(12,'SAL-005','RabbitAlley Salad (Sharing)','','Salad & Sandwiches',NULL,'Kitchen','388.00','200.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(13,'SAL-006','Shawarma Salad','','Salad & Sandwiches',NULL,'Kitchen','168.00','85.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(14,'SAL-007','Angus Beef Burger','','Salad & Sandwiches',NULL,'Kitchen','388.00','200.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(15,'SAL-008','Hangar Shawarma','Best Seller','Salad & Sandwiches',NULL,'Kitchen','188.00','95.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(16,'SAL-009','Kebab Shawarma','','Salad & Sandwiches',NULL,'Kitchen','208.00','105.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(17,'SAL-010','Quesadilla - Four Cheese','','Salad & Sandwiches',NULL,'Kitchen','158.00','80.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(18,'SAL-011','Quesadilla - Shawarma Beef','','Salad & Sandwiches',NULL,'Kitchen','188.00','95.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(19,'SAL-012','Quesadilla - Pepperoni','','Salad & Sandwiches',NULL,'Kitchen','208.00','105.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(20,'SAL-013','Quesadilla - Creamy Spinach','','Salad & Sandwiches',NULL,'Kitchen','208.00','105.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(21,'SAL-014','Chicken Burger - Original','','Salad & Sandwiches',NULL,'Kitchen','188.00','95.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(22,'SAL-015','Chicken Burger - Flavored','','Salad & Sandwiches',NULL,'Kitchen','208.00','105.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(23,'START-001','Mixed Nuts','','Starters / Bar Bites',NULL,'Bar','138.00','70.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(24,'START-002','Mixed Fruits','','Starters / Bar Bites',NULL,'Kitchen','258.00','130.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(25,'START-003','Crackers Platter','','Starters / Bar Bites',NULL,'Bar','138.00','70.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(26,'START-004','Street Food Platter','','Starters / Bar Bites',NULL,'Kitchen','188.00','95.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(27,'START-005','Sizzling Cheese Corn','','Starters / Bar Bites',NULL,'Kitchen','218.00','110.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(28,'START-006','Dumplings in Chili Oil','Best Seller','Starters / Bar Bites',NULL,'Kitchen','178.00','90.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(29,'START-007','Sizzling Tofu','','Starters / Bar Bites',NULL,'Kitchen','198.00','100.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(30,'START-008','Flavored Fries','BBQ / Cheese / Sour Cream','Starters / Bar Bites',NULL,'Kitchen','188.00','95.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(31,'START-009','Shawarma Fries','','Starters / Bar Bites',NULL,'Kitchen','208.00','105.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(32,'START-010','RA Nachos','Best Seller','Starters / Bar Bites',NULL,'Kitchen','238.00','120.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(33,'START-011','Shawarma Nachos','','Starters / Bar Bites',NULL,'Kitchen','258.00','130.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(34,'START-012','Jalapeno Cheese Sticks','','Starters / Bar Bites',NULL,'Kitchen','198.00','100.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(35,'START-013','Salmon Sashimi','Best Seller','Starters / Bar Bites',NULL,'Kitchen','338.00','170.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(36,'START-014','Tokwat Baboy','Best Seller','Starters / Bar Bites',NULL,'Kitchen','318.00','160.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(37,'START-015','Chicharong Bulaklak','Best Seller','Starters / Bar Bites',NULL,'Kitchen','248.00','125.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(38,'START-016','Creamy Spinach Dip','','Starters / Bar Bites',NULL,'Kitchen','258.00','130.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(39,'START-017','RabbitAlley Tacos','Sisig / Habanero Chicken / Camaron','Starters / Bar Bites',NULL,'Kitchen','238.00','120.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(40,'PASTA-001','Porcini and Truffle Pasta (Regular)','Best Seller','Pasta',NULL,'Kitchen','448.00','225.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(41,'PASTA-002','Porcini and Truffle Pasta (Sharing)','Best Seller','Pasta',NULL,'Kitchen','888.00','450.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(42,'PASTA-003','Gambas al Ajillo Pasta (Regular)','','Pasta',NULL,'Kitchen','368.00','185.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(43,'PASTA-004','Gambas al Ajillo Pasta (Sharing)','','Pasta',NULL,'Kitchen','708.00','355.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(44,'PASTA-005','Creamy Carbonara (Regular)','Best Seller','Pasta',NULL,'Kitchen','308.00','155.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(45,'PASTA-006','Creamy Carbonara (Sharing)','Best Seller','Pasta',NULL,'Kitchen','598.00','300.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(46,'PASTA-007','Shrimp in Aligue Pasta (Regular)','','Pasta',NULL,'Kitchen','408.00','205.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(47,'PASTA-008','Shrimp in Aligue Pasta (Sharing)','','Pasta',NULL,'Kitchen','798.00','400.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(48,'PASTA-009','Spanish Sardines Pasta (Regular)','','Pasta',NULL,'Kitchen','458.00','230.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(49,'PASTA-010','Spanish Sardines Pasta (Sharing)','','Pasta',NULL,'Kitchen','888.00','445.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(50,'PASTA-011','Cannelloni Bolognese (Regular)','','Pasta',NULL,'Kitchen','458.00','230.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(51,'PASTA-012','Cannelloni Bolognese (Sharing)','','Pasta',NULL,'Kitchen','888.00','445.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(52,'CHKN-001','Grilled Thai Chicken (Regular)','','Chicken',NULL,'Kitchen','258.00','130.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(53,'CHKN-002','Grilled Thai Chicken (Sharing)','','Chicken',NULL,'Kitchen','488.00','245.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(54,'CHKN-003','Chicken Katsu','','Chicken',NULL,'Kitchen','328.00','165.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(55,'CHKN-004','Chicken Katsu Curry','','Chicken',NULL,'Kitchen','388.00','195.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(56,'CHKN-005','Chicken Parmiggiana (Regular)','','Chicken',NULL,'Kitchen','298.00','150.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(57,'CHKN-006','Chicken Parmiggiana (Sharing)','','Chicken',NULL,'Kitchen','488.00','245.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(58,'CHKN-007','Kanto Fried Chicken (Regular)','Best Seller','Chicken',NULL,'Kitchen','308.00','155.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(59,'CHKN-008','Kanto Fried Chicken (Sharing)','Best Seller','Chicken',NULL,'Kitchen','588.00','295.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(60,'CHKN-009','Fried Chicken Wings (Half)','Best Seller','Chicken',NULL,'Kitchen','398.00','200.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(61,'CHKN-010','Fried Chicken Wings (Full)','Best Seller','Chicken',NULL,'Kitchen','658.00','330.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(62,'SEA-001','Creamy Garlic Shrimp','','Seafood',NULL,'Kitchen','398.00','200.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(63,'SEA-002','Fish and Chips','','Seafood',NULL,'Kitchen','328.00','165.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(64,'SEA-003','Baked Garlic Tahong','','Seafood',NULL,'Kitchen','428.00','215.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(65,'SEA-004','Shrimp Tempura','','Seafood',NULL,'Kitchen','298.00','150.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(66,'SEA-005','Garlic Butter Shrimp','Best Seller','Seafood',NULL,'Kitchen','368.00','185.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(67,'SEA-006','Shrimp in Aligue Butter','','Seafood',NULL,'Kitchen','388.00','195.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(68,'SEA-007','Gambas Al Ajillo','Best Seller','Seafood',NULL,'Kitchen','358.00','180.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(69,'SEA-008','Salted Egg Shrimp','','Seafood',NULL,'Kitchen','398.00','200.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(70,'SEA-009','Fried Calamares (Regular)','','Seafood',NULL,'Kitchen','348.00','175.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(71,'SEA-010','Fried Calamares (Large)','','Seafood',NULL,'Kitchen','668.00','335.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(72,'PORK-001','Pork Tonkatsu Platter','','Pork',NULL,'Kitchen','548.00','275.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(73,'PORK-002','Sizzling Pork Sisig','Best Seller','Pork',NULL,'Kitchen','268.00','135.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(74,'PORK-003','Sausage & Peppers','','Pork',NULL,'Kitchen','298.00','150.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(75,'PORK-004','Crispy Pata Platter','Best Seller','Pork',NULL,'Kitchen','1088.00','545.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(76,'PORK-005','Kare-Kare Crispy Pata','','Pork',NULL,'Kitchen','1188.00','595.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(77,'PORK-006','Lechon Kawali','','Pork',NULL,'Kitchen','448.00','225.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(78,'PORK-007','Binondo Kikiam','Best Seller','Pork',NULL,'Kitchen','448.00','225.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(79,'PORK-008','Grilled Hungarian Sausage','','Pork',NULL,'Kitchen','268.00','135.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(80,'PORK-009','Lechon Macau','Best Seller','Pork',NULL,'Kitchen','368.00','185.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(81,'PORK-010','Pork BBQ Skewers','','Pork',NULL,'Kitchen','308.00','155.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(82,'PORK-011','Grilled Pork Chops (Regular)','','Pork',NULL,'Kitchen','348.00','175.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(83,'PORK-012','Grilled Pork Chops (Large)','','Pork',NULL,'Kitchen','548.00','275.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(84,'BEEF-001','Grilled Wagyu Cubes','Best Seller','Beef / Others',NULL,'Kitchen','438.00','220.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(85,'BEEF-002','Steak and Fries','Best Seller','Beef / Others',NULL,'Kitchen','1088.00','545.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(86,'BEEF-003','Beef Chelo Kebab','','Beef / Others',NULL,'Kitchen','288.00','145.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(87,'BEEF-004','Beef Truffle Lengua','Best Seller','Beef / Others',NULL,'Kitchen','498.00','250.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(88,'BEEF-005','Beef BBQ Skewers','','Beef / Others',NULL,'Kitchen','498.00','250.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(89,'BEEF-006','Kaldereta - Beef','','Beef / Others',NULL,'Kitchen','558.00','280.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(90,'BEEF-007','Kambing','','Beef / Others',NULL,'Kitchen','598.00','300.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(91,'GRP-001','RabbitAlley Sampler','Good for 8-10 pax','Group Meals',NULL,'Kitchen','4000.00','2000.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(92,'GRP-002','Inuman Sampler','Good for 8-10 pax','Group Meals',NULL,'Kitchen','4000.00','2000.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(93,'GRP-003','Filipino Sampler','Good for 6-8 pax','Group Meals',NULL,'Kitchen','3099.00','1550.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(94,'GRP-004','International Sampler','Good for 8-10 pax','Group Meals',NULL,'Kitchen','4000.00','2000.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(95,'GRP-005','Asian Cuisine Sampler','Good for 8-10 pax','Group Meals',NULL,'Kitchen','4000.00','2000.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(96,'LIQ-001','Soju','','Hard Liquor',NULL,'Bar','500.00','250.00','50.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(97,'LIQ-002','The BaR Premium Dry Gin','Pink Gin / Lime Gin','Hard Liquor',NULL,'Bar','900.00','450.00','90.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(98,'LIQ-003','GSM Blue Mojito 1L','','Hard Liquor',NULL,'Bar','1000.00','500.00','100.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(99,'LIQ-004','Alfonso I Light','','Hard Liquor',NULL,'Bar','1300.00','650.00','130.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(100,'LIQ-005','Fundador Light','','Hard Liquor',NULL,'Bar','1500.00','750.00','150.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(101,'LIQ-006','Bacardi Superior','','Hard Liquor',NULL,'Bar','1700.00','850.00','170.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(102,'LIQ-007','Bacardi Gold','','Hard Liquor',NULL,'Bar','1700.00','850.00','170.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(103,'LIQ-008','Jose Cuervo','','Hard Liquor',NULL,'Bar','2200.00','1100.00','220.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(104,'LIQ-009','Jose Cuervo 1L','','Hard Liquor',NULL,'Bar','3000.00','1500.00','300.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(105,'LIQ-010','JW Black Label','','Hard Liquor',NULL,'Bar','3200.00','1600.00','320.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(106,'LIQ-011','Jack Daniels Whiskey','','Hard Liquor',NULL,'Bar','3700.00','1850.00','370.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(107,'LIQ-012','JW Double Black','','Hard Liquor',NULL,'Bar','4200.00','2100.00','420.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(108,'LIQ-013','JW Blue Label','','Hard Liquor',NULL,'Bar','14000.00','7000.00','1400.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(109,'LIQ-014','Hennessy VS','','Hard Liquor',NULL,'Bar','4200.00','2100.00','420.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(110,'LIQ-015','Dalmore 12 yrs','','Hard Liquor',NULL,'Bar','6900.00','3450.00','690.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(111,'WINE-001','Yellow Tail Pink Moscato','','Wines',NULL,'Bar','2000.00','1000.00','200.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(112,'WINE-002','Yellow Tail Moscato','','Wines',NULL,'Bar','2000.00','1000.00','200.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(113,'WINE-003','Yellow Tail Merlot','','Wines',NULL,'Bar','2000.00','1000.00','200.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(114,'BEER-001','San Miguel Light','','Beers',NULL,'Bar','150.00','75.00','15.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(115,'BEER-002','San Miguel Pale Pilsen','','Beers',NULL,'Bar','150.00','75.00','15.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(116,'BEER-003','San Miguel Apple','','Beers',NULL,'Bar','150.00','75.00','15.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(117,'BEER-004','Red Horse Stallion','','Beers',NULL,'Bar','200.00','100.00','20.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(118,'BEER-005','Smirnoff Mule','','Beers',NULL,'Bar','200.00','100.00','20.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(119,'BEER-006','SML/SMB/SMA Bucket','6 bottles','Beers',NULL,'Bar','598.00','300.00','60.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(120,'BEER-007','RH/Mule Bucket','6 bottles','Beers',NULL,'Bar','720.00','360.00','72.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(121,'NA-001','Bottled Water','','Non-Alcoholic',NULL,'Bar','75.00','38.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(122,'NA-002','Soda (Can)','','Non-Alcoholic',NULL,'Bar','90.00','45.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(123,'NA-003','Soda (Carafe)','','Non-Alcoholic',NULL,'Bar','250.00','125.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(124,'NA-004','Soda (Bottle)','','Non-Alcoholic',NULL,'Bar','300.00','150.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(125,'NA-005','Coffee','','Non-Alcoholic',NULL,'Bar','128.00','65.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(126,'NA-006','Iced Coffee','','Non-Alcoholic',NULL,'Bar','168.00','85.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(127,'NA-007','Iced Tea (Regular)','','Non-Alcoholic',NULL,'Bar','90.00','45.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(128,'NA-008','Iced Tea (Pitcher)','','Non-Alcoholic',NULL,'Bar','250.00','125.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(129,'NA-009','Cucumber Lemonade (Regular)','','Non-Alcoholic',NULL,'Bar','90.00','45.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(130,'NA-010','Cucumber Lemonade (Pitcher)','','Non-Alcoholic',NULL,'Bar','250.00','125.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(131,'NA-011','Candy','','Non-Alcoholic',NULL,'Bar','25.00','13.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(132,'NA-012','Cigarettes','','Non-Alcoholic',NULL,'Bar','250.00','125.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(133,'PROMO-001','Happy Hour SML/SMB/SMA (Bottle)','Lounge 6PM-9PM','Promos',NULL,'Bar','80.00','40.00','8.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(134,'PROMO-002','Happy Hour SML/SMB/SMA (Bucket)','Lounge 6PM-9PM','Promos',NULL,'Bar','450.00','225.00','45.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(135,'PROMO-003','Happy Hour RH/Mule (Bottle)','Lounge 6PM-9PM','Promos',NULL,'Bar','100.00','50.00','10.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(136,'PROMO-004','Happy Hour RH/Mule (Bucket)','Lounge 6PM-9PM','Promos',NULL,'Bar','550.00','275.00','55.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(137,'AYCE-001','AYCE Wings Sunday Special','All You Can Eat Wings - Sundays Only','AYCE Sundays',NULL,'Kitchen','648.00','300.00','65.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(138,'AYCE-W01','Wings - Original','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(139,'AYCE-W02','Wings - Classic Buffalo','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(140,'AYCE-W03','Wings - Honey Mustard','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(141,'AYCE-W04','Wings - Texas BBQ','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(142,'AYCE-W05','Wings - Honey Sriracha','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(143,'AYCE-W06','Wings - Honey Garlic','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(144,'AYCE-W07','Wings - Soy Garlic','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(145,'AYCE-W08','Wings - Garlic Parmesan','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(146,'AYCE-W09','Wings - Memphis Dry Rub','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(147,'AYCE-W10','Wings - Cheesy Cheetos','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(148,'AYCE-W11','Wings - Salted Egg','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(149,'AYCE-W12','Wings - Wasabi','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(150,'AYCE-W13','Wings - Galbi','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(151,'AYCE-W14','Wings - Gochu Jang','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(152,'AYCE-W15','Wings - Garlic Pesto','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(153,'AYCE-W16','Wings - Sour Cream','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(154,'AYCE-W17','Wings - Kamikaze','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(155,'AYCE-W18','Wings - Habanero Buffalo','AYCE Sunday Flavor - SPICY','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(156,'AYCE-W19','Wings - Carolina Reaper','AYCE Sunday Flavor - EXTREME SPICY','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(157,'AYCE-W20','Wings - Carolina Mop Sauce','AYCE Sunday Flavor','AYCE Wings',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(158,'AYCE-S01','Side - Mexican Corn','AYCE Sunday Side','AYCE Sides',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(159,'AYCE-S02','Side - Mac & Cheese','AYCE Sunday Side','AYCE Sides',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(160,'AYCE-S03','Side - Shawarma Rice','AYCE Sunday Side','AYCE Sides',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(161,'AYCE-S04','Side - Coleslaw','AYCE Sunday Side','AYCE Sides',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(162,'AYCE-S05','Side - Fries','AYCE Sunday Side','AYCE Sides',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(163,'AYCE-S06','Side - Iced Tea','AYCE Sunday Side','AYCE Sides',NULL,'Bar','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(164,'AYCE-S07','Side - Rice','AYCE Sunday Side','AYCE Sides',NULL,'Kitchen','0.00','0.00','0.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(165,'LD-001','San Mig Light','Ladies Drink - Beer','Ladies Drink',NULL,'LD','350.00','150.00','50.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(166,'LD-002','San Mig Pale Pilsen','Ladies Drink - Beer','Ladies Drink',NULL,'LD','350.00','150.00','50.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(167,'LD-003','Red Horse','Ladies Drink - Beer','Ladies Drink',NULL,'LD','350.00','150.00','50.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(168,'LD-004','Coke Float','Ladies Drink - Softdrink','Ladies Drink',NULL,'LD','250.00','100.00','40.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(169,'LD-005','Iced Tea','Ladies Drink - Non-Alcoholic','Ladies Drink',NULL,'LD','200.00','80.00','35.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(170,'LD-006','House Wine (Red)','Ladies Drink - Wine','Ladies Drink',NULL,'LD','450.00','200.00','70.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(171,'LD-007','House Wine (White)','Ladies Drink - Wine','Ladies Drink',NULL,'LD','450.00','200.00','70.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(172,'LD-008','Vodka Soda','Ladies Drink - Cocktail','Ladies Drink',NULL,'LD','400.00','180.00','60.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(173,'LD-009','Gin Tonic','Ladies Drink - Cocktail','Ladies Drink',NULL,'LD','400.00','180.00','60.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(174,'LD-010','Margarita','Ladies Drink - Cocktail','Ladies Drink',NULL,'LD','500.00','220.00','75.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(175,'LD-011','Mojito','Ladies Drink - Cocktail','Ladies Drink',NULL,'LD','500.00','220.00','75.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(176,'LD-012','Strawberry Daiquiri','Ladies Drink - Cocktail','Ladies Drink',NULL,'LD','500.00','220.00','75.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(177,'LD-013','Sex on the Beach','Ladies Drink - Cocktail','Ladies Drink',NULL,'LD','550.00','240.00','80.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(178,'LD-014','Blue Lagoon','Ladies Drink - Cocktail','Ladies Drink',NULL,'LD','550.00','240.00','80.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(179,'LD-015','Tequila Shot','Ladies Drink - Shot','Ladies Drink',NULL,'LD','300.00','120.00','50.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47');

-- ------------------------------------------------------
-- Table structure for table `receipt_snapshots`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `receipt_snapshots`;
CREATE TABLE `receipt_snapshots` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `snapshot_type` enum('official_receipt','running_bill') NOT NULL,
  `order_id` int(10) unsigned DEFAULT NULL,
  `table_id` varchar(16) DEFAULT NULL,
  `table_visit_id` int(10) unsigned DEFAULT NULL,
  `session_id` bigint(20) unsigned DEFAULT NULL,
  `payment_method` varchar(32) DEFAULT NULL,
  `receipt_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`receipt_json`)),
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_receipt_snapshots_order` (`branch_id`,`order_id`,`snapshot_type`,`created_at`),
  KEY `idx_receipt_snapshots_table` (`branch_id`,`table_id`,`snapshot_type`,`created_at`),
  KEY `idx_receipt_snapshots_visit` (`branch_id`,`table_visit_id`,`snapshot_type`,`created_at`),
  KEY `idx_receipt_snapshots_session` (`branch_id`,`session_id`),
  KEY `idx_receipt_snapshots_created` (`created_at`),
  CONSTRAINT `1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `receipt_snapshots`
INSERT INTO `receipt_snapshots` VALUES
(1,1,'official_receipt',8,'C6',8,5,'split_payment','{"orderNumber":"8","date":"Jul 17, 2026","time":"07:55 PM","table":"C6","cashier":"Angelo Val Morante","businessName":"Rabbit Alley","businessAddress":"123 Main Street, Manila, Philippines","businessContact":"+63 912 345 6789","receiptFooter":"Thank you for visiting Rabbit Alley!","vatTin":"123-456-789-000","serviceLabel":"Service (10%)","taxLabel":"VAT (12%)","items":[{"name":"San Mig Light [Clarisse Dela Cruz]","quantity":5,"subtotal":1750,"isComplimentary":false}],"subtotal":1750,"serviceCharge":175,"tax":210,"total":2135,"amountDue":2135,"paymentMethod":"split_payment","amountPaid":2135,"change":0}',1,'2026-07-17 11:55:00');

-- ------------------------------------------------------
-- Table structure for table `refunds`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `refunds`;
CREATE TABLE `refunds` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(10) unsigned NOT NULL,
  `original_payment_method` varchar(32) NOT NULL,
  `refund_amount` decimal(12,2) NOT NULL,
  `refund_method` varchar(32) NOT NULL,
  `reason` varchar(512) NOT NULL,
  `status` enum('pending','approved','completed','rejected') NOT NULL DEFAULT 'pending',
  `requested_by` int(10) unsigned NOT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `shift_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `shift_id` (`shift_id`),
  KEY `idx_refunds_order` (`order_id`),
  KEY `idx_refunds_status` (`status`),
  CONSTRAINT `1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `4` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `refunds`

-- ------------------------------------------------------
-- Table structure for table `role_permissions`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `role_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `role_permissions`
INSERT INTO `role_permissions` VALUES
(1,1),
(2,1),
(3,1),
(1,2),
(1,3),
(2,3),
(3,3),
(1,4),
(1,5),
(2,5),
(3,5),
(1,6),
(1,7),
(2,7),
(3,7),
(1,8),
(3,8),
(1,9),
(3,9),
(1,10),
(3,10),
(1,11),
(2,11),
(1,12),
(1,13),
(2,13),
(3,13),
(1,14),
(1,15),
(1,16),
(3,16),
(1,17),
(1,18),
(1,19),
(2,19),
(1,20),
(2,20),
(1,21),
(1,22),
(1,23),
(1,24),
(1,25),
(1,26),
(1,27),
(2,27),
(3,27),
(1,28),
(2,28),
(3,28),
(1,29),
(3,29),
(1,30),
(3,30),
(1,31),
(3,31),
(1,32),
(3,32),
(1,33),
(1,34),
(1,35),
(1,36),
(1,37),
(1,38),
(1,39),
(2,39),
(3,39),
(2,40),
(2,41),
(2,42),
(3,43),
(3,44),
(3,46),
(1,47),
(1,48),
(1,49),
(3,49),
(1,50),
(3,50),
(2,51),
(3,51);

-- ------------------------------------------------------
-- Table structure for table `roles`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `guard` varchar(32) NOT NULL DEFAULT 'web',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roles_name_guard` (`name`,`guard`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `roles`
INSERT INTO `roles` VALUES
(1,'Administrator','web','2026-07-16 15:23:47'),
(2,'Staff','web','2026-07-16 15:23:47'),
(3,'Operations Staff','web','2026-07-16 15:23:47');

-- ------------------------------------------------------
-- Table structure for table `schema_migrations`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `schema_migrations`;
CREATE TABLE `schema_migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration_name` varchar(255) NOT NULL,
  `applied_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_migration_name` (`migration_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `schema_migrations`

-- ------------------------------------------------------
-- Table structure for table `settings`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(64) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `category` varchar(32) DEFAULT 'general',
  `description` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_settings_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `settings`
INSERT INTO `settings` VALUES
(1,'business_name','Rabbit Alley','business','Business name','2026-07-16 15:23:47'),
(2,'business_address','123 Main Street, Manila, Philippines','business','Business address','2026-07-16 15:23:47'),
(3,'business_contact','+63 912 345 6789','business','Contact number','2026-07-16 15:23:47'),
(4,'vat_tin','123-456-789-000','business','VAT TIN number','2026-07-16 15:23:47'),
(5,'receipt_footer','Thank you for visiting Rabbit Alley!','receipt','Receipt footer message','2026-07-16 15:23:47'),
(6,'tax_rate','12','tax','Tax rate percentage (VAT)','2026-07-16 15:23:47'),
(7,'service_charge_mode','percent','charges','Service charge mode: percent or fixed','2026-07-16 15:23:47'),
(8,'service_charge_value','10','charges','Service charge value','2026-07-16 15:23:47'),
(9,'card_surcharge','2','charges','Card surcharge percentage','2026-07-16 15:23:47'),
(10,'printer_assignments','{"payment_receipt":"","running_bill":"","order_slip":"","bar_chit":"","kitchen_chit":"","ld_chit":""}','printing','Printer per print job type (JSON)','2026-07-16 15:23:47');

-- ------------------------------------------------------
-- Table structure for table `shifts`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `shifts`;
CREATE TABLE `shifts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `shift_date` date NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `status` enum('open','closed','approved') NOT NULL DEFAULT 'open',
  `opening_cash` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_cash_sales` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_card_sales` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_gcash_sales` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_bank_sales` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_refunds` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_voids` decimal(12,2) NOT NULL DEFAULT 0.00,
  `expected_cash` decimal(12,2) NOT NULL DEFAULT 0.00,
  `actual_cash` decimal(12,2) DEFAULT NULL,
  `cash_variance` decimal(12,2) DEFAULT NULL,
  `variance_reason` varchar(512) DEFAULT NULL,
  `approved_by` int(10) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_shifts_branch` (`branch_id`),
  KEY `idx_shifts_user_date` (`user_id`,`shift_date`),
  KEY `idx_shifts_status` (`status`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `3` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `shifts`
INSERT INTO `shifts` VALUES
(1,5,1,'2026-07-15 16:00:00','2026-07-15 23:23:50',NULL,'open','5000.00','0.00','0.00','0.00','0.00','0.00','276.00','0.00',NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50');

-- ------------------------------------------------------
-- Table structure for table `split_payments`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `split_payments`;
CREATE TABLE `split_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(10) unsigned NOT NULL,
  `split_number` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_method` varchar(32) NOT NULL,
  `status` enum('pending','paid') NOT NULL DEFAULT 'pending',
  `paid_at` datetime DEFAULT NULL,
  `processed_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `processed_by` (`processed_by`),
  KEY `idx_split_order` (`order_id`),
  CONSTRAINT `1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `split_payments`
INSERT INTO `split_payments` VALUES
(1,8,1,'1500.00','cash','paid',NULL,NULL,'2026-07-17 11:55:00'),
(2,8,2,'635.00','bank','paid',NULL,NULL,'2026-07-17 11:55:00');

-- ------------------------------------------------------
-- Table structure for table `table_sessions`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `table_sessions`;
CREATE TABLE `table_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `table_id` varchar(16) NOT NULL,
  `waiter_id` varchar(32) DEFAULT NULL COMMENT 'employee_id of waiter at open',
  `opened_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `closed_at` timestamp NULL DEFAULT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `closed_by` varchar(128) DEFAULT NULL,
  `migrated_legacy` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = best-effort backfill from pre-session data',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_table_sessions_branch_table` (`branch_id`,`table_id`,`status`),
  KEY `idx_table_sessions_opened` (`branch_id`,`opened_at`),
  KEY `idx_table_sessions_closed` (`branch_id`,`closed_at`),
  KEY `idx_table_sessions_waiter` (`branch_id`,`waiter_id`),
  CONSTRAINT `1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `table_sessions`
INSERT INTO `table_sessions` VALUES
(1,1,'LD1','WTR001','2026-07-16 06:33:50',NULL,'open',NULL,0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(2,1,'LD2','WTR001','2026-07-16 06:41:50','2026-07-16 15:24:59','closed','system:merge',0,'2026-07-16 15:23:50','2026-07-16 15:24:59'),
(3,1,'LD3','WTR001','2026-07-16 06:48:50',NULL,'open',NULL,0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(4,1,'C6','WTR001','2026-07-16 05:13:50','2026-07-16 05:15:50','closed','payment',0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(5,1,'C6','WTR001','2026-07-16 06:58:50','2026-07-17 11:55:00','closed','Angelo Val Morante',0,'2026-07-16 15:23:50','2026-07-17 11:55:00'),
(6,1,'L1','WTR001','2026-07-16 05:43:50','2026-07-16 05:45:50','closed','payment',0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(7,1,'LD4','WTR001','2026-07-16 07:03:50',NULL,'open',NULL,0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(8,1,'C3','WTR001','2026-07-16 05:53:50','2026-07-16 05:55:50','closed','payment',0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(9,1,'L4','WTR001','2026-07-16 07:08:50','2026-07-16 07:11:50','closed','void',0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(10,1,'C1','WTR001','2026-07-16 05:03:50',NULL,'open',NULL,0,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(11,1,'C3','WTS001','2026-07-16 15:23:47','2026-07-16 15:23:47','closed','migrated_legacy',1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(12,1,'L1','WTR001','2026-07-16 15:23:47','2026-07-16 15:23:47','closed','migrated_legacy',1,'2026-07-16 15:24:45','2026-07-16 15:24:45');

-- ------------------------------------------------------
-- Table structure for table `table_transfers`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `table_transfers`;
CREATE TABLE `table_transfers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int(10) unsigned NOT NULL,
  `from_table` varchar(16) NOT NULL,
  `to_table` varchar(16) NOT NULL,
  `transfer_type` enum('move','merge','split') NOT NULL DEFAULT 'move',
  `transferred_by` int(10) unsigned NOT NULL,
  `reason` varchar(256) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `transferred_by` (`transferred_by`),
  KEY `idx_transfer_order` (`order_id`),
  CONSTRAINT `1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`transferred_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `table_transfers`
INSERT INTO `table_transfers` VALUES
(4,3,'LD2','LD1','move',1,'API Integration Test Merge','2026-07-16 15:24:59'),
(5,4,'LD2','LD1','merge',1,'API Integration Test Merge','2026-07-16 15:24:59');

-- ------------------------------------------------------
-- Table structure for table `users`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  `email` varchar(128) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `nickname` varchar(64) DEFAULT NULL,
  `allowance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `hourly` decimal(10,2) NOT NULL DEFAULT 0.00,
  `budget` decimal(10,2) NOT NULL DEFAULT 0.00,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `incentive_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `table_incentive` decimal(10,2) NOT NULL DEFAULT 0.00,
  `has_quota` tinyint(1) NOT NULL DEFAULT 0,
  `quota_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_employee_id` (`employee_id`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `role_id` (`role_id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `2` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `users`
INSERT INTO `users` VALUES
(1,'MGR001','Angelo Val Morante','gelo@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',1,1,'Gelo','500.00','0.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(2,'MGR002','Jedd Kris Paul Patio','jedd@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',1,1,'Jedd','500.00','0.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(3,'MGR003','Len Gabriel Liwanag','gab@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',1,1,'Gab','500.00','0.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(4,'MGR004','Martin Tolentino','monk@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',1,1,'Monk','500.00','0.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(5,'WTR001','Christian','christian@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Christian','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(6,'WTR002','Jhovi','jhovi@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Jhovi','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(7,'WTR003','Keith','keith@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Keith','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(8,'WTR004','Marlon','marlon@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Marlon','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(9,'WTS001','Nikka','nikka@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Nikka','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(10,'WTS002','Yuna','yuna@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Yuna','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(11,'WTS003','Kath','kath@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Kath','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(12,'WTS004','Joy','joy@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Joy','350.00','50.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(13,'BAR001','Toyskie','toyskie@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',3,1,'Toyskie','400.00','60.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(14,'BAR002','Romgel','romgel@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',3,1,'Romgel','400.00','60.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(15,'MDL001','Angelica Santos','angelica@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Angel','300.00','0.00','1500.00','100.00','100.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:50'),
(16,'MDL002','Bianca Reyes','bianca@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Bianca','300.00','0.00','1500.00','100.00','100.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:50'),
(17,'MDL003','Clarisse Dela Cruz','clarisse@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Cla','300.00','0.00','1500.00','100.00','100.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:50'),
(18,'MDL004','Diana Villanueva','diana@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Diana','300.00','0.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47'),
(19,'MDL005','Elena Cruz','elena@rabbitalley.local','$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG',2,1,'Elena','300.00','0.00','0.00','0.00','0.00','0.00',0,'0.00',1,'2026-07-16 15:23:47','2026-07-16 15:23:47');

-- ------------------------------------------------------
-- Table structure for table `void_log`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `void_log`;
CREATE TABLE `void_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `void_type` enum('item','order','payment') NOT NULL DEFAULT 'item',
  `order_id` int(10) unsigned DEFAULT NULL,
  `order_item_id` int(10) unsigned DEFAULT NULL,
  `product_id` int(10) unsigned DEFAULT NULL,
  `product_sku` varchar(64) DEFAULT NULL,
  `product_name` varchar(128) NOT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `table_id` varchar(16) DEFAULT NULL,
  `session_id` bigint(20) unsigned DEFAULT NULL,
  `voided_by` int(10) unsigned DEFAULT NULL,
  `voided_by_name` varchar(128) DEFAULT NULL,
  `voided_by_employee_id` varchar(32) DEFAULT NULL,
  `voided_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reason` varchar(512) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_void_log_branch_time` (`branch_id`,`voided_at`),
  KEY `idx_void_log_voided_by` (`branch_id`,`voided_by`),
  KEY `idx_void_log_table` (`branch_id`,`table_id`),
  KEY `idx_void_log_product` (`product_sku`),
  KEY `idx_void_log_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `void_log`
INSERT INTO `void_log` VALUES
(1,1,'item',10,8,165,'LD-001','San Mig Light',5,'350.00','1750.00','LD4',NULL,1,'Angelo Val Morante','MGR001','2026-07-16 07:05:50','Wrong drink ordered','2026-07-16 15:23:50'),
(2,1,'item',11,10,23,'START-001','Mixed Nuts',2,'138.00','276.00','C3',NULL,1,'Angelo Val Morante','MGR001','2026-07-16 05:58:50','Guest changed mind','2026-07-16 15:23:50'),
(3,1,'order',12,12,1,'SOUP-001','Sinigang na Kambing',2,'558.00','1116.00','L4',NULL,1,'Angelo Val Morante','MGR001','2026-07-16 07:11:50','Table walked out','2026-07-16 15:23:50'),
(4,1,'order',12,13,23,'START-001','Mixed Nuts',1,'138.00','138.00','L4',NULL,1,'Angelo Val Morante','MGR001','2026-07-16 07:11:50','Table walked out','2026-07-16 15:23:50');

-- ------------------------------------------------------
-- Table structure for table `waiter_table_assignments`
-- ------------------------------------------------------
DROP TABLE IF EXISTS `waiter_table_assignments`;
CREATE TABLE `waiter_table_assignments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL DEFAULT 1,
  `user_id` int(10) unsigned NOT NULL,
  `table_id` varchar(16) NOT NULL,
  `assigned_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_waiter_table` (`branch_id`,`user_id`,`table_id`),
  KEY `user_id` (`user_id`),
  KEY `branch_id` (`branch_id`,`table_id`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`branch_id`, `table_id`) REFERENCES `pos_tables` (`branch_id`, `id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `waiter_table_assignments`

SET FOREIGN_KEY_CHECKS = 1;