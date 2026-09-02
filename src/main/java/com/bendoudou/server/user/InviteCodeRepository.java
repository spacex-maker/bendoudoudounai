package com.bendoudou.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InviteCodeRepository extends JpaRepository<InviteCode, Long> {

    Optional<InviteCode> findByCode(String code);

    boolean existsByCode(String code);

    long countByOwnerUserId(long ownerUserId);

    long countByOwnerUserIdAndInviteeUserIdIsNull(long ownerUserId);

    List<InviteCode> findByOwnerUserIdOrderByCreatedAtDesc(long ownerUserId);

    List<InviteCode> findByOwnerUserIdAndInviteeUserIdIsNotNullOrderByUsedAtDesc(long ownerUserId);
}
