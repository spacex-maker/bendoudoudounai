-- 留言板：记录发帖用户 id，便于登录用户看到自己发出的定向主楼；执行一次即可。
-- 若列已存在会报错，可忽略或按需注释掉本段。

ALTER TABLE guestbook_messages
  ADD COLUMN author_user_id BIGINT NULL COMMENT '发帖用户 id，匿名为 NULL';

CREATE INDEX idx_guestbook_author_user_id ON guestbook_messages (author_user_id);
