package com.employee.monitor.controller;

import com.employee.monitor.dto.ScreenshotUploadRequest;
import com.employee.monitor.model.Screenshot;
import com.employee.monitor.repository.ScreenshotRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/screenshots")
@CrossOrigin(origins = "*")
public class ScreenshotController {

    @Autowired
    private ScreenshotRepository screenshotRepository;

    private final String uploadDir = "./uploads";

    @PostMapping("/upload")
    public Map<String, Object> upload(@RequestBody ScreenshotUploadRequest request) {
        try {
            Path path = Paths.get(uploadDir);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }

            String fileName = "screenshot_" + request.getUserId() + "_" + System.currentTimeMillis() + ".jpg";
            String filePath = uploadDir + "/" + fileName;

            String base64Data = request.getImageBase64().replaceFirst("data:image/\\w+;base64,", "");
            byte[] imageBytes = Base64.getDecoder().decode(base64Data);

            try (FileOutputStream fos = new FileOutputStream(filePath)) {
                fos.write(imageBytes);
            }

            Screenshot screenshot = new Screenshot();
            screenshot.setUserId(request.getUserId());
            screenshot.setFileName(fileName);
            screenshot.setUrl("/api/uploads/" + fileName);
            screenshot.setTimestamp(LocalDateTime.now());

            screenshot = screenshotRepository.save(screenshot);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("screenshot", screenshot);
            return response;
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return response;
        }
    }

    @GetMapping("/{userId}")
    public List<Map<String, Object>> getScreenshots(@PathVariable Long userId,
            @RequestParam(required = false) String date) {
        List<Screenshot> shots;
        if (date != null) {
            LocalDateTime start = LocalDate.parse(date).atStartOfDay();
            LocalDateTime end = start.plusDays(1);
            shots = screenshotRepository.findByUserIdAndTimestampBetween(userId, start, end);
        } else {
            shots = screenshotRepository.findByUserId(userId);
        }

        Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("hh:mm a");
        DateTimeFormatter isoFormatter = DateTimeFormatter.ISO_DATE_TIME;

        for (Screenshot s : shots) {
            int hour = s.getTimestamp().getHour();
            String hourKey = String.format("%d:00 %s", hour % 12 == 0 ? 12 : hour % 12, hour >= 12 ? "PM" : "AM");

            Map<String, Object> shotData = new HashMap<>();
            shotData.put("time", s.getTimestamp().format(timeFormatter));

            String url = s.getUrl();
            if (url != null && url.startsWith("/uploads/")) {
                url = "/api" + url;
            }
            shotData.put("url", url);

            shotData.put("timestamp", s.getTimestamp().format(isoFormatter));

            grouped.computeIfAbsent(hourKey, k -> new ArrayList<>()).add(shotData);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : grouped.entrySet()) {
            Map<String, Object> group = new HashMap<>();
            group.put("label", entry.getKey());
            group.put("shots", entry.getValue());
            result.add(group);
        }

        return result;
    }
}
