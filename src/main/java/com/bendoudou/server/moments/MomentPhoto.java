package com.bendoudou.server.moments;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "moment_photos")
public class MomentPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "object_key", nullable = false, length = 512)
    private String objectKey;

    @Column(name = "public_url", nullable = false, length = 1024)
    private String publicUrl;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "caption", length = 200)
    private String caption;

    @Column(name = "taken_at")
    private Instant takenAt;

    @Column(name = "sort_order", nullable = false)
    private long sortOrder = 0L;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    /** 主色相 0–359；低饱和记为 null（中性灰） */
    @Column(name = "dominant_hue")
    private Integer dominantHue;

    /** 主色平均饱和度 0–100 */
    @Column(name = "dominant_sat")
    private Integer dominantSat;

    /** 主色平均明度 0–100 */
    @Column(name = "dominant_light")
    private Integer dominantLight;

    /** 色板 JSON：[{"hex":"#aabbcc","h":12,"s":40,"l":55}, ...] */
    @Column(name = "palette_json", length = 1024)
    private String paletteJson;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public void setObjectKey(String objectKey) {
        this.objectKey = objectKey;
    }

    public String getPublicUrl() {
        return publicUrl;
    }

    public void setPublicUrl(String publicUrl) {
        this.publicUrl = publicUrl;
    }

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public Integer getHeight() {
        return height;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }

    public String getCaption() {
        return caption;
    }

    public void setCaption(String caption) {
        this.caption = caption;
    }

    public Instant getTakenAt() {
        return takenAt;
    }

    public void setTakenAt(Instant takenAt) {
        this.takenAt = takenAt;
    }

    public long getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(long sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public Integer getDominantHue() {
        return dominantHue;
    }

    public void setDominantHue(Integer dominantHue) {
        this.dominantHue = dominantHue;
    }

    public Integer getDominantSat() {
        return dominantSat;
    }

    public void setDominantSat(Integer dominantSat) {
        this.dominantSat = dominantSat;
    }

    public Integer getDominantLight() {
        return dominantLight;
    }

    public void setDominantLight(Integer dominantLight) {
        this.dominantLight = dominantLight;
    }

    public String getPaletteJson() {
        return paletteJson;
    }

    public void setPaletteJson(String paletteJson) {
        this.paletteJson = paletteJson;
    }
}
