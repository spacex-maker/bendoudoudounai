package com.bendoudou.server.music.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PostTrackCommentRequest(
        Long parentId,
        @NotBlank(message = "评论内容不能为空")
        @Size(max = 1200, message = "评论内容过长")
        String content
) {}
