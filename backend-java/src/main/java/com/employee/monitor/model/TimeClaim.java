package com.employee.monitor.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "time_claims")
public class TimeClaim {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private LocalDate claimDate;
    private String duration; // e.g., "01:30"
    private String reason;
    private String status; // "Pending", "Approved", "Rejected"
    private LocalDateTime submittedAt;
}
