-- AlterTable
-- Additive migration: existing room, stay, reservation and billing data is retained.
ALTER TABLE `rooms` ADD COLUMN `maintenance_managed` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `housekeeping_tasks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_id` BIGINT UNSIGNED NOT NULL,
    `active_room_id` BIGINT UNSIGNED NULL,
    `assigned_to` BIGINT UNSIGNED NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `task_type` ENUM('TURNOVER_CLEANING') NOT NULL DEFAULT 'TURNOVER_CLEANING',
    `status` ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_INSPECTION', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `notes` TEXT NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `inspected_at` DATETIME(3) NULL,
    `inspected_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `housekeeping_tasks_active_room_id_key`(`active_room_id`),
    INDEX `housekeeping_tasks_hotel_id_status_priority_idx`(`hotel_id`, `status`, `priority`),
    INDEX `housekeeping_tasks_hotel_id_assigned_to_created_at_idx`(`hotel_id`, `assigned_to`, `created_at`),
    INDEX `housekeeping_tasks_hotel_id_room_id_created_at_idx`(`hotel_id`, `room_id`, `created_at`),
    UNIQUE INDEX `housekeeping_tasks_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_tickets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `reported_by` BIGINT UNSIGNED NOT NULL,
    `assigned_to` BIGINT UNSIGNED NULL,
    `resolved_by` BIGINT UNSIGNED NULL,
    `reported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `started_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `resolution_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `maintenance_tickets_hotel_id_status_priority_reported_at_idx`(`hotel_id`, `status`, `priority`, `reported_at`),
    INDEX `maintenance_tickets_hotel_id_assigned_to_reported_at_idx`(`hotel_id`, `assigned_to`, `reported_at`),
    UNIQUE INDEX `maintenance_tickets_hotel_id_room_id_id_key`(`hotel_id`, `room_id`, `id`),
    UNIQUE INDEX `maintenance_tickets_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_blocks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `room_id` BIGINT UNSIGNED NOT NULL,
    `maintenance_ticket_id` BIGINT UNSIGNED NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` ENUM('SCHEDULED', 'ACTIVE', 'RELEASED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `reason` VARCHAR(2000) NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `released_by` BIGINT UNSIGNED NULL,
    `released_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `maintenance_blocks_hotel_id_room_id_status_start_date_end_da_idx`(`hotel_id`, `room_id`, `status`, `start_date`, `end_date`),
    INDEX `maintenance_blocks_status_start_date_idx`(`status`, `start_date`),
    UNIQUE INDEX `maintenance_blocks_hotel_id_id_key`(`hotel_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operations_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `hotel_id` BIGINT UNSIGNED NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `task_id` BIGINT UNSIGNED NULL,
    `ticket_id` BIGINT UNSIGNED NULL,
    `block_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(40) NOT NULL,
    `from_status` VARCHAR(32) NULL,
    `to_status` VARCHAR(32) NOT NULL,
    `notes` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operations_audit_logs_hotel_id_task_id_created_at_idx`(`hotel_id`, `task_id`, `created_at`),
    INDEX `operations_audit_logs_hotel_id_ticket_id_created_at_idx`(`hotel_id`, `ticket_id`, `created_at`),
    INDEX `operations_audit_logs_hotel_id_block_id_created_at_idx`(`hotel_id`, `block_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `rooms_hotel_id_id_key` ON `rooms`(`hotel_id`, `id`);

-- AddForeignKey
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_tasks_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_tasks_hotel_id_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_id`) REFERENCES `rooms`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_tasks_hotel_id_assigned_to_fkey` FOREIGN KEY (`hotel_id`, `assigned_to`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_tasks_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_tasks_hotel_id_inspected_by_fkey` FOREIGN KEY (`hotel_id`, `inspected_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_hotel_id_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_id`) REFERENCES `rooms`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_hotel_id_reported_by_fkey` FOREIGN KEY (`hotel_id`, `reported_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_hotel_id_assigned_to_fkey` FOREIGN KEY (`hotel_id`, `assigned_to`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_hotel_id_resolved_by_fkey` FOREIGN KEY (`hotel_id`, `resolved_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_blocks` ADD CONSTRAINT `maintenance_blocks_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_blocks` ADD CONSTRAINT `maintenance_blocks_hotel_id_room_id_fkey` FOREIGN KEY (`hotel_id`, `room_id`) REFERENCES `rooms`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_blocks` ADD CONSTRAINT `maintenance_blocks_hotel_id_room_id_maintenance_ticket_id_fkey` FOREIGN KEY (`hotel_id`, `room_id`, `maintenance_ticket_id`) REFERENCES `maintenance_tickets`(`hotel_id`, `room_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_blocks` ADD CONSTRAINT `maintenance_blocks_hotel_id_created_by_fkey` FOREIGN KEY (`hotel_id`, `created_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `maintenance_blocks` ADD CONSTRAINT `maintenance_blocks_hotel_id_released_by_fkey` FOREIGN KEY (`hotel_id`, `released_by`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `operations_audit_logs` ADD CONSTRAINT `operations_audit_logs_hotel_id_actor_id_fkey` FOREIGN KEY (`hotel_id`, `actor_id`) REFERENCES `staff_users`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `operations_audit_logs` ADD CONSTRAINT `operations_audit_logs_hotel_id_task_id_fkey` FOREIGN KEY (`hotel_id`, `task_id`) REFERENCES `housekeeping_tasks`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `operations_audit_logs` ADD CONSTRAINT `operations_audit_logs_hotel_id_ticket_id_fkey` FOREIGN KEY (`hotel_id`, `ticket_id`) REFERENCES `maintenance_tickets`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `operations_audit_logs` ADD CONSTRAINT `operations_audit_logs_hotel_id_block_id_fkey` FOREIGN KEY (`hotel_id`, `block_id`) REFERENCES `maintenance_blocks`(`hotel_id`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Nulls release the unique active-room slot only for terminal tasks.
ALTER TABLE `housekeeping_tasks` ADD CONSTRAINT `housekeeping_active_slot_check` CHECK (
  (`status` IN ('PENDING', 'IN_PROGRESS', 'AWAITING_INSPECTION') AND `active_room_id` IS NOT NULL AND `active_room_id` = `room_id`)
  OR (`status` IN ('COMPLETED', 'CANCELLED') AND `active_room_id` IS NULL)
);
ALTER TABLE `maintenance_blocks` ADD CONSTRAINT `maintenance_interval_check` CHECK (
  `start_date` < `end_date` AND DATEDIFF(`end_date`, `start_date`) <= 365
);
ALTER TABLE `operations_audit_logs` ADD CONSTRAINT `operations_audit_entity_check` CHECK (
  (`task_id` IS NOT NULL) + (`ticket_id` IS NOT NULL) + (`block_id` IS NOT NULL) = 1
);
