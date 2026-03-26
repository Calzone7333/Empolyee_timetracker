package com.employee.monitor.controller;

import com.employee.monitor.model.Activity;
import com.employee.monitor.repository.ActivityRepository;
import com.employee.monitor.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

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

        // --- Data Cleanup & Fallback ---
        String app = activity.getApplication();
        String siteOrTitle = activity.getWebsite();

        // 1. If App is unknown, try to determine from title/site
        if (app == null || "Unknown".equalsIgnoreCase(app) || app.isEmpty()) {
            if (siteOrTitle != null && !siteOrTitle.isEmpty() && !"Unknown".equalsIgnoreCase(siteOrTitle)) {
                if (siteOrTitle.contains("://")) {
                     // If it's a URL, the app is likely a browser
                     app = "Browser";
                } else if (siteOrTitle.contains(" - ")) {
                    app = siteOrTitle.substring(siteOrTitle.lastIndexOf(" - ") + 3).trim();
                } else {
                    app = siteOrTitle;
                }
                activity.setApplication(app);
            }
        }

        // 2. Clean up app name paths and extensions
        if (app != null && !app.isEmpty() && !app.contains("://")) {
            if (app.contains("\\"))
                app = app.substring(app.lastIndexOf("\\") + 1);
            if (app.toLowerCase().endsWith(".exe"))
                app = app.substring(0, app.length() - 4);
            if (app.length() > 0)
                app = app.substring(0, 1).toUpperCase() + app.substring(1);
            activity.setApplication(app);
        }

        // 3. Determine if this should be 'idle' type if idleTime is significant (120s+)
        if (activity.getIdleTime() != null && activity.getIdleTime() > 120) {
            activity.setType("idle");
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
            String appName = a.getApplication();
            if (appName == null || appName.isEmpty() || "Unknown".equalsIgnoreCase(appName)) {
                // If app is unknown, try to use website name as app name
                if (a.getWebsite() != null && !a.getWebsite().isEmpty()
                        && !"Unknown".equalsIgnoreCase(a.getWebsite())) {
                    appName = a.getWebsite();
                    if (appName.contains(" - ")) {
                        appName = appName.substring(appName.lastIndexOf(" - ") + 3).trim();
                    }
                } else {
                    continue; // Truly unknown, skip for stats
                }
            }

            // Clean up name
            if (appName.contains("\\"))
                appName = appName.substring(appName.lastIndexOf("\\") + 1);
            else if (appName.contains("/"))
                appName = appName.substring(appName.lastIndexOf("/") + 1);
            if (appName.toLowerCase().endsWith(".exe"))
                appName = appName.substring(0, appName.length() - 4);

            // Further cleaning for titles that are too long
            if (appName.length() > 50)
                appName = appName.substring(0, 47) + "...";
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
                    lowerApp.contains("cmd") || lowerApp.contains("powershell") || lowerApp.contains("intellij") ||
                    lowerApp.contains("eclipse") || lowerApp.contains("git") || lowerApp.contains("docker") ||
                    lowerApp.contains("zoom") || lowerApp.contains("meet") || lowerApp.contains("skype") ||
                    lowerApp.contains("figma") || lowerApp.contains("adobe") || lowerApp.contains("canva") ||
                    lowerApp.contains("notion") || lowerApp.contains("trello") || lowerApp.contains("jira")) {
                group = "Productive";
            } else if (lowerApp.contains("game") || lowerApp.contains("steam") || lowerApp.contains("netflix") ||
                    lowerApp.contains("spotify") || lowerApp.contains("music") || lowerApp.contains("video") ||
                    lowerApp.contains("youtube") || lowerApp.contains("facebook") || lowerApp.contains("instagram") ||
                    lowerApp.contains("twitter") || lowerApp.contains("tiktok") || lowerApp.contains("reddit") ||
                    lowerApp.contains("discord") || lowerApp.contains("whatsapp") || lowerApp.contains("telegram")) {
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
            if (site != null && !site.isEmpty() && !"Unknown".equalsIgnoreCase(site)) {
                String displaySite = site;
                if (site.contains("://")) {
                    try {
                        String temp = site.split("://")[1];
                        displaySite = temp.split("/")[0];
                        // Handle localized names or subdomains
                        if (displaySite.startsWith("www.")) displaySite = displaySite.substring(4);
                    } catch (Exception e) {
                    }
                } else if (site.contains(" - ")) {
                    // Window title like "Home - Google Chrome"
                    String[] parts = site.split(" - ");
                    // Usually the first part is the app/site name
                    displaySite = parts[0].trim();
                    // If the first part is just a generic title, the last part might be the browser
                    if (parts.length > 1) {
                         String lastPart = parts[parts.length - 1].toLowerCase();
                         if (lastPart.contains("chrome") || lastPart.contains("edge") || lastPart.contains("firefox") || lastPart.contains("browser")) {
                             // Use the first part as the site name (e.g. "GitHub" from "GitHub - Google Chrome")
                             displaySite = parts[0].trim();
                         }
                    }
                }

                if (displaySite.length() > 50) displaySite = displaySite.substring(0, 47) + "...";
                
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
                    lowerSite.contains("atlassian") || lowerSite.contains("bitbucket") ||
                    lowerSite.contains("gitlab") || lowerSite.contains("aws") ||
                    lowerSite.contains("azure") || lowerSite.contains("cloud") ||
                    fullTitle.contains("documentation") || fullTitle.contains("tutorial") ||
                    fullTitle.contains("search") || fullTitle.contains("stack overflow") ||
                    fullTitle.contains("github")) {
                group = "Productive";
            } else if (lowerSite.contains("youtube") || lowerSite.contains("facebook") ||
                    lowerSite.contains("netflix") || lowerSite.contains("amazon") ||
                    lowerSite.contains("instagram") || lowerSite.contains("twitter") ||
                    lowerSite.contains("x.com") || lowerSite.contains("reddit") ||
                    lowerSite.contains("twitch") || lowerSite.contains("primevideo") ||
                    lowerSite.contains("disneyplus") || lowerSite.contains("flipkart")) {
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
