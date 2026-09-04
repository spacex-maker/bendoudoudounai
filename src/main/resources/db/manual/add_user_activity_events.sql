-- 用户操作痕迹（JPA ddl-auto: update 也会建表；此脚本供手工核对）
CREATE TABLE IF NOT EXISTS user_activity_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  action VARCHAR(64) NOT NULL,
  scope VARCHAR(32) NULL,
  query VARCHAR(512) NULL,
  target_type VARCHAR(32) NULL,
  target_id BIGINT NULL,
  detail_json TEXT NULL,
  client_ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME(6) NOT NULL,
  KEY idx_activity_user_time (user_id, created_at),
  KEY idx_activity_action_time (action, created_at),
  KEY idx_activity_user_action (user_id, action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
