package com.employee.monitor.dto;

import lombok.Data;

@Data
public class ScreenshotUploadRequest {
    private Long userId;
    private String imageBase64;
    private String timestamp;
}
