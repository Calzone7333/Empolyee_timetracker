package com.employee.monitor.controller;

import com.employee.monitor.model.Activity;
import com.employee.monitor.model.User;
import com.employee.monitor.repository.ActivityRepository;
import com.employee.monitor.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api")
public class ActivityController {

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/activity/track")
    public Map<String, Object> track(@RequestBody Activity activity) {
        if (activity.getTimestamp() == null) {
            activity.setTimestamp(LocalDateTime.now());
        }
        Activity saved = activityRepository.save(activity);

        userRepository.findById(activity.getUserId()).ifPresent(user -> {
            user.setLastActive(LocalDateTime.now());
            userRepository.save(user);
        });

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("activity", saved);
        return response;
    }

    @GetMapping("/activity/{userId}")
    public List<Activity> getActivities(@PathVariable Long userId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String range) {
        LocalDateTime start;
        LocalDateTime end;

        if (date != null) {
            LocalDate localDate = LocalDate.parse(date);
            if ("week".equalsIgnoreCase(range)) {
                start = localDate.minusDays(7).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else if ("month".equalsIgnoreCase(range)) {
                start = localDate.withDayOfMonth(1).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else {
                start = localDate.atStartOfDay();
                end = start.plusDays(1);
            }
            return activityRepository.findByUserIdAndTimestampBetween(userId, start, end);
        }
        return activityRepository.findByUserId(userId);
    }

    @GetMapping("/activity-levels/{userId}")
    public List<Map<String, Object>> getActivityLevels(@PathVariable Long userId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String range) {
        List<Activity> activities;
        if (date != null) {
            LocalDate localDate = LocalDate.parse(date);
            LocalDateTime start;
            LocalDateTime end;
            if ("week".equalsIgnoreCase(range)) {
                start = localDate.minusDays(7).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else if ("month".equalsIgnoreCase(range)) {
                start = localDate.withDayOfMonth(1).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else {
                start = localDate.atStartOfDay();
                end = start.plusDays(1);
            }
            activities = activityRepository.findByUserIdAndTimestampBetween(userId, start, end);
        } else {
            activities = activityRepository.findByUserId(userId);
        }

        Map<String, Map<String, Integer>> groupedMap = new LinkedHashMap<>();

        for (Activity a : activities) {
            int hour = a.getTimestamp().getHour();
            int min = a.getTimestamp().getMinute();
            int minGroup = (min / 10) * 10;
            String timeKey = String.format("%02d:%02d", hour, minGroup);

            groupedMap.putIfAbsent(timeKey, new HashMap<>());
            Map<String, Integer> stats = groupedMap.get(timeKey);
            stats.put("keys", stats.getOrDefault("keys", 0) + (a.getKeyStrokes() != null ? a.getKeyStrokes() : 0));
            stats.put("clicks",
                    stats.getOrDefault("clicks", 0) + (a.getMouseClicks() != null ? a.getMouseClicks() : 0));
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Map<String, Integer>> entry : groupedMap.entrySet()) {
            Map<String, Object> map = new HashMap<>();
            map.put("time", entry.getKey());
            map.put("keys", entry.getValue().get("keys"));
            map.put("clicks", entry.getValue().get("clicks"));
            result.add(map);
        }
        return result;
    }

    @GetMapping("/applications/{userId}")
    public List<Map<String, Object>> getApplications(@PathVariable Long userId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String range) {
        List<Activity> activities;
        if (date != null) {
            LocalDate localDate = LocalDate.parse(date);
            LocalDateTime start;
            LocalDateTime end;
            if ("week".equalsIgnoreCase(range)) {
                start = localDate.minusDays(7).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else if ("month".equalsIgnoreCase(range)) {
                start = localDate.withDayOfMonth(1).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else {
                start = localDate.atStartOfDay();
                end = start.plusDays(1);
            }
            activities = activityRepository.findByUserIdAndTimestampBetween(userId, start, end);
        } else {
            activities = activityRepository.findByUserId(userId);
        }

        Map<String, Integer> appActiveUsage = new HashMap<>(); // pings where app was active
        Map<String, Integer> appTotalUsage = new HashMap<>(); // all pings for this app
        Map<String, String> appToRecentTitle = new HashMap<>();

        for (Activity a : activities) {
            if (a.getApplication() != null && !"Unknown".equalsIgnoreCase(a.getApplication())) {
                String appName = a.getApplication();
                // Clean up name
                if (appName.contains("\\"))
                    appName = appName.substring(appName.lastIndexOf("\\") + 1);
                else if (appName.contains("/"))
                    appName = appName.substring(appName.lastIndexOf("/") + 1);
                if (appName.toLowerCase().endsWith(".exe"))
                    appName = appName.substring(0, appName.length() - 4);
                if (appName.length() > 0)
                    appName = appName.substring(0, 1).toUpperCase() + appName.substring(1);

                appTotalUsage.put(appName, appTotalUsage.getOrDefault(appName, 0) + 1);
                if ("active".equals(a.getType())) {
                    appActiveUsage.put(appName, appActiveUsage.getOrDefault(appName, 0) + 1);
                }
                if (a.getWebsite() != null && !a.getWebsite().isEmpty()) {
                    appToRecentTitle.put(appName, a.getWebsite());
                }
            }
        }

        long totalActivePings = activities.stream().filter(a -> "active".equals(a.getType())).count();
        long totalDenominator = totalActivePings > 0 ? totalActivePings : 1;

        List<Map<String, Object>> result = new ArrayList<>();
        for (String appName : appTotalUsage.keySet()) {
            int activeCount = appActiveUsage.getOrDefault(appName, 0);
            int totalCount = appTotalUsage.get(appName);
            int durationSecs = activeCount * 10;
            double percentage = (activeCount * 100.0) / totalDenominator;

            String lowerApp = appName.toLowerCase();
            String group = "Neutral";
            if (lowerApp.contains("code") || lowerApp.contains("studio") || lowerApp.contains("idea") ||
                    lowerApp.contains("slack") || lowerApp.contains("teams") || lowerApp.contains("word") ||
                    lowerApp.contains("excel") || lowerApp.contains("chrome") || lowerApp.contains("firefox") ||
                    lowerApp.contains("mysql") || lowerApp.contains("postman") || lowerApp.contains("terminal") ||
                    lowerApp.contains("cmd") || lowerApp.contains("powershell")) {
                group = "Productive";
            } else if (lowerApp.contains("game") || lowerApp.contains("steam") || lowerApp.contains("netflix") ||
                    lowerApp.contains("spotify") || lowerApp.contains("music") || lowerApp.contains("video")) {
                group = "Non-Productive";
            }

            Map<String, Object> map = new HashMap<>();
            map.put("app", appName);
            map.put("group", group);
            map.put("dur", String.format("%02d:%02d:%02d", durationSecs / 3600, (durationSecs % 3600) / 60,
                    durationSecs % 60));
            map.put("durationSecs", durationSecs);
            map.put("totalDurationSecs", totalCount * 10);
            map.put("perc", String.format("%.1f%%", percentage));
            map.put("percVal", percentage);
            map.put("title", appToRecentTitle.getOrDefault(appName, "Main Window"));
            result.add(map);
        }

        result.sort((a, b) -> ((Integer) b.get("durationSecs")).compareTo((Integer) a.get("durationSecs")));
        return result;
    }

    @GetMapping("/websites/{userId}")
    public List<Map<String, Object>> getWebsites(@PathVariable Long userId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String range) {
        List<Activity> activities;
        if (date != null) {
            LocalDate localDate = LocalDate.parse(date);
            LocalDateTime start;
            LocalDateTime end;
            if ("week".equalsIgnoreCase(range)) {
                start = localDate.minusDays(7).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else if ("month".equalsIgnoreCase(range)) {
                start = localDate.withDayOfMonth(1).atStartOfDay();
                end = localDate.plusDays(1).atStartOfDay();
            } else {
                start = localDate.atStartOfDay();
                end = start.plusDays(1);
            }
            activities = activityRepository.findByUserIdAndTimestampBetween(userId, start, end);
        } else {
            activities = activityRepository.findByUserId(userId);
        }

        Map<String, Integer> siteActiveCount = new HashMap<>();
        Map<String, Integer> siteTotalCount = new HashMap<>();
        Map<String, String> siteToFullTitle = new HashMap<>();

        for (Activity a : activities) {
            String site = a.getWebsite();
            if (site != null && !site.isEmpty()) {
                String displaySite = site;
                if (site.contains("://")) {
                    try {
                        String temp = site.split("://")[1];
                        displaySite = temp.split("/")[0];
                    } catch (Exception e) {
                    }
                } else if (site.contains(" - ")) {
                    String[] parts = site.split(" - ");
                    displaySite = parts[parts.length - 1];
                }

                siteTotalCount.put(displaySite, siteTotalCount.getOrDefault(displaySite, 0) + 1);
                if ("active".equals(a.getType())) {
                    siteActiveCount.put(displaySite, siteActiveCount.getOrDefault(displaySite, 0) + 1);
                }
                siteToFullTitle.put(displaySite, site);
            }
        }

        long totalActiveDenominator = activities.stream().filter(a -> "active".equals(a.getType())).count();
        if (totalActiveDenominator == 0)
            totalActiveDenominator = 1;

        List<Map<String, Object>> result = new ArrayList<>();
        for (String siteName : siteTotalCount.keySet()) {
            int activeCount = siteActiveCount.getOrDefault(siteName, 0);
            int totalCount = siteTotalCount.get(siteName);
            int durationSecs = activeCount * 10;
            double percentage = (activeCount * 100.0) / totalActiveDenominator;

            String lowerSite = siteName.toLowerCase();
            String fullTitle = siteToFullTitle.getOrDefault(siteName, "").toLowerCase();
            String group = "Neutral";
            if (lowerSite.contains("github") || lowerSite.contains("stackoverflow") ||
                    lowerSite.contains("jira") || lowerSite.contains("google") ||
                    fullTitle.contains("documentation")) {
                group = "Productive";
            } else if (lowerSite.contains("youtube") || lowerSite.contains("facebook") ||
                    lowerSite.contains("netflix") || lowerSite.contains("amazon")) {
                group = "Non-Productive";
            }

            Map<String, Object> map = new HashMap<>();
            map.put("site", siteName);
            map.put("group", group);
            map.put("dur", String.format("%02d:%02d:%02d", durationSecs / 3600, (durationSecs % 3600) / 60,
                    durationSecs % 60));
            map.put("durationSecs", durationSecs);
            map.put("totalDurationSecs", totalCount * 10);
            map.put("perc", String.format("%.1f%%", percentage));
            map.put("percVal", percentage);
            map.put("fullTitle", siteToFullTitle.get(siteName));
            result.add(map);
        }

        result.sort((a, b) -> Double.compare((Double) b.get("percVal"), (Double) a.get("percVal")));
        return result;
    }
}
