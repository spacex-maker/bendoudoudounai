package com.bendoudou.server.bean;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "user_bean_transaction",
    indexes = @Index(name = "idx_ubt_user_created", columnList = "user_id, created_at")
)
public class UserBeanTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Positive = earned, negative = spent */
    @Column(nullable = false)
    private int delta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private BeanTransactionReason reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", length = 32)
    private BeanActionType actionType;

    @Column(name = "related_id")
    private Long relatedId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public int getDelta() { return delta; }
    public void setDelta(int delta) { this.delta = delta; }

    public BeanTransactionReason getReason() { return reason; }
    public void setReason(BeanTransactionReason reason) { this.reason = reason; }

    public BeanActionType getActionType() { return actionType; }
    public void setActionType(BeanActionType actionType) { this.actionType = actionType; }

    public Long getRelatedId() { return relatedId; }
    public void setRelatedId(Long relatedId) { this.relatedId = relatedId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
