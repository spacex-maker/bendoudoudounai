package com.bendoudou.server.diary;

import com.bendoudou.server.diary.dto.DevDiaryEntryDetail;
import com.bendoudou.server.diary.dto.DevDiaryPageResponse;
import com.bendoudou.server.diary.dto.PatchDevDiaryRequest;
import com.bendoudou.server.diary.dto.PostDevDiaryRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/diary/entries")
public class DevDiaryController {

    private final DevDiaryService devDiaryService;

    public DevDiaryController(DevDiaryService devDiaryService) {
        this.devDiaryService = devDiaryService;
    }

    @GetMapping
    public DevDiaryPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return devDiaryService.list(page, size);
    }

    @GetMapping("/{id}")
    public DevDiaryEntryDetail getOne(@PathVariable long id) {
        return devDiaryService.get(id);
    }

    @PostMapping
    public DevDiaryEntryDetail create(
            @Valid @RequestBody PostDevDiaryRequest body,
            Authentication auth
    ) {
        return devDiaryService.create(requireUserId(auth), body);
    }

    @PatchMapping("/{id}")
    public DevDiaryEntryDetail update(
            @PathVariable long id,
            @RequestBody PatchDevDiaryRequest body,
            Authentication auth
    ) {
        return devDiaryService.update(requireUserId(auth), id, body);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable long id, Authentication auth) {
        devDiaryService.delete(requireUserId(auth), id);
    }

    private static long requireUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "需要登录");
        }
        return Long.parseLong(auth.getName());
    }
}
