-- Rabbit Alley POS Database Backup
-- Generated on 2026-07-18T11:27:34.474Z
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `audit_logs`
INSERT INTO `audit_logs` VALUES
(1,5,'WTR001','Christian','Staff','auth_login','user','5',NULL,NULL,1,'2026-07-16 15:24:52'),
(2,1,'MGR001','Angelo Val Morante','Administrator','auth_login','user','1',NULL,NULL,1,'2026-07-16 15:24:59'),
(3,1,'MGR001','Angelo Val Morante','Administrator','auth_login','user','1',NULL,NULL,1,'2026-07-17 11:54:34'),
(4,1,'MGR001','Angelo Val Morante','Administrator','table_pay_all','table','C6','{"orderIds":["8"],"paymentMethod":"split_payment","total":2135,"splits":[{"amount":1500,"paymentMethod":"cash"},{"amount":635,"paymentMethod":"bank"}]}','::1',1,'2026-07-17 11:55:00'),
(5,1,'MGR001','Angelo Val Morante','Administrator','table_pay_all','table','C1','{"orderIds":["14"],"paymentMethod":"cash","total":336.72}','::1',1,'2026-07-17 20:09:30');

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
  `order_ids` text DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=141 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `order_items`
INSERT INTO `order_items` VALUES
(6,8,165,'LD-001',NULL,'San Mig Light',5,'350.00','0.00','1750.00','LD',1,0,17,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(15,14,23,'START-001',NULL,'Mixed Nuts',2,'138.00','0.00','276.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-16 15:23:50'),
(16,15,165,'LD-001',NULL,'San Mig Light',8,'350.00','0.00','2800.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(17,16,165,'LD-001',NULL,'San Mig Light',6,'350.00','0.00','2100.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(18,17,165,'LD-001',NULL,'San Mig Light',4,'350.00','0.00','1400.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(19,18,165,'LD-001',NULL,'San Mig Light',5,'350.00','0.00','1750.00','LD',1,0,17,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(20,18,23,'START-001',NULL,'Mixed Nuts',2,'138.00','0.00','276.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(21,19,165,'LD-001',NULL,'San Mig Light',5,'350.00','0.00','1750.00','LD',1,0,17,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(22,20,165,'LD-001',NULL,'San Mig Light',3,'350.00','0.00','1050.00','LD',1,0,15,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(23,21,165,'LD-001',NULL,'San Mig Light',5,'350.00','0.00','1750.00','LD',1,0,16,NULL,1,1,'2026-07-17 11:54:22','Angelo Val Morante','2026-07-17 20:12:22'),
(24,21,23,'START-001',NULL,'Mixed Nuts',1,'138.00','0.00','138.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(25,22,23,'START-001',NULL,'Mixed Nuts',2,'138.00','0.00','276.00','Bar',1,0,NULL,NULL,1,1,'2026-07-17 10:47:22','Angelo Val Morante','2026-07-17 20:12:22'),
(26,22,1,'SOUP-001',NULL,'Sinigang na Kambing',1,'558.00','0.00','558.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(27,23,1,'SOUP-001',NULL,'Sinigang na Kambing',2,'558.00','0.00','1116.00','Kitchen',1,0,NULL,NULL,1,1,'2026-07-17 12:00:22','Angelo Val Morante','2026-07-17 20:12:22'),
(28,23,23,'START-001',NULL,'Mixed Nuts',1,'138.00','0.00','138.00','Bar',1,0,NULL,NULL,1,1,'2026-07-17 12:00:22','Angelo Val Morante','2026-07-17 20:12:22'),
(29,24,23,'START-001',NULL,'Mixed Nuts',3,'138.00','0.00','414.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(30,25,23,'START-001',NULL,'Mixed Nuts',2,'138.00','0.00','276.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:12:22'),
(31,26,111,'WINE-001',NULL,'Yellow Tail Pink Moscato',2,'2000.00','0.00','4000.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(32,26,45,'PASTA-006',NULL,'Creamy Carbonara (Sharing)',2,'598.00','0.00','1196.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(33,26,120,'BEER-007',NULL,'RH/Mule Bucket',2,'720.00','0.00','1440.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(34,27,118,'BEER-005',NULL,'Smirnoff Mule',1,'200.00','0.00','200.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(35,27,110,'LIQ-015',NULL,'Dalmore 12 yrs',1,'6900.00','0.00','6900.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(36,28,131,'NA-011',NULL,'Candy',1,'25.00','0.00','25.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(37,28,138,'AYCE-W01',NULL,'Wings - Original',2,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(38,28,133,'PROMO-001',NULL,'Happy Hour SML/SMB/SMA (Bottle)',1,'80.00','0.00','80.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(39,29,170,'LD-006',NULL,'House Wine (Red)',2,'450.00','0.00','900.00','LD',1,0,15,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(40,29,43,'PASTA-004',NULL,'Gambas al Ajillo Pasta (Sharing)',1,'708.00','0.00','708.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(41,30,48,'PASTA-009',NULL,'Spanish Sardines Pasta (Regular)',2,'458.00','0.00','916.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(42,31,123,'NA-003',NULL,'Soda (Carafe)',2,'250.00','0.00','500.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(43,31,19,'SAL-012',NULL,'Quesadilla - Pepperoni',1,'208.00','0.00','208.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(44,32,28,'START-006',NULL,'Dumplings in Chili Oil',1,'178.00','0.00','178.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(45,32,8,'SAL-001',NULL,'Kani Salad (Regular)',2,'258.00','0.00','516.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(46,33,133,'PROMO-001',NULL,'Happy Hour SML/SMB/SMA (Bottle)',2,'80.00','0.00','160.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(47,33,110,'LIQ-015',NULL,'Dalmore 12 yrs',2,'6900.00','0.00','13800.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(48,33,31,'START-009',NULL,'Shawarma Fries',1,'208.00','0.00','208.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(49,34,105,'LIQ-010',NULL,'JW Black Label',1,'3200.00','0.00','3200.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(50,35,177,'LD-013',NULL,'Sex on the Beach',1,'550.00','0.00','550.00','LD',1,0,16,NULL,1,1,'2026-06-22 19:07:52','Angelo Val Morante','2026-07-17 20:13:09'),
(51,35,134,'PROMO-002',NULL,'Happy Hour SML/SMB/SMA (Bucket)',1,'450.00','0.00','450.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(52,36,132,'NA-012',NULL,'Cigarettes',1,'250.00','0.00','250.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(53,36,139,'AYCE-W02',NULL,'Wings - Classic Buffalo',2,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(54,37,149,'AYCE-W12',NULL,'Wings - Wasabi',2,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(55,37,22,'SAL-015',NULL,'Chicken Burger - Flavored',1,'208.00','0.00','208.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(56,38,118,'BEER-005',NULL,'Smirnoff Mule',1,'200.00','0.00','200.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(57,38,28,'START-006',NULL,'Dumplings in Chili Oil',1,'178.00','0.00','178.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(58,39,49,'PASTA-010',NULL,'Spanish Sardines Pasta (Sharing)',1,'888.00','0.00','888.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(59,40,80,'PORK-009',NULL,'Lechon Macau',1,'368.00','0.00','368.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(60,41,8,'SAL-001',NULL,'Kani Salad (Regular)',1,'258.00','0.00','258.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(61,41,93,'GRP-003',NULL,'Filipino Sampler',2,'3099.00','0.00','6198.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(62,42,126,'NA-006',NULL,'Iced Coffee',2,'168.00','0.00','336.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(63,43,164,'AYCE-S07',NULL,'Side - Rice',2,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(64,43,55,'CHKN-004',NULL,'Chicken Katsu Curry',1,'388.00','0.00','388.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(65,44,150,'AYCE-W13',NULL,'Wings - Galbi',2,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(66,45,37,'START-015',NULL,'Chicharong Bulaklak',2,'248.00','0.00','496.00','Kitchen',1,0,NULL,NULL,1,1,'2026-06-28 08:11:26','Angelo Val Morante','2026-07-17 20:13:09'),
(67,46,171,'LD-007',NULL,'House Wine (White)',2,'450.00','0.00','900.00','LD',1,0,15,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(68,47,148,'AYCE-W11',NULL,'Wings - Salted Egg',1,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(69,48,66,'SEA-005',NULL,'Garlic Butter Shrimp',1,'368.00','0.00','368.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(70,48,47,'PASTA-008',NULL,'Shrimp in Aligue Pasta (Sharing)',2,'798.00','0.00','1596.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(71,48,169,'LD-005',NULL,'Iced Tea',2,'200.00','0.00','400.00','LD',1,0,18,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(72,49,14,'SAL-007',NULL,'Angus Beef Burger',1,'388.00','0.00','388.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(73,49,21,'SAL-014',NULL,'Chicken Burger - Original',1,'188.00','0.00','188.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(74,50,118,'BEER-005',NULL,'Smirnoff Mule',1,'200.00','0.00','200.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(75,50,42,'PASTA-003',NULL,'Gambas al Ajillo Pasta (Regular)',1,'368.00','0.00','368.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(76,51,112,'WINE-002',NULL,'Yellow Tail Moscato',2,'2000.00','0.00','4000.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(77,51,174,'LD-010',NULL,'Margarita',2,'500.00','0.00','1000.00','LD',1,0,19,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(78,52,10,'SAL-003',NULL,'Cucumber Salad',2,'158.00','0.00','316.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(79,53,71,'SEA-010',NULL,'Fried Calamares (Large)',2,'668.00','0.00','1336.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(80,54,179,'LD-015',NULL,'Tequila Shot',2,'300.00','0.00','600.00','LD',1,0,15,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(81,55,190,'BAR-003',NULL,'Heineken',2,'220.00','0.00','440.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(82,55,49,'PASTA-010',NULL,'Spanish Sardines Pasta (Sharing)',1,'888.00','0.00','888.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(83,55,102,'LIQ-007',NULL,'Bacardi Gold',1,'1700.00','0.00','1700.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(84,56,2,'SOUP-002',NULL,'Crab and Corn Soup (Regular)',2,'138.00','0.00','276.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(85,56,67,'SEA-006',NULL,'Shrimp in Aligue Butter',1,'388.00','0.00','388.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(86,57,177,'LD-013',NULL,'Sex on the Beach',1,'550.00','0.00','550.00','LD',1,0,18,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(87,57,122,'NA-002',NULL,'Soda (Can)',1,'90.00','0.00','90.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(88,57,73,'PORK-002',NULL,'Sizzling Pork Sisig',1,'268.00','0.00','268.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(89,58,88,'BEEF-005',NULL,'Beef BBQ Skewers',1,'498.00','0.00','498.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(90,58,120,'BEER-007',NULL,'RH/Mule Bucket',1,'720.00','0.00','720.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(91,59,30,'START-008',NULL,'Flavored Fries',2,'188.00','0.00','376.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(92,59,143,'AYCE-W06',NULL,'Wings - Honey Garlic',1,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(93,60,63,'SEA-002',NULL,'Fish and Chips',1,'328.00','0.00','328.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(94,60,194,'KIT-003',NULL,'Nachos Large',2,'250.00','0.00','500.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(95,61,15,'SAL-008',NULL,'Hangar Shawarma',2,'188.00','0.00','376.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(96,61,195,'KIT-004',NULL,'Pork Sisig',1,'320.00','0.00','320.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(97,61,85,'BEEF-002',NULL,'Steak and Fries',1,'1088.00','0.00','1088.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(98,62,102,'LIQ-007',NULL,'Bacardi Gold',2,'1700.00','0.00','3400.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(99,63,116,'BEER-003',NULL,'San Miguel Apple',1,'150.00','0.00','150.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(100,64,165,'LD-001',NULL,'San Mig Light',2,'350.00','0.00','700.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(101,64,70,'SEA-009',NULL,'Fried Calamares (Regular)',1,'348.00','0.00','348.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(102,64,40,'PASTA-001',NULL,'Porcini and Truffle Pasta (Regular)',2,'448.00','0.00','896.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(103,65,130,'NA-010',NULL,'Cucumber Lemonade (Pitcher)',2,'250.00','0.00','500.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(104,65,119,'BEER-006',NULL,'SML/SMB/SMA Bucket',2,'598.00','0.00','1196.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(105,65,171,'LD-007',NULL,'House Wine (White)',2,'450.00','0.00','900.00','LD',1,0,16,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(106,66,14,'SAL-007',NULL,'Angus Beef Burger',1,'388.00','0.00','388.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(107,66,64,'SEA-003',NULL,'Baked Garlic Tahong',1,'428.00','0.00','428.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(108,66,189,'BAR-002',NULL,'San Mig Pale Pilsen',1,'180.00','0.00','180.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(109,67,8,'SAL-001',NULL,'Kani Salad (Regular)',2,'258.00','0.00','516.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(110,67,30,'START-008',NULL,'Flavored Fries',1,'188.00','0.00','188.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(111,68,30,'START-008',NULL,'Flavored Fries',2,'188.00','0.00','376.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(112,68,171,'LD-007',NULL,'House Wine (White)',2,'450.00','0.00','900.00','LD',1,0,19,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(113,68,75,'PORK-004',NULL,'Crispy Pata Platter',2,'1088.00','0.00','2176.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(114,69,151,'AYCE-W14',NULL,'Wings - Gochu Jang',1,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(115,69,122,'NA-002',NULL,'Soda (Can)',2,'90.00','0.00','180.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(116,69,73,'PORK-002',NULL,'Sizzling Pork Sisig',1,'268.00','0.00','268.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(117,70,121,'NA-001',NULL,'Bottled Water',1,'75.00','0.00','75.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(118,71,2,'SOUP-002',NULL,'Crab and Corn Soup (Regular)',1,'138.00','0.00','138.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(119,71,44,'PASTA-005',NULL,'Creamy Carbonara (Regular)',2,'308.00','0.00','616.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(120,71,124,'NA-004',NULL,'Soda (Bottle)',1,'300.00','0.00','300.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(121,72,66,'SEA-005',NULL,'Garlic Butter Shrimp',2,'368.00','0.00','736.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(122,72,25,'START-003',NULL,'Crackers Platter',1,'138.00','0.00','138.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(123,73,12,'SAL-005',NULL,'RabbitAlley Salad (Sharing)',1,'388.00','0.00','388.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(124,74,69,'SEA-008',NULL,'Salted Egg Shrimp',2,'398.00','0.00','796.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(125,74,31,'START-009',NULL,'Shawarma Fries',2,'208.00','0.00','416.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(126,74,174,'LD-010',NULL,'Margarita',1,'500.00','0.00','500.00','LD',1,0,17,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(127,75,192,'KIT-001',NULL,'French Fries',1,'120.00','0.00','120.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(128,75,111,'WINE-001',NULL,'Yellow Tail Pink Moscato',1,'2000.00','0.00','2000.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(129,75,138,'AYCE-W01',NULL,'Wings - Original',2,'0.00','0.00','0.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(130,76,50,'PASTA-011',NULL,'Cannelloni Bolognese (Regular)',1,'458.00','0.00','458.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(131,77,14,'SAL-007',NULL,'Angus Beef Burger',1,'388.00','0.00','388.00','Kitchen',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(132,77,119,'BEER-006',NULL,'SML/SMB/SMA Bucket',1,'598.00','0.00','598.00','Bar',1,0,NULL,NULL,0,NULL,NULL,NULL,'2026-07-17 20:13:09'),
(133,78,48,'PASTA-009',NULL,'Spanish Sardines Pasta (Regular)',2,'458.00','0.00','916.00','Kitchen',1,0,NULL,NULL,1,1,'2026-07-16 06:21:19','Angelo Val Morante','2026-07-17 20:13:09'),
(134,78,195,'KIT-004',NULL,'Pork Sisig',2,'320.00','0.00','640.00','Kitchen',1,0,NULL,NULL,1,1,'2026-07-16 06:21:19','Angelo Val Morante','2026-07-17 20:13:09'),
(135,78,125,'NA-005',NULL,'Coffee',1,'128.00','0.00','128.00','Bar',1,0,NULL,NULL,1,1,'2026-07-16 06:21:19','Angelo Val Morante','2026-07-17 20:13:09'),
(136,79,27,'START-005',NULL,'Sizzling Cheese Corn',2,'218.00','0.00','436.00','Kitchen',1,0,NULL,NULL,1,1,'2026-07-16 19:43:36','Angelo Val Morante','2026-07-17 20:13:09'),
(137,79,136,'PROMO-004',NULL,'Happy Hour RH/Mule (Bucket)',2,'550.00','0.00','1100.00','Bar',1,0,NULL,NULL,1,1,'2026-07-16 19:43:36','Angelo Val Morante','2026-07-17 20:13:09'),
(138,80,92,'GRP-002',NULL,'Inuman Sampler',1,'4000.00','0.00','4000.00','Kitchen',1,0,NULL,NULL,1,1,'2026-07-17 09:45:50','Angelo Val Morante','2026-07-17 20:13:09'),
(139,80,42,'PASTA-003',NULL,'Gambas al Ajillo Pasta (Regular)',1,'368.00','0.00','368.00','Kitchen',1,0,NULL,NULL,1,1,'2026-07-17 09:45:50','Angelo Val Morante','2026-07-17 20:13:09'),
(140,80,107,'LIQ-012',NULL,'JW Double Black',1,'4200.00','0.00','4200.00','Bar',1,0,NULL,NULL,1,1,'2026-07-17 09:45:50','Angelo Val Morante','2026-07-17 20:13:09');

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
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `orders`
INSERT INTO `orders` VALUES
(1,1,NULL,'L1',1,12,'paid',NULL,'500.00','0.00','60.00','560.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 15:23:47','2026-07-16 15:24:45'),
(2,1,NULL,'C3',2,11,'paid',NULL,'800.00','50.00','90.00','840.00','WTS001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 15:23:47','2026-07-16 15:24:45'),
(3,1,NULL,'LD1',3,1,'pending',NULL,'1200.00','0.00','144.00','1344.00','WTR002','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 15:23:47','2026-07-16 15:24:59'),
(8,1,NULL,'C6',8,5,'paid','split_payment','1750.00','0.00','210.00','2135.00','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 06:58:50','2026-07-17 11:55:00'),
(14,1,NULL,'C1',14,10,'paid','cash','276.00','0.00','33.12','336.72','WTR001','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-16 07:01:50','2026-07-17 20:09:30'),
(15,1,NULL,'LD1',15,13,'pending','seed_verify_all','2800.00','0.00','0.00','2800.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 11:22:22','2026-07-17 20:12:22'),
(16,1,NULL,'LD2',16,14,'pending','seed_verify_all','2100.00','0.00','0.00','2100.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 11:30:22','2026-07-17 20:12:22'),
(17,1,NULL,'LD3',17,15,'pending','seed_verify_all','1400.00','0.00','0.00','1400.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 11:37:22','2026-07-17 20:12:22'),
(18,1,NULL,'C6',18,16,'paid','seed_verify_all','2026.00','0.00','0.00','2026.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 10:02:22','2026-07-17 20:12:22'),
(19,1,NULL,'C6',19,17,'pending','seed_verify_all','1750.00','0.00','0.00','1750.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 11:47:22','2026-07-17 20:12:22'),
(20,1,NULL,'L1',20,18,'paid','seed_verify_all','1050.00','0.00','0.00','1050.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 10:32:22','2026-07-17 20:12:22'),
(21,1,NULL,'LD4',21,19,'pending','seed_verify_all','138.00','0.00','0.00','138.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 11:52:22','2026-07-17 20:12:22'),
(22,1,NULL,'C3',22,20,'paid','seed_verify_all','558.00','0.00','0.00','558.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 10:42:22','2026-07-17 20:12:22'),
(23,1,NULL,'L4',23,21,'pending','seed_verify_all','0.00','0.00','0.00','0.00','WTR001','2026-07-16 16:00:00','2026-07-17 12:00:22',1,'Angelo Val Morante','2026-07-17 11:57:22','2026-07-17 20:12:22'),
(24,1,NULL,'C1',24,22,'paid','seed_verify_all','414.00','0.00','0.00','414.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 09:52:22','2026-07-17 20:12:22'),
(25,1,NULL,'C1',24,22,'pending','seed_verify_all','276.00','0.00','0.00','276.00','WTR001','2026-07-16 16:00:00',NULL,NULL,NULL,'2026-07-17 11:50:22','2026-07-17 20:12:22'),
(26,1,'SEED50X-20260618-0001','C2',24,24,'paid','debit','6636.00','0.00','0.00','6636.00','WTR001','2026-06-17 16:00:00',NULL,NULL,NULL,'2026-06-18 00:45:02','2026-07-17 20:13:09'),
(27,1,'SEED50X-20260618-0002','C4',25,25,'paid','gcash','7100.00','0.00','0.00','7100.00','WTR003','2026-06-17 16:00:00',NULL,NULL,NULL,'2026-06-18 11:22:33','2026-07-17 20:13:09'),
(28,1,'SEED50X-20260619-0003','L4',26,26,'paid','credit','105.00','0.00','0.00','105.00','WTR003','2026-06-18 16:00:00',NULL,NULL,NULL,'2026-06-19 01:54:36','2026-07-17 20:13:09'),
(29,1,'SEED50X-20260619-0004','L4',27,27,'paid','gcash','1608.00','0.00','0.00','1608.00','WTR002','2026-06-18 16:00:00',NULL,NULL,NULL,'2026-06-19 14:11:25','2026-07-17 20:13:09'),
(30,1,'SEED50X-20260620-0005','C1',28,28,'paid','credit','916.00','0.00','0.00','916.00','WTR003','2026-06-19 16:00:00',NULL,NULL,NULL,'2026-06-20 03:19:00','2026-07-17 20:13:09'),
(31,1,'SEED50X-20260621-0006','L6',29,29,'paid','credit','708.00','0.00','0.00','708.00','WTR003','2026-06-20 16:00:00',NULL,NULL,NULL,'2026-06-20 16:38:15','2026-07-17 20:13:09'),
(32,1,'SEED50X-20260621-0007','C8',30,30,'paid','debit','694.00','0.00','0.00','694.00','WTR001','2026-06-20 16:00:00',NULL,NULL,NULL,'2026-06-21 04:00:41','2026-07-17 20:13:09'),
(33,1,'SEED50X-20260622-0008','LD4',31,31,'paid','gcash','14168.00','0.00','0.00','14168.00','WTR003','2026-06-21 16:00:00',NULL,NULL,NULL,'2026-06-21 18:40:09','2026-07-17 20:13:09'),
(34,1,'SEED50X-20260622-0009','C2',32,32,'paid','gcash','3200.00','0.00','0.00','3200.00','WTR004','2026-06-21 16:00:00',NULL,NULL,NULL,'2026-06-22 06:25:31','2026-07-17 20:13:09'),
(35,1,'SEED50X-20260623-0010','LD2',33,33,'paid','credit','450.00','0.00','0.00','450.00','WTR003','2026-06-22 16:00:00',NULL,NULL,NULL,'2026-06-22 19:07:52','2026-07-17 20:13:09'),
(36,1,'SEED50X-20260623-0011','L3',34,34,'paid','gcash','250.00','0.00','0.00','250.00','WTR002','2026-06-22 16:00:00',NULL,NULL,NULL,'2026-06-23 11:30:48','2026-07-17 20:13:09'),
(37,1,'SEED50X-20260624-0012','C6',35,35,'paid','gcash','208.00','0.00','0.00','208.00','WTR003','2026-06-23 16:00:00',NULL,NULL,NULL,'2026-06-23 21:55:13','2026-07-17 20:13:09'),
(38,1,'SEED50X-20260624-0013','LD3',36,36,'paid','credit','378.00','0.00','0.00','378.00','WTR003','2026-06-23 16:00:00',NULL,NULL,NULL,'2026-06-24 14:01:02','2026-07-17 20:13:09'),
(39,1,'SEED50X-20260625-0014','C3',37,37,'paid','debit','888.00','0.00','0.00','888.00','WTR001','2026-06-24 16:00:00',NULL,NULL,NULL,'2026-06-25 00:43:30','2026-07-17 20:13:09'),
(40,1,'SEED50X-20260625-0015','LD2',38,38,'paid','credit','368.00','0.00','0.00','368.00','WTR002','2026-06-24 16:00:00',NULL,NULL,NULL,'2026-06-25 14:22:50','2026-07-17 20:13:09'),
(41,1,'SEED50X-20260626-0016','L5',39,39,'paid','credit','6456.00','0.00','0.00','6456.00','WTR001','2026-06-25 16:00:00',NULL,NULL,NULL,'2026-06-26 03:11:20','2026-07-17 20:13:09'),
(42,1,'SEED50X-20260627-0017','LD3',40,40,'paid','credit','336.00','0.00','0.00','336.00','WTR004','2026-06-26 16:00:00',NULL,NULL,NULL,'2026-06-26 16:04:19','2026-07-17 20:13:09'),
(43,1,'SEED50X-20260627-0018','LD1',41,41,'paid','credit','388.00','0.00','0.00','388.00','WTR001','2026-06-26 16:00:00',NULL,NULL,NULL,'2026-06-27 04:55:40','2026-07-17 20:13:09'),
(44,1,'SEED50X-20260628-0019','C4',42,42,'paid','credit','0.00','0.00','0.00','0.00','WTR002','2026-06-27 16:00:00',NULL,NULL,NULL,'2026-06-27 17:23:46','2026-06-27 17:23:46'),
(45,1,'SEED50X-20260628-0020','L4',43,43,'paid','credit','0.00','0.00','0.00','0.00','WTR004','2026-06-27 16:00:00',NULL,NULL,NULL,'2026-06-28 08:11:26','2026-06-28 08:11:26'),
(46,1,'SEED50X-20260629-0021','LD1',44,44,'paid','credit','900.00','0.00','0.00','900.00','WTR001','2026-06-28 16:00:00',NULL,NULL,NULL,'2026-06-28 20:33:17','2026-07-17 20:13:09'),
(47,1,'SEED50X-20260629-0022','C4',45,45,'paid','gcash','0.00','0.00','0.00','0.00','WTR003','2026-06-28 16:00:00',NULL,NULL,NULL,'2026-06-29 08:19:36','2026-06-29 08:19:36'),
(48,1,'SEED50X-20260630-0023','LD2',46,46,'paid','gcash','2364.00','0.00','0.00','2364.00','WTR003','2026-06-29 16:00:00',NULL,NULL,NULL,'2026-06-30 01:01:41','2026-07-17 20:13:09'),
(49,1,'SEED50X-20260630-0024','C5',47,47,'paid','cash','576.00','0.00','0.00','576.00','WTR003','2026-06-29 16:00:00',NULL,NULL,NULL,'2026-06-30 10:41:58','2026-07-17 20:13:09'),
(50,1,'SEED50X-20260701-0025','L3',48,48,'paid','credit','568.00','0.00','0.00','568.00','WTR001','2026-06-30 16:00:00',NULL,NULL,NULL,'2026-07-01 00:08:33','2026-07-17 20:13:09'),
(51,1,'SEED50X-20260701-0026','C7',49,49,'paid','debit','5000.00','0.00','0.00','5000.00','WTR004','2026-06-30 16:00:00',NULL,NULL,NULL,'2026-07-01 12:44:41','2026-07-17 20:13:09'),
(52,1,'SEED50X-20260702-0027','C8',50,50,'paid','gcash','316.00','0.00','0.00','316.00','WTR003','2026-07-01 16:00:00',NULL,NULL,NULL,'2026-07-02 04:48:19','2026-07-17 20:13:09'),
(53,1,'SEED50X-20260702-0028','L2',51,51,'paid','gcash','1336.00','0.00','0.00','1336.00','WTR002','2026-07-01 16:00:00',NULL,NULL,NULL,'2026-07-02 15:42:46','2026-07-17 20:13:09'),
(54,1,'SEED50X-20260703-0029','LD1',52,52,'paid','debit','600.00','0.00','0.00','600.00','WTR002','2026-07-02 16:00:00',NULL,NULL,NULL,'2026-07-03 06:13:49','2026-07-17 20:13:09'),
(55,1,'SEED50X-20260704-0030','LD2',53,53,'paid','gcash','3028.00','0.00','0.00','3028.00','WTR001','2026-07-03 16:00:00',NULL,NULL,NULL,'2026-07-03 17:13:55','2026-07-17 20:13:09'),
(56,1,'SEED50X-20260704-0031','LD4',54,54,'paid','gcash','664.00','0.00','0.00','664.00','WTR001','2026-07-03 16:00:00',NULL,NULL,NULL,'2026-07-04 06:57:50','2026-07-17 20:13:09'),
(57,1,'SEED50X-20260705-0032','C8',55,55,'paid','credit','908.00','0.00','0.00','908.00','WTR001','2026-07-04 16:00:00',NULL,NULL,NULL,'2026-07-04 22:33:26','2026-07-17 20:13:09'),
(58,1,'SEED50X-20260705-0033','C4',56,56,'paid','gcash','1218.00','0.00','0.00','1218.00','WTR002','2026-07-04 16:00:00',NULL,NULL,NULL,'2026-07-05 09:22:26','2026-07-17 20:13:09'),
(59,1,'SEED50X-20260706-0034','LD3',57,57,'paid','cash','376.00','0.00','0.00','376.00','WTR003','2026-07-05 16:00:00',NULL,NULL,NULL,'2026-07-05 23:19:20','2026-07-17 20:13:09'),
(60,1,'SEED50X-20260706-0035','C4',58,58,'paid','credit','828.00','0.00','0.00','828.00','WTR002','2026-07-05 16:00:00',NULL,NULL,NULL,'2026-07-06 13:38:04','2026-07-17 20:13:09'),
(61,1,'SEED50X-20260707-0036','C4',59,59,'paid','cash','1784.00','0.00','0.00','1784.00','WTR003','2026-07-06 16:00:00',NULL,NULL,NULL,'2026-07-06 23:54:39','2026-07-17 20:13:09'),
(62,1,'SEED50X-20260708-0037','L2',60,60,'paid','gcash','3400.00','0.00','0.00','3400.00','WTR001','2026-07-07 16:00:00',NULL,NULL,NULL,'2026-07-07 16:07:14','2026-07-17 20:13:09'),
(63,1,'SEED50X-20260708-0038','C6',61,61,'paid','debit','150.00','0.00','0.00','150.00','WTR003','2026-07-07 16:00:00',NULL,NULL,NULL,'2026-07-08 01:53:49','2026-07-17 20:13:09'),
(64,1,'SEED50X-20260709-0039','L3',62,62,'paid','debit','1944.00','0.00','0.00','1944.00','WTR002','2026-07-08 16:00:00',NULL,NULL,NULL,'2026-07-08 17:35:15','2026-07-17 20:13:09'),
(65,1,'SEED50X-20260709-0040','LD1',63,63,'paid','cash','2596.00','0.00','0.00','2596.00','WTR001','2026-07-08 16:00:00',NULL,NULL,NULL,'2026-07-09 06:28:50','2026-07-17 20:13:09'),
(66,1,'SEED50X-20260710-0041','C1',64,64,'paid','cash','996.00','0.00','0.00','996.00','WTR002','2026-07-09 16:00:00',NULL,NULL,NULL,'2026-07-09 17:38:21','2026-07-17 20:13:09'),
(67,1,'SEED50X-20260710-0042','C6',65,65,'paid','credit','704.00','0.00','0.00','704.00','WTR001','2026-07-09 16:00:00',NULL,NULL,NULL,'2026-07-10 07:28:03','2026-07-17 20:13:09'),
(68,1,'SEED50X-20260711-0043','LD1',66,66,'paid','debit','3452.00','0.00','0.00','3452.00','WTR001','2026-07-10 16:00:00',NULL,NULL,NULL,'2026-07-10 20:54:10','2026-07-17 20:13:09'),
(69,1,'SEED50X-20260711-0044','C7',67,67,'paid','cash','448.00','0.00','0.00','448.00','WTR001','2026-07-10 16:00:00',NULL,NULL,NULL,'2026-07-11 11:57:37','2026-07-17 20:13:09'),
(70,1,'SEED50X-20260712-0045','C8',68,68,'pending',NULL,'75.00','0.00','0.00','75.00','WTR002','2026-07-11 16:00:00',NULL,NULL,NULL,'2026-07-11 23:13:36','2026-07-17 20:13:09'),
(71,1,'SEED50X-20260712-0046','C3',69,69,'pending',NULL,'1054.00','0.00','0.00','1054.00','WTR001','2026-07-11 16:00:00',NULL,NULL,NULL,'2026-07-12 11:34:28','2026-07-17 20:13:09'),
(72,1,'SEED50X-20260713-0047','L3',70,70,'pending',NULL,'874.00','0.00','0.00','874.00','WTR002','2026-07-12 16:00:00',NULL,NULL,NULL,'2026-07-13 03:10:12','2026-07-17 20:13:09'),
(73,1,'SEED50X-20260713-0048','C5',71,71,'pending',NULL,'388.00','0.00','0.00','388.00','WTR001','2026-07-12 16:00:00',NULL,NULL,NULL,'2026-07-13 13:38:29','2026-07-17 20:13:09'),
(74,1,'SEED50X-20260714-0049','L5',72,72,'pending',NULL,'1712.00','0.00','0.00','1712.00','WTR002','2026-07-13 16:00:00',NULL,NULL,NULL,'2026-07-14 03:06:25','2026-07-17 20:13:09'),
(75,1,'SEED50X-20260714-0050','C2',73,73,'pending',NULL,'2120.00','0.00','0.00','2120.00','WTR003','2026-07-13 16:00:00',NULL,NULL,NULL,'2026-07-14 15:33:09','2026-07-17 20:13:09'),
(76,1,'SEED50X-20260715-0051','L6',74,74,'pending',NULL,'458.00','0.00','0.00','458.00','WTR002','2026-07-14 16:00:00',NULL,NULL,NULL,'2026-07-15 05:31:08','2026-07-17 20:13:09'),
(77,1,'SEED50X-20260716-0052','LD3',75,75,'pending',NULL,'986.00','0.00','0.00','986.00','WTR003','2026-07-15 16:00:00',NULL,NULL,NULL,'2026-07-15 20:15:51','2026-07-17 20:13:09'),
(78,1,'SEED50X-20260716-0053','L1',76,76,'paid',NULL,'0.00','0.00','0.00','0.00','WTR004','2026-07-15 16:00:00','2026-07-16 06:21:19',1,'Angelo Val Morante','2026-07-16 06:21:19','2026-07-17 20:13:09'),
(79,1,'SEED50X-20260717-0054','LD2',77,77,'paid',NULL,'0.00','0.00','0.00','0.00','WTR004','2026-07-16 16:00:00','2026-07-16 19:43:36',1,'Angelo Val Morante','2026-07-16 19:43:36','2026-07-17 20:13:09'),
(80,1,'SEED50X-20260717-0055','LD1',78,78,'paid',NULL,'0.00','0.00','0.00','0.00','WTR001','2026-07-16 16:00:00','2026-07-17 09:45:50',1,'Angelo Val Morante','2026-07-17 09:45:50','2026-07-17 20:13:09');

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `payment_voids`
INSERT INTO `payment_voids` VALUES
(2,22,'cash','276.00','Duplicate charge','completed',1,NULL,2,'2026-07-17 20:12:22','2026-07-17 10:48:22');

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `payouts`
INSERT INTO `payouts` VALUES
(1,16,'2026-07-15 16:00:00','2026-07-15 16:00:00','1500.00','0.00','1800.00','3100.00','0.00','0.00','[{"title":"Bianca — table target bonus","amount":100},{"title":"Bianca — VIP guest bonus","amount":150},{"title":"Bianca — weekend shift bonus","amount":200},{"title":"Bianca — referral bonus","amount":75},{"title":"Bianca — attendance bonus","amount":50},{"title":"Bianca — sales milestone","amount":125},{"title":"Bianca — manager discretion","amount":100}]','[]','[]','7200.00','draft',NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(2,17,'2026-07-15 16:00:00','2026-07-15 16:00:00','1500.00','0.00','1000.00','3100.00','200.00','150.00','[{"title":"Cla — table target bonus","amount":100},{"title":"Cla — VIP guest bonus","amount":150},{"title":"Cla — weekend shift bonus","amount":200},{"title":"Cla — referral bonus","amount":75},{"title":"Cla — attendance bonus","amount":50},{"title":"Cla — sales milestone","amount":125},{"title":"Cla — manager discretion","amount":100}]','[{"title":"Transport allowance","amount":200}]','[{"title":"Cash advance","amount":150}]','6450.00','approved',NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(3,15,'2026-07-15 16:00:00','2026-07-15 16:00:00','1500.00','0.00','300.00','3100.00','0.00','0.00','[{"title":"Angel — table target bonus","amount":100},{"title":"Angel — VIP guest bonus","amount":150},{"title":"Angel — weekend shift bonus","amount":200},{"title":"Angel — referral bonus","amount":75},{"title":"Angel — attendance bonus","amount":50},{"title":"Angel — sales milestone","amount":125},{"title":"Angel — manager discretion","amount":100}]','[]','[]','5700.00','draft',NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(4,16,'2026-07-16 16:00:00','2026-07-16 16:00:00','1500.00','0.00','1800.00','3100.00','0.00','0.00','[{"title":"Bianca — table target bonus","amount":100},{"title":"Bianca — VIP guest bonus","amount":150},{"title":"Bianca — weekend shift bonus","amount":200},{"title":"Bianca — referral bonus","amount":75},{"title":"Bianca — attendance bonus","amount":50},{"title":"Bianca — sales milestone","amount":125},{"title":"Bianca — manager discretion","amount":100}]','[]','[]','7200.00','draft',NULL,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(5,17,'2026-07-16 16:00:00','2026-07-16 16:00:00','1500.00','0.00','1000.00','3100.00','200.00','150.00','[{"title":"Cla — table target bonus","amount":100},{"title":"Cla — VIP guest bonus","amount":150},{"title":"Cla — weekend shift bonus","amount":200},{"title":"Cla — referral bonus","amount":75},{"title":"Cla — attendance bonus","amount":50},{"title":"Cla — sales milestone","amount":125},{"title":"Cla — manager discretion","amount":100}]','[{"title":"Transport allowance","amount":200}]','[{"title":"Cash advance","amount":150}]','6450.00','approved',NULL,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(6,15,'2026-07-16 16:00:00','2026-07-16 16:00:00','1500.00','0.00','300.00','3100.00','0.00','0.00','[{"title":"Angel — table target bonus","amount":100},{"title":"Angel — VIP guest bonus","amount":150},{"title":"Angel — weekend shift bonus","amount":200},{"title":"Angel — referral bonus","amount":75},{"title":"Angel — attendance bonus","amount":50},{"title":"Angel — sales milestone","amount":125},{"title":"Angel — manager discretion","amount":100}]','[]','[]','5700.00','draft',NULL,'2026-07-17 20:12:22','2026-07-17 20:12:22');

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
(1,'C1','C1','Club','occupied','25','2026-07-17 20:12:22'),
(1,'C2','C2','Club','occupied','75','2026-07-17 20:13:09'),
(1,'C3','C3','Club','occupied','71','2026-07-17 20:13:09'),
(1,'C4','C4','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'C5','C5','Club','occupied','73','2026-07-17 20:13:09'),
(1,'C6','C6','Club','occupied','19','2026-07-17 20:12:22'),
(1,'C7','C7','Club','available',NULL,'2026-07-16 15:23:47'),
(1,'C8','C8','Club','occupied','70','2026-07-17 20:13:09'),
(1,'L1','L1','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L2','L2','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L3','L3','Lounge','occupied','72','2026-07-17 20:13:09'),
(1,'L4','L4','Lounge','available',NULL,'2026-07-16 15:23:47'),
(1,'L5','L5','Lounge','occupied','74','2026-07-17 20:13:09'),
(1,'L6','L6','Lounge','occupied','76','2026-07-17 20:13:09'),
(1,'LD1','LD1','LD','occupied','3','2026-07-17 20:12:22'),
(1,'LD2','LD2','LD','occupied','16','2026-07-17 20:12:22'),
(1,'LD3','LD3','LD','occupied','17','2026-07-17 20:12:22'),
(1,'LD4','LD4','LD','occupied','21','2026-07-17 20:12:22');

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
) ENGINE=InnoDB AUTO_INCREMENT=188 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
(179,179,'Regular',NULL,'300.00',NULL,NULL,1,1,'2026-07-16 15:24:45','2026-07-16 15:24:45'),
(180,188,'Regular',NULL,'180.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04'),
(181,189,'Regular',NULL,'180.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04'),
(182,190,'Regular',NULL,'220.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04'),
(183,191,'Regular',NULL,'250.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04'),
(184,192,'Regular',NULL,'120.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04'),
(185,193,'Regular',NULL,'280.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04'),
(186,194,'Regular',NULL,'250.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04'),
(187,195,'Regular',NULL,'320.00',NULL,NULL,1,1,'2026-07-18 11:19:04','2026-07-18 11:19:04');

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
(23,'-2.000','2026-07-17 20:09:30'),
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
(179,'0.000','2026-07-16 15:24:45'),
(188,'0.000','2026-07-18 11:19:04'),
(189,'0.000','2026-07-18 11:19:04'),
(190,'0.000','2026-07-18 11:19:04'),
(191,'0.000','2026-07-18 11:19:04'),
(192,'0.000','2026-07-18 11:19:04'),
(193,'0.000','2026-07-18 11:19:04'),
(194,'0.000','2026-07-18 11:19:04'),
(195,'0.000','2026-07-18 11:19:04');

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
) ENGINE=InnoDB AUTO_INCREMENT=196 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
(179,'LD-015','Tequila Shot','Ladies Drink - Shot','Ladies Drink',NULL,'LD','300.00','120.00','50.00','active','2026-07-16 15:23:47','2026-07-16 15:23:47'),
(188,'BAR-001','San Mig Light','Beer bottle','Beer',NULL,'Bar','180.00','80.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09'),
(189,'BAR-002','San Mig Pale Pilsen','Beer bottle','Beer',NULL,'Bar','180.00','80.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09'),
(190,'BAR-003','Heineken','Premium Beer','Beer',NULL,'Bar','220.00','110.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09'),
(191,'BAR-004','Tequila Gold Shot','Shot of Tequila Gold','Spirits',NULL,'Bar','250.00','100.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09'),
(192,'KIT-001','French Fries','Crispy potato fries','Sides',NULL,'Kitchen','120.00','40.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09'),
(193,'KIT-002','Chicken Wings','6pcs Buffalo Chicken Wings','Appetizer',NULL,'Kitchen','280.00','110.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09'),
(194,'KIT-003','Nachos Large','Nachos with cheese and beef','Appetizer',NULL,'Kitchen','250.00','95.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09'),
(195,'KIT-004','Pork Sisig','Rabbit Alley Signature Pork Sisig','Mains',NULL,'Kitchen','320.00','130.00','0.00','active','2026-07-17 20:13:09','2026-07-17 20:13:09');

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `receipt_snapshots`
INSERT INTO `receipt_snapshots` VALUES
(1,1,'official_receipt',8,'C6',8,5,'split_payment','{"orderNumber":"8","date":"Jul 17, 2026","time":"07:55 PM","table":"C6","cashier":"Angelo Val Morante","businessName":"Rabbit Alley","businessAddress":"123 Main Street, Manila, Philippines","businessContact":"+63 912 345 6789","receiptFooter":"Thank you for visiting Rabbit Alley!","vatTin":"123-456-789-000","serviceLabel":"Service (10%)","taxLabel":"VAT (12%)","items":[{"name":"San Mig Light [Clarisse Dela Cruz]","quantity":5,"subtotal":1750,"isComplimentary":false}],"subtotal":1750,"serviceCharge":175,"tax":210,"total":2135,"amountDue":2135,"paymentMethod":"split_payment","amountPaid":2135,"change":0}',1,'2026-07-17 11:55:00'),
(2,1,'official_receipt',14,'C1',14,10,'cash','{"orderNumber":"14","date":"Jul 18, 2026","time":"04:09 AM","table":"C1","cashier":"Angelo Val Morante","businessName":"Rabbit Alley","businessAddress":"123 Main Street, Manila, Philippines","businessContact":"+63 912 345 6789","receiptFooter":"Thank you for visiting Rabbit Alley!","vatTin":"123-456-789-000","serviceLabel":"Service (10%)","taxLabel":"VAT (12%)","items":[{"name":"Mixed Nuts","quantity":2,"subtotal":276,"isComplimentary":false}],"subtotal":276,"serviceCharge":27.6,"tax":33.12,"total":336.72,"amountDue":336.72,"paymentMethod":"cash","amountPaid":500,"change":163.28}',1,'2026-07-17 20:09:30');

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `shifts`
INSERT INTO `shifts` VALUES
(1,5,1,'2026-07-15 16:00:00','2026-07-15 23:23:50',NULL,'open','5000.00','0.00','0.00','0.00','0.00','0.00','276.00','0.00',NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-16 15:23:50','2026-07-16 15:23:50'),
(2,5,1,'2026-07-16 16:00:00','2026-07-17 04:12:22',NULL,'open','5000.00','0.00','0.00','0.00','0.00','0.00','276.00','0.00',NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-17 20:12:22','2026-07-17 20:12:22');

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
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `table_sessions`
INSERT INTO `table_sessions` VALUES
(13,1,'LD1','WTR001','2026-07-17 11:22:22',NULL,'open',NULL,0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(14,1,'LD2','WTR001','2026-07-17 11:30:22',NULL,'open',NULL,0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(15,1,'LD3','WTR001','2026-07-17 11:37:22',NULL,'open',NULL,0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(16,1,'C6','WTR001','2026-07-17 10:02:22','2026-07-17 10:04:22','closed','payment',0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(17,1,'C6','WTR001','2026-07-17 11:47:22',NULL,'open',NULL,0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(18,1,'L1','WTR001','2026-07-17 10:32:22','2026-07-17 10:34:22','closed','payment',0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(19,1,'LD4','WTR001','2026-07-17 11:52:22',NULL,'open',NULL,0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(20,1,'C3','WTR001','2026-07-17 10:42:22','2026-07-17 10:44:22','closed','payment',0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(21,1,'L4','WTR001','2026-07-17 11:57:22','2026-07-17 12:00:22','closed','void',0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(22,1,'C1','WTR001','2026-07-17 09:52:22',NULL,'open',NULL,0,'2026-07-17 20:12:22','2026-07-17 20:12:22'),
(24,1,'C2','WTR001','2026-06-17 23:38:14','2026-06-18 00:45:02','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(25,1,'C4','WTR003','2026-06-18 10:17:52','2026-06-18 11:22:33','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(26,1,'L4','WTR003','2026-06-18 23:58:03','2026-06-19 01:54:36','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(27,1,'L4','WTR002','2026-06-19 12:56:49','2026-06-19 14:11:25','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(28,1,'C1','WTR003','2026-06-20 01:57:29','2026-06-20 03:19:00','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(29,1,'L6','WTR003','2026-06-20 14:57:58','2026-06-20 16:38:15','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(30,1,'C8','WTR001','2026-06-21 02:19:31','2026-06-21 04:00:41','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(31,1,'LD4','WTR003','2026-06-21 16:42:33','2026-06-21 18:40:09','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(32,1,'C2','WTR004','2026-06-22 05:02:28','2026-06-22 06:25:31','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(33,1,'LD2','WTR003','2026-06-22 17:29:47','2026-06-22 19:07:52','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(34,1,'L3','WTR002','2026-06-23 10:28:05','2026-06-23 11:30:48','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(35,1,'C6','WTR003','2026-06-23 19:57:31','2026-06-23 21:55:13','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(36,1,'LD3','WTR003','2026-06-24 12:18:48','2026-06-24 14:01:02','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(37,1,'C3','WTR001','2026-06-24 23:41:36','2026-06-25 00:43:30','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(38,1,'LD2','WTR002','2026-06-25 12:25:53','2026-06-25 14:22:50','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(39,1,'L5','WTR001','2026-06-26 01:40:51','2026-06-26 03:11:20','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(40,1,'LD3','WTR004','2026-06-26 14:34:42','2026-06-26 16:04:19','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(41,1,'LD1','WTR001','2026-06-27 03:52:04','2026-06-27 04:55:40','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(42,1,'C4','WTR002','2026-06-27 16:15:02','2026-06-27 17:23:46','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(43,1,'L4','WTR004','2026-06-28 06:38:24','2026-06-28 08:11:26','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(44,1,'LD1','WTR001','2026-06-28 19:03:07','2026-06-28 20:33:17','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(45,1,'C4','WTR003','2026-06-29 07:06:21','2026-06-29 08:19:36','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(46,1,'LD2','WTR003','2026-06-29 23:40:57','2026-06-30 01:01:41','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(47,1,'C5','WTR003','2026-06-30 09:12:44','2026-06-30 10:41:58','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(48,1,'L3','WTR001','2026-06-30 22:12:43','2026-07-01 00:08:33','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(49,1,'C7','WTR004','2026-07-01 11:17:20','2026-07-01 12:44:41','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(50,1,'C8','WTR003','2026-07-02 03:09:45','2026-07-02 04:48:19','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(51,1,'L2','WTR002','2026-07-02 14:27:55','2026-07-02 15:42:46','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(52,1,'LD1','WTR002','2026-07-03 04:28:12','2026-07-03 06:13:49','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(53,1,'LD2','WTR001','2026-07-03 15:45:41','2026-07-03 17:13:55','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(54,1,'LD4','WTR001','2026-07-04 05:05:11','2026-07-04 06:57:50','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(55,1,'C8','WTR001','2026-07-04 20:47:42','2026-07-04 22:33:26','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(56,1,'C4','WTR002','2026-07-05 08:00:57','2026-07-05 09:22:26','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(57,1,'LD3','WTR003','2026-07-05 22:08:04','2026-07-05 23:19:20','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(58,1,'C4','WTR002','2026-07-06 11:55:29','2026-07-06 13:38:04','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(59,1,'C4','WTR003','2026-07-06 21:58:42','2026-07-06 23:54:39','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(60,1,'L2','WTR001','2026-07-07 15:06:10','2026-07-07 16:07:14','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(61,1,'C6','WTR003','2026-07-08 00:31:02','2026-07-08 01:53:49','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(62,1,'L3','WTR002','2026-07-08 15:48:56','2026-07-08 17:35:15','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(63,1,'LD1','WTR001','2026-07-09 05:25:25','2026-07-09 06:28:50','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(64,1,'C1','WTR002','2026-07-09 16:06:03','2026-07-09 17:38:21','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(65,1,'C6','WTR001','2026-07-10 06:07:40','2026-07-10 07:28:03','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(66,1,'LD1','WTR001','2026-07-10 19:28:54','2026-07-10 20:54:10','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(67,1,'C7','WTR001','2026-07-11 10:56:15','2026-07-11 11:57:37','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(68,1,'C8','WTR002','2026-07-11 23:13:36',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(69,1,'C3','WTR001','2026-07-12 11:34:28',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(70,1,'L3','WTR002','2026-07-13 03:10:12',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(71,1,'C5','WTR001','2026-07-13 13:38:29',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(72,1,'L5','WTR002','2026-07-14 03:06:25',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(73,1,'C2','WTR003','2026-07-14 15:33:09',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(74,1,'L6','WTR002','2026-07-15 05:31:08',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(75,1,'LD3','WTR003','2026-07-15 20:15:51',NULL,'open',NULL,0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(76,1,'L1','WTR004','2026-07-16 04:22:37','2026-07-16 06:21:19','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(77,1,'LD2','WTR004','2026-07-16 18:06:15','2026-07-16 19:43:36','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09'),
(78,1,'LD1','WTR001','2026-07-17 07:47:29','2026-07-17 09:45:50','closed','cashier',0,'2026-07-17 20:13:09','2026-07-17 20:13:09');

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
(4,3,'LD2','LD1','move',1,'API Integration Test Merge','2026-07-16 15:24:59');

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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `void_log`
INSERT INTO `void_log` VALUES
(5,1,'item',21,23,165,'LD-001','San Mig Light',5,'350.00','1750.00','LD4',NULL,1,'Angelo Val Morante','MGR001','2026-07-17 11:54:22','Wrong drink ordered','2026-07-17 20:12:22'),
(6,1,'item',22,25,23,'START-001','Mixed Nuts',2,'138.00','276.00','C3',NULL,1,'Angelo Val Morante','MGR001','2026-07-17 10:47:22','Guest changed mind','2026-07-17 20:12:22'),
(7,1,'order',23,27,1,'SOUP-001','Sinigang na Kambing',2,'558.00','1116.00','L4',NULL,1,'Angelo Val Morante','MGR001','2026-07-17 12:00:22','Table walked out','2026-07-17 20:12:22'),
(8,1,'order',23,28,23,'START-001','Mixed Nuts',1,'138.00','138.00','L4',NULL,1,'Angelo Val Morante','MGR001','2026-07-17 12:00:22','Table walked out','2026-07-17 20:12:22'),
(9,1,'item',35,50,177,'LD-013','Sex on the Beach',1,'550.00','550.00','LD2',33,1,'Angelo Val Morante','MGR001','2026-06-22 19:07:52','Guest changed mind','2026-07-17 20:13:09'),
(10,1,'item',45,66,37,'START-015','Chicharong Bulaklak',2,'248.00','496.00','L4',43,1,'Angelo Val Morante','MGR001','2026-06-28 08:11:26','Guest changed mind','2026-07-17 20:13:09'),
(11,1,'order',78,133,48,'PASTA-009','Spanish Sardines Pasta (Regular)',2,'458.00','916.00','L1',76,1,'Angelo Val Morante','MGR001','2026-07-16 06:21:19','Table walked out','2026-07-17 20:13:09'),
(12,1,'order',78,134,195,'KIT-004','Pork Sisig',2,'320.00','640.00','L1',76,1,'Angelo Val Morante','MGR001','2026-07-16 06:21:19','Table walked out','2026-07-17 20:13:09'),
(13,1,'order',78,135,125,'NA-005','Coffee',1,'128.00','128.00','L1',76,1,'Angelo Val Morante','MGR001','2026-07-16 06:21:19','Table walked out','2026-07-17 20:13:09'),
(14,1,'order',79,136,27,'START-005','Sizzling Cheese Corn',2,'218.00','436.00','LD2',77,1,'Angelo Val Morante','MGR001','2026-07-16 19:43:36','Table walked out','2026-07-17 20:13:09'),
(15,1,'order',79,137,136,'PROMO-004','Happy Hour RH/Mule (Bucket)',2,'550.00','1100.00','LD2',77,1,'Angelo Val Morante','MGR001','2026-07-16 19:43:36','Table walked out','2026-07-17 20:13:09'),
(16,1,'order',80,138,92,'GRP-002','Inuman Sampler',1,'4000.00','4000.00','LD1',78,1,'Angelo Val Morante','MGR001','2026-07-17 09:45:50','Table walked out','2026-07-17 20:13:09'),
(17,1,'order',80,139,42,'PASTA-003','Gambas al Ajillo Pasta (Regular)',1,'368.00','368.00','LD1',78,1,'Angelo Val Morante','MGR001','2026-07-17 09:45:50','Table walked out','2026-07-17 20:13:09'),
(18,1,'order',80,140,107,'LIQ-012','JW Double Black',1,'4200.00','4200.00','LD1',78,1,'Angelo Val Morante','MGR001','2026-07-17 09:45:50','Table walked out','2026-07-17 20:13:09');

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