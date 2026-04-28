package com.bendoudou.server.user;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "user_login_record", indexes = {
        @Index(name = "idx_login_user_time", columnList = "user_id, login_at")
})
public class UserLoginRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "login_at", nullable = false)
    private Instant loginAt = Instant.now();

    @Column(name = "client_ip", length = 64)
    private String clientIp;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Instant getLoginAt() {
        return loginAt;
    }

    public void setLoginAt(Instant loginAt) {
        this.loginAt = loginAt;
    }

    public String getClientIp() {
        return clientIp;
    }

    public void setClientIp(String clientIp) {
        this.clientIp = clientIp;
    }
}
