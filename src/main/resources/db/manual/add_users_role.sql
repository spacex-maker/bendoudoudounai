-- 与 JPA User.role（UserRole: USER, ADMIN）对应；老库/手动建表未包含时执行一次即可。
-- CHARACTER SET / COLLATION 须紧跟在类型后，再写 NOT NULL、DEFAULT（MySQL 语法）。
ALTER TABLE `users`
  ADD COLUMN `role` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_german2_ci NOT NULL DEFAULT 'USER';
