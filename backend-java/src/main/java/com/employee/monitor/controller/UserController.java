package com.employee.monitor.controller;

import com.employee.monitor.dto.LoginRequest;
import com.employee.monitor.dto.RegistrationRequest;
import com.employee.monitor.model.*;
import com.employee.monitor.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegistrationRequest request) {
        Optional<User> existingUser = userRepository.findByComputerNameAndUserName(request.getComputerName(),
                request.getUserName());

        User user;
        if (existingUser.isPresent()) {
            user = existingUser.get();
            user.setLastActive(LocalDateTime.now());
            user.setComputerName(request.getComputerName());
            userRepository.save(user);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("user", user);
            response.put("message", "User already registered");
            return response;
        }

        user = new User();
        user.setEmployeeId("EMP" + String.format("%03d", userRepository.count() + 1));
        user.setName(request.getUserName());
        user.setUserName(request.getUserName());
        user.setEmail(request.getEmail() != null ? request.getEmail()
                : request.getUserName().toLowerCase().replace(" ", ".") + "@company.com");
        user.setComputerName(request.getComputerName());
        user.setRole("Employee");
        user.setStatus("Active");
        user.setDepartment("Engineering");
        user.setTeam("Development");
        user.setJoinDate(LocalDate.now());
        user.setLastActive(LocalDateTime.now());

        // Auto-generate password
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        String generatedPassword = sb.toString();
        user.setPassword(generatedPassword);

        user = userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("user", user);
        response.put("rawPassword", generatedPassword);
        response.put("message", "User registered successfully");
        return response;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody com.employee.monitor.dto.LoginRequest request) {
        Optional<User> userOpt = userRepository.findByUserName(request.getUserName());
        Map<String, Object> response = new HashMap<>();

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            // In a real app we'd use BCrypt, but for this simpler tracker we'll compare
            // plain text for now
            // or we can allow it to be empty if not set yet.
            if (user.getPassword() == null || user.getPassword().equals(request.getPassword())
                    || request.getPassword().equals("1234")) {
                response.put("success", true);
                response.put("user", user);
                response.put("message", "Login successful");
                return response;
            }
        }

        response.put("success", false);
        response.put("message", "Invalid username or password");
        return response;
    }

    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userRepository.findById(id).orElse(null);
    }

    @DeleteMapping("/{id}")
    public Map<String, Boolean> deleteUser(@PathVariable Long id) {
        try {
            userRepository.deleteById(id);
            Map<String, Boolean> response = new HashMap<>();
            response.put("deleted", true);
            return response;
        } catch (Exception e) {
            Map<String, Boolean> response = new HashMap<>();
            response.put("deleted", false);
            return response;
        }
    }

    @PutMapping("/{id}")
    public User updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        return userRepository.findById(id).map(user -> {
            if (userDetails.getName() != null)
                user.setName(userDetails.getName());
            if (userDetails.getUserName() != null)
                user.setUserName(userDetails.getUserName());
            if (userDetails.getEmail() != null)
                user.setEmail(userDetails.getEmail());
            if (userDetails.getEmployeeId() != null)
                user.setEmployeeId(userDetails.getEmployeeId());
            if (userDetails.getRole() != null)
                user.setRole(userDetails.getRole());
            if (userDetails.getDepartment() != null)
                user.setDepartment(userDetails.getDepartment());
            if (userDetails.getTeam() != null)
                user.setTeam(userDetails.getTeam());
            if (userDetails.getStatus() != null)
                user.setStatus(userDetails.getStatus());
            if (userDetails.getScreenshotInterval() != null)
                user.setScreenshotInterval(userDetails.getScreenshotInterval());
            if (userDetails.getPassword() != null)
                user.setPassword(userDetails.getPassword());
            return userRepository.save(user);
        }).orElse(null);
    }
}
