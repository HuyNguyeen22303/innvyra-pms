-- CreateTable
CREATE TABLE `inventory_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_categories_hotel_id_is_active_idx`(`hotel_id`, `is_active`),
    INDEX `inventory_categories_hotel_id_name_idx`(`hotel_id`, `name`),
    UNIQUE INDEX `inventory_categories_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `inventory_categories_hotel_id_code_key`(`hotel_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contact_person` VARCHAR(150) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `suppliers_hotel_id_is_active_idx`(`hotel_id`, `is_active`),
    INDEX `suppliers_hotel_id_name_idx`(`hotel_id`, `name`),
    UNIQUE INDEX `suppliers_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `suppliers_hotel_id_code_key`(`hotel_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(30) NOT NULL,
    `description` TEXT NULL,
    `current_stock` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `min_stock_level` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_items_hotel_id_category_id_idx`(`hotel_id`, `category_id`),
    INDEX `inventory_items_hotel_id_is_active_idx`(`hotel_id`, `is_active`),
    INDEX `inventory_items_hotel_id_name_idx`(`hotel_id`, `name`),
    UNIQUE INDEX `inventory_items_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `inventory_items_hotel_id_code_key`(`hotel_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_receipts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `supplier_id` BIGINT UNSIGNED NULL,
    `receipt_number` VARCHAR(50) NOT NULL,
    `receipt_date` DATETIME(3) NOT NULL,
    `total_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_receipts_hotel_id_receipt_date_idx`(`hotel_id`, `receipt_date`),
    INDEX `stock_receipts_hotel_id_supplier_id_idx`(`hotel_id`, `supplier_id`),
    UNIQUE INDEX `stock_receipts_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `stock_receipts_hotel_id_receipt_number_key`(`hotel_id`, `receipt_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_receipt_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `receipt_id` BIGINT UNSIGNED NOT NULL,
    `item_id` BIGINT UNSIGNED NOT NULL,
    `quantity` DECIMAL(14, 2) NOT NULL,
    `unit_price` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `line_total` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_receipt_items_hotel_id_receipt_id_idx`(`hotel_id`, `receipt_id`),
    INDEX `stock_receipt_items_hotel_id_item_id_idx`(`hotel_id`, `item_id`),
    UNIQUE INDEX `stock_receipt_items_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_issues` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `issue_number` VARCHAR(50) NOT NULL,
    `issue_date` DATETIME(3) NOT NULL,
    `department` VARCHAR(100) NOT NULL,
    `purpose` VARCHAR(500) NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_issues_hotel_id_issue_date_idx`(`hotel_id`, `issue_date`),
    INDEX `stock_issues_hotel_id_department_idx`(`hotel_id`, `department`),
    UNIQUE INDEX `stock_issues_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `stock_issues_hotel_id_issue_number_key`(`hotel_id`, `issue_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_issue_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `issue_id` BIGINT UNSIGNED NOT NULL,
    `item_id` BIGINT UNSIGNED NOT NULL,
    `quantity` DECIMAL(14, 2) NOT NULL,
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_issue_items_hotel_id_issue_id_idx`(`hotel_id`, `issue_id`),
    INDEX `stock_issue_items_hotel_id_item_id_idx`(`hotel_id`, `item_id`),
    UNIQUE INDEX `stock_issue_items_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_adjustments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `adjustment_number` VARCHAR(50) NOT NULL,
    `item_id` BIGINT UNSIGNED NOT NULL,
    `system_quantity` DECIMAL(14, 2) NOT NULL,
    `actual_quantity` DECIMAL(14, 2) NOT NULL,
    `difference` DECIMAL(14, 2) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_adjustments_hotel_id_item_id_created_at_idx`(`hotel_id`, `item_id`, `created_at`),
    UNIQUE INDEX `stock_adjustments_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `stock_adjustments_hotel_id_adjustment_number_key`(`hotel_id`, `adjustment_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `item_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('RECEIPT', 'ISSUE', 'ADJUSTMENT') NOT NULL,
    `quantity` DECIMAL(14, 2) NOT NULL,
    `previous_stock` DECIMAL(14, 2) NOT NULL,
    `current_stock` DECIMAL(14, 2) NOT NULL,
    `reference_type` VARCHAR(50) NOT NULL,
    `reference_id` BIGINT UNSIGNED NULL,
    `reference_number` VARCHAR(50) NULL,
    `notes` VARCHAR(500) NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_movements_hotel_id_item_id_created_at_idx`(`hotel_id`, `item_id`, `created_at`),
    INDEX `inventory_movements_hotel_id_type_created_at_idx`(`hotel_id`, `type`, `created_at`),
    UNIQUE INDEX `inventory_movements_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory_categories` ADD CONSTRAINT `inventory_categories_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_hotel_id_category_id_fkey` FOREIGN KEY (`hotel_id`, `category_id`) REFERENCES `inventory_categories`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_hotel_id_supplier_id_fkey` FOREIGN KEY (`hotel_id`, `supplier_id`) REFERENCES `suppliers`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_hotel_id_receipt_id_fkey` FOREIGN KEY (`hotel_id`, `receipt_id`) REFERENCES `stock_receipts`(`hotel_id`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_hotel_id_item_id_fkey` FOREIGN KEY (`hotel_id`, `item_id`) REFERENCES `inventory_items`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_issues` ADD CONSTRAINT `stock_issues_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_issues` ADD CONSTRAINT `stock_issues_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_issue_items` ADD CONSTRAINT `stock_issue_items_hotel_id_issue_id_fkey` FOREIGN KEY (`hotel_id`, `issue_id`) REFERENCES `stock_issues`(`hotel_id`, `id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_issue_items` ADD CONSTRAINT `stock_issue_items_hotel_id_item_id_fkey` FOREIGN KEY (`hotel_id`, `item_id`) REFERENCES `inventory_items`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_hotel_id_item_id_fkey` FOREIGN KEY (`hotel_id`, `item_id`) REFERENCES `inventory_items`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_hotel_id_item_id_fkey` FOREIGN KEY (`hotel_id`, `item_id`) REFERENCES `inventory_items`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Constraint to guarantee stock is never negative in MySQL
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_stock_non_negative_check` CHECK (`current_stock` >= 0);
