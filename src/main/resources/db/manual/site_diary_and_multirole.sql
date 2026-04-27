-- 可选：在禁用 ddl-auto 或首次上线时手工执行
-- 与 JPA 实体一致

CREATE TABLE IF NOT EXISTS `user_account_roles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `role` varchar(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`,`role`)
);

CREATE TABLE IF NOT EXISTS `site_dev_diaries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `body_md` longtext NOT NULL,
  `author_user_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `developer_role_applications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `status` varchar(16) NOT NULL,
  `message` varchar(1000) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `resolved_at` datetime(6) DEFAULT NULL,
  `resolved_by_user_id` bigint DEFAULT NULL,
  `resolution_note` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`)
);
