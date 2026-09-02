package com.bendoudou.server.music;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(
        name = "music_tracks",
        indexes = {
                @Index(name = "idx_music_file_sha256", columnList = "file_sha256")
        }
)
public class MusicTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "playlist_id", nullable = false)
    private Long playlistId;

    @Column(nullable = false, length = 512)
    private String title;

    @Column(nullable = false, length = 512)
    private String artist;

    @Column(nullable = false, length = 512)
    private String album;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "duration_seconds", nullable = false)
    private int durationSeconds;

    @Column(name = "original_filename", nullable = false, length = 512)
    private String originalFilename;

    /**
     * 相对 music-upload-dir，如 7/a1b2c3d4.mp3；COS 模式下为对象 key（songs/... 或本应用前缀下路径）。
     */
    @Column(name = "stored_relpath", length = 1024)
    private String storedRelpath;

    /** 文件内容 SHA-256 十六进制，用于去重 */
    @Column(name = "file_sha256", length = 64)
    private String fileSha256;

    /** 音频公网可访问地址（通常为 COS 默认域名） */
    @Column(name = "audio_url", length = 1024)
    private String audioUrl;

    /** 歌词文件在 COS 上的公网地址（.lrc 等），可空 */
    @Column(name = "lyrics_url", length = 1024)
    private String lyricsUrl;

    /**
     * 无 COS 时，歌词相对 music-upload-dir，如 lyrics/ab/abcd...ef.lrc（与 file_sha256 对应）
     */
    @Column(name = "lyrics_stored_relpath", length = 1024)
    private String lyricsStoredRelpath;

    /** 封面 COS 公网 URL，可空 */
    @Column(name = "cover_url", length = 1024)
    private String coverUrl;

    /** 无 COS 时封面相对 music-upload-dir，如 covers/ab/{sha256}.jpg */
    @Column(name = "cover_stored_relpath", length = 1024)
    private String coverStoredRelpath;

    /** 翻译歌词（tlyric）COS 公网地址，可空 */
    @Column(name = "translated_lyrics_url", columnDefinition = "text")
    private String translatedLyricsUrl;

    @Column(name = "translated_lyrics_stored_relpath", columnDefinition = "text")
    private String translatedLyricsStoredRelpath;

    /** 罗马音歌词（romalrc） */
    @Column(name = "roma_lyrics_url", columnDefinition = "text")
    private String romaLyricsUrl;

    @Column(name = "roma_lyrics_stored_relpath", columnDefinition = "text")
    private String romaLyricsStoredRelpath;

    /** 逐字歌词（yrc） */
    @Column(name = "yrc_lyrics_url", columnDefinition = "text")
    private String yrcLyricsUrl;

    @Column(name = "yrc_lyrics_stored_relpath", columnDefinition = "text")
    private String yrcLyricsStoredRelpath;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "mime_type", length = 128)
    private String mimeType;

    /**
     * 主要元数据（歌名/歌手/专辑/时长）是否从文件内嵌信息解析
     */
    @Column(name = "metadata_from_file", nullable = false)
    private boolean metadataFromFile;

    /** 实际入库音质：standard / higher / exhigh / lossless / hires；非网易云可空 */
    @Column(name = "audio_quality", length = 32)
    private String audioQuality;

    /** 网易云歌曲 id（导入曲） */
    @Column(name = "netease_song_id")
    private Long neteaseSongId;

    /** 网易云专辑 id */
    @Column(name = "album_id")
    private Long albumId;

    /** 歌手列表 JSON：[{"id":1,"name":"..."}] */
    @Column(name = "artists_json", columnDefinition = "text")
    private String artistsJson;

    /** 别名 alia，多个用 " / " 拼接 */
    @Column(name = "title_alias", columnDefinition = "text")
    private String titleAlias;

    /** 译名 tns */
    @Column(name = "title_translated", columnDefinition = "text")
    private String titleTranslated;

    /** 专辑艺人 */
    @Column(name = "album_artist", length = 512)
    private String albumArtist;

    /** 发行年（由 publishTime 推算） */
    @Column(name = "release_year")
    private Integer releaseYear;

    /** 网易云 song detail 原始 JSON（单曲节点），便于日后补字段 */
    @Column(name = "source_detail_json", columnDefinition = "LONGTEXT")
    private String sourceDetailJson;

    /** 累计播放次数（每次开始播放计一次，由前端配合去重） */
    @Column(name = "play_count", nullable = false, columnDefinition = "bigint default 0")
    private long playCount = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

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

    public Long getPlaylistId() {
        return playlistId;
    }

    public void setPlaylistId(Long playlistId) {
        this.playlistId = playlistId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getArtist() {
        return artist;
    }

    public void setArtist(String artist) {
        this.artist = artist;
    }

    public String getAlbum() {
        return album;
    }

    public void setAlbum(String album) {
        this.album = album;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public int getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(int durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    public String getStoredRelpath() {
        return storedRelpath;
    }

    public void setStoredRelpath(String storedRelpath) {
        this.storedRelpath = storedRelpath;
    }

    public String getFileSha256() {
        return fileSha256;
    }

    public void setFileSha256(String fileSha256) {
        this.fileSha256 = fileSha256;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String audioUrl) {
        this.audioUrl = audioUrl;
    }

    public String getLyricsUrl() {
        return lyricsUrl;
    }

    public void setLyricsUrl(String lyricsUrl) {
        this.lyricsUrl = lyricsUrl;
    }

    public String getLyricsStoredRelpath() {
        return lyricsStoredRelpath;
    }

    public void setLyricsStoredRelpath(String lyricsStoredRelpath) {
        this.lyricsStoredRelpath = lyricsStoredRelpath;
    }

    public String getCoverUrl() {
        return coverUrl;
    }

    public void setCoverUrl(String coverUrl) {
        this.coverUrl = coverUrl;
    }

    public String getCoverStoredRelpath() {
        return coverStoredRelpath;
    }

    public void setCoverStoredRelpath(String coverStoredRelpath) {
        this.coverStoredRelpath = coverStoredRelpath;
    }

    public String getTranslatedLyricsUrl() {
        return translatedLyricsUrl;
    }

    public void setTranslatedLyricsUrl(String translatedLyricsUrl) {
        this.translatedLyricsUrl = translatedLyricsUrl;
    }

    public String getTranslatedLyricsStoredRelpath() {
        return translatedLyricsStoredRelpath;
    }

    public void setTranslatedLyricsStoredRelpath(String translatedLyricsStoredRelpath) {
        this.translatedLyricsStoredRelpath = translatedLyricsStoredRelpath;
    }

    public String getRomaLyricsUrl() {
        return romaLyricsUrl;
    }

    public void setRomaLyricsUrl(String romaLyricsUrl) {
        this.romaLyricsUrl = romaLyricsUrl;
    }

    public String getRomaLyricsStoredRelpath() {
        return romaLyricsStoredRelpath;
    }

    public void setRomaLyricsStoredRelpath(String romaLyricsStoredRelpath) {
        this.romaLyricsStoredRelpath = romaLyricsStoredRelpath;
    }

    public String getYrcLyricsUrl() {
        return yrcLyricsUrl;
    }

    public void setYrcLyricsUrl(String yrcLyricsUrl) {
        this.yrcLyricsUrl = yrcLyricsUrl;
    }

    public String getYrcLyricsStoredRelpath() {
        return yrcLyricsStoredRelpath;
    }

    public void setYrcLyricsStoredRelpath(String yrcLyricsStoredRelpath) {
        this.yrcLyricsStoredRelpath = yrcLyricsStoredRelpath;
    }

    public String getAudioQuality() {
        return audioQuality;
    }

    public void setAudioQuality(String audioQuality) {
        this.audioQuality = audioQuality;
    }

    public Long getNeteaseSongId() {
        return neteaseSongId;
    }

    public void setNeteaseSongId(Long neteaseSongId) {
        this.neteaseSongId = neteaseSongId;
    }

    public Long getAlbumId() {
        return albumId;
    }

    public void setAlbumId(Long albumId) {
        this.albumId = albumId;
    }

    public String getArtistsJson() {
        return artistsJson;
    }

    public void setArtistsJson(String artistsJson) {
        this.artistsJson = artistsJson;
    }

    public String getTitleAlias() {
        return titleAlias;
    }

    public void setTitleAlias(String titleAlias) {
        this.titleAlias = titleAlias;
    }

    public String getTitleTranslated() {
        return titleTranslated;
    }

    public void setTitleTranslated(String titleTranslated) {
        this.titleTranslated = titleTranslated;
    }

    public String getAlbumArtist() {
        return albumArtist;
    }

    public void setAlbumArtist(String albumArtist) {
        this.albumArtist = albumArtist;
    }

    public Integer getReleaseYear() {
        return releaseYear;
    }

    public void setReleaseYear(Integer releaseYear) {
        this.releaseYear = releaseYear;
    }

    public String getSourceDetailJson() {
        return sourceDetailJson;
    }

    public void setSourceDetailJson(String sourceDetailJson) {
        this.sourceDetailJson = sourceDetailJson;
    }

    public long getFileSize() {
        return fileSize;
    }

    public void setFileSize(long fileSize) {
        this.fileSize = fileSize;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public boolean isMetadataFromFile() {
        return metadataFromFile;
    }

    public void setMetadataFromFile(boolean metadataFromFile) {
        this.metadataFromFile = metadataFromFile;
    }

    public long getPlayCount() {
        return playCount;
    }

    public void setPlayCount(long playCount) {
        this.playCount = playCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
