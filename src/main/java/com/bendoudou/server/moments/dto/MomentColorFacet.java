package com.bendoudou.server.moments.dto;

/** 主色调分桶：hue 为桶中心 0–359；neutral=true 表示灰/低饱和。 */
public record MomentColorFacet(
        Integer hue,
        boolean neutral,
        long count
) {}
