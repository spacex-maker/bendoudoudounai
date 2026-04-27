-- 歌曲评论（一级评论 + 一级回复）与评论点赞

CREATE TABLE IF NOT EXISTS music_track_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  track_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  user_id BIGINT NOT NULL,
  content VARCHAR(1200) NOT NULL,
  like_count BIGINT NOT NULL DEFAULT 0,
  reply_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mtc_track_parent_created (track_id, parent_id, created_at DESC),
  INDEX idx_mtc_parent_created (parent_id, created_at ASC),
  INDEX idx_mtc_user_created (user_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS music_track_comment_likes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  comment_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_mtcl_comment_user (comment_id, user_id),
  INDEX idx_mtcl_user_created (user_id, created_at DESC)
);
