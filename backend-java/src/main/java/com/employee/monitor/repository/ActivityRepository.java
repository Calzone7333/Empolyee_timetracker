package com.employee.monitor.repository;

import com.employee.monitor.model.Activity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface ActivityRepository extends JpaRepository<Activity, Long> {
    List<Activity> findByUserIdAndTimestampBetween(Long userId, LocalDateTime start, LocalDateTime end);

    List<Activity> findByUserId(Long userId);
}
