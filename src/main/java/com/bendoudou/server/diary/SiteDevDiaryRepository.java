package com.bendoudou.server.diary;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteDevDiaryRepository extends JpaRepository<SiteDevDiary, Long> {
    Page<SiteDevDiary> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
