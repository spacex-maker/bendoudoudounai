package com.bendoudou.server.moments;

import com.bendoudou.server.moments.dto.CreateMomentPhotoRequest;
import com.bendoudou.server.moments.dto.CreateMomentUploadTicketRequest;
import com.bendoudou.server.moments.dto.MomentPhotoResponse;
import com.bendoudou.server.moments.dto.MomentUploadTicketResponse;
import com.bendoudou.server.moments.dto.PatchMomentPhotoRequest;
import com.bendoudou.server.moments.dto.MomentColorFacet;
import com.bendoudou.server.moments.dto.ReplaceMomentPhotoRequest;
import com.bendoudou.server.music.CosStorageService;
import com.bendoudou.server.music.CosStsService;
import com.bendoudou.server.music.dto.CosUploadTicketResponse;
import com.bendoudou.server.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class MomentService {
    private static final Logger log = LoggerFactory.getLogger(MomentService.class);
    private static final Set<String> ALLOWED_EXT = Set.of("jpg", "jpeg", "png", "webp", "gif", "heic");

    private final MomentPhotoRepository momentPhotoRepository;
    private final CosStorageService cosStorageService;
    private final CosStsService cosStsService;
    private final UserService userService;

    public MomentService(
            MomentPhotoRepository momentPhotoRepository,
            CosStorageService cosStorageService,
            CosStsService cosStsService,
            UserService userService
    ) {
        this.momentPhotoRepository = momentPhotoRepository;
        this.cosStorageService = cosStorageService;
        this.cosStsService = cosStsService;
        this.userService = userService;
    }

    public MomentUploadTicketResponse createUploadTicket(long adminId, CreateMomentUploadTicketRequest req) {
        userService.requireAdmin(adminId);
        if (!cosStsService.isUsable()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS 配置不可用");
        }
        String ext = req.ext() == null ? "" : req.ext().toLowerCase(Locale.ROOT).trim();
        if (ext.startsWith(".")) {
            ext = ext.substring(1);
        }
        if (!ALLOWED_EXT.contains(ext)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的图片格式");
        }
        String key = cosStorageService.buildMomentObjectKey(UUID.randomUUID().toString().replace("-", ""), ext);
        CosUploadTicketResponse raw = cosStsService.issueTicket(key, null, null);
        return new MomentUploadTicketResponse(
                raw.tmpSecretId(),
                raw.tmpSecretKey(),
                raw.sessionToken(),
                raw.startTime(),
                raw.expiredTime(),
                raw.bucket(),
                raw.region(),
                raw.host(),
                key
        );
    }

    @Transactional
    public MomentPhotoResponse create(long adminId, CreateMomentPhotoRequest req) {
        userService.requireAdmin(adminId);
        String key = req.objectKey() == null ? "" : req.objectKey().trim();
        if (!key.startsWith("bendoudou/moments/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "objectKey 非法");
        }
        if (momentPhotoRepository.existsByObjectKey(key)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该图片已登记");
        }
        MomentPhoto m = new MomentPhoto();
        m.setObjectKey(key);
        m.setPublicUrl(cosStorageService.publicObjectUrl(key));
        m.setWidth(req.width());
        m.setHeight(req.height());
        if (StringUtils.hasText(req.caption())) {
            m.setCaption(req.caption().trim());
        }
        m.setTakenAt(req.takenAt());
        applyColor(m, req.dominantHue(), req.dominantSat(), req.dominantLight(), req.paletteJson());
        m.setSortOrder(momentPhotoRepository.findMaxSortOrder() + 1);
        m.setCreatedAt(Instant.now());
        m.setCreatedByUserId(adminId);
        return toResponse(momentPhotoRepository.save(m));
    }

    @Transactional(readOnly = true)
    public Page<MomentPhotoResponse> list(
            long adminId,
            int page,
            int size,
            Integer hue,
            Integer tolerance,
            String mood,
            String sort
    ) {
        userService.requireAdmin(adminId);
        return listPublic(page, size, hue, tolerance, mood, sort);
    }

    @Transactional(readOnly = true)
    public Page<MomentPhotoResponse> listPublic(
            int page,
            int size,
            Integer hue,
            Integer tolerance,
            String mood,
            String sort
    ) {
        int p = Math.max(page, 0);
        int s = Math.min(Math.max(size, 1), 100);
        PageRequest pageable = PageRequest.of(p, s);
        boolean byHue = "hue".equalsIgnoreCase(sort);
        String moodKey = mood == null ? "" : mood.trim().toLowerCase(Locale.ROOT);

        Page<MomentPhoto> result;
        if (hue != null) {
            int h = ((hue % 360) + 360) % 360;
            int tol = tolerance == null ? 28 : Math.min(Math.max(tolerance, 5), 90);
            int lo = (h - tol + 360) % 360;
            int hi = (h + tol) % 360;
            Integer minSat = null;
            Integer maxSat = null;
            if ("vivid".equals(moodKey)) {
                minSat = 45;
            } else if ("soft".equals(moodKey)) {
                minSat = 12;
                maxSat = 44;
            }
            result = byHue
                    ? momentPhotoRepository.findByHueRangeOrderByHue(lo, hi, minSat, maxSat, pageable)
                    : momentPhotoRepository.findByHueRange(lo, hi, minSat, maxSat, pageable);
        } else if ("warm".equals(moodKey)) {
            result = byHue
                    ? momentPhotoRepository.findByHueRangeOrderByHue(330, 60, 18, null, pageable)
                    : momentPhotoRepository.findByHueRange(330, 60, 18, null, pageable);
        } else if ("cool".equals(moodKey)) {
            result = byHue
                    ? momentPhotoRepository.findByHueRangeOrderByHue(150, 250, 18, null, pageable)
                    : momentPhotoRepository.findByHueRange(150, 250, 18, null, pageable);
        } else if ("neutral".equals(moodKey)) {
            result = momentPhotoRepository.findNeutral(18, pageable);
        } else if ("vivid".equals(moodKey)) {
            result = byHue
                    ? momentPhotoRepository.findVividOrderByHue(45, pageable)
                    : momentPhotoRepository.findVivid(45, pageable);
        } else if ("soft".equals(moodKey)) {
            result = momentPhotoRepository.findSoft(12, 44, pageable);
        } else if (byHue) {
            result = momentPhotoRepository.findAllByOrderByDominantHueAscIdDesc(pageable);
        } else {
            result = momentPhotoRepository.findAllByOrderBySortOrderDescIdDesc(pageable);
        }
        return result.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<MomentColorFacet> colorFacets() {
        List<MomentColorFacet> out = new ArrayList<>();
        for (Object[] row : momentPhotoRepository.countColorBuckets()) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            int bucket = ((Number) row[0]).intValue();
            long count = ((Number) row[1]).longValue();
            if (count <= 0) {
                continue;
            }
            if (bucket < 0) {
                out.add(new MomentColorFacet(null, true, count));
            } else {
                int center = (bucket + 15) % 360;
                out.add(new MomentColorFacet(center, false, count));
            }
        }
        return out;
    }

    @Transactional
    public MomentPhotoResponse patch(long adminId, long id, PatchMomentPhotoRequest req) {
        userService.requireAdmin(adminId);
        MomentPhoto m = momentPhotoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "照片不存在"));
        if (req.caption() != null) {
            String c = req.caption().trim();
            m.setCaption(c.isEmpty() ? null : c);
        }
        if (req.sortOrder() != null) {
            m.setSortOrder(req.sortOrder());
        }
        if (Boolean.TRUE.equals(req.clearColor())) {
            m.setDominantHue(null);
            m.setDominantSat(null);
            m.setDominantLight(null);
            m.setPaletteJson(null);
        } else if (req.dominantHue() != null || req.paletteJson() != null
                || req.dominantSat() != null || req.dominantLight() != null) {
            applyColor(
                    m,
                    req.dominantHue() != null ? req.dominantHue() : m.getDominantHue(),
                    req.dominantSat() != null ? req.dominantSat() : m.getDominantSat(),
                    req.dominantLight() != null ? req.dominantLight() : m.getDominantLight(),
                    req.paletteJson() != null ? req.paletteJson() : m.getPaletteJson()
            );
        }
        return toResponse(momentPhotoRepository.save(m));
    }

    @Transactional
    public MomentPhotoResponse replace(long adminId, long id, ReplaceMomentPhotoRequest req) {
        userService.requireAdmin(adminId);
        MomentPhoto m = momentPhotoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "照片不存在"));
        String newKey = req.objectKey() == null ? "" : req.objectKey().trim();
        if (!newKey.startsWith("bendoudou/moments/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "objectKey 非法");
        }
        if (!newKey.equals(m.getObjectKey()) && momentPhotoRepository.existsByObjectKey(newKey)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该图片已登记");
        }
        String oldKey = m.getObjectKey();
        m.setObjectKey(newKey);
        m.setPublicUrl(cosStorageService.publicObjectUrl(newKey));
        m.setWidth(req.width());
        m.setHeight(req.height());
        applyColor(m, req.dominantHue(), req.dominantSat(), req.dominantLight(), req.paletteJson());
        MomentPhotoResponse saved = toResponse(momentPhotoRepository.save(m));
        if (!oldKey.equals(newKey)) {
            try {
                cosStorageService.deleteObject(oldKey);
            } catch (Exception e) {
                log.warn("Failed to delete replaced COS object {}: {}", oldKey, e.toString());
            }
        }
        return saved;
    }

    @Transactional
    public void delete(long adminId, long id) {
        userService.requireAdmin(adminId);
        MomentPhoto m = momentPhotoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "照片不存在"));
        String key = m.getObjectKey();
        momentPhotoRepository.delete(m);
        try {
            cosStorageService.deleteObject(key);
        } catch (Exception e) {
            log.warn("Failed to delete COS object {}: {}", key, e.toString());
        }
    }

    private static void applyColor(
            MomentPhoto m,
            Integer hue,
            Integer sat,
            Integer light,
            String paletteJson
    ) {
        if (sat != null && sat < 12) {
            m.setDominantHue(null);
        } else {
            m.setDominantHue(hue);
        }
        m.setDominantSat(sat);
        m.setDominantLight(light);
        if (StringUtils.hasText(paletteJson)) {
            String pj = paletteJson.trim();
            if (pj.length() > 1024) {
                pj = pj.substring(0, 1024);
            }
            m.setPaletteJson(pj);
        } else {
            m.setPaletteJson(null);
        }
    }

    private MomentPhotoResponse toResponse(MomentPhoto m) {
        String url = m.getPublicUrl();
        String thumb = url + (url.contains("?") ? "&" : "?") + "imageMogr2/thumbnail/800x/format/webp";
        String large = url + (url.contains("?") ? "&" : "?") + "imageMogr2/thumbnail/2400x/format/webp";
        return new MomentPhotoResponse(
                m.getId(),
                m.getObjectKey(),
                url,
                thumb,
                large,
                m.getWidth(),
                m.getHeight(),
                m.getCaption(),
                m.getTakenAt(),
                m.getSortOrder(),
                m.getCreatedAt(),
                m.getDominantHue(),
                m.getDominantSat(),
                m.getDominantLight(),
                m.getPaletteJson()
        );
    }
}
