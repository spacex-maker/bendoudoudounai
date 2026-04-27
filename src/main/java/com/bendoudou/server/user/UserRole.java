package com.bendoudou.server.user;

/**
 * 站内用户角色；管理员可进入后台（功能后续迭代）。
 */
public enum UserRole {
    USER,
    ADMIN,
    /** 可撰写与管理「开发日记」等站点更新内容，可与 USER/ADMIN 并存 */
    DEVELOPER
}
