package com.gcrapp.valuation.ui.inspection

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gcrapp.valuation.core.calculation.ValuationEngine
import com.gcrapp.valuation.data.models.*
import com.gcrapp.valuation.data.repositories.CaseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class InspectionUiState(
    val currentStep: Int = 1,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val caseDto: ValuationCaseDto = ValuationCaseDto(),
    val valuation: ValuationDto = ValuationDto(),
    val errorMessage: String? = null,
    val saveSuccessMessage: String? = null,
    val isSubmitted: Boolean = false
)

class InspectionViewModel(application: Application) : AndroidViewModel(application) {
    private val caseRepo = CaseRepository(application)

    private val _uiState = MutableStateFlow(InspectionUiState())
    val uiState: StateFlow<InspectionUiState> = _uiState.asStateFlow()

    fun loadCase(id: String) {
        if (id.isBlank() || id == "new") {
            val newCase = ValuationCaseDto(
                id = "LOCAL_" + System.currentTimeMillis(),
                bankName = "State Bank of India",
                bankBranch = "Main Branch",
                bankDistrict = "Krishna",
                status = "In Progress"
            )
            _uiState.value = InspectionUiState(
                caseDto = newCase,
                valuation = ValuationEngine.calculate(newCase.propertyDetails, bankName = newCase.bankName)
            )
            return
        }

        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
        viewModelScope.launch {
            val result = caseRepo.getCaseById(id)
            result.onSuccess { loaded ->
                val calc = ValuationEngine.calculate(loaded.propertyDetails, bankName = loaded.bankName)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    caseDto = loaded,
                    valuation = calc
                )
            }.onFailure { ex ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = ex.message ?: "Failed to load case details"
                )
            }
        }
    }

    fun setStep(step: Int) {
        if (step in 1..6) {
            _uiState.value = _uiState.value.copy(currentStep = step)
        }
    }

    fun updateCase(modifier: (ValuationCaseDto) -> ValuationCaseDto) {
        val updated = modifier(_uiState.value.caseDto)
        val calc = ValuationEngine.calculate(updated.propertyDetails, bankName = updated.bankName)
        _uiState.value = _uiState.value.copy(
            caseDto = updated.copy(valuation = calc),
            valuation = calc
        )
    }

    fun updatePropertyDetails(modifier: (PropertyDetailsDto) -> PropertyDetailsDto) {
        val updatedProp = modifier(_uiState.value.caseDto.propertyDetails)
        val calc = ValuationEngine.calculate(updatedProp, bankName = _uiState.value.caseDto.bankName)
        val updatedCase = _uiState.value.caseDto.copy(
            propertyDetails = updatedProp,
            valuation = calc
        )
        _uiState.value = _uiState.value.copy(
            caseDto = updatedCase,
            valuation = calc
        )
    }

    fun addFloor(label: String, area: String, rate: String = "1800") {
        updatePropertyDetails { prop ->
            val newFloors = prop.siteValue.floors.toMutableList().apply {
                add(FloorItemDto(id = "floor_${System.currentTimeMillis()}", label = label, value = area, rate = rate))
            }
            prop.copy(siteValue = prop.siteValue.copy(floors = newFloors))
        }
    }

    fun addFloor(label: String, area: String, rate: Double) {
        addFloor(label, area, if (rate % 1.0 == 0.0) rate.toLong().toString() else rate.toString())
    }

    fun removeFloor(index: Int) {
        updatePropertyDetails { prop ->
            val newFloors = prop.siteValue.floors.toMutableList()
            if (index in 0 until newFloors.size) {
                newFloors.removeAt(index)
            }
            prop.copy(siteValue = prop.siteValue.copy(floors = newFloors))
        }
    }

    fun addAmenity(desc: String, qty: String, rate: String, amount: String = "") {
        updatePropertyDetails { prop ->
            val exactAmount = if (amount.isNotBlank()) amount else {
                try {
                    val qScaled = ValuationEngine.parseDecimalToScaled(qty, 2, "Quantity")
                    val rScaled = ValuationEngine.parseDecimalToScaled(rate, 2, "Rate")
                    val aPaise = qScaled.multiply(rScaled).add(java.math.BigInteger.valueOf(50L)).divide(java.math.BigInteger.valueOf(100L))
                    val rupees = aPaise.add(java.math.BigInteger.valueOf(50L)).divide(java.math.BigInteger.valueOf(100L))
                    rupees.toString()
                } catch (e: Exception) {
                    "0"
                }
            }
            val newAmenities = prop.additionsWork.toMutableList().apply {
                add(AdditionsItemDto(description = desc, quantity = qty, rate = rate, amount = exactAmount))
            }
            prop.copy(additionsWork = newAmenities)
        }
    }

    fun addAmenity(desc: String, qty: String, rate: Double) {
        val rStr = if (rate % 1.0 == 0.0) rate.toLong().toString() else rate.toString()
        addAmenity(desc, qty, rStr)
    }

    fun removeAmenity(index: Int) {
        updatePropertyDetails { prop ->
            val newAmenities = prop.additionsWork.toMutableList()
            if (index in 0 until newAmenities.size) {
                newAmenities.removeAt(index)
            }
            prop.copy(additionsWork = newAmenities)
        }
    }

    fun addPhoto(photoDataUrl: String) {
        updateCase { c ->
            val updatedPhotos = c.sitePhotos.toMutableList().apply { add(photoDataUrl) }
            c.copy(sitePhotos = updatedPhotos)
        }
    }

    fun removePhoto(index: Int) {
        updateCase { c ->
            val updatedPhotos = c.sitePhotos.toMutableList()
            if (index in 0 until updatedPhotos.size) {
                updatedPhotos.removeAt(index)
            }
            c.copy(sitePhotos = updatedPhotos)
        }
    }

    fun setSignature(signatureBase64: String) {
        updateCase { c ->
            c.copy(signatureDataUrl = signatureBase64)
        }
    }

    fun saveDraft() {
        _uiState.value = _uiState.value.copy(isSaving = true, errorMessage = null)
        viewModelScope.launch {
            val res = caseRepo.saveDraftLocally(_uiState.value.caseDto)
            res.onSuccess {
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    saveSuccessMessage = "Draft saved safely in local encrypted storage."
                )
            }.onFailure { ex ->
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    errorMessage = "Failed to save draft: ${ex.message}"
                )
            }
        }
    }

    fun submitFinalValuation(onSuccess: () -> Unit) {
        val currentCase = _uiState.value.caseDto
        if (currentCase.signatureDataUrl.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Engineer signature is required before submitting final valuation.")
            return
        }

        _uiState.value = _uiState.value.copy(isSaving = true, errorMessage = null)
        viewModelScope.launch {
            val completedCase = currentCase.copy(
                status = "Completed",
                valuation = _uiState.value.valuation
            )
            val result = caseRepo.submitCase(completedCase)
            result.onSuccess { submitted ->
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    caseDto = submitted,
                    isSubmitted = true,
                    saveSuccessMessage = "Valuation case submitted successfully!"
                )
                onSuccess()
            }.onFailure { ex ->
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    errorMessage = "Submission error: ${ex.message}"
                )
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, saveSuccessMessage = null)
    }
}
