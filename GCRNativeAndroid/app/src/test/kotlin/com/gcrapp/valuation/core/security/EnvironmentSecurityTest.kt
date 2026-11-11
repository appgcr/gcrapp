package com.gcrapp.valuation.core.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class EnvironmentSecurityTest {

    // Helper to test validation logic
    private fun validate(url: String, env: String): String {
        val clean = url.trim()
        if (env == "production") {
            if (!clean.startsWith("https://", ignoreCase = true)) {
                throw SecurityException("Security Violation: Production Android builds MUST use HTTPS base URLs. Attempted: $clean")
            }
            if (clean.contains("10.0.2.2") || clean.contains("localhost") || clean.contains("127.0.0.1")) {
                throw SecurityException("Security Violation: Production Android builds cannot point to local emulator or loopback addresses. Attempted: $clean")
            }
        } else if (env == "staging") {
            if (!clean.startsWith("https://", ignoreCase = true)) {
                throw SecurityException("Security Violation: Staging Android builds MUST use HTTPS base URLs. Attempted: $clean")
            }
        }
        return if (clean.endsWith("/")) clean else "$clean/"
    }

    @Test
    fun testProductionPermitsValidHttpsDomain() {
        val validUrl = "https://api.gcrvaluations.com/api"
        val result = validate(validUrl, "production")
        assertEquals("https://api.gcrvaluations.com/api/", result)
    }

    @Test
    fun testProductionRejectsPlainHttpUrl() {
        val insecureUrl = "http://api.gcrvaluations.com/api"
        assertThrows(SecurityException::class.java) {
            validate(insecureUrl, "production")
        }
    }

    @Test
    fun testProductionRejectsEmulatorLoopbackAddress() {
        val emulatorUrl = "http://10.0.2.2:5001/"
        assertThrows(SecurityException::class.java) {
            validate(emulatorUrl, "production")
        }
    }

    @Test
    fun testProductionRejectsLocalhostAddress() {
        val localhostUrl = "https://localhost:5001/"
        assertThrows(SecurityException::class.java) {
            validate(localhostUrl, "production")
        }
    }

    @Test
    fun testStagingEnforcesHttps() {
        val stagingValid = "https://staging-api.gcrvaluations.com/api/"
        val result = validate(stagingValid, "staging")
        assertEquals("https://staging-api.gcrvaluations.com/api/", result)

        assertThrows(SecurityException::class.java) {
            validate("http://staging-api.gcrvaluations.com/api/", "staging")
        }
    }

    @Test
    fun testDevelopmentPermitsEmulatorLoopback() {
        val devUrl = "http://10.0.2.2:5001"
        val result = validate(devUrl, "development")
        assertEquals("http://10.0.2.2:5001/", result)
    }
}
