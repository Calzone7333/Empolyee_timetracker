package com.employee.monitor.dto;

import lombok.Data;

@Data
public class RegistrationRequest {
    private String computerName;
    private String userName;
    private String email;
}
