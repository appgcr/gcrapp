package com.gcrapp.valuation.core.database

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.gcrapp.valuation.data.models.AttendanceResponse
import com.gcrapp.valuation.data.models.ValuationCaseDto
import com.google.gson.Gson

data class CachedCaseRecord(
    val id: String,
    val clientName: String,
    val status: String,
    val caseJson: String,
    val updatedAt: Long
)

data class PendingSyncRecord(
    val id: Long,
    val actionType: String,
    val entityId: String,
    val payloadJson: String,
    val idempotencyKey: String,
    val status: String,
    val createdAt: Long
)

data class AttendanceDbRecord(
    val id: String,
    val userId: String,
    val name: String,
    val attendanceType: String,
    val lat: String,
    val lng: String,
    val timestamp: String,
    val status: String
)

class OfflineDatabase private constructor(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    private val gson = Gson()

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS cases_cache (
                id TEXT PRIMARY KEY,
                clientName TEXT,
                bankName TEXT,
                status TEXT,
                caseJson TEXT,
                updatedAt INTEGER
            )
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS offline_sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actionType TEXT,
                entityId TEXT,
                payloadJson TEXT,
                idempotencyKey TEXT UNIQUE,
                status TEXT,
                createdAt INTEGER
            )
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS attendance_cache (
                id TEXT PRIMARY KEY,
                userId TEXT,
                name TEXT,
                attendanceType TEXT,
                lat TEXT,
                lng TEXT,
                timestamp TEXT,
                status TEXT
            )
        """.trimIndent())
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS cases_cache")
        db.execSQL("DROP TABLE IF EXISTS offline_sync_queue")
        db.execSQL("DROP TABLE IF EXISTS attendance_cache")
        onCreate(db)
    }

    // --- Cases Cache ---

    fun saveCachedCase(id: String, clientName: String, status: String, caseJson: String) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("id", id)
            put("clientName", clientName)
            put("status", status)
            put("caseJson", caseJson)
            put("updatedAt", System.currentTimeMillis())
        }
        db.insertWithOnConflict("cases_cache", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun getCachedCase(id: String): CachedCaseRecord? {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT id, clientName, status, caseJson, updatedAt FROM cases_cache WHERE id = ?", arrayOf(id))
        cursor.use {
            if (it.moveToFirst()) {
                return CachedCaseRecord(
                    id = it.getString(0),
                    clientName = it.getString(1),
                    status = it.getString(2),
                    caseJson = it.getString(3),
                    updatedAt = it.getLong(4)
                )
            }
        }
        return null
    }

    fun getAllCachedCases(): List<CachedCaseRecord> {
        val list = mutableListOf<CachedCaseRecord>()
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT id, clientName, status, caseJson, updatedAt FROM cases_cache ORDER BY updatedAt DESC", null)
        cursor.use {
            while (it.moveToNext()) {
                list.add(
                    CachedCaseRecord(
                        id = it.getString(0),
                        clientName = it.getString(1),
                        status = it.getString(2),
                        caseJson = it.getString(3),
                        updatedAt = it.getLong(4)
                    )
                )
            }
        }
        return list
    }

    // --- Offline Sync Queue ---

    fun enqueueSyncItem(actionType: String, entityId: String, payloadJson: String, idempotencyKey: String) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("actionType", actionType)
            put("entityId", entityId)
            put("payloadJson", payloadJson)
            put("idempotencyKey", idempotencyKey)
            put("status", "PENDING")
            put("createdAt", System.currentTimeMillis())
        }
        db.insertWithOnConflict("offline_sync_queue", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun getPendingSyncItems(): List<PendingSyncRecord> {
        val list = mutableListOf<PendingSyncRecord>()
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, actionType, entityId, payloadJson, idempotencyKey, status, createdAt FROM offline_sync_queue WHERE status = 'PENDING' ORDER BY id ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(
                    PendingSyncRecord(
                        id = it.getLong(0),
                        actionType = it.getString(1),
                        entityId = it.getString(2),
                        payloadJson = it.getString(3),
                        idempotencyKey = it.getString(4),
                        status = it.getString(5),
                        createdAt = it.getLong(6)
                    )
                )
            }
        }
        return list
    }

    fun markSyncItemCompleted(id: Long) {
        val db = writableDatabase
        db.delete("offline_sync_queue", "id = ?", arrayOf(id.toString()))
    }

    // --- Attendance Cache ---

    fun saveAttendanceRecord(
        id: String,
        userId: String,
        name: String,
        attendanceType: String,
        lat: String,
        lng: String,
        timestamp: String,
        status: String
    ) {
        val db = writableDatabase
        val cv = ContentValues().apply {
            put("id", id)
            put("userId", userId)
            put("name", name)
            put("attendanceType", attendanceType)
            put("lat", lat)
            put("lng", lng)
            put("timestamp", timestamp)
            put("status", status)
        }
        db.insertWithOnConflict("attendance_cache", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun getAttendanceHistory(userId: String): List<AttendanceDbRecord> {
        val list = mutableListOf<AttendanceDbRecord>()
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, userId, name, attendanceType, lat, lng, timestamp, status FROM attendance_cache WHERE userId = ? ORDER BY timestamp DESC",
            arrayOf(userId)
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(
                    AttendanceDbRecord(
                        id = it.getString(0),
                        userId = it.getString(1),
                        name = it.getString(2),
                        attendanceType = it.getString(3),
                        lat = it.getString(4),
                        lng = it.getString(5),
                        timestamp = it.getString(6),
                        status = it.getString(7)
                    )
                )
            }
        }
        return list
    }

    companion object {
        private const val DATABASE_NAME = "gcr_offline_valuation.db"
        private const val DATABASE_VERSION = 2

        @Volatile
        private var instance: OfflineDatabase? = null

        fun getInstance(context: Context): OfflineDatabase {
            return instance ?: synchronized(this) {
                instance ?: OfflineDatabase(context.applicationContext).also { instance = it }
            }
        }
    }
}
