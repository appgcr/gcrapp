package com.gcrapp.valuation.data.repositories

import android.content.Context
import com.gcrapp.valuation.core.database.OfflineDatabase
import com.gcrapp.valuation.core.network.ApiClient
import com.gcrapp.valuation.data.models.AttendanceRequest
import com.gcrapp.valuation.data.models.AttendanceResponse
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class AttendanceRepository(private val context: Context) {
    private val db = OfflineDatabase.getInstance(context)
    private val gson = Gson()

    suspend fun submitAttendance(
        userId: String,
        name: String,
        attendanceType: String,
        lat: Double,
        lng: Double,
        faceVerified: Boolean = true,
        imageUrl: String = ""
    ): Result<AttendanceResponse> = withContext(Dispatchers.IO) {
        val request = AttendanceRequest(
            userId = userId,
            name = name,
            attendanceType = attendanceType,
            lat = lat.toString(),
            lng = lng.toString(),
            faceVerified = faceVerified,
            verificationMethod = "FACE_BIOMETRIC_NATIVE",
            imageUrl = imageUrl
        )

        try {
            val api = ApiClient.getApiService(context)
            val response = api.submitAttendance(request)

            if (response.isSuccessful && response.body() != null) {
                val record = response.body()!!
                db.saveAttendanceRecord(
                    id = record.id.ifBlank { UUID.randomUUID().toString() },
                    userId = userId,
                    name = name,
                    attendanceType = attendanceType,
                    lat = lat.toString(),
                    lng = lng.toString(),
                    timestamp = record.timestamp.ifBlank { System.currentTimeMillis().toString() },
                    status = "Verified"
                )
                Result.success(record)
            } else {
                // Save offline attendance
                val localId = "LOCAL_ATT_" + System.currentTimeMillis()
                val nowStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                val todayStr = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(Date())

                db.saveAttendanceRecord(
                    id = localId,
                    userId = userId,
                    name = name,
                    attendanceType = attendanceType,
                    lat = lat.toString(),
                    lng = lng.toString(),
                    timestamp = System.currentTimeMillis().toString(),
                    status = "Waiting to Sync"
                )

                // Enqueue to offline sync
                db.enqueueSyncItem(
                    actionType = "ATTENDANCE_SUBMIT",
                    entityId = localId,
                    payloadJson = gson.toJson(request),
                    idempotencyKey = UUID.randomUUID().toString()
                )

                val offlineResp = AttendanceResponse(
                    id = localId,
                    userId = userId,
                    name = name,
                    timestamp = System.currentTimeMillis().toString(),
                    lat = lat.toString(),
                    lng = lng.toString(),
                    attendanceType = attendanceType,
                    status = "Waiting to Sync",
                    formattedTime = nowStr,
                    formattedDate = todayStr,
                    faceVerified = faceVerified
                )
                Result.success(offlineResp)
            }
        } catch (e: Exception) {
            // Offline fallback
            val localId = "LOCAL_ATT_" + System.currentTimeMillis()
            val nowStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
            val todayStr = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(Date())

            db.saveAttendanceRecord(
                id = localId,
                userId = userId,
                name = name,
                attendanceType = attendanceType,
                lat = lat.toString(),
                lng = lng.toString(),
                timestamp = System.currentTimeMillis().toString(),
                status = "Waiting to Sync"
            )

            db.enqueueSyncItem(
                actionType = "ATTENDANCE_SUBMIT",
                entityId = localId,
                payloadJson = gson.toJson(request),
                idempotencyKey = UUID.randomUUID().toString()
            )

            val offlineResp = AttendanceResponse(
                id = localId,
                userId = userId,
                name = name,
                timestamp = System.currentTimeMillis().toString(),
                lat = lat.toString(),
                lng = lng.toString(),
                attendanceType = attendanceType,
                status = "Waiting to Sync",
                formattedTime = nowStr,
                formattedDate = todayStr,
                faceVerified = faceVerified
            )
            Result.success(offlineResp)
        }
    }

    suspend fun getAttendanceHistory(userId: String): Result<List<AttendanceResponse>> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.getAttendanceHistory(userId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val cached = db.getAttendanceHistory(userId).map {
                    AttendanceResponse(
                        id = it.id,
                        userId = it.userId,
                        name = it.name,
                        timestamp = it.timestamp,
                        lat = it.lat,
                        lng = it.lng,
                        attendanceType = it.attendanceType,
                        status = it.status
                    )
                }
                Result.success(cached)
            }
        } catch (e: Exception) {
            val cached = db.getAttendanceHistory(userId).map {
                AttendanceResponse(
                    id = it.id,
                    userId = it.userId,
                    name = it.name,
                    timestamp = it.timestamp,
                    lat = it.lat,
                    lng = it.lng,
                    attendanceType = it.attendanceType,
                    status = it.status
                )
            }
            Result.success(cached)
        }
    }

    fun getLatestAttendance(userId: String): AttendanceResponse? {
        val list = db.getAttendanceHistory(userId)
        val first = list.firstOrNull() ?: return null
        return AttendanceResponse(
            id = first.id,
            userId = first.userId,
            name = first.name,
            timestamp = first.timestamp,
            lat = first.lat,
            lng = first.lng,
            attendanceType = first.attendanceType,
            status = first.status
        )
    }
}
