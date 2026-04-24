-- 用户红心歌曲（JPA ddl-auto: update 也会建表；此脚本供手工执行或核对）
CREATE TABLE IF NOT EXISTS user_track_hearts (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    track_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_user_track_heart (user_id, track_id),
    KEY idx_uth_user (user_id),
    KEY idx_uth_track (track_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
