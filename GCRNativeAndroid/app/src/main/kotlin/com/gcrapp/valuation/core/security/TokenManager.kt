package com.gcrapp.valuation.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.gcrapp.valuation.data.models.UserDto
import com.google.gson.Gson

/**
 * Android Keystore-backed Secure Token and Session Manager
 */
class TokenManager private constructor(private val context: Context) {


    private val prefs: SharedPreferences = try {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        EncryptedSharedPreferences.create(
            "gcr_secure_prefs",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback for emulators without hardware Keystore AES256-SIV support
        context.getSharedPreferences("gcr_prefs_fallback", Context.MODE_PRIVATE)
    }

    private val gson = Gson()

    fun saveAuth(token: String, user: UserDto) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER, gson.toJson(user))
            .apply()
    }

    fun saveSession(token: String, user: UserDto) = saveAuth(token, user)

    fun getToken(): String? {
        return prefs.getString(KEY_TOKEN, null)
    }

    fun getUser(): UserDto? {
        val userJson = prefs.getString(KEY_USER, null) ?: return null
        return try {
            gson.fromJson(userJson, UserDto::class.java)
        } catch (e: Exception) {
            null
        }
    }

    fun clearAuth() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER)
            .apply()
    }

    fun clearSession() = clearAuth()

    fun isLoggedIn(): Boolean {
        return !getToken().isNullOrBlank()
    }

    var appEnvironment: String = "development"
        private set

    private val configuredDefaultUrl: String by lazy {
        try {
            context.assets.open("app-config.json").use { input ->
                val json = input.bufferedReader().use { it.readText() }
                val map = gson.fromJson(json, Map::class.java)
                appEnvironment = (map["appEnvironment"] as? String)?.lowercase() ?: "development"
                val rawUrl = (map["apiBaseUrl"] as? String) ?: DEFAULT_BASE_URL
                validateAndSanitizeUrl(rawUrl, appEnvironment)
            }
        } catch (e: Exception) {
            DEFAULT_BASE_URL
        }
    }

    fun getBaseUrl(): String {
        val stored = prefs.getString(KEY_BASE_URL, null)
        return if (!stored.isNullOrBlank()) {
            try {
                validateAndSanitizeUrl(stored, appEnvironment)
            } catch (e: SecurityException) {
                // If stored URL violates environment rules (e.g. dev URL stored and switched to prod), use default
                configuredDefaultUrl
            }
        } else {
            configuredDefaultUrl
        }
    }

    fun setBaseUrl(url: String) {
        val validated = validateAndSanitizeUrl(url, appEnvironment)
        prefs.edit().putString(KEY_BASE_URL, validated).apply()
    }

    fun saveBaseUrl(url: String) = setBaseUrl(url)

    /**
     * Enforce strict HTTPS and block local/loopback URLs in production builds
     */
    fun validateAndSanitizeUrl(url: String, env: String): String {
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



    companion object {
        private const val KEY_TOKEN = "jwt_auth_token"
        private const val KEY_USER = "current_user_profile"
        private const val KEY_BASE_URL = "custom_backend_base_url"

        const val DEFAULT_BASE_URL = "http://10.0.2.2:5001/"

        @Volatile
        private var instance: TokenManager? = null

        fun getInstance(context: Context): TokenManager {
            return instance ?: synchronized(this) {
                instance ?: TokenManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
