package com.bendoudou.server.music;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Set;

public interface MusicTrackCommentLikeRepository extends JpaRepository<MusicTrackCommentLike, Long> {

    boolean existsByCommentIdAndUserId(long commentId, long userId);

    void deleteByCommentIdAndUserId(long commentId, long userId);

    void deleteByCommentIdIn(Collection<Long> commentIds);

    @Query("select l.commentId from MusicTrackCommentLike l where l.userId = :userId and l.commentId in :ids")
    Set<Long> findLikedCommentIds(@Param("userId") long userId, @Param("ids") Collection<Long> ids);
}
