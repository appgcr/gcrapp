package com.gcrapp.valuation.core.network

import com.gcrapp.valuation.data.models.*
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // --- Authentication ---
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<Map<String, Any>>

    // --- Valuation Cases ---
    @GET("api/cases")
    suspend fun getCases(): Response<List<ValuationCaseDto>>

    @GET("api/cases/{id}")
    suspend fun getCaseById(@Path("id") id: String): Response<ValuationCaseDto>

    @POST("api/cases")
    suspend fun createCase(@Body caseData: ValuationCaseDto): Response<ValuationCaseDto>

    @PUT("api/cases/{id}")
    suspend fun updateCase(@Path("id") id: String, @Body caseData: ValuationCaseDto): Response<ValuationCaseDto>

    @Streaming
    @GET("api/cases/{id}/report")
    suspend fun downloadCaseReport(@Path("id") id: String): Response<ResponseBody>

    // --- Biometric Attendance ---
    @POST("api/attendance")
    suspend fun submitAttendance(@Body request: AttendanceRequest): Response<AttendanceResponse>

    @GET("api/attendance")
    suspend fun getAttendanceHistory(@Query("userId") userId: String): Response<List<AttendanceResponse>>

    // --- Notifications ---
    @GET("api/notifications")
    suspend fun getNotifications(): Response<List<NotificationDto>>

    @POST("api/notifications")
    suspend fun sendNotification(@Body request: CreateNotificationRequest): Response<NotificationDto>

    // --- System Config ---
    @GET("api/config")
    suspend fun getConfig(): Response<Map<String, Any>>

    // --- Field Chat System ---
    @GET("api/chat/{userId1}/{userId2}")
    suspend fun getChatMessages(
        @Path("userId1") userId1: String,
        @Path("userId2") userId2: String
    ): Response<List<ChatMessageDto>>

    @POST("api/chat")
    suspend fun sendChatMessage(@Body message: ChatMessageDto): Response<ChatMessageDto>
}
