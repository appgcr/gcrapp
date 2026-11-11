package com.gcrapp.valuation.ui.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gcrapp.valuation.data.models.UserDto
import com.gcrapp.valuation.data.repositories.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val currentUser: UserDto? = null,
    val errorMessage: String? = null,
    val baseUrl: String = ""
)

class AuthViewModel(application: Application) : AndroidViewModel(application) {
    private val authRepo = AuthRepository(application)

    private val _uiState = MutableStateFlow(
        AuthUiState(
            isLoggedIn = authRepo.isLoggedIn(),
            currentUser = authRepo.getCurrentUser(),
            baseUrl = authRepo.getBaseUrl()
        )
    )
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun login(username: String, pass: String, onSuccess: () -> Unit) {
        if (username.isBlank() || pass.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please enter both username and password")
            return
        }

        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            val result = authRepo.login(username, pass)
            result.onSuccess { user ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isLoggedIn = true,
                    currentUser = user,
                    errorMessage = null
                )
                onSuccess()
            }.onFailure { ex ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = ex.message ?: "Authentication failed. Check your network or credentials."
                )
            }
        }
    }

    fun updateServerUrl(url: String) {
        authRepo.updateBaseUrl(url)
        _uiState.value = _uiState.value.copy(baseUrl = authRepo.getBaseUrl())
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun logout() {
        authRepo.logout()
        _uiState.value = AuthUiState(
            isLoggedIn = false,
            currentUser = null,
            baseUrl = authRepo.getBaseUrl()
        )
    }
}
