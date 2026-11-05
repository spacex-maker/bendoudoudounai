package com.bendoudou.server.moments;

import com.bendoudou.server.moments.dto.MomentColorFacet;
import com.bendoudou.server.moments.dto.MomentPhotoResponse;
import com.bendoudou.server.music.MusicService;
import com.bendoudou.server.music.dto.MusicTrackResponse;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 公开浏览片刻相册（只读）。上传/删改仍走 /api/admin/moments。 */
@RestController
@RequestMapping("/api/moments")
public class MomentsController {

    private final MomentService momentService;
    private final MusicService musicService;

    public MomentsController(MomentService momentService, MusicService musicService) {
        this.momentService = momentService;
        this.musicService = musicService;
    }

    @GetMapping
    public Page<MomentPhotoResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "40") int size,
            @RequestParam(required = false) Integer hue,
            @RequestParam(required = false) Integer tolerance,
            @RequestParam(required = false) String mood,
            @RequestParam(required = false) String sort
    ) {
        return momentService.listPublic(page, size, hue, tolerance, mood, sort);
    }

    @GetMapping("/color-facets")
    public List<MomentColorFacet> colorFacets() {
        return momentService.colorFacets();
    }

    /** 片刻精选歌单曲目（已随机打乱，供浏览页背景播放） */
    @GetMapping("/soundtrack")
    public List<MusicTrackResponse> soundtrack() {
        return musicService.listMomentsSoundtrackShuffled();
    }
}
