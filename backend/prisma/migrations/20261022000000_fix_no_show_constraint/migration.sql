-- DropConstraint
ALTER TABLE `reservations` DROP CONSTRAINT `reservations_cancellation_check`;

-- AddConstraint (now includes NO_SHOW as a cancellation-like status)
ALTER TABLE `reservations`
  ADD CONSTRAINT `reservations_cancellation_check` CHECK (
    (`status` IN ('CANCELLED', 'NO_SHOW') AND `cancelled_at` IS NOT NULL AND `cancelled_by` IS NOT NULL AND `cancellation_reason` IS NOT NULL)
    OR (`status` NOT IN ('CANCELLED', 'NO_SHOW') AND `cancelled_at` IS NULL AND `cancelled_by` IS NULL AND `cancellation_reason` IS NULL)
  );
