-- AlterTable
ALTER TABLE `hotel_subscription_periods` ADD COLUMN `month_count` SMALLINT UNSIGNED NULL,
    ADD COLUMN `monthly_price` DECIMAL(14, 2) NULL,
    ADD COLUMN `plan_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `room_limit` INTEGER UNSIGNED NULL,
    ADD COLUMN `staff_limit` INTEGER UNSIGNED NULL;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `monthly_price` DECIMAL(14, 2) NOT NULL,
    `room_limit` INTEGER UNSIGNED NOT NULL,
    `staff_limit` INTEGER UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subscription_plans_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plan_audits` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `changes` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subscription_plan_audits_plan_id_created_at_idx`(`plan_id`, `created_at`),
    INDEX `subscription_plan_audits_actor_id_idx`(`actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hotel_subscription_periods` ADD CONSTRAINT `hotel_subscription_periods_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `subscription_plan_audits` ADD CONSTRAINT `subscription_plan_audits_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_plan_audits` ADD CONSTRAINT `subscription_plan_audits_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `platform_admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nullable snapshots preserve legacy periods without imposing new quotas.
ALTER TABLE subscription_plans ADD CONSTRAINT chk_subscription_plan_limits CHECK (monthly_price >= 0 AND room_limit > 0 AND staff_limit > 0);
ALTER TABLE hotel_subscription_periods ADD CONSTRAINT chk_subscription_snapshot CHECK (
  (plan_id IS NULL AND monthly_price IS NULL AND month_count IS NULL AND room_limit IS NULL AND staff_limit IS NULL)
  OR (plan_id IS NOT NULL AND monthly_price IS NOT NULL AND monthly_price >= 0 AND month_count IS NOT NULL AND month_count BETWEEN 1 AND 120 AND room_limit IS NOT NULL AND room_limit > 0 AND staff_limit IS NOT NULL AND staff_limit > 0)
);
