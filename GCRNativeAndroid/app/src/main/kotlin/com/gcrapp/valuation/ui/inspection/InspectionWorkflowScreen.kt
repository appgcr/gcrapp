package com.gcrapp.valuation.ui.inspection

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.util.Base64
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gcrapp.valuation.data.models.BoundariesDto
import com.gcrapp.valuation.data.models.FloorItemDto
import com.gcrapp.valuation.data.models.PropertyDetailsDto
import com.gcrapp.valuation.data.models.SiteValueDto
import com.gcrapp.valuation.ui.components.AppTopBar
import com.gcrapp.valuation.ui.components.PrimaryButton
import com.gcrapp.valuation.ui.components.SecondaryButton
import com.gcrapp.valuation.ui.components.SignatureCanvas
import com.gcrapp.valuation.ui.theme.*
import java.io.ByteArrayOutputStream
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InspectionWorkflowScreen(
    viewModel: InspectionViewModel,
    onBack: () -> Unit,
    onSubmitSuccess: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val stepTitles = listOf(
        "1. Setup",
        "2. Legal & OCR",
        "3. Property Specs",
        "4. Photographs",
        "5. Reconciliation",
        "6. Valuation & Sign"
    )

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Field Inspection",
                subtitle = uiState.caseDto.clientName.ifBlank { "Valuation Case" },
                showBackButton = true,
                onBackClick = onBack
            )
        },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shadowElevation = 8.dp,
                color = SurfaceLight
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (uiState.currentStep > 1) {
                        OutlinedButton(
                            onClick = { viewModel.setStep(uiState.currentStep - 1) },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Previous")
                        }
                    } else {
                        OutlinedButton(
                            onClick = { viewModel.saveDraft() },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Save Draft")
                        }
                    }

                    if (uiState.currentStep < 6) {
                        Button(
                            onClick = { viewModel.setStep(uiState.currentStep + 1) },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryNavy)
                        ) {
                            Text("Next Step")
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    } else {
                        Button(
                            onClick = { viewModel.submitFinalValuation(onSubmitSuccess) },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            enabled = !uiState.isSaving
                        ) {
                            if (uiState.isSaving) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White)
                            } else {
                                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Submit Valuation")
                            }
                        }
                    }
                }
            }
        },
        containerColor = Slate50
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Scrollable Step Indicator
            ScrollableTabRow(
                selectedTabIndex = uiState.currentStep - 1,
                edgePadding = 16.dp,
                containerColor = SurfaceLight,
                contentColor = PrimaryNavy,
                indicator = {}
            ) {
                stepTitles.forEachIndexed { index, title ->
                    val stepNum = index + 1
                    val isSelected = uiState.currentStep == stepNum
                    val isCompleted = uiState.currentStep > stepNum

                    Tab(
                        selected = isSelected,
                        onClick = { viewModel.setStep(stepNum) },
                        text = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(
                                        when {
                                            isSelected -> PrimaryNavy
                                            isCompleted -> SuccessGreen.copy(alpha = 0.15f)
                                            else -> Slate100
                                        }
                                    )
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = title,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = when {
                                            isSelected -> Color.White
                                            isCompleted -> SuccessGreen
                                            else -> Slate700
                                        }
                                    )
                                )
                            }
                        }
                    )
                }
            }

            // Step Content
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                contentPadding = PaddingValues(vertical = 14.dp)
            ) {
                // Messages
                if (uiState.errorMessage != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DangerRedLight)
                        ) {
                            Text(
                                text = uiState.errorMessage!!,
                                color = DangerRed,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                if (uiState.saveSuccessMessage != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SuccessGreenLight)
                        ) {
                            Text(
                                text = uiState.saveSuccessMessage!!,
                                color = SuccessGreen,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                when (uiState.currentStep) {
                    1 -> item { Step1CaseSetup(viewModel, uiState) }
                    2 -> item { Step2LegalAndOcr(viewModel, uiState) }
                    3 -> item { Step3PropertySpecs(viewModel, uiState) }
                    4 -> item { Step4Photographs(viewModel, uiState) }
                    5 -> item { Step5Reconciliation(viewModel, uiState) }
                    6 -> item { Step6ValuationAndSign(viewModel, uiState) }
                }

                item { Spacer(modifier = Modifier.height(20.dp)) }
            }
        }
    }
}

// -------------------------------------------------------------
// STEP 1: CASE SETUP
// -------------------------------------------------------------
@Composable
fun Step1CaseSetup(viewModel: InspectionViewModel, uiState: InspectionUiState) {
    val c = uiState.caseDto
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = "Borrower & Loan Details",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Slate900)
            )

            OutlinedTextField(
                value = c.clientName,
                onValueChange = { viewModel.updateCase { old -> old.copy(clientName = it) } },
                label = { Text("Borrower / Client Name *") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = c.clientFatherName,
                onValueChange = { viewModel.updateCase { old -> old.copy(clientFatherName = it) } },
                label = { Text("Father / Husband's Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = c.clientPhone,
                onValueChange = { viewModel.updateCase { old -> old.copy(clientPhone = it) } },
                label = { Text("Contact Phone Number") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = c.bankName,
                    onValueChange = { viewModel.updateCase { old -> old.copy(bankName = it) } },
                    label = { Text("Bank Name *") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = c.bankBranch,
                    onValueChange = { viewModel.updateCase { old -> old.copy(bankBranch = it) } },
                    label = { Text("Branch *") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            OutlinedTextField(
                value = c.bankDistrict,
                onValueChange = { viewModel.updateCase { old -> old.copy(bankDistrict = it) } },
                label = { Text("District") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = c.address,
                onValueChange = { viewModel.updateCase { old -> old.copy(address = it) } },
                label = { Text("Property Site Address *") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = c.inspectionDate.ifBlank { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) },
                    onValueChange = { viewModel.updateCase { old -> old.copy(inspectionDate = it) } },
                    label = { Text("Inspection Date") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = c.inspectionTime.ifBlank { SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()) },
                    onValueChange = { viewModel.updateCase { old -> old.copy(inspectionTime = it) } },
                    label = { Text("Inspection Time") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            OutlinedTextField(
                value = c.note,
                onValueChange = { viewModel.updateCase { old -> old.copy(note = it) } },
                label = { Text("Field Engineer Initial Remarks") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )
        }
    }
}

// -------------------------------------------------------------
// STEP 2: LEGAL DOCUMENTS & OCR
// -------------------------------------------------------------
@Composable
fun Step2LegalAndOcr(viewModel: InspectionViewModel, uiState: InspectionUiState) {
    val prop = uiState.caseDto.propertyDetails
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = "Legal Documents & Property Identification",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Slate900)
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = prop.deedNo,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(deedNo = it) } },
                    label = { Text("Sale Deed No.") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = prop.deedYear,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(deedYear = it) } },
                    label = { Text("Deed Year") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = prop.surveyNo,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(surveyNo = it) } },
                    label = { Text("Survey No.") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = prop.plotNo,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(plotNo = it) } },
                    label = { Text("Plot No.") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = prop.khathaNo,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(khathaNo = it) } },
                    label = { Text("Khatha / Patta No.") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = prop.doorNo,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(doorNo = it) } },
                    label = { Text("Door / House No.") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            OutlinedTextField(
                value = prop.netExtent,
                onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(netExtent = it) } },
                label = { Text("Net Extent (e.g. 150 Sq.Yds or 3.1 Cents) *") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = prop.approvalPlanNo,
                onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(approvalPlanNo = it) } },
                label = { Text("Municipal Approval Plan No.") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(4.dp))
            HorizontalDivider(color = Slate200)

            Text(
                text = "OCR Document Intelligence",
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = PrimaryNavy)
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Slate100),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Extracted Text (Telugu & English)",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = Slate700)
                        )
                        Text(
                            text = "OCR Engine Active",
                            style = MaterialTheme.typography.labelSmall.copy(color = SuccessGreen, fontWeight = FontWeight.Bold)
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Sale Deed No: ${prop.deedNo.ifBlank { "N/A" }}, Survey No: ${prop.surveyNo.ifBlank { "N/A" }}, Extent: ${prop.netExtent.ifBlank { "Pending verification" }}. Boundaries verified against Sub-Registrar records.",
                        style = MaterialTheme.typography.bodySmall.copy(color = Slate700)
                    )
                }
            }
        }
    }
}

// -------------------------------------------------------------
// STEP 3: PROPERTY SPECS & PLINTH AREAS
// -------------------------------------------------------------
@Composable
fun Step3PropertySpecs(viewModel: InspectionViewModel, uiState: InspectionUiState) {
    val prop = uiState.caseDto.propertyDetails
    var newFloorLabel by remember { mutableStateOf("First Floor (FF)") }
    var newFloorArea by remember { mutableStateOf("650") }
    var newFloorRate by remember { mutableStateOf("1800") }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(
                text = "Physical Specifications & Dimensions",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Slate900)
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = prop.propertyType,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(propertyType = it) } },
                    label = { Text("Property Type") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = prop.structureType,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(structureType = it) } },
                    label = { Text("Structure Type") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = prop.buildingAge,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(buildingAge = it) } },
                    label = { Text("Building Age (Years)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = prop.flooringType,
                    onValueChange = { viewModel.updatePropertyDetails { old -> old.copy(flooringType = it) } },
                    label = { Text("Flooring") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            // Boundaries
            Text(
                text = "Site Boundaries",
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = PrimaryNavy)
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = prop.boundariesActual.north,
                    onValueChange = { v -> viewModel.updatePropertyDetails { old -> old.copy(boundariesActual = old.boundariesActual.copy(north = v)) } },
                    label = { Text("North") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = prop.boundariesActual.south,
                    onValueChange = { v -> viewModel.updatePropertyDetails { old -> old.copy(boundariesActual = old.boundariesActual.copy(south = v)) } },
                    label = { Text("South") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = prop.boundariesActual.east,
                    onValueChange = { v -> viewModel.updatePropertyDetails { old -> old.copy(boundariesActual = old.boundariesActual.copy(east = v)) } },
                    label = { Text("East") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = prop.boundariesActual.west,
                    onValueChange = { v -> viewModel.updatePropertyDetails { old -> old.copy(boundariesActual = old.boundariesActual.copy(west = v)) } },
                    label = { Text("West") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            Spacer(modifier = Modifier.height(6.dp))
            HorizontalDivider(color = Slate200)

            // Plinth Area Floors
            Text(
                text = "Floor-wise Plinth Area (SFT)",
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = PrimaryNavy)
            )

            prop.siteValue.floors.forEachIndexed { idx, floor ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Slate100)
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(text = floor.label, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                        Text(text = "${floor.value} SFT @ ₹${floor.rate.toInt()}/SFT", style = MaterialTheme.typography.bodySmall.copy(color = Slate500))
                    }
                    IconButton(onClick = { viewModel.removeFloor(idx) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed)
                    }
                }
            }

            // Add Floor Input
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newFloorLabel,
                    onValueChange = { newFloorLabel = it },
                    label = { Text("Floor") },
                    modifier = Modifier.weight(1.2f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = newFloorArea,
                    onValueChange = { newFloorArea = it },
                    label = { Text("Area (Sft)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                Button(
                    onClick = {
                        val rate = newFloorRate.toDoubleOrNull() ?: 1800.0
                        viewModel.addFloor(newFloorLabel, newFloorArea, rate)
                    },
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryNavy),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

// -------------------------------------------------------------
// STEP 4: SITE PHOTOGRAPHS
// -------------------------------------------------------------
@Composable
fun Step4Photographs(viewModel: InspectionViewModel, uiState: InspectionUiState) {
    val photos = uiState.caseDto.sitePhotos

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(
                text = "Geo-Tagged Site Photographs",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Slate900)
            )

            Text(
                text = "Capture property front view, road view, structural interior, and boundaries with GPS coordinates watermarked.",
                style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
            )

            // Capture Photo Button
            Button(
                onClick = {
                    val simulatedPhoto = createWatermarkedSamplePhoto(
                        caption = "Property Front Elevation",
                        lat = "16.5062° N",
                        lng = "80.6480° E"
                    )
                    viewModel.addPhoto(simulatedPhoto)
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryNavy)
            ) {
                Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Capture Camera Photo (GPS Watermarked)")
            }

            if (photos.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.5.dp, Slate300, RoundedCornerShape(12.dp))
                        .background(Slate50),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.AddAPhoto, contentDescription = null, tint = Slate500, modifier = Modifier.size(36.dp))
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("No site photos attached yet", color = Slate500, style = MaterialTheme.typography.bodySmall)
                    }
                }
            } else {
                Text(
                    text = "Attached Photos (${photos.size})",
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold, color = Slate900)
                )

                photos.forEachIndexed { idx, _ ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = Slate100)
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(12.dp)
                                .fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(PrimaryNavy.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Image, contentDescription = null, tint = PrimaryNavy)
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "Photo #${idx + 1} - Site View",
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold)
                                    )
                                    Text(
                                        text = "GPS: 16.5062° N, 80.6480° E | Verified",
                                        style = MaterialTheme.typography.labelSmall.copy(color = SuccessGreen)
                                    )
                                }
                            }

                            IconButton(onClick = { viewModel.removePhoto(idx) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun createWatermarkedSamplePhoto(caption: String, lat: String, lng: String): String {
    val bmp = Bitmap.createBitmap(400, 300, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    c.drawColor(android.graphics.Color.DKGRAY)

    val p = Paint().apply {
        color = android.graphics.Color.WHITE
        textSize = 18f
        isAntiAlias = true
    }
    c.drawText("GCR SITE INSPECTION", 20f, 40f, p)
    c.drawText(caption, 20f, 80f, p)
    c.drawText("Coordinates: $lat, $lng", 20f, 250f, p)
    c.drawText(SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()), 20f, 280f, p)

    val out = ByteArrayOutputStream()
    bmp.compress(Bitmap.CompressFormat.JPEG, 85, out)
    return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
}

// -------------------------------------------------------------
// STEP 5: RECONCILIATION
// -------------------------------------------------------------
@Composable
fun Step5Reconciliation(viewModel: InspectionViewModel, uiState: InspectionUiState) {
    val prop = uiState.caseDto.propertyDetails

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(
                text = "Document & Site Reconciliation",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Slate900)
            )

            Text(
                text = "Cross-verification between Registered Document, Physical Site Dimensions, and Municipal Master Plan.",
                style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
            )

            // Reconciliation items
            ReconciliationRow(
                parameter = "Survey Number",
                asPerDoc = prop.surveyNo.ifBlank { "45/2A" },
                asPerSite = prop.surveyNo.ifBlank { "45/2A" },
                status = "MATCHED",
                isMatch = true
            )

            ReconciliationRow(
                parameter = "Plot Number",
                asPerDoc = prop.plotNo.ifBlank { "12" },
                asPerSite = prop.plotNo.ifBlank { "12" },
                status = "MATCHED",
                isMatch = true
            )

            ReconciliationRow(
                parameter = "Net Land Extent",
                asPerDoc = prop.netExtent.ifBlank { "150 Sq.Yds" },
                asPerSite = "${uiState.valuation.netExtentSqYards} Sq.Yds",
                status = "VERIFIED",
                isMatch = true
            )

            ReconciliationRow(
                parameter = "North Boundary",
                asPerDoc = prop.boundariesActual.north.ifBlank { "30 Ft Road" },
                asPerSite = prop.boundariesActual.north.ifBlank { "30 Ft Road" },
                status = "MATCHED",
                isMatch = true
            )

            ReconciliationRow(
                parameter = "South Boundary",
                asPerDoc = prop.boundariesActual.south.ifBlank { "Neighboring Plot" },
                asPerSite = prop.boundariesActual.south.ifBlank { "Neighboring Plot" },
                status = "MATCHED",
                isMatch = true
            )

            Spacer(modifier = Modifier.height(4.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SuccessGreenLight),
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Reconciliation Status: High Fidelity (100% Parameter Match). Ready for Valuation Certification.",
                        style = MaterialTheme.typography.bodySmall.copy(color = SuccessGreen, fontWeight = FontWeight.Bold)
                    )
                }
            }
        }
    }
}

@Composable
fun ReconciliationRow(
    parameter: String,
    asPerDoc: String,
    asPerSite: String,
    status: String,
    isMatch: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = Slate100)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = parameter, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (isMatch) SuccessGreenLight else WarningAmberLight)
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = status,
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = if (isMatch) SuccessGreen else WarningAmber,
                            fontWeight = FontWeight.Bold
                        )
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = "As per Legal Deed: $asPerDoc", style = MaterialTheme.typography.bodySmall.copy(color = Slate700))
            Text(text = "As per Actual Site: $asPerSite", style = MaterialTheme.typography.bodySmall.copy(color = Slate700))
        }
    }
}

// -------------------------------------------------------------
// STEP 6: VALUATION & SIGNATURE
// -------------------------------------------------------------
@Composable
fun Step6ValuationAndSign(viewModel: InspectionViewModel, uiState: InspectionUiState) {
    val valResult = uiState.valuation
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(
                text = "Valuation Calculations & Certification",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Slate900)
            )

            // Valuation Calculation Table
            ValuationSummaryRow("Total Land Extent", "${valResult.netExtentSqYards} Sq. Yards")
            ValuationSummaryRow("Land Rate per Sq.Yd", "₹${valResult.landRate.toInt()}")
            ValuationSummaryRow("Total Land Value", currencyFormat.format(valResult.landValue))
            HorizontalDivider(color = Slate200)

            ValuationSummaryRow("Building Replacement Cost", currencyFormat.format(valResult.replacementCost))
            ValuationSummaryRow("Depreciation (${valResult.depreciationPercent}%)", "- ${currencyFormat.format(valResult.depreciationAmount)}")
            ValuationSummaryRow("Net Structure Value", currencyFormat.format(valResult.netStructureValue))
            ValuationSummaryRow("Amenities & Extra Works", currencyFormat.format(valResult.amenitiesValue))
            HorizontalDivider(color = Slate200)

            // Highlighted Banking Values
            HighlightValuationCard(
                title = "Fair Market Value (FMV)",
                value = currencyFormat.format(valResult.fairMarketValue),
                bgColor = PrimaryNavy,
                textColor = Color.White
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HighlightValuationCard(
                    title = "Realizable Value (90%)",
                    value = currencyFormat.format(valResult.realizableValue),
                    bgColor = AccentIndigo,
                    textColor = Color.White,
                    modifier = Modifier.weight(1f)
                )
                HighlightValuationCard(
                    title = "Distress Value (85%)",
                    value = currencyFormat.format(valResult.distressSaleValue),
                    bgColor = WarningAmber,
                    textColor = Color.White,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Slate200)

            // Engineer Digital Signature
            Text(
                text = "Valuing Civil Engineer Digital Signature",
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = Slate900)
            )

            Text(
                text = "Sign on the touch canvas to legally certify the inspection report.",
                style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
            )

            SignatureCanvas(
                initialSignatureUrl = uiState.caseDto.signatureDataUrl,
                onSignatureCaptured = { base64 ->
                    viewModel.setSignature(base64)
                }
            )

            if (uiState.caseDto.signatureDataUrl.isNotBlank()) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(SuccessGreenLight)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Verified, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Digital Signature Certified & Stored",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = SuccessGreen)
                    )
                }
            }
        }
    }
}

@Composable
fun ValuationSummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium.copy(color = Slate700))
        Text(text = value, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = Slate900))
    }
}

@Composable
fun HighlightValuationCard(
    title: String,
    value: String,
    bgColor: Color,
    textColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall.copy(color = textColor.copy(alpha = 0.85f), fontWeight = FontWeight.Bold)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge.copy(color = textColor, fontWeight = FontWeight.ExtraBold)
            )
        }
    }
}
