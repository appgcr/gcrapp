package com.gcrapp.valuation.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.gcrapp.valuation.ui.attendance.AttendanceScreen
import com.gcrapp.valuation.ui.attendance.AttendanceViewModel
import com.gcrapp.valuation.ui.cases.CaseListScreen
import com.gcrapp.valuation.ui.cases.CaseListViewModel
import com.gcrapp.valuation.ui.chat.ChatScreen
import com.gcrapp.valuation.ui.chat.ChatViewModel
import com.gcrapp.valuation.ui.dashboard.DashboardViewModel
import com.gcrapp.valuation.ui.dashboard.EngineerDashboardScreen
import androidx.compose.material.icons.automirrored.filled.Logout

enum class MainTab(val label: String, val icon: ImageVector) {
    ATTENDANCE("Attendance", Icons.Default.EditCalendar),
    CASES("Cases", Icons.Default.Description),
    DASHBOARD("Dashboard", Icons.Default.GridView),
    CHAT("Chat", Icons.Default.ChatBubbleOutline),
    SETTINGS("Settings", Icons.Default.Settings)
}

@Composable
fun MainScaffoldScreen(
    currentTab: MainTab,
    onTabSelected: (MainTab) -> Unit,
    attendanceViewModel: AttendanceViewModel,
    dashboardViewModel: DashboardViewModel,
    caseListViewModel: CaseListViewModel,
    onNavigateToInspection: (String) -> Unit,
    onNavigateToReport: (String) -> Unit,
    onLogout: () -> Unit
) {
    val chatViewModel: ChatViewModel = viewModel()
    Scaffold(
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shadowElevation = 8.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceAround,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    MainTab.values().forEach { tab ->
                        val isSelected = currentTab == tab
                        val activeColor = Color(0xFF0052CC)
                        val inactiveColor = Color(0xFF94A3B8)

                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clickable { onTabSelected(tab) }
                                .padding(vertical = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.label,
                                tint = if (isSelected) activeColor else inactiveColor,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.height(3.dp))
                            Text(
                                text = tab.label,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) activeColor else inactiveColor
                                )
                            )
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentTab) {
                MainTab.ATTENDANCE -> {
                    AttendanceScreen(
                        viewModel = attendanceViewModel,
                        onLogout = onLogout
                    )
                }
                MainTab.CASES -> {
                    CaseListScreen(
                        viewModel = caseListViewModel,
                        onBack = { onTabSelected(MainTab.ATTENDANCE) },
                        onNavigateToInspection = onNavigateToInspection,
                        onNavigateToReport = onNavigateToReport
                    )
                }
                MainTab.DASHBOARD -> {
                    EngineerDashboardScreen(
                        viewModel = dashboardViewModel,
                        onNavigateToAttendance = { onTabSelected(MainTab.ATTENDANCE) },
                        onNavigateToCases = { onTabSelected(MainTab.CASES) },
                        onNavigateToInspection = onNavigateToInspection,
                        onLogout = onLogout
                    )
                }
                MainTab.CHAT -> {
                    ChatScreen(
                        viewModel = chatViewModel,
                        onBack = { onTabSelected(MainTab.ATTENDANCE) }
                    )
                }
                MainTab.SETTINGS -> {
                    SettingsTabScreen(onLogout = onLogout)
                }
            }
        }
    }
}

@Composable
fun SettingsTabScreen(onLogout: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .padding(20.dp)
    ) {
        Text(
            text = "System & Field Settings",
            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = Color(0xFF0F172A)),
            maxLines = 1,
            softWrap = false
        )
        Spacer(modifier = Modifier.height(16.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Field Engineer Profile",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    softWrap = false
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Role: SBI Panel Valuer Engineer",
                    style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF64748B)),
                    maxLines = 1,
                    softWrap = false
                )
                Text(
                    text = "Branch: RACPC Branch, Kadapa",
                    style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF64748B)),
                    maxLines = 1,
                    softWrap = false
                )
                Text(
                    text = "GNSS Engine: High-Accuracy GPS active",
                    style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF059669), fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    softWrap = false
                )
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(imageVector = Icons.AutoMirrored.Filled.Logout, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Log Out from Portal", maxLines = 1, softWrap = false)
        }
    }
}
