package com.gcrapp.valuation.ui.dashboard

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.unit.sp
import com.gcrapp.valuation.data.models.ValuationCaseDto
import com.gcrapp.valuation.ui.components.*
import com.gcrapp.valuation.ui.theme.*

@Composable
fun EngineerDashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToAttendance: () -> Unit,
    onNavigateToCases: () -> Unit,
    onNavigateToInspection: (String) -> Unit,
    onLogout: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            AppTopBar(
                title = "GCR Engineer Portal",
                subtitle = uiState.user?.district?.ifBlank { "SBI Panel Valuer" } ?: "SBI Panel Valuer",
                isOnline = uiState.isOnline,
                onRefresh = { viewModel.loadDashboard(forceRefresh = true) },
                onLogout = onLogout
            )
        },
        containerColor = Slate50
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Offline Sync Alert Banner
            if (uiState.offlineQueueCount > 0) {
                item {
                    OfflineBanner(
                        pendingCount = uiState.offlineQueueCount,
                        onSyncClick = { viewModel.syncOfflineQueue() }
                    )
                }
            }

            // Engineer Identity & Attendance Snapshot Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PrimaryNavy),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Engineering,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(30.dp)
                                )
                            }

                            Spacer(modifier = Modifier.width(14.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = uiState.user?.name?.ifBlank { "Civil Field Engineer" } ?: "Civil Field Engineer",
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = "ID: ${uiState.user?.username ?: "EMP-GCR"} | ${uiState.user?.branch?.ifBlank { "Vijayawada Region" } ?: "Vijayawada Region"}",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = Color.White.copy(alpha = 0.8f)
                                    )
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider(color = Color.White.copy(alpha = 0.2f))
                        Spacer(modifier = Modifier.height(14.dp))

                        // Attendance Snapshot Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = "TODAY'S ATTENDANCE",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = Color.White.copy(alpha = 0.7f),
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                val attType = uiState.latestAttendance?.attendanceType ?: "Not Clocked In"
                                Text(
                                    text = attType,
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = if (attType.contains("Clock-In", ignoreCase = true)) SuccessGreenLight else Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }

                            Button(
                                onClick = onNavigateToAttendance,
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White,
                                    contentColor = PrimaryNavy
                                ),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Face,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Face Verify",
                                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
                                )
                            }
                        }
                    }
                }
            }

            // 4 Metrics Grid
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MetricCard(
                        title = "Assigned",
                        value = "${uiState.totalAssigned}",
                        icon = Icons.Default.Assignment,
                        iconTint = PrimaryNavy,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToCases
                    )
                    MetricCard(
                        title = "Pending",
                        value = "${uiState.pendingInspections}",
                        icon = Icons.Default.PendingActions,
                        iconTint = WarningAmber,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToCases
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    MetricCard(
                        title = "Completed",
                        value = "${uiState.completedCases}",
                        icon = Icons.Default.CheckCircle,
                        iconTint = SuccessGreen,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToCases
                    )
                    MetricCard(
                        title = "Offline Cache",
                        value = "${uiState.offlineQueueCount}",
                        subtitle = if (uiState.offlineQueueCount == 0) "Synced" else "Pending Sync",
                        icon = Icons.Default.CloudQueue,
                        iconTint = if (uiState.offlineQueueCount == 0) SuccessGreen else WarningAmber,
                        modifier = Modifier.weight(1f),
                        onClick = { viewModel.syncOfflineQueue() }
                    )
                }
            }

            // Quick Actions Header
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Upcoming Inspections",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                    )
                    TextButton(onClick = onNavigateToCases) {
                        Text(
                            text = "View All Cases (${uiState.totalAssigned})",
                            style = MaterialTheme.typography.labelLarge.copy(
                                color = PrimaryNavy,
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                    }
                }
            }

            // Upcoming Case List Items
            if (uiState.upcomingCases.isEmpty() && !uiState.isLoading) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceLight)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No pending inspections assigned currently.",
                                color = Slate500,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            } else {
                items(uiState.upcomingCases) { caseItem ->
                    InspectionCaseCard(
                        caseItem = caseItem,
                        onInspectClick = { onNavigateToInspection(caseItem.id) },
                        onNavigateGpsClick = {
                            val addr = caseItem.address.ifBlank { "${caseItem.bankBranch}, ${caseItem.bankDistrict}" }
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(addr)))
                            context.startActivity(intent)
                        }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun InspectionCaseCard(
    caseItem: ValuationCaseDto,
    onInspectClick: () -> Unit,
    onNavigateGpsClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onInspectClick() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = caseItem.clientName.ifBlank { "Valuation Client" },
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    ),
                    modifier = Modifier.weight(1f, fill = false),
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.width(8.dp))
                StatusBadge(status = caseItem.status)
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.AccountBalance,
                    contentDescription = null,
                    tint = PrimaryNavy,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "${caseItem.bankName} - ${caseItem.bankBranch} (${caseItem.bankDistrict})",
                    style = MaterialTheme.typography.bodyMedium.copy(color = Slate700)
                )
            }

            if (caseItem.address.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = DangerRed,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = caseItem.address,
                        style = MaterialTheme.typography.bodySmall.copy(color = Slate500),
                        maxLines = 1
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))
            HorizontalDivider(color = Slate200)
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = onNavigateGpsClick,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Icon(imageVector = Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("GPS Nav", style = MaterialTheme.typography.labelSmall)
                }

                Button(
                    onClick = onInspectClick,
                    modifier = Modifier.weight(1.3f),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryNavy),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Icon(imageVector = Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Start Inspection", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                }
            }
        }
    }
}
