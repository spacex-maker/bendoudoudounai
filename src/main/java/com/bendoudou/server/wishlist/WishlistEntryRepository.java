package com.bendoudou.server.wishlist;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WishlistEntryRepository extends JpaRepository<WishlistEntry, Long> {

    Page<WishlistEntry> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
