-- CreateTable
CREATE TABLE `room_types` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `max_adults` SMALLINT UNSIGNED NOT NULL,
    `max_children` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `base_price` DECIMAL(14, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `room_types_hotel_id_is_active_idx`(`hotel_id`, `is_active`),
    INDEX `room_types_hotel_id_name_idx`(`hotel_id`, `name`),
    INDEX `room_types_hotel_id_base_price_idx`(`hotel_id`, `base_price`),
    INDEX `room_types_hotel_id_created_at_idx`(`hotel_id`, `created_at`),
    UNIQUE INDEX `room_types_hotel_id_id_key`(`hotel_id`, `id`),
    UNIQUE INDEX `room_types_hotel_id_code_key`(`hotel_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_type_id` BIGINT UNSIGNED NOT NULL,
    `room_number` VARCHAR(20) NOT NULL,
    `floor_number` SMALLINT NOT NULL,
    `physical_status` ENUM('ACTIVE', 'OUT_OF_SERVICE', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    `housekeeping_status` ENUM('DIRTY', 'CLEANING', 'INSPECTION', 'READY') NOT NULL DEFAULT 'DIRTY',
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rooms_hotel_id_room_type_id_idx`(`hotel_id`, `room_type_id`),
    INDEX `rooms_hotel_id_floor_number_idx`(`hotel_id`, `floor_number`),
    INDEX `rooms_hotel_id_physical_status_idx`(`hotel_id`, `physical_status`),
    INDEX `rooms_hotel_id_housekeeping_status_idx`(`hotel_id`, `housekeeping_status`),
    INDEX `rooms_hotel_id_is_active_idx`(`hotel_id`, `is_active`),
    INDEX `rooms_hotel_id_created_at_idx`(`hotel_id`, `created_at`),
    UNIQUE INDEX `rooms_hotel_id_room_number_key`(`hotel_id`, `room_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `room_types` ADD CONSTRAINT `room_types_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_hotel_id_room_type_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`) REFERENCES `room_types`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
