package com.bendoudou.server.music;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MusicTrackCommentRepository extends JpaRepository<MusicTrackComment, Long> {

    Page<MusicTrackComment> findByTrackIdAndParentIdIsNullOrderByCreatedAtDesc(long trackId, Pageable pageable);

    List<MusicTrackComment> findByParentIdInOrderByCreatedAtAsc(Collection<Long> parentIds);

    List<MusicTrackComment> findByTrackId(long trackId);

    void deleteByTrackId(long trackId);
}
