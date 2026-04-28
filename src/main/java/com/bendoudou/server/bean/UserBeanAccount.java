package com.bendoudou.server.bean;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "user_bean_account")
public class UserBeanAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false)
    private long balance = 0L;

    @Column(name = "last_daily_award_date")
    private LocalDate lastDailyAwardDate;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public long getBalance() { return balance; }
    public void setBalance(long balance) { this.balance = balance; }

    public LocalDate getLastDailyAwardDate() { return lastDailyAwardDate; }
    public void setLastDailyAwardDate(LocalDate lastDailyAwardDate) { this.lastDailyAwardDate = lastDailyAwardDate; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
