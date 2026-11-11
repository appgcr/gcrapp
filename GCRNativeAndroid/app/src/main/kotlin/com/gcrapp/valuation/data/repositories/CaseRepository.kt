package com.gcrapp.valuation.data.repositories

import android.content.Context
import com.gcrapp.valuation.core.database.OfflineDatabase
import com.gcrapp.valuation.core.network.ApiClient
import com.gcrapp.valuation.data.models.ValuationCaseDto
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import java.io.InputStream
import java.util.UUID

class CaseRepository(private val context: Context) {
    private val db = OfflineDatabase.getInstance(context)
    private val gson = Gson()

    suspend fun getCases(forceRefresh: Boolean = false): Result<List<ValuationCaseDto>> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.getCases()

            if (response.isSuccessful && response.body() != null) {
                val cases = response.body()!!
                // Cache to SQLite
                cases.forEach { c ->
                    val caseJson = gson.toJson(c)
                    db.saveCachedCase(c.id, c.clientName, c.status, caseJson)
                }
                Result.success(cases)
            } else {
                // Read from offline cache
                val cached = db.getAllCachedCases()
                val list = cached.mapNotNull {
                    try { gson.fromJson(it.caseJson, ValuationCaseDto::class.java) } catch (e: Exception) { null }
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            // Fallback to SQLite cache on network error
            val cached = db.getAllCachedCases()
            val list = cached.mapNotNull {
                try { gson.fromJson(it.caseJson, ValuationCaseDto::class.java) } catch (e: Exception) { null }
            }
            if (list.isNotEmpty()) {
                Result.success(list)
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun getCaseById(id: String): Result<ValuationCaseDto> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.getCaseById(id)

            if (response.isSuccessful && response.body() != null) {
                val caseDto = response.body()!!
                db.saveCachedCase(caseDto.id, caseDto.clientName, caseDto.status, gson.toJson(caseDto))
                Result.success(caseDto)
            } else {
                val cached = db.getCachedCase(id)
                if (cached != null) {
                    val dto = gson.fromJson(cached.caseJson, ValuationCaseDto::class.java)
                    Result.success(dto)
                } else {
                    Result.failure(Exception("Case not found"))
                }
            }
        } catch (e: Exception) {
            val cached = db.getCachedCase(id)
            if (cached != null) {
                val dto = gson.fromJson(cached.caseJson, ValuationCaseDto::class.java)
                Result.success(dto)
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun saveDraftLocally(caseDto: ValuationCaseDto): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val json = gson.toJson(caseDto)
            db.saveCachedCase(caseDto.id, caseDto.clientName, "Draft", json)
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitCase(caseDto: ValuationCaseDto): Result<ValuationCaseDto> = withContext(Dispatchers.IO) {
        val json = gson.toJson(caseDto)
        try {
            val api = ApiClient.getApiService(context)
            val response = if (caseDto.id.isNotBlank() && !caseDto.id.startsWith("LOCAL_")) {
                api.updateCase(caseDto.id, caseDto)
            } else {
                api.createCase(caseDto)
            }

            if (response.isSuccessful && response.body() != null) {
                val updated = response.body()!!
                db.saveCachedCase(updated.id, updated.clientName, updated.status, gson.toJson(updated))
                Result.success(updated)
            } else {
                // Enqueue to offline sync queue
                val idempotencyKey = UUID.randomUUID().toString()
                db.enqueueSyncItem("CASE_SUBMIT", caseDto.id, json, idempotencyKey)
                db.saveCachedCase(caseDto.id, caseDto.clientName, "Waiting to Sync", json)
                Result.success(caseDto.copy(status = "Waiting to Sync"))
            }
        } catch (e: Exception) {
            // Enqueue to offline sync queue on network exception
            val idempotencyKey = UUID.randomUUID().toString()
            db.enqueueSyncItem("CASE_SUBMIT", caseDto.id, json, idempotencyKey)
            db.saveCachedCase(caseDto.id, caseDto.clientName, "Waiting to Sync", json)
            Result.success(caseDto.copy(status = "Waiting to Sync"))
        }
    }

    suspend fun syncOfflineQueue(): Result<Int> = withContext(Dispatchers.IO) {
        var syncedCount = 0
        try {
            val pending = db.getPendingSyncItems()
            val api = ApiClient.getApiService(context)

            for (item in pending) {
                try {
                    when (item.actionType) {
                        "CASE_SUBMIT" -> {
                            val dto = gson.fromJson(item.payloadJson, ValuationCaseDto::class.java)
                            val res = if (dto.id.isNotBlank() && !dto.id.startsWith("LOCAL_")) {
                                api.updateCase(dto.id, dto)
                            } else {
                                api.createCase(dto)
                            }
                            if (res.isSuccessful) {
                                db.markSyncItemCompleted(item.id)
                                syncedCount++
                            }
                        }
                    }
                } catch (ex: Exception) {
                    // Stop on network failure
                    break
                }
            }
            Result.success(syncedCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getOfflineQueueCount(): Int {
        return db.getPendingSyncItems().size
    }

    suspend fun downloadReport(caseId: String): Result<InputStream> = withContext(Dispatchers.IO) {
        try {
            val api = ApiClient.getApiService(context)
            val response = api.downloadCaseReport(caseId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.byteStream())
            } else {
                Result.failure(Exception("Failed to download report"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
