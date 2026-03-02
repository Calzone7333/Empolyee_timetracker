package com.employee.monitor.repository;

import com.employee.monitor.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByComputerNameAndUserName(String computerName, String userName);
}
