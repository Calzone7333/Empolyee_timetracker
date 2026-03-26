package com.employee.monitor.controller;

import com.employee.monitor.model.Department;
import com.employee.monitor.model.Team;
import com.employee.monitor.repository.DepartmentRepository;
import com.employee.monitor.repository.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AppDataController {

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @GetMapping("/teams")
    public List<Team> getTeams() {
        return teamRepository.findAll();
    }

    @GetMapping("/departments")
    public List<Department> getDepartments() {
        return departmentRepository.findAll();
    }

    @PostMapping("/teams")
    public Team createTeam(@RequestBody Team team) {
        return teamRepository.save(team);
    }

    @PostMapping("/departments")
    public Department createDepartment(@RequestBody Department department) {
        return departmentRepository.save(department);
    }

    @GetMapping("/download-agent")
    public ResponseEntity<Resource> downloadAgent() {
        try {
            Path path = Paths.get("../agent/dist/TimeTracker Agent Setup 1.0.0.exe");
            Resource resource = new UrlResource(path.toUri());

            if (resource.exists() || resource.isReadable()) {
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "attachment; filename=\"TimeChamp_Security_Agent.exe\"")
                        .header(HttpHeaders.CONTENT_TYPE, "application/octet-stream")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
