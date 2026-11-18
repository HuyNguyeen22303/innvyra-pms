ALTER TABLE `stock_issues`
  ADD COLUMN `request_key_hash` CHAR(64) NULL,
  ADD COLUMN `request_hash` CHAR(64) NULL,
  ADD UNIQUE INDEX `stock_issues_request_key` (`hotel_id`, `created_by`, `request_key_hash`);
