package com.localgrow.v2;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
public class LocalGrowV2Application {

    private static final Logger log = LoggerFactory.getLogger(LocalGrowV2Application.class);

    public static void main(String[] args) {
        loadEnvironmentVariables();
        SpringApplication.run(LocalGrowV2Application.class, args);
    }

    /**
     * Automatically loads database and environment variables from .env.local or .env
     * if not already set in the operating system environment or Java system properties.
     * This ensures local development workflows in IntelliJ IDEA, VS Code, and direct Maven
     * execution resolve credentials seamlessly without manual configuration.
     */
    public static void loadEnvironmentVariables() {
        Path current = Paths.get(".").toAbsolutePath().normalize();
        for (int i = 0; i < 3 && current != null; i++) {
            Path candidate = current.resolve(".env.local");
            if (Files.isRegularFile(candidate)) {
                log.info("Loading local environment properties from {}", candidate);
                loadEnvFile(candidate);
                return;
            }
            Path envCandidate = current.resolve(".env");
            if (Files.isRegularFile(envCandidate)) {
                log.info("Loading local environment properties from {}", envCandidate);
                loadEnvFile(envCandidate);
                return;
            }
            current = current.getParent();
        }
    }

    private static void loadEnvFile(Path path) {
        try (BufferedReader reader = Files.newBufferedReader(path)) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int idx = line.indexOf('=');
                if (idx > 0) {
                    String key = line.substring(0, idx).trim();
                    String val = line.substring(idx + 1).trim();
                    if ((val.startsWith("\"") && val.endsWith("\"")) ||
                        (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.substring(1, val.length() - 1);
                    }
                    if (System.getProperty(key) == null && System.getenv(key) == null) {
                        System.setProperty(key, val);
                    }
                }
            }
        } catch (IOException e) {
            log.warn("Could not read environment file {}: {}", path, e.getMessage());
        }
    }
}

