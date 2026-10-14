-- AlterTable
ALTER TABLE `hotels` ADD COLUMN `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';

-- CreateTable
CREATE TABLE `reservations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `confirmation_code` VARCHAR(32) NOT NULL,
    `booker_guest_id` BIGINT UNSIGNED NOT NULL,
    `check_in_date` DATE NOT NULL,
    `check_out_date` DATE NOT NULL,
    `status` ENUM('CONFIRMED', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW') NOT NULL DEFAULT 'CONFIRMED',
    `booking_source` VARCHAR(32) NOT NULL DEFAULT 'DIRECT',
    `total_amount` DECIMAL(14, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'VND',
    `notes` TEXT NULL,
    `cancellation_reason` TEXT NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancelled_by` BIGINT UNSIGNED NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reservations_confirmation_code_key`(`confirmation_code`),
    INDEX `reservations_hotel_id_status_check_in_date_check_out_date_idx`(`hotel_id`, `status`, `check_in_date`, `check_out_date`),
    INDEX `reservations_hotel_id_booker_guest_id_idx`(`hotel_id`, `booker_guest_id`),
    INDEX `reservations_hotel_id_check_in_date_idx`(`hotel_id`, `check_in_date`),
    INDEX `reservations_hotel_id_check_out_date_idx`(`hotel_id`, `check_out_date`),
    INDEX `reservations_hotel_id_booking_source_idx`(`hotel_id`, `booking_source`),
    INDEX `reservations_hotel_id_created_at_idx`(`hotel_id`, `created_at`),
    UNIQUE INDEX `reservations_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservation_rooms` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `reservation_id` BIGINT UNSIGNED NOT NULL,
    `room_type_id` BIGINT UNSIGNED NOT NULL,
    `room_id` BIGINT UNSIGNED NULL,
    `adults` SMALLINT UNSIGNED NOT NULL,
    `children` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reservation_rooms_hotel_id_room_type_id_reservation_id_idx`(`hotel_id`, `room_type_id`, `reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservation_room_nights` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_room_id` BIGINT UNSIGNED NOT NULL,
    `stay_date` DATE NOT NULL,
    `nightly_rate` DECIMAL(14, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reservation_room_nights_stay_date_reservation_room_id_idx`(`stay_date`, `reservation_room_id`),
    UNIQUE INDEX `reservation_room_nights_reservation_room_id_stay_date_key`(`reservation_room_id`, `stay_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `staff_users_hotel_id_id_key` ON `staff_users`(`hotel_id`, `id`);

-- CreateIndex
CREATE UNIQUE INDEX `rooms_hotel_id_room_type_id_id_key` ON `rooms`(`hotel_id`, `room_type_id`, `id`);

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_hotel_id_booker_guest_id_fkey` FOREIGN KEY (`hotel_id`, `booker_guest_id`) REFERENCES `guests`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_hotel_id_cancelled_by_fkey` FOREIGN KEY (`hotel_id`, `cancelled_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_rooms` ADD CONSTRAINT `reservation_rooms_hotel_id_reservation_id_fkey` FOREIGN KEY (`hotel_id`, `reservation_id`) REFERENCES `reservations`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_rooms` ADD CONSTRAINT `reservation_rooms_hotel_id_room_type_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`) REFERENCES `room_types`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_rooms` ADD CONSTRAINT `reservation_rooms_hotel_id_room_type_id_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `room_id`) REFERENCES `rooms`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_room_nights` ADD CONSTRAINT `reservation_room_nights_reservation_room_id_fkey` FOREIGN KEY (`reservation_room_id`) REFERENCES `reservation_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database invariants for the new tables (MySQL 8.0.16+).
ALTER TABLE `reservations`
  ADD CONSTRAINT `reservations_dates_check` CHECK (`check_out_date` > `check_in_date`),
  ADD CONSTRAINT `reservations_amount_check` CHECK (`total_amount` >= 0),
  ADD CONSTRAINT `reservations_cancellation_check` CHECK (
    (`status` = 'CANCELLED' AND `cancelled_at` IS NOT NULL AND `cancelled_by` IS NOT NULL AND `cancellation_reason` IS NOT NULL)
    OR (`status` <> 'CANCELLED' AND `cancelled_at` IS NULL AND `cancelled_by` IS NULL AND `cancellation_reason` IS NULL)
  );
ALTER TABLE `reservation_rooms` ADD CONSTRAINT `reservation_rooms_adults_check` CHECK (`adults` > 0);
ALTER TABLE `reservation_room_nights` ADD CONSTRAINT `reservation_nights_rate_check` CHECK (`nightly_rate` >= 0);
