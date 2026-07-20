-- ==========================================================
-- Malligai EPS — safe migration
--
-- Run this on an EXISTING database (e.g. in phpMyAdmin → SQL tab) to bring an
-- older `eps_registrations` table up to the current schema. It is idempotent:
-- running it again when the columns already exist does nothing harmful.
--
-- Requires MariaDB 10.4+ / MySQL 8+ (ADD COLUMN IF NOT EXISTS).
-- ==========================================================

ALTER TABLE `eps_registrations`
  ADD COLUMN IF NOT EXISTS `reg_seq` int(11) DEFAULT NULL AFTER `reg_no`,
  ADD COLUMN IF NOT EXISTS `photo_file` varchar(255) NOT NULL DEFAULT '' AFTER `address`,
  ADD COLUMN IF NOT EXISTS `photo_mime` varchar(100) NOT NULL DEFAULT '' AFTER `photo_file`,
  ADD COLUMN IF NOT EXISTS `payment_file` varchar(255) NOT NULL DEFAULT '' AFTER `photo_mime`,
  ADD COLUMN IF NOT EXISTS `payment_mime` varchar(100) NOT NULL DEFAULT '' AFTER `payment_file`,
  ADD COLUMN IF NOT EXISTS `payment_amount` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `payment_mime`,
  ADD COLUMN IF NOT EXISTS `payment_status` varchar(20) NOT NULL DEFAULT 'PENDING' AFTER `payment_amount`,
  ADD COLUMN IF NOT EXISTS `approved_at` timestamp NULL DEFAULT NULL AFTER `submitted_at`;

-- reg_no must allow NULL (numbers are only issued on approval).
ALTER TABLE `eps_registrations` MODIFY `reg_no` varchar(32) DEFAULT NULL;

-- Helpful indexes (ignore the error if they already exist).
ALTER TABLE `eps_registrations` ADD INDEX IF NOT EXISTS `idx_status` (`payment_status`);
ALTER TABLE `eps_registrations` ADD INDEX IF NOT EXISTS `idx_submitted_at` (`submitted_at`);
