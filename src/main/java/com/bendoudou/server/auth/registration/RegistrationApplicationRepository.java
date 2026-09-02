package com.bendoudou.server.auth.registration;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RegistrationApplicationRepository extends JpaRepository<RegistrationApplication, Long> {

    boolean existsByEmailAndStatus(String email, RegistrationApplicationStatus status);

    Optional<RegistrationApplication> findFirstByEmailOrderByCreatedAtDesc(String email);

    List<RegistrationApplication> findByStatusOrderByCreatedAtAsc(RegistrationApplicationStatus status);

    List<RegistrationApplication> findAllByOrderByCreatedAtDesc();
}
