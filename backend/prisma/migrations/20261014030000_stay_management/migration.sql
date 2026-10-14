-- AlterTable
ALTER TABLE `reservations` MODIFY `status` ENUM('CONFIRMED', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'PARTIALLY_CHECKED_IN') NOT NULL DEFAULT 'CONFIRMED';

-- CreateTable
CREATE TABLE `stays` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_type_id` BIGINT UNSIGNED NOT NULL,
    `reservation_room_id` BIGINT UNSIGNED NOT NULL,
    `current_room_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('CHECKED_IN', 'CHECKED_OUT') NOT NULL DEFAULT 'CHECKED_IN',
    `actual_checkin_at` DATETIME(3) NOT NULL,
    `actual_checkout_at` DATETIME(3) NULL,
    `checkin_staff_id` BIGINT UNSIGNED NOT NULL,
    `checkout_staff_id` BIGINT UNSIGNED NULL,
    `checkin_notes` VARCHAR(2000) NULL,
    `checkout_notes` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stays_reservation_room_id_key`(`reservation_room_id`),
    INDEX `stays_hotel_id_status_actual_checkin_at_idx`(`hotel_id`, `status`, `actual_checkin_at`),
    INDEX `stays_hotel_id_actual_checkout_at_idx`(`hotel_id`, `actual_checkout_at`),
    UNIQUE INDEX `stays_hotel_id_room_type_id_id_key`(`hotel_id`, `room_type_id`, `id`),
    UNIQUE INDEX `stays_hotel_id_room_type_id_reservation_room_id_key`(`hotel_id`, `room_type_id`, `reservation_room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_occupancies` (
    `room_id` BIGINT UNSIGNED NOT NULL,
    `stay_id` BIGINT UNSIGNED NOT NULL,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_type_id` BIGINT UNSIGNED NOT NULL,
    `occupied_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `room_occupancies_stay_id_key`(`stay_id`),
    UNIQUE INDEX `room_occupancies_hotel_id_room_type_id_room_id_key`(`hotel_id`, `room_type_id`, `room_id`),
    UNIQUE INDEX `room_occupancies_hotel_id_room_type_id_stay_id_key`(`hotel_id`, `room_type_id`, `stay_id`),
    PRIMARY KEY (`room_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_transfers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_type_id` BIGINT UNSIGNED NOT NULL,
    `stay_id` BIGINT UNSIGNED NOT NULL,
    `from_room_id` BIGINT UNSIGNED NOT NULL,
    `to_room_id` BIGINT UNSIGNED NOT NULL,
    `transferred_at` DATETIME(3) NOT NULL,
    `transferred_by` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(2000) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `room_transfers_hotel_id_stay_id_transferred_at_idx`(`hotel_id`, `stay_id`, `transferred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `reservation_rooms_hotel_id_room_id_idx` ON `reservation_rooms`(`hotel_id`, `room_id`);

-- CreateIndex
CREATE UNIQUE INDEX `reservation_rooms_hotel_id_room_type_id_id_key` ON `reservation_rooms`(`hotel_id`, `room_type_id`, `id`);

-- AddForeignKey
ALTER TABLE `stays` ADD CONSTRAINT `stays_hotel_id_room_type_id_reservation_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `reservation_room_id`) REFERENCES `reservation_rooms`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stays` ADD CONSTRAINT `stays_hotel_id_room_type_id_current_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `current_room_id`) REFERENCES `rooms`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stays` ADD CONSTRAINT `stays_hotel_id_checkin_staff_id_fkey` FOREIGN KEY (`hotel_id`, `checkin_staff_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `stays` ADD CONSTRAINT `stays_hotel_id_checkout_staff_id_fkey` FOREIGN KEY (`hotel_id`, `checkout_staff_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `room_occupancies` ADD CONSTRAINT `room_occupancies_hotel_id_room_type_id_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `room_id`) REFERENCES `rooms`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `room_occupancies` ADD CONSTRAINT `room_occupancies_hotel_id_room_type_id_stay_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `stay_id`) REFERENCES `stays`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `room_transfers` ADD CONSTRAINT `room_transfers_hotel_id_room_type_id_stay_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `stay_id`) REFERENCES `stays`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `room_transfers` ADD CONSTRAINT `room_transfers_hotel_id_room_type_id_from_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `from_room_id`) REFERENCES `rooms`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `room_transfers` ADD CONSTRAINT `room_transfers_hotel_id_room_type_id_to_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_type_id`, `to_room_id`) REFERENCES `rooms`(`hotel_id`, `room_type_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `room_transfers` ADD CONSTRAINT `room_transfers_hotel_id_transferred_by_fkey` FOREIGN KEY (`hotel_id`, `transferred_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
