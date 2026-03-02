package com.employee.monitor.config;

import com.employee.monitor.model.Department;
import com.employee.monitor.model.Team;
import com.employee.monitor.repository.DepartmentRepository;
import com.employee.monitor.repository.TeamRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner initData(TeamRepository teamRepository, DepartmentRepository departmentRepository) {
        return args -> {
            if (teamRepository.count() == 0) {
                teamRepository.save(new Team(null, "Development", "Admin"));
                teamRepository.save(new Team(null, "Design", "Admin"));
                teamRepository.save(new Team(null, "Product", "Admin"));
                teamRepository.save(new Team(null, "Marketing", "Admin"));
            }
            if (departmentRepository.count() == 0) {
                departmentRepository.save(new Department(null, "Engineering"));
                departmentRepository.save(new Department(null, "HR"));
                departmentRepository.save(new Department(null, "Sales"));
            }
        };
    }
}
