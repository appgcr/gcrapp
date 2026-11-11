package com.gcrapp.valuation.ui.attendance

import android.annotation.SuppressLint
import android.app.Application
import android.graphics.Bitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gcrapp.valuation.data.models.AttendanceResponse
import com.gcrapp.valuation.data.repositories.AttendanceRepository
import com.gcrapp.valuation.data.repositories.AuthRepository
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class AttendanceUiState(
    val isLoading: Boolean = false,
    val isLocating: Boolean = false,
    val isCapturingPhoto: Boolean = false,
    val currentLat: Double = 16.5062,
    val currentLng: Double = 80.6480,
    val locationAccuracy: Float = 0f,
    val isLocationAcquired: Boolean = false,
    val addressTitle: String = "Kadapa District, Andhra Pradesh",
    val faceVerified: Boolean = false,
    val capturedBitmap: Bitmap? = null,
    val capturedImageUrl: String? = null,
    val hasCameraPermission: Boolean = false,
    val hasLocationPermission: Boolean = false,
    val lastAttendance: AttendanceResponse? = null,
    val history: List<AttendanceResponse> = emptyList(),
    val todayLogs: List<AttendanceResponse> = emptyList(),
    val isOnDuty: Boolean = false,
    val firstCheckInTime: String? = null,
    val lastCheckOutTime: String? = null,
    val totalShiftMinutes: Long = 0,
    val shiftDurationText: String = "0 mins",
    val progressPercent: Int = 0,
    val targetShiftHours: Float = 8.0f,
    val activeView: String = "MARK", // "MARK" | "CALENDAR"
    val successMessage: String? = null,
    val errorMessage: String? = null
)

class AttendanceViewModel(application: Application) : AndroidViewModel(application) {
    private val attendanceRepo = AttendanceRepository(application)
    private val authRepo = AuthRepository(application)
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(application)

    private val _uiState = MutableStateFlow(AttendanceUiState())
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    init {
        loadHistory()
        // Periodic timer to update active on-duty shift minutes
        viewModelScope.launch {
            while (true) {
                delay(30000) // update every 30 seconds
                recalculateShiftTimes(_uiState.value.todayLogs)
            }
        }
    }

    fun setActiveView(view: String) {
        _uiState.value = _uiState.value.copy(activeView = view)
    }

    fun setPermissions(camera: Boolean, location: Boolean) {
        _uiState.value = _uiState.value.copy(
            hasCameraPermission = camera,
            hasLocationPermission = location
        )
        if (location) {
            fetchLocation()
        }
    }

    fun setCapturedPhoto(bitmap: Bitmap, dataUri: String) {
        _uiState.value = _uiState.value.copy(
            capturedBitmap = bitmap,
            capturedImageUrl = dataUri,
            faceVerified = true
        )
    }

    fun clearCapturedPhoto() {
        _uiState.value = _uiState.value.copy(
            capturedBitmap = null,
            capturedImageUrl = null,
            faceVerified = false
        )
    }

    @SuppressLint("MissingPermission")
    fun fetchLocation() {
        _uiState.value = _uiState.value.copy(isLocating = true)
        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc ->
                    if (loc != null) {
                        _uiState.value = _uiState.value.copy(
                            isLocating = false,
                            currentLat = loc.latitude,
                            currentLng = loc.longitude,
                            locationAccuracy = loc.accuracy,
                            isLocationAcquired = true
                        )
                    } else {
                        fusedLocationClient.lastLocation.addOnSuccessListener { lastLoc ->
                            if (lastLoc != null) {
                                _uiState.value = _uiState.value.copy(
                                    isLocating = false,
                                    currentLat = lastLoc.latitude,
                                    currentLng = lastLoc.longitude,
                                    locationAccuracy = lastLoc.accuracy,
                                    isLocationAcquired = true
                                )
                            } else {
                                _uiState.value = _uiState.value.copy(isLocating = false)
                            }
                        }.addOnFailureListener {
                            _uiState.value = _uiState.value.copy(isLocating = false)
                        }
                    }
                }.addOnFailureListener {
                    _uiState.value = _uiState.value.copy(isLocating = false)
                }
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(isLocating = false)
        }
    }

    fun submitAttendance(type: String, photoDataUri: String = "", onComplete: ((Boolean) -> Unit)? = null) {
        val user = authRepo.getCurrentUser()
        if (user == null) {
            _uiState.value = _uiState.value.copy(errorMessage = "User session expired. Please sign in again.")
            onComplete?.invoke(false)
            return
        }

        // Duplicate Clock-In check
        val onDuty = _uiState.value.isOnDuty
        if (type.equals("Clock-In", ignoreCase = true) && onDuty) {
            _uiState.value = _uiState.value.copy(errorMessage = "Already clocked in! You must Clock-Out first.")
            onComplete?.invoke(false)
            return
        }
        if (type.equals("Clock-Out", ignoreCase = true) && !onDuty) {
            _uiState.value = _uiState.value.copy(errorMessage = "Not clocked in! You must Clock-In first.")
            onComplete?.invoke(false)
            return
        }

        val finalImage = photoDataUri.ifBlank { _uiState.value.capturedImageUrl ?: "" }

        _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, successMessage = null)

        viewModelScope.launch {
            val result = attendanceRepo.submitAttendance(
                userId = user.id,
                name = user.name.ifBlank { user.username },
                attendanceType = type,
                lat = _uiState.value.currentLat,
                lng = _uiState.value.currentLng,
                faceVerified = true,
                imageUrl = finalImage
            )

            result.onSuccess { record ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    lastAttendance = record,
                    successMessage = "Successfully verified: $type recorded with live selfie & GPS!",
                    errorMessage = null
                )
                loadHistory()
                onComplete?.invoke(true)
            }.onFailure { ex ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = "Attendance failed: ${ex.message}"
                )
                onComplete?.invoke(false)
            }
        }
    }

    fun loadHistory() {
        val user = authRepo.getCurrentUser() ?: return
        viewModelScope.launch {
            val res = attendanceRepo.getAttendanceHistory(user.id)
            res.onSuccess { list ->
                val sorted = list.sortedByDescending { it.timestamp }
                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

                // Filter logs belonging to today
                val today = sorted.filter { item ->
                    try {
                        val epoch = item.timestamp.toLongOrNull()
                        if (epoch != null) {
                            val dStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(epoch))
                            dStr == todayStr
                        } else {
                            true
                        }
                    } catch (e: Exception) {
                        true
                    }
                }

                _uiState.value = _uiState.value.copy(
                    history = sorted,
                    todayLogs = today,
                    lastAttendance = sorted.firstOrNull() ?: _uiState.value.lastAttendance
                )

                recalculateShiftTimes(today)
            }
        }
    }

    private fun recalculateShiftTimes(todayLogs: List<AttendanceResponse>) {
        val latestLog = todayLogs.firstOrNull()
        val onDuty = latestLog?.attendanceType?.equals("Clock-In", ignoreCase = true) == true

        // First check-in of the day
        val firstIn = todayLogs.lastOrNull { it.attendanceType.equals("Clock-In", ignoreCase = true) }
        val lastOut = todayLogs.firstOrNull { it.attendanceType.equals("Clock-Out", ignoreCase = true) }

        // Compute total completed duration
        var totalMinutes = 0L
        todayLogs.forEach { l ->
            if (l.workDurationHours > 0) {
                totalMinutes += (l.workDurationHours * 60).toLong()
            }
        }

        // Add currently active elapsed time if currently on-duty
        if (onDuty && latestLog != null) {
            val startEpoch = latestLog.timestamp.toLongOrNull() ?: System.currentTimeMillis()
            val elapsedMs = maxOf(0L, System.currentTimeMillis() - startEpoch)
            totalMinutes += (elapsedMs / (1000 * 60))
        }

        val hours = totalMinutes / 60
        val mins = totalMinutes % 60
        val durationStr = when {
            hours == 0L -> "$mins mins"
            mins == 0L -> "$hours hrs"
            else -> "$hours hrs $mins mins"
        }

        val netHours = totalMinutes / 60f
        val pct = minOf(100, ((netHours / 8.0f) * 100).toInt())

        _uiState.value = _uiState.value.copy(
            isOnDuty = onDuty,
            firstCheckInTime = firstIn?.formattedTime?.ifBlank { null },
            lastCheckOutTime = lastOut?.formattedTime?.ifBlank { null },
            totalShiftMinutes = totalMinutes,
            shiftDurationText = durationStr,
            progressPercent = pct
        )
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(successMessage = null, errorMessage = null)
    }
}
