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
        activity.setTimestamp(LocalDateTime.now());
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

        Map<String, Integer> appUsage = new HashMap<>();
        Map<String, String> appToRecentTitle = new HashMap<>();

        System.out.println("Backend Request: getApplications for user " + userId + " on date " + date);
        System.out.println("Activities found: " + activities.size());

        for (Activity a : activities) {
            if (a.getApplication() != null) {
                String appName = a.getApplication();
                // Clean up name: remove path and .exe
                if (appName.contains("\\")) {
                    appName = appName.substring(appName.lastIndexOf("\\") + 1);
                } else if (appName.contains("/")) {
                    appName = appName.substring(appName.lastIndexOf("/") + 1);
                }
                if (appName.toLowerCase().endsWith(".exe")) {
                    appName = appName.substring(0, appName.length() - 4);
                }

                // Capitalize first letter
                if (appName.length() > 0) {
                    appName = appName.substring(0, 1).toUpperCase() + appName.substring(1);
                }

                appUsage.put(appName, appUsage.getOrDefault(appName, 0) + 1);
                if (a.getWebsite() != null && !a.getWebsite().isEmpty()) {
                    appToRecentTitle.put(appName, a.getWebsite());
                }
            }
        }
        System.out.println("Identified " + appUsage.size() + " unique apps.");

        List<Map<String, Object>> result = new ArrayList<>();
        long totalTracked = activities.stream().filter(a -> "active".equals(a.getType())).count();
        if (totalTracked == 0)
            totalTracked = 1;

        // Skip the next old if block
        if (false)

            if (totalTracked == 0)
                totalTracked = 1;

        for (Map.Entry<String, Integer> entry : appUsage.entrySet()) {
            String appName = entry.getKey();
            int count = entry.getValue();
            int durationSecs = count * 10;
            double percentage = (count * 100.0) / totalTracked;

            // Simple productivity categorization logic
            String lowerApp = appName.toLowerCase();
            String group = "Neutral";
            if (lowerApp.contains("code") || lowerApp.contains("studio") || lowerApp.contains("idea") ||
                    lowerApp.contains("slack") || lowerApp.contains("teams") || lowerApp.contains("word") ||
                    lowerApp.contains("excel") || lowerApp.contains("powerpoint") || lowerApp.contains("mysql") ||
                    lowerApp.contains("workbench") || lowerApp.contains("postman") || lowerApp.contains("terminal") ||
                    lowerApp.contains("cmd") || lowerApp.contains("powershell") || lowerApp.contains("vs") ||
                    lowerApp.contains("git") || lowerApp.contains("docker")) {
                group = "Productive";
            } else if (lowerApp.contains("game") || lowerApp.contains("steam") || lowerApp.contains("player") ||
                    lowerApp.contains("video") || lowerApp.contains("music") || lowerApp.contains("spotify") ||
                    lowerApp.contains("netflix")) {
                group = "Non-Productive";
            }

            Map<String, Object> map = new HashMap<>();
            map.put("app", appName);
            map.put("group", group);
            map.put("dur", String.format("%02d:%02d:%02d", durationSecs / 3600, (durationSecs % 3600) / 60,
                    durationSecs % 60));
            map.put("durationSecs", durationSecs);
            map.put("inact", "0 Mins");
            map.put("perc", String.format("%.1f%%", percentage));
            map.put("percVal", percentage);
            map.put("title", appToRecentTitle.getOrDefault(appName, ""));
            result.add(map);
        }

        // Sort by duration descending
        result.sort((a, b) -> Double.compare((Double) b.get("percVal"), (Double) a.get("percVal")));

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

        Map<String, Integer> siteUsage = new HashMap<>();
        Map<String, String> siteToFullTitle = new HashMap<>();

        System.out.println("Backend Request: getWebsites for user " + userId + " on date " + date);
        System.out.println("Activities found: " + activities.size());

        for (Activity a : activities) {
            String site = a.getWebsite();
            if (site != null && !site.isEmpty()) {
                // If it looks like a URL with http, try to get the domain
                String displaySite = site;
                if (site.contains("://")) {
                    try {
                        String temp = site.split("://")[1];
                        displaySite = temp.split("/")[0];
                    } catch (Exception e) {
                    }
                } else if (site.contains(" - ")) {
                    // Often window titles are "Page Title - Domain"
                    String[] parts = site.split(" - ");
                    displaySite = parts[parts.length - 1];
                }

                siteUsage.put(displaySite, siteUsage.getOrDefault(displaySite, 0) + 1);
                siteToFullTitle.put(displaySite, site);
            }
        }
        System.out.println("Identified " + siteUsage.size() + " unique websites.");

        List<Map<String, Object>> result = new ArrayList<>();
        long totalTracked = activities.stream().filter(a -> "active".equals(a.getType())).count();
        if (totalTracked == 0)
            totalTracked = 1;

        // Skip the next old if block
        if (false)

            if (totalTracked == 0)
                totalTracked = 1;

        for (Map.Entry<String, Integer> entry : siteUsage.entrySet()) {
            String siteName = entry.getKey();
            int count = entry.getValue();
            int durationSecs = count * 10;
            double percentage = (count * 100.0) / totalTracked;

            // Productivity Logic for Websites
            String lowerSite = siteName.toLowerCase();
            String fullTitle = siteToFullTitle.getOrDefault(siteName, "").toLowerCase();
            String group = "Neutral";

            if (lowerSite.contains("github") || lowerSite.contains("stackoverflow") ||
                    lowerSite.contains("jira") || lowerSite.contains("confluence") ||
                    lowerSite.contains("figma") || lowerSite.contains("canva") ||
                    lowerSite.contains("google") || fullTitle.contains("documentation") ||
                    fullTitle.contains("tutorial") || lowerSite.contains("azure") ||
                    lowerSite.contains("aws") || lowerSite.contains("maven")) {
                group = "Productive";
            } else if (lowerSite.contains("youtube") || lowerSite.contains("facebook") ||
                    lowerSite.contains("instagram") || lowerSite.contains("netflix") ||
                    lowerSite.contains("twitter") || lowerSite.contains("reddit") ||
                    lowerSite.contains("amazon") || lowerSite.contains("flipkart")) {
                group = "Non-Productive";
            }

            Map<String, Object> map = new HashMap<>();
            map.put("site", siteName);
            map.put("group", group);
            map.put("dur", String.format("%02d:%02d:%02d", durationSecs / 3600, (durationSecs % 3600) / 60,
                    durationSecs % 60));
            map.put("durationSecs", durationSecs);
            map.put("inact", "0 Mins");
            map.put("perc", String.format("%.1f%%", percentage));
            map.put("percVal", percentage);
            map.put("fullTitle", siteToFullTitle.get(siteName));
            result.add(map);
        }

        // Sort by duration descending
        result.sort((a, b) -> Double.compare((Double) b.get("percVal"), (Double) a.get("percVal")));

        return result;
    }
}
