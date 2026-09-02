package com.bendoudou.server.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * 站点注册邀请码：一码一人；用户可拥有多枚（初始一枚，活动/管理员可增发）。
 */
@Entity
@Table(
        name = "invite_codes",
        uniqueConstraints = @UniqueConstraint(name = "uk_invite_codes_code", columnNames = "code"),
        indexes = {
                @Index(name = "idx_invite_codes_owner", columnList = "owner_user_id"),
                @Index(name = "idx_invite_codes_invitee", columnList = "invitee_user_id")
        }
)
public class InviteCode {

    public static final String SOURCE_INITIAL = "INITIAL";
    public static final String SOURCE_ADMIN = "ADMIN";
    public static final String SOURCE_ACTIVITY = "ACTIVITY";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String code;

    @Column(name = "owner_user_id", nullable = false)
    private Long ownerUserId;

    /** INITIAL / ADMIN / ACTIVITY */
    @Column(nullable = false, length = 32)
    private String source = SOURCE_INITIAL;

    @Column(name = "invitee_user_id")
    private Long inviteeUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "used_at")
    private Instant usedAt;

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public Long getOwnerUserId() {
        return ownerUserId;
    }

    public void setOwnerUserId(Long ownerUserId) {
        this.ownerUserId = ownerUserId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Long getInviteeUserId() {
        return inviteeUserId;
    }

    public void setInviteeUserId(Long inviteeUserId) {
        this.inviteeUserId = inviteeUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public void setUsedAt(Instant usedAt) {
        this.usedAt = usedAt;
    }

    public boolean isUsed() {
        return inviteeUserId != null;
    }
}
