package com.bendoudou.server.bean;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "bean_rule")
public class BeanRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, unique = true, length = 32)
    private BeanActionType actionType;

    @Column(name = "bean_delta", nullable = false)
    private int beanDelta;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public BeanActionType getActionType() {
        return actionType;
    }

    public void setActionType(BeanActionType actionType) {
        this.actionType = actionType;
    }

    public int getBeanDelta() {
        return beanDelta;
    }

    public void setBeanDelta(int beanDelta) {
        this.beanDelta = beanDelta;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
