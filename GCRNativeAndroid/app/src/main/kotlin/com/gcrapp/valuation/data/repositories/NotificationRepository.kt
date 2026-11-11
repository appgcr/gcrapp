package com.gcrapp.valuation.data.repositories

import android.content.Context
import com.gcrapp.valuation.core.network.ApiClient
import com.gcrapp.valuation.data.models.CreateNotificationRequest
import com.gcrapp.valuation.data.models.NotificationDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class NotificationRepository(private val context: Context) {

    suspend fun getNotifications(): Result<List<NotificationDto>> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.getNotifications()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.success(emptyList())
        }
    }

    suspend fun sendNotification(targetUser: String, title: String, message: String): Result<NotificationDto> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.sendNotification(CreateNotificationRequest(targetUser, title, message))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to send notification"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
