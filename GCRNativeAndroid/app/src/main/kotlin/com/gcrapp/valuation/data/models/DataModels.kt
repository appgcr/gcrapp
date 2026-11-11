package com.gcrapp.valuation.data.models

import com.google.gson.annotations.SerializedName

// --- Authentication Models ---
data class LoginRequest(
    val username: String,
    val password: String
)

data class LoginResponse(
    val token: String,
    val user: UserDto
)

data class UserDto(
    val id: String = "",
    val username: String = "",
    val name: String = "",
    val role: String = "ENGINEER",
    val email: String = "",
    val branch: String = "",
    val district: String = "",
    val status: String = "Active"
)

// --- Valuation Case Models ---
data class ValuationCaseDto(
    val id: String = "",
    val clientName: String = "",
    val clientFatherName: String = "",
    val bankName: String = "",
    val bankBranch: String = "",
    val bankDistrict: String = "",
    val clientPhone: String = "",
    val address: String = "",
    val note: String = "",
    val inspectionDate: String = "",
    val inspectionTime: String = "",
    val locationData: String = "",
    val status: String = "Pending",
    val assignedEngineerId: String = "",
    val assignedEngineerName: String = "",
    val rejectionReason: String = "",
    val createdAt: String = "",
    val signatureDataUrl: String = "",
    val sitePhotos: List<String> = emptyList(),
    val propertyDetails: PropertyDetailsDto = PropertyDetailsDto(),
    val valuation: ValuationDto = ValuationDto()
)

data class PropertyDetailsDto(
    val deedNo: String = "",
    val deedYear: String = "",
    val netExtent: String = "",
    val surveyNo: String = "",
    val plotNo: String = "",
    val khathaNo: String = "",
    val assessmentNo: String = "",
    val doorNo: String = "",
    val marketValueAmount: String = "",
    val approvalPlanNo: String = "",
    val approvalPlanDate: String = "",
    val builderName: String = "",
    val managingPartner: String = "",
    val flatNo: String = "",
    val floorNo: String = "",
    val buildingAge: String = "0",
    val flooringType: String = "Vitrified Tiles",
    val structureType: String = "Framed structure",
    val roadWidth: String = "",
    val propertyType: String = "Independent House",
    val roadType: String = "",
    val plotType: String = "",
    val siteValue: SiteValueDto = SiteValueDto(),
    val additionsWork: List<AdditionsItemDto> = emptyList(),
    val boundariesDoc: BoundariesDto = BoundariesDto(),
    val boundariesActual: BoundariesDto = BoundariesDto()
)

data class SiteValueDto(
    val plinthArea: String = "",
    val ratePerSqYd: String = "15000",
    val floors: List<FloorItemDto> = listOf(
        FloorItemDto("gf", "Ground Floor (GF)", "650")
    )
)

data class FloorItemDto(
    val id: String = "gf",
    val label: String = "Ground Floor (GF)",
    val value: String = "",
    val rate: String = "1800"
) {
    constructor(id: String, label: String, value: String, rate: Double) : this(
        id = id,
        label = label,
        value = value,
        rate = if (rate % 1.0 == 0.0) rate.toLong().toString() else rate.toString()
    )
}

data class AdditionsItemDto(
    val description: String = "",
    val quantity: String = "1",
    val rate: String = "0",
    val amount: String = "0"
) {
    constructor(description: String, quantity: String, rate: Double, amount: Double) : this(
        description = description,
        quantity = quantity,
        rate = if (rate % 1.0 == 0.0) rate.toLong().toString() else rate.toString(),
        amount = if (amount % 1.0 == 0.0) amount.toLong().toString() else amount.toString()
    )
    constructor(description: String, amount: Double) : this(
        description = description,
        quantity = "1",
        rate = "0",
        amount = if (amount % 1.0 == 0.0) amount.toLong().toString() else amount.toString()
    )
}

data class BoundariesDto(
    val north: String = "",
    val south: String = "",
    val east: String = "",
    val west: String = ""
)

data class ValuationDto(
    val landRate: Double = 0.0,
    val landValue: Double = 0.0,
    val netExtentSqYards: Double = 0.0,
    val constructionRate: Double = 0.0,
    val replacementCost: Double = 0.0,
    val structureReplacementCost: Double = 0.0,
    val buildingAge: Int = 0,
    val buildingLife: Int = 60,
    val depreciationPercent: Int = 0,
    val depreciationAmount: Double = 0.0,
    val netStructureValue: Double = 0.0,
    val amenitiesValue: Double = 0.0,
    val fairMarketValue: Double = 0.0,
    val realizableValue: Double = 0.0,
    val distressSaleValue: Double = 0.0,
    val insurableValue: Double = 0.0,
    val valuationStatus: String = "SUCCESS",
    val errorMessage: String? = null
)

// --- Attendance Models ---
data class AttendanceRequest(
    val userId: String,
    val name: String,
    val attendanceType: String, // "Clock-In" or "Clock-Out"
    val lat: String,
    val lng: String,
    val verificationMethod: String = "FACE_BIOMETRIC",
    val faceVerified: Boolean = true,
    val livenessScore: Double = 0.95,
    val imageUrl: String = ""
)

data class AttendanceResponse(
    val id: String = "",
    val userId: String = "",
    val name: String = "",
    val timestamp: String = "",
    val lat: String = "",
    val lng: String = "",
    val attendanceType: String = "",
    val status: String = "Verified",
    val formattedTime: String = "",
    val formattedDate: String = "",
    val workDurationHours: Double = 0.0,
    val workDurationFormatted: String = "",
    val faceVerified: Boolean = true,
    val imageUrl: String = ""
)

// --- Notification Models ---
data class NotificationDto(
    val _id: String = "",
    val targetUser: String = "",
    val title: String = "",
    val message: String = "",
    val read: Boolean = false,
    val createdAt: String = ""
)

data class CreateNotificationRequest(
    val targetUser: String,
    val title: String,
    val message: String
)

// --- Chat Models ---
data class ChatMessageDto(
    val _id: String = "",
    val senderId: String = "",
    val receiverId: String = "",
    val text: String = "",
    val caseId: String? = null,
    val attachmentUrl: String? = null,
    val attachmentType: String? = null,
    val isRead: Boolean = false,
    val timestamp: String = ""
)
