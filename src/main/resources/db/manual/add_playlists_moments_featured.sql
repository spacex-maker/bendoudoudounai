-- 片刻精选歌单标记（全站建议仅一条为 1）
ALTER TABLE playlists
  ADD COLUMN moments_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER is_default;
