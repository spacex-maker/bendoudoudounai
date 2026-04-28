package com.bendoudou.server.bean;

import jakarta.persistence.*;

@Entity
@Table(name = "bean_level", indexes = {
        @Index(name = "idx_bean_level_min", columnList = "min_beans")
})
public class BeanLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String code;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "min_beans", nullable = false)
    private long minBeans;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public long getMinBeans() {
        return minBeans;
    }

    public void setMinBeans(long minBeans) {
        this.minBeans = minBeans;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
