package com.bendoudou.server.guestbook;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "guestbook_messages")
public class GuestbookMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 仅一层回复：子帖 parent_id 指向主楼，主楼为 null。不允许回复子帖。 */
    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "nickname", length = 32)
    private String nickname;

    @Column(name = "content", nullable = false, length = 2000)
    private String content;

    /**
     * 定向可见：为 null 时全员可见；非 null 时仅该站内用户与公开列表规则下可见（游客只能看到 null）。
     * 子帖与主楼同范围。
     */
    @Column(name = "visible_to_user_id")
    private Long visibleToUserId;

    /** 发帖用户（登录发帖时记录）；匿名发帖为 null。 */
    @Column(name = "author_user_id")
    private Long authorUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Long getVisibleToUserId() {
        return visibleToUserId;
    }

    public void setVisibleToUserId(Long visibleToUserId) {
        this.visibleToUserId = visibleToUserId;
    }

    public Long getAuthorUserId() {
        return authorUserId;
    }

    public void setAuthorUserId(Long authorUserId) {
        this.authorUserId = authorUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
