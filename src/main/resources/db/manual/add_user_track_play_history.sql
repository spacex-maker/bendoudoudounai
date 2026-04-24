-- 用户最近播放历史（JPA ddl-auto: update 也会建表；此脚本供手工执行或核对）
CREATE TABLE IF NOT EXISTS user_track_play_history (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    track_id BIGINT NOT NULL,
    played_at DATETIME(6) NOT NULL,
    KEY idx_utph_user_played (user_id, played_at),
    KEY idx_utph_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

