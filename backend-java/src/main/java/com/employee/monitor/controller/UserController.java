package com.employee.monitor.controller;

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

        user = userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("user", user);
        response.put("message", "User registered successfully");
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
}
