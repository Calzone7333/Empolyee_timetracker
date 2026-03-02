package com.employee.monitor.repository;

import com.employee.monitor.model.TimeClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TimeClaimRepository extends JpaRepository<TimeClaim, Long> {
    List<TimeClaim> findByUserId(Long userId);
}
