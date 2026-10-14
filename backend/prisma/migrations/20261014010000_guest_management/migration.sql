-- CreateTable
CREATE TABLE `guests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `date_of_birth` DATE NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED') NULL,
    `nationality` VARCHAR(100) NULL,
    `document_type` ENUM('NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER') NULL,
    `document_number_ciphertext` TEXT NULL,
    `document_number_hash` CHAR(64) NULL,
    `address` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `guests_hotel_id_deleted_at_full_name_idx`(`hotel_id`, `deleted_at`, `full_name`),
    INDEX `guests_hotel_id_deleted_at_created_at_idx`(`hotel_id`, `deleted_at`, `created_at`),
    INDEX `guests_hotel_id_phone_idx`(`hotel_id`, `phone`),
    INDEX `guests_hotel_id_email_idx`(`hotel_id`, `email`),
    INDEX `guests_hotel_id_document_number_hash_idx`(`hotel_id`, `document_number_hash`),
    INDEX `guests_hotel_id_nationality_idx`(`hotel_id`, `nationality`),
    UNIQUE INDEX `guests_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `guest_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `changed_fields` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `guest_audit_logs_hotel_id_guest_id_created_at_idx`(`hotel_id`, `guest_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `guests` ADD CONSTRAINT `guests_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guest_audit_logs` ADD CONSTRAINT `guest_audit_logs_hotel_id_guest_id_fkey` FOREIGN KEY (`hotel_id`, `guest_id`) REFERENCES `guests`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
