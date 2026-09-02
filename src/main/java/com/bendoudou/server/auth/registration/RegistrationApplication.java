package com.bendoudou.server.auth.registration;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * 无邀请码的注册申请：管理员审核通过后创建账号。
 */
@Entity
@Table(
        name = "registration_applications",
        indexes = {
                @Index(name = "idx_reg_app_email", columnList = "email"),
                @Index(name = "idx_reg_app_status", columnList = "status")
        }
)
public class RegistrationApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", length = 255)
    private String displayName;

    /** 申请留言（可选） */
    @Column(length = 1000)
    private String message;

    /** 界面语言，用于拒绝邮件文案 */
    @Column(length = 16)
    private String locale;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RegistrationApplicationStatus status = RegistrationApplicationStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by_user_id")
    private Long resolvedByUserId;

    /** 拒绝原因（拒绝时必填） */
    @Column(name = "resolution_note", length = 1000)
    private String resolutionNote;

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getLocale() {
        return locale;
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    public RegistrationApplicationStatus getStatus() {
        return status;
    }

    public void setStatus(RegistrationApplicationStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Long getResolvedByUserId() {
        return resolvedByUserId;
    }

    public void setResolvedByUserId(Long resolvedByUserId) {
        this.resolvedByUserId = resolvedByUserId;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public void setResolutionNote(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }
}
