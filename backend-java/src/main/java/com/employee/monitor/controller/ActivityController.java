package com.employee.monitor.controller;

import com.employee.monitor.model.Activity;
import com.employee.monitor.repository.ActivityRepository;
import com.employee.monitor.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/activity")
@CrossOrigin(origins = "*")
public class ActivityController {

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/track")
    public Map<String, Object> track(@RequestBody Map<String, Object> data) {
        try {
            Long userId = Long.valueOf(data.get("userId").toString());
            Activity activity = new Activity();
            activity.setUserId(userId);
            activity.setType(data.get("type").toString());
            activity.setApplication(data.get("application").toString());
            activity.setWebsite(data.get("website").toString());
            activity.setKeyStrokes(Integer.parseInt(data.get("keyStrokes").toString()));
            activity.setMouseClicks(Integer.parseInt(data.get("mouseClicks").toString()));
            activity.setIdleTime(Integer.parseInt(data.get("idleTime").toString()));
            
            if (data.containsKey("timestamp")) {
                activity.setTimestamp(LocalDateTime.parse(data.get("timestamp").toString()));
            } else {
                activity.setTimestamp(LocalDateTime.now());
            }

            activityRepository.save(activity);
            
            // Update user last active
            userRepository.findById(userId).ifPresent(u -> {
                u.setLastActive(LocalDateTime.now());
                userRepository.save(u);
            });

            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @GetMapping("/{userId}")
    public List<Activity> getActivities(@PathVariable Long userId,
            @RequestParam(required = false) String date) {
        if (date != null) {
            LocalDate localDate = LocalDate.parse(date);
            return activityRepository.findByUserIdAndTimestampBetween(userId, localDate.atStartOfDay(), localDate.plusDays(1).atStartOfDay());
        }
        return activityRepository.findByUserId(userId);
    }

    @GetMapping("/applications/{userId}")
    public List<Map<String, Object>> getApplications(@PathVariable Long userId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String range) {
        List<Activity> activities = getActivitiesByRange(userId, date, range);
        
        Map<String, Integer> appActiveUsage = new HashMap<>();
        Map<String, Integer> appTotalUsage = new HashMap<>();
        Map<String, String> appToRecentTitle = new HashMap<>();

        for (Activity a : activities) {
            String appName = a.getApplication();
            if (appName == null || appName.isEmpty() || "Unknown".equalsIgnoreCase(appName)) {
                appName = "System/Other";
            }

            // Clean up name
            if (appName.contains("\\")) appName = appName.substring(appName.lastIndexOf("\\") + 1);
            if (appName.toLowerCase().endsWith(".exe")) appName = appName.substring(0, appName.length() - 4);
            if (appName.length() > 0) appName = appName.substring(0, 1).toUpperCase() + appName.substring(1);

            appTotalUsage.put(appName, appTotalUsage.getOrDefault(appName, 0) + 1);
            if ("active".equals(a.getType())) {
                appActiveUsage.put(appName, appActiveUsage.getOrDefault(appName, 0) + 1);
            }
            if (a.getWebsite() != null && !a.getWebsite().isEmpty()) {
                appToRecentTitle.put(appName, a.getWebsite());
            }
        }

        long totalActivePings = activities.stream().filter(a -> "active".equals(a.getType())).count();
        long totalDenom = totalActivePings > 0 ? totalActivePings : 1;

        List<Map<String, Object>> result = new ArrayList<>();
        for (String appName : appTotalUsage.keySet()) {
            int activePings = appActiveUsage.getOrDefault(appName, 0);
            int durationSecs = activePings * 10;
            double percentage = (activePings * 100.0) / totalDenom;

            Map<String, Object> map = new HashMap<>();
            map.put("app", appName);
            map.put("group", getAppGroup(appName));
            map.put("dur", formatDuration(durationSecs));
            map.put("durationSecs", durationSecs);
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
        List<Activity> activities = getActivitiesByRange(userId, date, range);

        Map<String, Integer> siteActiveCount = new HashMap<>();
        Map<String, Integer> siteTotalCount = new HashMap<>();
        Map<String, String> siteToFullTitle = new HashMap<>();

        for (Activity a : activities) {
            String site = a.getWebsite();
            String appName = (a.getApplication() != null) ? a.getApplication().toLowerCase() : "";
            boolean isBrowser = appName.contains("chrome") || appName.contains("edge") || 
                              appName.contains("firefox") || appName.contains("brave") || 
                              appName.contains("opera") || appName.contains("vivaldi");

            if (site == null || site.isEmpty() || "Unknown".equalsIgnoreCase(site)) continue;

            // Only count as a website if it's from a browser OR has a protocol/dot
            if (!isBrowser && !site.contains("://") && !site.contains("www.") && !site.contains(".")) continue;

            String displaySite = site;
            if (site.contains("://")) {
                try {
                    String temp = site.split("://")[1];
                    displaySite = temp.split("/")[0];
                    if (displaySite.startsWith("www.")) displaySite = displaySite.substring(4);
                } catch (Exception e) {}
            } else if (site.contains(" - ")) {
                String[] parts = site.split(" - ");
                displaySite = parts[0].trim();
                if (parts.length > 1) {
                    String lp = parts[parts.length - 1].toLowerCase();
                    if (lp.contains("chrome") || lp.contains("edge") || lp.contains("firefox")) {
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

        long totalActivePings = activities.stream().filter(a -> "active".equals(a.getType())).count();
        long totalDenom = totalActivePings > 0 ? totalActivePings : 1;

        List<Map<String, Object>> result = new ArrayList<>();
        for (String siteName : siteTotalCount.keySet()) {
            int activePings = siteActiveCount.getOrDefault(siteName, 0);
            int durationSecs = activePings * 10;
            double percentage = (activePings * 100.0) / totalDenom;

            Map<String, Object> map = new HashMap<>();
            map.put("site", siteName);
            map.put("group", getWebsiteGroup(siteName, siteToFullTitle.get(siteName)));
            map.put("dur", formatDuration(durationSecs));
            map.put("durationSecs", durationSecs);
            map.put("perc", String.format("%.1f%%", percentage));
            map.put("percVal", percentage);
            map.put("fullTitle", siteToFullTitle.get(siteName));
            result.add(map);
        }

        result.sort((a, b) -> Double.compare((Double) b.get("percVal"), (Double) a.get("percVal")));
        return result;
    }

    @GetMapping("/levels/{userId}")
    public List<Map<String, Object>> getLevels(@PathVariable Long userId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String range) {
        List<Activity> activities = getActivitiesByRange(userId, date, range);
        
        // Group by 5-minute intervals
        Map<String, Map<String, Integer>> intervals = new TreeMap<>();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");

        for (Activity a : activities) {
            LocalDateTime ts = a.getTimestamp();
            int minute = (ts.getMinute() / 5) * 5;
            String key = String.format("%02d:%02d", ts.getHour(), minute);

            intervals.computeIfAbsent(key, k -> new HashMap<>(Map.of("keys", 0, "clicks", 0)));
            Map<String, Integer> data = intervals.get(key);
            data.put("keys", data.get("keys") + a.getKeyStrokes());
            data.put("clicks", data.get("clicks") + a.getMouseClicks());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Map<String, Integer>> entry : intervals.entrySet()) {
            Map<String, Object> map = new HashMap<>();
            map.put("time", entry.getKey());
            map.put("keys", entry.getValue().get("keys"));
            map.put("clicks", entry.getValue().get("clicks"));
            result.add(map);
        }
        return result;
    }

    private List<Activity> getActivitiesByRange(Long userId, String date, String range) {
        if (date == null) return activityRepository.findByUserId(userId);
        
        LocalDate localDate = LocalDate.parse(date);
        LocalDateTime start, end;
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

    private String formatDuration(int totalSecs) {
        int h = totalSecs / 3600;
        int m = (totalSecs % 3600) / 60;
        int s = totalSecs % 60;
        return String.format("%02d:%02d:%02d", h, m, s);
    }

    private String getAppGroup(String appName) {
        String lower = appName.toLowerCase();
        if (lower.contains("code") || lower.contains("studio") || lower.contains("idea") ||
            lower.contains("slack") || lower.contains("teams") || lower.contains("chrome") ||
            lower.contains("firefox") || lower.contains("mysql") || lower.contains("postman") ||
            lower.contains("terminal") || lower.contains("intellij") || lower.contains("git") ||
            lower.contains("docker") || lower.contains("zoom") || lower.contains("meet") ||
            lower.contains("skype") || lower.contains("figma") || lower.contains("adobe") ||
            lower.contains("notion") || lower.contains("trello") || lower.contains("jira")) {
            return "Productive";
        } else if (lower.contains("game") || lower.contains("steam") || lower.contains("netflix") ||
            lower.contains("spotify") || lower.contains("music") || lower.contains("video") ||
            lower.contains("youtube") || lower.contains("facebook") || lower.contains("instagram") ||
            lower.contains("twitter") || lower.contains("tiktok") || lower.contains("reddit")) {
            return "Non-Productive";
        }
        return "Neutral";
    }

    private String getWebsiteGroup(String siteName, String fullTitle) {
        String lowerSite = siteName.toLowerCase();
        String lowerTitle = (fullTitle != null ? fullTitle.toLowerCase() : "");
        
        if (lowerSite.contains("github") || lowerSite.contains("stackoverflow") ||
            lowerSite.contains("jira") || lowerSite.contains("google") ||
            lowerSite.contains("atlassian") || lowerSite.contains("bitbucket") ||
            lowerSite.contains("gitlab") || lowerSite.contains("aws") ||
            lowerSite.contains("azure") || lowerSite.contains("cloud") ||
            lowerTitle.contains("documentation") || lowerTitle.contains("tutorial") ||
            lowerTitle.contains("search") || lowerTitle.contains("stack overflow")) {
            return "Productive";
        } else if (lowerSite.contains("youtube") || lowerSite.contains("facebook") ||
            lowerSite.contains("netflix") || lowerSite.contains("amazon") ||
            lowerSite.contains("instagram") || lowerSite.contains("twitter") ||
            lowerSite.contains("reddit") || lowerSite.contains("twitch")) {
            return "Non-Productive";
        }
        return "Neutral";
    }
}
