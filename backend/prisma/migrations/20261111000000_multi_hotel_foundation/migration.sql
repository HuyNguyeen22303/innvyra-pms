-- Additive foundation only. Existing hotels remain ACTIVE and staff keep their
-- current password/session state. No tenant, account, role or subscription is seeded.
-- Requires MySQL 8.0.16+ for enforced CHECK constraints.

-- AlterTable
ALTER TABLE `hotels` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `agreement_reference` VARCHAR(191) NULL,
    ADD COLUMN `contact_email` VARCHAR(191) NULL,
    ADD COLUMN `contact_phone` VARCHAR(30) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `suspended_at` DATETIME(3) NULL,
    ADD COLUMN `suspension_reason` VARCHAR(2000) NULL;

-- AlterTable
ALTER TABLE `staff_users` ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `platform_admins` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `platform_admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_auth_sessions` (
    `id` CHAR(36) NOT NULL,
    `platform_admin_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `revoked_reason` VARCHAR(32) NULL,

    INDEX `platform_auth_sessions_platform_admin_id_revoked_at_idx`(`platform_admin_id`, `revoked_at`),
    INDEX `platform_auth_sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_refresh_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `session_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,

    UNIQUE INDEX `platform_refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `platform_refresh_tokens_session_id_idx`(`session_id`),
    INDEX `platform_refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hotel_subscription_periods` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `plan_name` VARCHAR(100) NOT NULL,
    `starts_on` DATE NOT NULL,
    `ends_on` DATE NOT NULL,
    `fee_amount` DECIMAL(14, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'VND',
    `agreement_reference` VARCHAR(191) NULL,
    `payment_reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `recorded_by_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hotel_subscription_periods_hotel_id_starts_on_ends_on_idx`(`hotel_id`, `starts_on`, `ends_on`),
    INDEX `hotel_subscription_periods_hotel_id_ends_on_idx`(`hotel_id`, `ends_on`),
    INDEX `hotel_subscription_periods_recorded_by_id_idx`(`recorded_by_id`),
    UNIQUE INDEX `hotel_subscription_periods_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `action` ENUM('HOTEL_CREATED', 'HOTEL_UPDATED', 'HOTEL_SUSPENDED', 'HOTEL_REACTIVATED', 'HOTEL_ADMIN_CREATED', 'HOTEL_ADMIN_PASSWORD_RESET', 'SUBSCRIPTION_PERIOD_RECORDED') NOT NULL,
    `reason` VARCHAR(2000) NULL,
    `changes` JSON NULL,
    `target_staff_user_id` BIGINT UNSIGNED NULL,
    `subscription_period_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `platform_audit_logs_hotel_id_created_at_idx`(`hotel_id`, `created_at`),
    INDEX `platform_audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `platform_audit_logs_hotel_id_target_staff_user_id_idx`(`hotel_id`, `target_staff_user_id`),
    INDEX `platform_audit_logs_hotel_id_subscription_period_id_idx`(`hotel_id`, `subscription_period_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `hotels_status_idx` ON `hotels`(`status`);

-- AddForeignKey
ALTER TABLE `platform_auth_sessions` ADD CONSTRAINT `platform_auth_sessions_platform_admin_id_fkey` FOREIGN KEY (`platform_admin_id`) REFERENCES `platform_admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_refresh_tokens` ADD CONSTRAINT `platform_refresh_tokens_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `platform_auth_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hotel_subscription_periods` ADD CONSTRAINT `hotel_subscription_periods_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hotel_subscription_periods` ADD CONSTRAINT `hotel_subscription_periods_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `platform_admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_audit_logs` ADD CONSTRAINT `platform_audit_logs_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_audit_logs` ADD CONSTRAINT `platform_audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `platform_admins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_audit_logs` ADD CONSTRAINT `platform_audit_logs_hotel_id_target_staff_user_id_fkey` FOREIGN KEY (`hotel_id`, `target_staff_user_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `platform_audit_logs` ADD CONSTRAINT `platform_audit_logs_hotel_id_subscription_period_id_fkey` FOREIGN KEY (`hotel_id`, `subscription_period_id`) REFERENCES `hotel_subscription_periods`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Prisma does not model these business CHECK constraints. Keep them in this
-- migration and verify them against MySQL when changing the schema later.
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_suspension_state_check` CHECK (
    (`status` = 'ACTIVE' AND `suspended_at` IS NULL AND `suspension_reason` IS NULL)
    OR (`status` = 'SUSPENDED' AND `suspended_at` IS NOT NULL
        AND `suspension_reason` IS NOT NULL AND CHAR_LENGTH(TRIM(`suspension_reason`)) > 0)
);

ALTER TABLE `hotel_subscription_periods`
    ADD CONSTRAINT `hotel_subscription_periods_dates_check` CHECK (`starts_on` <= `ends_on`),
    ADD CONSTRAINT `hotel_subscription_periods_fee_check` CHECK (`fee_amount` >= 0),
    ADD CONSTRAINT `hotel_subscription_periods_currency_check` CHECK (`currency` = 'VND');

ALTER TABLE `platform_audit_logs` ADD CONSTRAINT `platform_audit_logs_reason_check` CHECK (
    `action` NOT IN ('HOTEL_SUSPENDED', 'HOTEL_REACTIVATED')
    OR (`reason` IS NOT NULL AND CHAR_LENGTH(TRIM(`reason`)) > 0)
);
