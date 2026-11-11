package com.gcrapp.valuation.ui.reports

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.gcrapp.valuation.data.models.ValuationCaseDto
import com.gcrapp.valuation.data.repositories.CaseRepository
import com.gcrapp.valuation.ui.components.AppTopBar
import com.gcrapp.valuation.ui.components.PrimaryButton
import com.gcrapp.valuation.ui.components.SecondaryButton
import com.gcrapp.valuation.ui.components.StatusBadge
import com.gcrapp.valuation.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.text.NumberFormat
import java.util.Locale

@Composable
fun ReportViewerScreen(
    caseId: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val caseRepo = remember { CaseRepository(context) }

    var caseDto by remember { mutableStateOf<ValuationCaseDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isDownloading by remember { mutableStateOf(false) }
    var downloadedFile by remember { mutableStateOf<File?>(null) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "IN"))

    LaunchedEffect(caseId) {
        isLoading = true
        val res = caseRepo.getCaseById(caseId)
        res.onSuccess {
            caseDto = it
            isLoading = false
        }.onFailure {
            errorMessage = "Failed to load case report: ${it.message}"
            isLoading = false
        }
    }

    fun downloadAndSaveReport() {
        isDownloading = true
        statusMessage = "Downloading official banking report..."
        coroutineScope.launch {
            val res = caseRepo.downloadReport(caseId)
            res.onSuccess { inputStream ->
                withContext(Dispatchers.IO) {
                    try {
                        val reportsDir = File(context.cacheDir, "reports").apply { mkdirs() }
                        val file = File(reportsDir, "Valuation_Report_${caseDto?.clientName?.replace(" ", "_") ?: caseId}.docx")
                        FileOutputStream(file).use { out ->
                            inputStream.copyTo(out)
                        }
                        withContext(Dispatchers.Main) {
                            downloadedFile = file
                            isDownloading = false
                            statusMessage = "Report downloaded successfully!"
                        }
                    } catch (e: Exception) {
                        withContext(Dispatchers.Main) {
                            isDownloading = false
                            errorMessage = "Error saving report: ${e.message}"
                        }
                    }
                }
            }.onFailure { ex ->
                isDownloading = false
                errorMessage = "Download failed: ${ex.message}"
            }
        }
    }

    fun shareReportFile(file: File) {
        try {
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "GCR Bank Valuation Report - ${caseDto?.clientName}")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Share Valuation Report"))
        } catch (e: Exception) {
            errorMessage = "Failed to open share sheet: ${e.message}"
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Valuation Report",
                subtitle = caseDto?.clientName ?: "Report Details",
                showBackButton = true,
                onBackClick = onBack
            )
        },
        containerColor = Slate50
    ) { innerPadding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = PrimaryNavy)
            }
        } else {
            val c = caseDto
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (statusMessage != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SuccessGreenLight)
                        ) {
                            Text(
                                text = statusMessage!!,
                                color = SuccessGreen,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                if (errorMessage != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DangerRedLight)
                        ) {
                            Text(
                                text = errorMessage!!,
                                color = DangerRed,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                if (c != null) {
                    // Report Header Card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = SurfaceLight),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(18.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = c.clientName,
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = Slate900
                                        )
                                    )
                                    StatusBadge(status = c.status)
                                }

                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Bank: ${c.bankName} - ${c.bankBranch}",
                                    style = MaterialTheme.typography.bodyMedium.copy(color = Slate700)
                                )
                                Text(
                                    text = "Survey No: ${c.propertyDetails.surveyNo.ifBlank { "N/A" }} | Extent: ${c.propertyDetails.netExtent.ifBlank { "N/A" }}",
                                    style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
                                )
                                Text(
                                    text = "Address: ${c.address}",
                                    style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
                                )
                            }
                        }
                    }

                    // Valuation Certificate Metrics
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = PrimaryNavy),
                            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                        ) {
                            Column(modifier = Modifier.padding(18.dp)) {
                                Text(
                                    text = "FAIR MARKET VALUE (FMV)",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = Color.White.copy(alpha = 0.8f),
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = currencyFormat.format(c.valuation.fairMarketValue),
                                    style = MaterialTheme.typography.headlineMedium.copy(
                                        color = Color.White,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                )

                                Spacer(modifier = Modifier.height(12.dp))
                                HorizontalDivider(color = Color.White.copy(alpha = 0.2f))
                                Spacer(modifier = Modifier.height(12.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(
                                            text = "Realizable Value (90%)",
                                            style = MaterialTheme.typography.labelSmall.copy(color = Color.White.copy(alpha = 0.8f))
                                        )
                                        Text(
                                            text = currencyFormat.format(c.valuation.realizableValue),
                                            style = MaterialTheme.typography.titleMedium.copy(color = Color.White, fontWeight = FontWeight.Bold)
                                        )
                                    }

                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            text = "Distress Value (85%)",
                                            style = MaterialTheme.typography.labelSmall.copy(color = Color.White.copy(alpha = 0.8f))
                                        )
                                        Text(
                                            text = currencyFormat.format(c.valuation.distressSaleValue),
                                            style = MaterialTheme.typography.titleMedium.copy(color = Color.White, fontWeight = FontWeight.Bold)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Actions: Download & Share
                    item {
                        PrimaryButton(
                            text = if (downloadedFile == null) "Download Official Report (.DOCX)" else "Re-download Report",
                            onClick = { downloadAndSaveReport() },
                            isLoading = isDownloading,
                            icon = Icons.Default.Download
                        )
                    }

                    if (downloadedFile != null) {
                        item {
                            Button(
                                onClick = { shareReportFile(downloadedFile!!) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                            ) {
                                Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Share via Android Share Sheet",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
