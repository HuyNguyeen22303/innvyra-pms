-- CreateTable
CREATE TABLE `services` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `unit` VARCHAR(30) NOT NULL,
    `price` DECIMAL(18, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `services_hotel_id_is_active_name_idx`(`hotel_id`, `is_active`, `name`),
    UNIQUE INDEX `services_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `services_hotel_id_code_key`(`hotel_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `reservation_id` BIGINT UNSIGNED NOT NULL,
    `stay_id` BIGINT UNSIGNED NULL,
    `status` ENUM('REQUESTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `notes` VARCHAR(2000) NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `completed_by` BIGINT UNSIGNED NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_by` BIGINT UNSIGNED NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancellation_reason` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_orders_hotel_id_reservation_id_status_idx`(`hotel_id`, `reservation_id`, `status`),
    INDEX `service_orders_hotel_id_created_at_idx`(`hotel_id`, `created_at`),
    UNIQUE INDEX `service_orders_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `service_order_id` BIGINT UNSIGNED NOT NULL,
    `service_id` BIGINT UNSIGNED NOT NULL,
    `name_snapshot` VARCHAR(150) NOT NULL,
    `unit_snapshot` VARCHAR(30) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `unit_price_snapshot` DECIMAL(18, 2) NOT NULL,
    `line_total` DECIMAL(18, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `service_order_items_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `service_order_items_service_order_id_service_id_key`(`service_order_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `folios` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `reservation_id` BIGINT UNSIGNED NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'VND',
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `folios_reservation_id_key`(`reservation_id`),
    INDEX `folios_hotel_id_status_idx`(`hotel_id`, `status`),
    UNIQUE INDEX `folios_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `folios_hotel_id_reservation_id_key`(`hotel_id`, `reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `folio_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `folio_id` BIGINT UNSIGNED NOT NULL,
    `entry_type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `source_type` ENUM('ROOM_NIGHT', 'SERVICE_ORDER_ITEM', 'MANUAL_ADJUSTMENT') NOT NULL,
    `source_id` BIGINT UNSIGNED NULL,
    `room_night_id` BIGINT UNSIGNED NULL,
    `service_order_item_id` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `description` VARCHAR(2000) NOT NULL,
    `related_item_id` BIGINT UNSIGNED NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `folio_items_room_night_id_key`(`room_night_id`),
    UNIQUE INDEX `folio_items_service_order_item_id_key`(`service_order_item_id`),
    INDEX `folio_items_hotel_id_folio_id_created_at_idx`(`hotel_id`, `folio_id`, `created_at`),
    UNIQUE INDEX `folio_items_hotel_id_folio_id_id_key`(`hotel_id`, `folio_id`, `id`),
    UNIQUE INDEX `folio_items_hotel_id_service_order_item_id_key`(`hotel_id`, `service_order_item_id`),
    UNIQUE INDEX `folio_items_hotel_id_source_type_source_id_key`(`hotel_id`, `source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `folio_id` BIGINT UNSIGNED NOT NULL,
    `payment_type` ENUM('PAYMENT', 'DEPOSIT', 'REFUND') NOT NULL,
    `payment_method` ENUM('CASH', 'BANK_TRANSFER') NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `status` ENUM('CONFIRMED', 'PENDING', 'FAILED') NOT NULL,
    `reference_number` VARCHAR(100) NULL,
    `original_payment_id` BIGINT UNSIGNED NULL,
    `reason` VARCHAR(2000) NULL,
    `processed_by` BIGINT UNSIGNED NOT NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_hotel_id_folio_id_status_created_at_idx`(`hotel_id`, `folio_id`, `status`, `created_at`),
    UNIQUE INDEX `payments_hotel_id_folio_id_id_key`(`hotel_id`, `folio_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_idempotency` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `key_hash` CHAR(64) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `response` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `billing_idempotency_hotel_id_key_hash_key`(`hotel_id`, `key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `entity_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `billing_audit_logs_hotel_id_action_entity_id_created_at_idx`(`hotel_id`, `action`, `entity_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `stays_hotel_id_id_key` ON `stays`(`hotel_id`, `id`);

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_hotel_id_reservation_id_fkey` FOREIGN KEY (`hotel_id`, `reservation_id`) REFERENCES `reservations`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_hotel_id_stay_id_fkey` FOREIGN KEY (`hotel_id`, `stay_id`) REFERENCES `stays`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_hotel_id_completed_by_fkey` FOREIGN KEY (`hotel_id`, `completed_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_hotel_id_cancelled_by_fkey` FOREIGN KEY (`hotel_id`, `cancelled_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_order_items` ADD CONSTRAINT `service_order_items_hotel_id_service_order_id_fkey` FOREIGN KEY (`hotel_id`, `service_order_id`) REFERENCES `service_orders`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_order_items` ADD CONSTRAINT `service_order_items_hotel_id_service_id_fkey` FOREIGN KEY (`hotel_id`, `service_id`) REFERENCES `services`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `folios` ADD CONSTRAINT `folios_hotel_id_reservation_id_fkey` FOREIGN KEY (`hotel_id`, `reservation_id`) REFERENCES `reservations`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `folio_items` ADD CONSTRAINT `folio_items_hotel_id_folio_id_fkey` FOREIGN KEY (`hotel_id`, `folio_id`) REFERENCES `folios`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `folio_items` ADD CONSTRAINT `folio_items_room_night_id_fkey` FOREIGN KEY (`room_night_id`) REFERENCES `reservation_room_nights`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `folio_items` ADD CONSTRAINT `folio_items_hotel_id_service_order_item_id_fkey` FOREIGN KEY (`hotel_id`, `service_order_item_id`) REFERENCES `service_order_items`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `folio_items` ADD CONSTRAINT `folio_items_hotel_id_folio_id_related_item_id_fkey` FOREIGN KEY (`hotel_id`, `folio_id`, `related_item_id`) REFERENCES `folio_items`(`hotel_id`, `folio_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `folio_items` ADD CONSTRAINT `folio_items_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_hotel_id_folio_id_fkey` FOREIGN KEY (`hotel_id`, `folio_id`) REFERENCES `folios`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_hotel_id_processed_by_fkey` FOREIGN KEY (`hotel_id`, `processed_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_hotel_id_folio_id_original_payment_id_fkey` FOREIGN KEY (`hotel_id`, `folio_id`, `original_payment_id`) REFERENCES `payments`(`hotel_id`, `folio_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `billing_idempotency` ADD CONSTRAINT `billing_idempotency_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_audit_logs` ADD CONSTRAINT `billing_audit_logs_hotel_id_actor_id_fkey` FOREIGN KEY (`hotel_id`, `actor_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Additive financial invariants (MySQL 8.0.16+). Existing history is untouched.
ALTER TABLE `services` ADD CONSTRAINT `services_price_check` CHECK (`price` >= 0 AND `price` = ROUND(`price`, 0));
ALTER TABLE `service_order_items` ADD CONSTRAINT `service_items_money_check` CHECK (
  `quantity` BETWEEN 1 AND 10000 AND `unit_price_snapshot` >= 0
  AND `unit_price_snapshot` = ROUND(`unit_price_snapshot`, 0)
  AND `line_total` = `quantity` * `unit_price_snapshot`
);
ALTER TABLE `service_orders` ADD CONSTRAINT `service_order_state_check` CHECK (
  (`status` = 'REQUESTED' AND `completed_by` IS NULL AND `completed_at` IS NULL AND `cancelled_by` IS NULL AND `cancelled_at` IS NULL)
  OR (`status` = 'COMPLETED' AND `completed_by` IS NOT NULL AND `completed_at` IS NOT NULL AND `cancelled_by` IS NULL AND `cancelled_at` IS NULL)
  OR (`status` = 'CANCELLED' AND `cancelled_by` IS NOT NULL AND `cancelled_at` IS NOT NULL AND CHAR_LENGTH(TRIM(`cancellation_reason`)) > 0 AND `completed_by` IS NULL AND `completed_at` IS NULL)
);
ALTER TABLE `folios` ADD CONSTRAINT `folios_state_check` CHECK (
  `currency` = 'VND' AND ((`status` = 'OPEN' AND `closed_at` IS NULL) OR (`status` = 'CLOSED' AND `closed_at` IS NOT NULL))
);
ALTER TABLE `folio_items` ADD CONSTRAINT `folio_items_source_check` CHECK (
  `amount` >= 0 AND `amount` = ROUND(`amount`, 0) AND CHAR_LENGTH(TRIM(`description`)) > 0 AND (
    (`source_type` = 'ROOM_NIGHT' AND `entry_type` = 'DEBIT' AND `room_night_id` IS NOT NULL AND `source_id` IS NOT NULL AND `source_id` = `room_night_id` AND `service_order_item_id` IS NULL)
    OR (`source_type` = 'SERVICE_ORDER_ITEM' AND `entry_type` = 'DEBIT' AND `service_order_item_id` IS NOT NULL AND `source_id` IS NOT NULL AND `source_id` = `service_order_item_id` AND `room_night_id` IS NULL)
    OR (`source_type` = 'MANUAL_ADJUSTMENT' AND `amount` > 0 AND `source_id` IS NULL AND `room_night_id` IS NULL AND `service_order_item_id` IS NULL)
  )
);
ALTER TABLE `payments` ADD CONSTRAINT `payments_money_check` CHECK (
  `amount` > 0 AND `amount` = ROUND(`amount`, 0) AND (
    (`payment_type` = 'REFUND' AND `original_payment_id` IS NOT NULL AND `reason` IS NOT NULL AND CHAR_LENGTH(TRIM(`reason`)) > 0)
    OR (`payment_type` IN ('PAYMENT', 'DEPOSIT') AND `original_payment_id` IS NULL)
  ) AND (`payment_method` <> 'BANK_TRANSFER' OR (`reference_number` IS NOT NULL AND CHAR_LENGTH(TRIM(`reference_number`)) > 0))
);
