-- AlterTable
ALTER TABLE `housekeeping_material_presets` ADD COLUMN `usage_basis` VARCHAR(20) NOT NULL DEFAULT 'PER_ROOM';

-- AlterTable
ALTER TABLE `housekeeping_material_completions` ADD COLUMN `prepared_adults` SMALLINT UNSIGNED NULL,
    ADD COLUMN `prepared_children` SMALLINT UNSIGNED NULL;

ALTER TABLE `housekeeping_material_presets` ADD CONSTRAINT `housekeeping_presets_basis_check` CHECK (`usage_basis` IN ('PER_ROOM','PER_GUEST'));
ALTER TABLE `housekeeping_material_completions` ADD CONSTRAINT `housekeeping_preparation_counts_check` CHECK ((`prepared_adults` IS NULL AND `prepared_children` IS NULL) OR (`prepared_adults` IS NOT NULL AND `prepared_children` IS NOT NULL AND `prepared_adults` > 0));
