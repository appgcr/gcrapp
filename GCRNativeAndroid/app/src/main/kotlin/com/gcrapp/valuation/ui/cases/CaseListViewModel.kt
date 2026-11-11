package com.gcrapp.valuation.ui.cases

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gcrapp.valuation.data.models.ValuationCaseDto
import com.gcrapp.valuation.data.repositories.CaseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CaseListUiState(
    val isLoading: Boolean = false,
    val allCases: List<ValuationCaseDto> = emptyList(),
    val filteredCases: List<ValuationCaseDto> = emptyList(),
    val searchQuery: String = "",
    val selectedFilter: String = "All",
    val errorMessage: String? = null
)

class CaseListViewModel(application: Application) : AndroidViewModel(application) {
    private val caseRepo = CaseRepository(application)

    private val _uiState = MutableStateFlow(CaseListUiState())
    val uiState: StateFlow<CaseListUiState> = _uiState.asStateFlow()

    init {
        loadCases()
    }

    fun loadCases(forceRefresh: Boolean = false) {
        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            val result = caseRepo.getCases(forceRefresh)
            result.onSuccess { list ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    allCases = list
                )
                applyFilters()
            }.onFailure { ex ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = ex.message ?: "Failed to load valuation cases"
                )
            }
        }
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        applyFilters()
    }

    fun setFilter(filter: String) {
        _uiState.value = _uiState.value.copy(selectedFilter = filter)
        applyFilters()
    }

    private fun applyFilters() {
        val q = _uiState.value.searchQuery.trim().lowercase()
        val filter = _uiState.value.selectedFilter

        val filtered = _uiState.value.allCases.filter { c ->
            val matchesQuery = q.isBlank() ||
                c.clientName.lowercase().contains(q) ||
                c.bankName.lowercase().contains(q) ||
                c.bankBranch.lowercase().contains(q) ||
                c.address.lowercase().contains(q) ||
                c.propertyDetails.surveyNo.lowercase().contains(q)

            val matchesFilter = when (filter) {
                "All" -> true
                "Pending" -> c.status.equals("Pending", ignoreCase = true)
                "In Progress" -> c.status.equals("In Progress", ignoreCase = true)
                "Completed" -> c.status.equals("Completed", ignoreCase = true)
                "Approved" -> c.status.equals("Approved", ignoreCase = true)
                else -> true
            }

            matchesQuery && matchesFilter
        }

        _uiState.value = _uiState.value.copy(filteredCases = filtered)
    }
}
