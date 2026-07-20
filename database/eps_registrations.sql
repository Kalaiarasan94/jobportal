-- ==========================================================
-- Malligai EPS Registration
-- Database schema
--
-- Flow: a registration is stored as PENDING with no registration
-- number. When an admin approves it, a running number
-- (EPS-<year>-001, -002, …) is allocated and the status becomes
-- APPROVED (i.e. paid & confirmed).
-- ==========================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET NAMES utf8mb4 */;

--
-- Table structure for table `eps_registrations`
--

CREATE TABLE IF NOT EXISTS `eps_registrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reg_no` varchar(32) DEFAULT NULL,
  `reg_seq` int(11) DEFAULT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone` varchar(32) NOT NULL,
  `email` varchar(255) NOT NULL,
  `dob` date NOT NULL,
  `address` text NOT NULL,
  `photo_file` varchar(255) NOT NULL,
  `photo_mime` varchar(100) NOT NULL,
  `payment_file` varchar(255) NOT NULL,
  `payment_mime` varchar(100) NOT NULL,
  `payment_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `approved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reg_no` (`reg_no`),
  KEY `idx_status` (`payment_status`),
  KEY `idx_submitted_at` (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;
