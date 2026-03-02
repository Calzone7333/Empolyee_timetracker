package com.employee.monitor.repository;

import com.employee.monitor.model.Screenshot;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface ScreenshotRepository extends JpaRepository<Screenshot, Long> {
    List<Screenshot> findByUserIdAndTimestampBetween(Long userId, LocalDateTime start, LocalDateTime end);

    List<Screenshot> findByUserId(Long userId);
}
