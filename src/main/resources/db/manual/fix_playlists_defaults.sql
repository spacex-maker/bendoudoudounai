-- 补默认值，避免 JPA insert 未带列时报错
ALTER TABLE playlists
  MODIFY COLUMN is_library_bucket TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY COLUMN moments_featured TINYINT(1) NOT NULL DEFAULT 0;
