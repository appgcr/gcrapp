package com.gcrapp.valuation.data.repositories

import android.content.Context
import com.gcrapp.valuation.core.network.ApiClient
import com.gcrapp.valuation.data.models.ChatMessageDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ChatRepository(private val context: Context) {

    suspend fun getMessages(userId1: String = "engineer", userId2: String = "ADMIN"): Result<List<ChatMessageDto>> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.getChatMessages(userId1, userId2)
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!
                if (list.isNotEmpty()) {
                    Result.success(list)
                } else {
                    Result.success(getDefaultInitialMessages())
                }
            } else {
                Result.success(getDefaultInitialMessages())
            }
        } catch (e: Exception) {
            Result.success(getDefaultInitialMessages())
        }
    }

    suspend fun sendMessage(message: ChatMessageDto): Result<ChatMessageDto> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.sendChatMessage(message)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(message)
            }
        } catch (e: Exception) {
            Result.success(message)
        }
    }

    private fun getDefaultInitialMessages(): List<ChatMessageDto> {
        return listOf(
            ChatMessageDto(
                _id = "seed_1",
                senderId = "ADMIN",
                receiverId = "engineer",
                text = "Welcome to GCR Field Operations Channel. Senior Valuer & Desk Coordinator are active.",
                timestamp = "09:00 AM"
            ),
            ChatMessageDto(
                _id = "seed_2",
                senderId = "ADMIN",
                receiverId = "engineer",
                text = "Please submit high-resolution front elevation & boundary photos for today's SBI inspections.",
                timestamp = "09:05 AM"
            )
        )
    }
}
