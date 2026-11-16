-- AlterTable
ALTER TABLE `housekeeping_tasks` ADD COLUMN `work_token` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `inventory_items` ADD COLUMN `material_type` VARCHAR(20) NOT NULL DEFAULT 'UNCLASSIFIED';

-- AlterTable
ALTER TABLE `stock_receipts` ADD COLUMN `payment_tracking` VARCHAR(20) NOT NULL DEFAULT 'UNRECONCILED',
    ADD COLUMN `reconciled_at` DATETIME(3) NULL,
    ADD COLUMN `reconciled_by_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `reconciliation_reason` VARCHAR(2000) NULL;

-- AlterTable
ALTER TABLE `stock_issues` ADD COLUMN `housekeeping_completion_id` BIGINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `housekeeping_material_presets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_type_id` BIGINT UNSIGNED NOT NULL,
    `item_id` BIGINT UNSIGNED NOT NULL,
    `quantity` DECIMAL(14, 2) NOT NULL,

    UNIQUE INDEX `housekeeping_material_presets_hotel_id_room_type_id_item_id_key`(`hotel_id`, `room_type_id`, `item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `housekeeping_material_completions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `work_token` CHAR(36) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `no_materials_reason` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `housekeeping_material_completions_hotel_id_task_id_idx`(`hotel_id`, `task_id`),
    UNIQUE INDEX `housekeeping_material_completions_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `housekeeping_material_completions_hotel_id_work_token_key`(`hotel_id`, `work_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `receipt_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `request_key` CHAR(36) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `payment_method` ENUM('CASH', 'BANK_TRANSFER') NOT NULL,
    `paid_at` DATETIME(3) NOT NULL,
    `reference_number` VARCHAR(100) NULL,
    `notes` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supplier_payments_hotel_id_paid_at_idx`(`hotel_id`, `paid_at`),
    INDEX `supplier_payments_hotel_id_receipt_id_idx`(`hotel_id`, `receipt_id`),
    UNIQUE INDEX `supplier_payments_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `supplier_payments_hotel_id_request_key_key`(`hotel_id`, `request_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payment_reversals` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `payment_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(2000) NOT NULL,
    `reversed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `supplier_payment_reversals_payment_id_key`(`payment_id`),
    INDEX `supplier_payment_reversals_hotel_id_reversed_at_idx`(`hotel_id`, `reversed_at`),
    UNIQUE INDEX `supplier_payment_reversals_hotel_id_payment_id_key`(`hotel_id`, `payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `stock_issues_housekeeping_completion_id_key` ON `stock_issues`(`housekeeping_completion_id`);

-- CreateIndex
CREATE UNIQUE INDEX `stock_issues_hotel_id_housekeeping_completion_id_key` ON `stock_issues`(`hotel_id`, `housekeeping_completion_id`);

-- AddForeignKey
ALTER TABLE `housekeeping_material_presets` ADD CONSTRAINT `housekeeping_material_presets_hotel_id_room_type_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`) REFERENCES `room_types`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `housekeeping_material_presets` ADD CONSTRAINT `housekeeping_material_presets_hotel_id_item_id_fkey` FOREIGN KEY (`hotel_id`, `item_id`) REFERENCES `inventory_items`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `housekeeping_material_completions` ADD CONSTRAINT `housekeeping_material_completions_hotel_id_task_id_fkey` FOREIGN KEY (`hotel_id`, `task_id`) REFERENCES `housekeeping_tasks`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `housekeeping_material_completions` ADD CONSTRAINT `housekeeping_material_completions_hotel_id_actor_id_fkey` FOREIGN KEY (`hotel_id`, `actor_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_hotel_id_receipt_id_fkey` FOREIGN KEY (`hotel_id`, `receipt_id`) REFERENCES `stock_receipts`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_hotel_id_actor_id_fkey` FOREIGN KEY (`hotel_id`, `actor_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `supplier_payment_reversals` ADD CONSTRAINT `supplier_payment_reversals_hotel_id_payment_id_fkey` FOREIGN KEY (`hotel_id`, `payment_id`) REFERENCES `supplier_payments`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `supplier_payment_reversals` ADD CONSTRAINT `supplier_payment_reversals_hotel_id_actor_id_fkey` FOREIGN KEY (`hotel_id`, `actor_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_hotel_id_reconciled_by_id_fkey` FOREIGN KEY (`hotel_id`, `reconciled_by_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_issues` ADD CONSTRAINT `stock_issues_hotel_id_housekeeping_completion_id_fkey` FOREIGN KEY (`hotel_id`, `housekeeping_completion_id`) REFERENCES `housekeeping_material_completions`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Preserve existing in-progress work without inventing historical consumption.
UPDATE `housekeeping_tasks` SET `work_token` = UUID() WHERE `status` = 'IN_PROGRESS' AND `work_token` IS NULL;
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_material_type_check` CHECK (`material_type` IN ('UNCLASSIFIED','CONSUMABLE','REUSABLE'));
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_tracking_check` CHECK (`payment_tracking` IN ('UNRECONCILED','TRACKED'));
ALTER TABLE `housekeeping_material_presets` ADD CONSTRAINT `housekeeping_presets_quantity_check` CHECK (`quantity` > 0);
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_amount_check` CHECK (`amount` > 0);
