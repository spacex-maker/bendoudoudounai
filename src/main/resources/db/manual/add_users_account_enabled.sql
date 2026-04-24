-- 禁用登录与 JWT 校验时拒绝未启用账号
ALTER TABLE `users`
  ADD COLUMN `account_enabled` TINYINT(1) NOT NULL DEFAULT 1
  COMMENT '0=禁用，不可登录且现有 Token 视为未登录' AFTER `role`;
