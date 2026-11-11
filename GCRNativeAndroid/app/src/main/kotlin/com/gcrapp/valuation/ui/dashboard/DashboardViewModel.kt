package com.gcrapp.valuation.ui.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gcrapp.valuation.data.models.AttendanceResponse
import com.gcrapp.valuation.data.models.UserDto
import com.gcrapp.valuation.data.models.ValuationCaseDto
import com.gcrapp.valuation.data.repositories.AttendanceRepository
import com.gcrapp.valuation.data.repositories.AuthRepository
import com.gcrapp.valuation.data.repositories.CaseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardUiState(
    val isLoading: Boolean = false,
    val isOnline: Boolean = true,
    val user: UserDto? = null,
    val totalAssigned: Int = 0,
    val pendingInspections: Int = 0,
    val completedCases: Int = 0,
    val offlineQueueCount: Int = 0,
    val upcomingCases: List<ValuationCaseDto> = emptyList(),
    val latestAttendance: AttendanceResponse? = null,
    val syncSuccessMessage: String? = null,
    val errorMessage: String? = null
)

class DashboardViewModel(application: Application) : AndroidViewModel(application) {
    private val authRepo = AuthRepository(application)
    private val caseRepo = CaseRepository(application)
    private val attendanceRepo = AttendanceRepository(application)

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboard()
    }

    fun loadDashboard(forceRefresh: Boolean = false) {
        val user = authRepo.getCurrentUser()
        _uiState.value = _uiState.value.copy(
            isLoading = true,
            user = user,
            offlineQueueCount = caseRepo.getOfflineQueueCount()
        )

        viewModelScope.launch {
            val caseResult = caseRepo.getCases(forceRefresh)
            val attResult = if (user != null) attendanceRepo.getAttendanceHistory(user.id) else Result.success(emptyList())

            var isOnline = true
            val cases = caseResult.getOrElse {
                isOnline = false
                emptyList()
            }

            val total = cases.size
            val pending = cases.count { it.status.equals("Pending", ignoreCase = true) || it.status.equals("In Progress", ignoreCase = true) }
            val completed = cases.count { it.status.equals("Completed", ignoreCase = true) || it.status.equals("Approved", ignoreCase = true) }

            val upcoming = cases.filter {
                !it.status.equals("Approved", ignoreCase = true) && !it.status.equals("Rejected", ignoreCase = true)
            }.take(5)

            val latestAtt = attResult.getOrNull()?.firstOrNull() ?: (if (user != null) attendanceRepo.getLatestAttendance(user.id) else null)

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                isOnline = isOnline,
                user = user,
                totalAssigned = total,
                pendingInspections = pending,
                completedCases = completed,
                offlineQueueCount = caseRepo.getOfflineQueueCount(),
                upcomingCases = upcoming,
                latestAttendance = latestAtt,
                errorMessage = null
            )
        }
    }

    fun syncOfflineQueue() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val result = caseRepo.syncOfflineQueue()
            result.onSuccess { count ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    syncSuccessMessage = "Successfully synchronized $count items with server!",
                    offlineQueueCount = caseRepo.getOfflineQueueCount()
                )
                loadDashboard(forceRefresh = true)
            }.onFailure { ex ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = "Synchronization failed: ${ex.message}"
                )
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(syncSuccessMessage = null, errorMessage = null)
    }
}
