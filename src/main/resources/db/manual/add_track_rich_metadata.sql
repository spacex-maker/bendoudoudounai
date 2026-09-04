-- 网易云导入富元数据 / 多版歌词（与 MusicTrack 实体对齐）
-- 注意：utf8mb4 下大量 VARCHAR(1024) 易触发 InnoDB 行宽 65535 限制，长字段用 TEXT。
-- 可按列单独执行；已存在则跳过。

ALTER TABLE music_tracks ADD COLUMN translated_lyrics_url TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN translated_lyrics_stored_relpath TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN roma_lyrics_url TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN roma_lyrics_stored_relpath TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN yrc_lyrics_url TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN yrc_lyrics_stored_relpath TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN audio_quality VARCHAR(32) NULL;
ALTER TABLE music_tracks ADD COLUMN netease_song_id BIGINT NULL;
ALTER TABLE music_tracks ADD COLUMN album_id BIGINT NULL;
ALTER TABLE music_tracks ADD COLUMN artists_json TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN title_alias TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN title_translated TEXT NULL;
ALTER TABLE music_tracks ADD COLUMN album_artist VARCHAR(512) NULL;
ALTER TABLE music_tracks ADD COLUMN release_year INT NULL;
ALTER TABLE music_tracks ADD COLUMN source_detail_json LONGTEXT NULL;
