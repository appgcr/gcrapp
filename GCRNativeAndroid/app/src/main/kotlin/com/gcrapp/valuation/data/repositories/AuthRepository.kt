package com.gcrapp.valuation.data.repositories

import android.content.Context
import com.gcrapp.valuation.core.network.ApiClient
import com.gcrapp.valuation.core.security.TokenManager
import com.gcrapp.valuation.data.models.LoginRequest
import com.gcrapp.valuation.data.models.UserDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepository(private val context: Context) {
    private val tokenManager = TokenManager.getInstance(context)

    fun isLoggedIn(): Boolean {
        return tokenManager.isLoggedIn()
    }

    fun getCurrentUser(): UserDto? {
        return tokenManager.getUser()
    }

    fun getBaseUrl(): String {
        return tokenManager.getBaseUrl()
    }

    fun updateBaseUrl(newUrl: String) {
        tokenManager.saveBaseUrl(newUrl)
        ApiClient.reset()
    }

    suspend fun login(username: String, password: String): Result<UserDto> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.login(LoginRequest(username.trim(), password.trim()))

            if (response.isSuccessful && response.body() != null) {
                val loginBody = response.body()!!
                tokenManager.saveSession(loginBody.token, loginBody.user)
                Result.success(loginBody.user)
            } else {
                val rawError = response.errorBody()?.string()
                val errorMsg = try {
                    if (!rawError.isNullOrBlank() && rawError.contains("error")) {
                        org.json.JSONObject(rawError).optString("error", rawError)
                    } else {
                        rawError ?: "Invalid username or password"
                    }
                } catch (_: Exception) {
                    rawError ?: "Invalid username or password"
                }
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        tokenManager.clearSession()
        ApiClient.reset()
    }
}
