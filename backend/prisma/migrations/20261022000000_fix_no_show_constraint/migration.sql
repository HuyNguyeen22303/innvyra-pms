-- Drop old constraint if it still exists (idempotent – safe to re-run).
-- MySQL 8.0 does not support DROP CONSTRAINT IF EXISTS, so we use dynamic SQL.
SET @cn = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations'
           AND CONSTRAINT_NAME = 'reservations_cancellation_check');
SET @sql = IF(@cn > 0, 'ALTER TABLE `reservations` DROP CONSTRAINT `reservations_cancellation_check`', 'SELECT 1 AS skipped');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fix existing NO_SHOW rows that have NULL cancellation fields
-- so they become compatible with the new constraint below.
UPDATE `reservations`
SET
  `cancelled_at` = NOW(),
  `cancelled_by` = (SELECT `id` FROM `staff_users` WHERE `is_active` = 1 ORDER BY `id` LIMIT 1),
  `cancellation_reason` = 'No-show (data migrated)'
WHERE `status` = 'NO_SHOW'
  AND (`cancelled_at` IS NULL OR `cancelled_by` IS NULL OR `cancellation_reason` IS NULL);

-- AddConstraint (now includes NO_SHOW as a cancellation-like status)
ALTER TABLE `reservations`
  ADD CONSTRAINT `reservations_cancellation_check` CHECK (
    (`status` IN ('CANCELLED', 'NO_SHOW') AND `cancelled_at` IS NOT NULL AND `cancelled_by` IS NOT NULL AND `cancellation_reason` IS NOT NULL)
    OR (`status` NOT IN ('CANCELLED', 'NO_SHOW') AND `cancelled_at` IS NULL AND `cancelled_by` IS NULL AND `cancellation_reason` IS NULL)
  );

