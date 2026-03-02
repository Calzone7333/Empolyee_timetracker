package com.employee.monitor.controller;

import com.employee.monitor.model.TimeClaim;
import com.employee.monitor.repository.TimeClaimRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/claims")
public class TimeClaimController {

    @Autowired
    private TimeClaimRepository claimRepository;

    @GetMapping("/{userId}")
    public List<TimeClaim> getClaims(@PathVariable Long userId) {
        return claimRepository.findByUserId(userId);
    }

    @PostMapping("/add")
    public TimeClaim addClaim(@RequestBody TimeClaim claim) {
        claim.setSubmittedAt(LocalDateTime.now());
        if (claim.getStatus() == null) {
            claim.setStatus("Pending");
        }
        return claimRepository.save(claim);
    }

    @PutMapping("/status/{id}")
    public TimeClaim updateStatus(@PathVariable Long id, @RequestParam String status) {
        return claimRepository.findById(id).map(claim -> {
            claim.setStatus(status);
            return claimRepository.save(claim);
        }).orElse(null);
    }
}
