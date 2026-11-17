-- CreateTable
CREATE TABLE `hotel_bank_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `bank_bin` CHAR(6) NOT NULL,
    `bank_name` VARCHAR(191) NOT NULL,
    `account_number` VARCHAR(19) NOT NULL,
    `account_name` VARCHAR(50) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `updated_by` BIGINT UNSIGNED NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hotel_bank_accounts_hotel_id_key`(`hotel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_requests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `reservation_id` BIGINT UNSIGNED NOT NULL,
    `folio_id` BIGINT UNSIGNED NULL,
    `payment_id` BIGINT UNSIGNED NULL,
    `payment_type` ENUM('PAYMENT', 'DEPOSIT', 'REFUND') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `memo` VARCHAR(19) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `bank_version` INTEGER UNSIGNED NOT NULL,
    `bank_bin` CHAR(6) NOT NULL,
    `bank_name` VARCHAR(191) NOT NULL,
    `account_number` VARCHAR(19) NOT NULL,
    `account_name` VARCHAR(50) NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `confirmed_by` BIGINT UNSIGNED NULL,
    `confirmed_at` DATETIME(3) NULL,
    `cancelled_reason` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_requests_payment_id_key`(`payment_id`),
    UNIQUE INDEX `payment_requests_memo_key`(`memo`),
    INDEX `payment_requests_hotel_id_reservation_id_status_id_idx`(`hotel_id`, `reservation_id`, `status`, `id`),
    UNIQUE INDEX `payment_requests_hotel_id_folio_id_payment_id_key`(`hotel_id`, `folio_id`, `payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hotel_bank_accounts` ADD CONSTRAINT `hotel_bank_accounts_hotel_id_updated_by_fkey` FOREIGN KEY (`hotel_id`, `updated_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `hotel_bank_accounts` ADD CONSTRAINT `hotel_bank_accounts_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_hotel_id_confirmed_by_fkey` FOREIGN KEY (`hotel_id`, `confirmed_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_hotel_id_reservation_id_fkey` FOREIGN KEY (`hotel_id`, `reservation_id`) REFERENCES `reservations`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_hotel_id_folio_id_payment_id_fkey` FOREIGN KEY (`hotel_id`, `folio_id`, `payment_id`) REFERENCES `payments`(`hotel_id`, `folio_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
