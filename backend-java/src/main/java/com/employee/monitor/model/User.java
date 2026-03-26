package com.employee.monitor.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String employeeId;
    private String name;
    private String userName;
    private String email;
    private String computerName;
    private String role;
    private String status;
    private String department;
    private String team;
    private String password;
    private LocalDate joinDate;
    private LocalDateTime lastActive;
    private Integer screenshotInterval = 60; // default 60 seconds
}
