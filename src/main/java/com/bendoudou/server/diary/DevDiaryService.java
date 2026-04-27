package com.bendoudou.server.diary;

import com.bendoudou.server.diary.dto.DevDiaryEntryDetail;
import com.bendoudou.server.diary.dto.DevDiaryEntryListItem;
import com.bendoudou.server.diary.dto.DevDiaryPageResponse;
import com.bendoudou.server.diary.dto.PatchDevDiaryRequest;
import com.bendoudou.server.diary.dto.PostDevDiaryRequest;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import com.bendoudou.server.user.UserRole;
import com.bendoudou.server.user.AccountRoleService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

@Service
public class DevDiaryService {

    private final SiteDevDiaryRepository diaryRepository;
    private final UserRepository userRepository;
    private final AccountRoleService accountRoleService;

    public DevDiaryService(
            SiteDevDiaryRepository diaryRepository,
            UserRepository userRepository,
            AccountRoleService accountRoleService
    ) {
        this.diaryRepository = diaryRepository;
        this.userRepository = userRepository;
        this.accountRoleService = accountRoleService;
    }

    @Transactional(readOnly = true)
    public DevDiaryPageResponse list(int page, int size) {
        Pageable p = PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size)));
        Page<SiteDevDiary> pg = diaryRepository.findAllByOrderByCreatedAtDesc(p);
        return new DevDiaryPageResponse(
                pg.getContent().stream().map(this::toListItem).collect(Collectors.toList()),
                pg.getTotalElements(),
                pg.getTotalPages(),
                pg.getNumber(),
                pg.getSize()
        );
    }

    @Transactional(readOnly = true)
    public DevDiaryEntryDetail get(long id) {
        return diaryRepository.findById(id)
                .map(d -> toDetail(d, true))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "日记不存在"));
    }

    @Transactional
    public DevDiaryEntryDetail create(long userId, PostDevDiaryRequest req) {
        assertCanManage(userId);
        String t = req.title() != null ? req.title().trim() : "";
        if (!StringUtils.hasText(t)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写标题");
        }
        SiteDevDiary d = new SiteDevDiary();
        d.setTitle(t.length() > 200 ? t.substring(0, 200) : t);
        d.setBodyMd(StringUtils.hasText(req.bodyMd()) ? req.bodyMd() : "");
        d.setAuthorUserId(userId);
        d = diaryRepository.save(d);
        return toDetail(d, true);
    }

    @Transactional
    public DevDiaryEntryDetail update(long userId, long id, PatchDevDiaryRequest req) {
        assertCanManage(userId);
        SiteDevDiary d = diaryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "日记不存在"));
        if (req.title() != null) {
            String t = req.title().trim();
            if (!StringUtils.hasText(t)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "标题不能为空");
            }
            d.setTitle(t.length() > 200 ? t.substring(0, 200) : t);
        }
        if (req.bodyMd() != null) {
            d.setBodyMd(req.bodyMd());
        }
        d.setUpdatedAt(java.time.Instant.now());
        d = diaryRepository.save(d);
        return toDetail(d, true);
    }

    @Transactional
    public void delete(long userId, long id) {
        assertCanManage(userId);
        if (!diaryRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "日记不存在");
        }
        diaryRepository.deleteById(id);
    }

    private void assertCanManage(long userId) {
        if (accountRoleService.hasRole(userId, UserRole.DEVELOPER)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "需要开发者身份");
    }

    private DevDiaryEntryListItem toListItem(SiteDevDiary d) {
        return new DevDiaryEntryListItem(
                d.getId(),
                d.getTitle(),
                d.getAuthorUserId(),
                authorLabel(d.getAuthorUserId()),
                d.getCreatedAt().toEpochMilli()
        );
    }

    private DevDiaryEntryDetail toDetail(SiteDevDiary d, boolean withBody) {
        return new DevDiaryEntryDetail(
                d.getId(),
                d.getTitle(),
                withBody ? d.getBodyMd() : null,
                d.getAuthorUserId(),
                authorLabel(d.getAuthorUserId()),
                d.getCreatedAt().toEpochMilli(),
                d.getUpdatedAt().toEpochMilli()
        );
    }

    private String authorLabel(long userId) {
        User u = userRepository.findById(userId).orElse(null);
        if (u == null) {
            return "?";
        }
        if (u.getDisplayName() != null && !u.getDisplayName().isBlank()) {
            return u.getDisplayName().trim();
        }
        return u.getEmail();
    }
}
