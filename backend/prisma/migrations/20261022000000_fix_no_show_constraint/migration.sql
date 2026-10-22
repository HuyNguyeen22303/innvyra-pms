-- ============================================================
-- Migration: Fix NO_SHOW constraint (idempotent)
-- ============================================================
-- Safe for: fresh DB, existing DB, partially-migrated DB.
-- Requires MySQL 8.0+ (uses dynamic SQL + PREPARE/EXECUTE).

-- ------------------------------------------------------------------
-- Step 1: Drop old constraint if it exists.
-- ------------------------------------------------------------------
-- MySQL 8.0 does not support DROP CONSTRAINT IF EXISTS natively,
-- so we use dynamic SQL to conditionally execute the DROP.
SET @cn = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations'
           AND CONSTRAINT_NAME = 'reservations_cancellation_check');
SET @sql = IF(@cn > 0,
  'ALTER TABLE `reservations` DROP CONSTRAINT `reservations_cancellation_check`',
  'SELECT 1 AS skipped_drop');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------------
-- Step 2: Fix existing NO_SHOW rows that have NULL cancellation fields.
-- ------------------------------------------------------------------
-- Only fix if staff_users has at least 1 active user (otherwise
-- cancell_by would be NULL → constraint ADD below would fail).
SELECT `id` INTO @staff FROM `staff_users` WHERE `is_active` = 1 ORDER BY `id` LIMIT 1;

UPDATE `reservations`
SET
  `cancelled_at` = NOW(),
  `cancelled_by` = @staff,
  `cancellation_reason` = 'No-show (data migrated)'
WHERE `status` = 'NO_SHOW'
  AND (`cancelled_at` IS NULL OR `cancelled_by` IS NULL OR `cancellation_reason` IS NULL)
  AND @staff IS NOT NULL;

-- ------------------------------------------------------------------
-- Step 3: Add new constraint (idempotent — skip if already exists).
-- ------------------------------------------------------------------
SET @cn2 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations'
            AND CONSTRAINT_NAME = 'reservations_cancellation_check');

SET @add_sql = IF(@cn2 = 0,
  CONCAT(
    'ALTER TABLE `reservations` ADD CONSTRAINT `reservations_cancellation_check` CHECK (',
    '(`status` IN (''CANCELLED'', ''NO_SHOW'') AND `cancelled_at` IS NOT NULL AND `cancelled_by` IS NOT NULL AND `cancellation_reason` IS NOT NULL)',
    ' OR (`status` NOT IN (''CANCELLED'', ''NO_SHOW'') AND `cancelled_at` IS NULL AND `cancelled_by` IS NULL AND `cancellation_reason` IS NULL)',
    ')'
  ),
  'SELECT 1 AS skipped_add');

PREPARE stmt2 FROM @add_sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

