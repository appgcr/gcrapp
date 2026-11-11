package com.gcrapp.valuation.ui.attendance

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.core.content.ContextCompat
import com.gcrapp.valuation.data.models.AttendanceResponse
import com.gcrapp.valuation.ui.theme.*
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun AttendanceScreen(
    viewModel: AttendanceViewModel,
    onLogout: () -> Unit = {}
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()

    // Live second-by-second digital clock
    var liveDate by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) {
        while (true) {
            liveDate = Date()
            delay(1000)
        }
    }

    val timeFormat = remember { SimpleDateFormat("hh:mm:ss a", Locale.US) }
    val dateFormat = remember { SimpleDateFormat("EEEE, MMM d, yyyy", Locale.US) }

    val formattedTimeStr = remember(liveDate) { timeFormat.format(liveDate) }
    val formattedDateStr = remember(liveDate) { dateFormat.format(liveDate) }

    // Camera and Location Permission Launchers
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        hasCameraPermission = perms[Manifest.permission.CAMERA] ?: false
        hasLocationPermission = perms[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        viewModel.setPermissions(hasCameraPermission, hasLocationPermission)
    }

    LaunchedEffect(Unit) {
        viewModel.setPermissions(hasCameraPermission, hasLocationPermission)
    }

    // Modal state for Face Verification Camera
    var activePunchType by remember { mutableStateOf<String?>(null) }

    // Pulse animation for duty badge
    val infiniteTransition = rememberInfiniteTransition(label = "DutyPulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.9f,
        targetValue = 1.25f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "PulseScale"
    )

    Scaffold(
        topBar = {
            // Header matching Image 1
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF0052CC)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountBalance,
                                contentDescription = "GCR Logo",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Column {
                            Text(
                                text = "GCR Valuation",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFF0F172A),
                                    fontSize = 16.sp
                                )
                            )
                            Text(
                                text = "Field Engineer Portal",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = Color(0xFF64748B),
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Notification Bell with Badge 1
                        Box(contentAlignment = Alignment.TopEnd) {
                            IconButton(onClick = {}, modifier = Modifier.size(36.dp)) {
                                Icon(
                                    imageVector = Icons.Default.NotificationsNone,
                                    contentDescription = "Notifications",
                                    tint = Color(0xFF334155),
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .padding(top = 4.dp, end = 4.dp)
                                    .size(16.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFFEF4444)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "1",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(4.dp))

                        // Logout button
                        IconButton(onClick = onLogout, modifier = Modifier.size(36.dp)) {
                            Icon(
                                imageVector = Icons.Default.Logout,
                                contentDescription = "Logout",
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        },
        containerColor = Color(0xFFF8FAFC)
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { Spacer(modifier = Modifier.height(2.dp)) }

            // 1. Segmented Navigation Bar (Mark Attendance | Monthly Calendar)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFF1F5F9))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Mark Attendance Tab
                    val isMark = uiState.activeView == "MARK"
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isMark) Color.White else Color.Transparent)
                            .then(
                                if (isMark) Modifier.border(0.5.dp, Color(0xFFCBD5E1), RoundedCornerShape(8.dp))
                                else Modifier
                            )
                            .clickable { viewModel.setActiveView("MARK") }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = null,
                                tint = if (isMark) Color(0xFF0052CC) else Color(0xFF64748B),
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Mark Attendance",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (isMark) Color(0xFF0052CC) else Color(0xFF64748B)
                                )
                            )
                        }
                    }

                    // Monthly Calendar Tab
                    val isCalendar = uiState.activeView == "CALENDAR"
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isCalendar) Color.White else Color.Transparent)
                            .then(
                                if (isCalendar) Modifier.border(0.5.dp, Color(0xFFCBD5E1), RoundedCornerShape(8.dp))
                                else Modifier
                            )
                            .clickable { viewModel.setActiveView("CALENDAR") }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CalendarMonth,
                                contentDescription = null,
                                tint = if (isCalendar) Color(0xFF0052CC) else Color(0xFF64748B),
                                modifier = Modifier.size(15.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Monthly Calendar",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (isCalendar) Color(0xFF0052CC) else Color(0xFF64748B)
                                )
                            )
                        }
                    }

                    // Refresh Button
                    IconButton(
                        onClick = { viewModel.loadHistory() },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = Color(0xFF64748B),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // CALENDAR VIEW (When Monthly Calendar tab is selected)
            if (uiState.activeView == "CALENDAR") {
                item {
                    MonthlyCalendarView(history = uiState.history)
                }
            } else {
                // MARK ATTENDANCE VIEW (Matching Image 1)

                // 2. HERO ATTENDANCE DASHBOARD CARD
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
                        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    Brush.linearGradient(
                                        listOf(
                                            Color(0xFF001233),
                                            Color(0xFF002855),
                                            Color(0xFF023E8A)
                                        )
                                    )
                                )
                                .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(20.dp))
                                .padding(20.dp)
                        ) {
                            Column {
                                // Top Row: System Time Title & Duty Status Badge
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top
                                ) {
                                    Column {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                imageVector = Icons.Default.Schedule,
                                                contentDescription = null,
                                                tint = Color(0xFF94A3B8),
                                                modifier = Modifier.size(13.dp)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = "LIVE FIELD SYSTEM TIME",
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    color = Color(0xFF94A3B8),
                                                    fontWeight = FontWeight.Bold,
                                                    letterSpacing = 1.2.sp,
                                                    fontSize = 11.sp
                                                )
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(4.dp))

                                        // Digital Clock (Live ticking seconds!)
                                        Text(
                                            text = formattedTimeStr,
                                            style = MaterialTheme.typography.headlineMedium.copy(
                                                color = Color.White,
                                                fontWeight = FontWeight.ExtraBold,
                                                letterSpacing = (-0.5).sp,
                                                fontSize = 28.sp
                                            )
                                        )

                                        Text(
                                            text = formattedDateStr,
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = Color(0xFFCBD5E1),
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        )
                                    }

                                    // Duty Status Badge
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(20.dp))
                                            .background(
                                                if (uiState.isOnDuty) Color(0x3310B981) else Color.White.copy(alpha = 0.12f)
                                            )
                                            .border(
                                                1.dp,
                                                if (uiState.isOnDuty) Color(0xFF10B981) else Color.White.copy(alpha = 0.2f),
                                                RoundedCornerShape(20.dp)
                                            )
                                            .padding(horizontal = 14.dp, vertical = 6.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Box(
                                                modifier = Modifier
                                                    .size(8.dp)
                                                    .clip(CircleShape)
                                                    .background(
                                                        if (uiState.isOnDuty) Color(0xFF10B981) else Color(0xFF94A3B8)
                                                    )
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = if (uiState.isOnDuty) "ON DUTY" else "OFF DUTY",
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    color = if (uiState.isOnDuty) Color(0xFF34D399) else Color(0xFFE2E8F0),
                                                    fontWeight = FontWeight.ExtraBold,
                                                    letterSpacing = 0.5.sp,
                                                    fontSize = 11.sp
                                                )
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(18.dp))

                                // Shift Duration Block
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(Color.White.copy(alpha = 0.08f))
                                        .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(14.dp))
                                        .padding(14.dp)
                                ) {
                                    Column {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(
                                                    imageVector = Icons.Default.Timer,
                                                    contentDescription = null,
                                                    tint = Color(0xFF94A3B8),
                                                    modifier = Modifier.size(14.dp)
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(
                                                    text = "Total Shift Duration Today",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        color = Color(0xFF94A3B8),
                                                        fontWeight = FontWeight.SemiBold
                                                    )
                                                )
                                            }

                                            Text(
                                                text = uiState.shiftDurationText,
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    color = Color(0xFF38BDF8),
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontSize = 15.sp
                                                )
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(8.dp))

                                        // Progress bar track
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(6.dp)
                                                .clip(RoundedCornerShape(3.dp))
                                                .background(Color.White.copy(alpha = 0.15f))
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxHeight()
                                                    .fillMaxWidth(fraction = uiState.progressPercent / 100f)
                                                    .clip(RoundedCornerShape(3.dp))
                                                    .background(
                                                        if (uiState.progressPercent >= 85) Color(0xFF10B981)
                                                        else if (uiState.progressPercent >= 50) Color(0xFF38BDF8)
                                                        else Color(0xFFF59E0B)
                                                    )
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(6.dp))

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "Target: 8.0 hrs Full Day",
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    color = Color(0xFF94A3B8),
                                                    fontSize = 11.sp
                                                )
                                            )
                                            Text(
                                                text = "${uiState.progressPercent}% Achieved",
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    color = Color(0xFF94A3B8),
                                                    fontSize = 11.sp
                                                )
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(14.dp))

                                // Punches Grid: First Check-In & Last Check-Out Tiles
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    // Tile 1: First Check-In
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(Color.White.copy(alpha = 0.08f))
                                            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                                            .padding(12.dp)
                                    ) {
                                        Column {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(
                                                    imageVector = Icons.Default.Login,
                                                    contentDescription = null,
                                                    tint = Color(0xFF34D399),
                                                    modifier = Modifier.size(13.dp)
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(
                                                    text = "First Check-In",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        color = Color(0xFFCBD5E1),
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 11.sp
                                                    )
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = uiState.firstCheckInTime ?: "--:--",
                                                style = MaterialTheme.typography.titleMedium.copy(
                                                    color = Color.White,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontSize = 16.sp
                                                )
                                            )
                                        }
                                    }

                                    // Tile 2: Last Check-Out
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(Color.White.copy(alpha = 0.08f))
                                            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                                            .padding(12.dp)
                                    ) {
                                        Column {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(
                                                    imageVector = Icons.Default.Logout,
                                                    contentDescription = null,
                                                    tint = Color(0xFFF87171),
                                                    modifier = Modifier.size(13.dp)
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(
                                                    text = "Last Check-Out",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        color = Color(0xFFCBD5E1),
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 11.sp
                                                    )
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = uiState.lastCheckOutTime ?: (if (uiState.isOnDuty) "Active" else "--:--"),
                                                style = MaterialTheme.typography.titleMedium.copy(
                                                    color = Color.White,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontSize = 16.sp
                                                )
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 3. CLOCK-IN / CLOCK-OUT ACTION BUTTONS ZONE
                item {
                    val canClockIn = !uiState.isOnDuty
                    val canClockOut = uiState.isOnDuty

                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            // Clock-In Button (Gradient Vibrant Blue)
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(76.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(
                                        if (canClockIn) {
                                            Brush.linearGradient(listOf(Color(0xFF0052CC), Color(0xFF003E99)))
                                        } else {
                                            Brush.linearGradient(listOf(Color(0xFFF1F5F9), Color(0xFFE2E8F0)))
                                        }
                                    )
                                    .then(
                                        if (!canClockIn) Modifier.border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(14.dp))
                                        else Modifier
                                    )
                                    .clickable(enabled = canClockIn && !uiState.isLoading) {
                                        if (!hasCameraPermission) {
                                            permissionLauncher.launch(
                                                arrayOf(
                                                    Manifest.permission.CAMERA,
                                                    Manifest.permission.ACCESS_FINE_LOCATION
                                                )
                                            )
                                        } else {
                                            activePunchType = "Clock-In"
                                        }
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Login,
                                            contentDescription = null,
                                            tint = if (canClockIn) Color.White else Color(0xFF94A3B8),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "Clock-In",
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = if (canClockIn) Color.White else Color(0xFF94A3B8),
                                                fontSize = 17.sp
                                            )
                                        )
                                    }
                                    Text(
                                        text = "Biometric Face + Geotag",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = if (canClockIn) Color(0xFFBAE6FD) else Color(0xFF94A3B8),
                                            fontSize = 11.sp
                                        )
                                    )
                                }
                            }

                            // Clock-Out Button
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(76.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(
                                        if (canClockOut) {
                                            Brush.linearGradient(listOf(Color(0xFFDC2626), Color(0xFFB91C1C)))
                                        } else {
                                            Brush.linearGradient(listOf(Color(0xFFF1F5F9), Color(0xFFE2E8F0)))
                                        }
                                    )
                                    .then(
                                        if (!canClockOut) Modifier.border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(14.dp))
                                        else Modifier
                                    )
                                    .clickable(enabled = canClockOut && !uiState.isLoading) {
                                        if (!hasCameraPermission) {
                                            permissionLauncher.launch(
                                                arrayOf(
                                                    Manifest.permission.CAMERA,
                                                    Manifest.permission.ACCESS_FINE_LOCATION
                                                )
                                            )
                                        } else {
                                            activePunchType = "Clock-Out"
                                        }
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Logout,
                                            contentDescription = null,
                                            tint = if (canClockOut) Color.White else Color(0xFF94A3B8),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "Clock-Out",
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = if (canClockOut) Color.White else Color(0xFF94A3B8),
                                                fontSize = 17.sp
                                            )
                                        )
                                    }
                                    Text(
                                        text = "Log Field Session",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = if (canClockOut) Color(0xFFFECACA) else Color(0xFF94A3B8),
                                            fontSize = 11.sp
                                        )
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Security Seal Note
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = null,
                                tint = Color(0xFF059669),
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = "Anti-spoofing liveness verified · Hardware GPS tamper protection active",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = Color(0xFF64748B),
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }
                }

                // Error or Success Alert
                if (uiState.errorMessage != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = DangerRedLight)
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Error, contentDescription = null, tint = DangerRed)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(text = uiState.errorMessage!!, color = DangerRed, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }

                if (uiState.successMessage != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = SuccessGreenLight)
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(text = uiState.successMessage!!, color = SuccessGreen, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }

                // 4. FIELD GEOLOCATION & GEOFENCE STATUS CARD
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    modifier = Modifier.weight(1f, fill = false),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.LocationOn,
                                        contentDescription = null,
                                        tint = Color(0xFF0052CC),
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "FIELD GEOLOCATION & GEOFENCE",
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color(0xFF0F172A),
                                            fontSize = 12.sp,
                                            letterSpacing = 0.2.sp
                                        ),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        softWrap = false
                                    )
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (uiState.isLocationAcquired) Color(0xFFECFDF5) else Color(0xFFFEF3C7))
                                        .border(
                                            1.dp,
                                            if (uiState.isLocationAcquired) Color(0xFFA7F3D0) else Color(0xFFFDE68A),
                                            RoundedCornerShape(12.dp)
                                        )
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        Icon(
                                            imageVector = if (uiState.isLocationAcquired) Icons.Default.CheckCircle else Icons.Default.Refresh,
                                            contentDescription = null,
                                            tint = if (uiState.isLocationAcquired) Color(0xFF059669) else Color(0xFFB45309),
                                            modifier = Modifier.size(11.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = if (uiState.isLocationAcquired) "Satellite Locked" else "Acquiring...",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                color = if (uiState.isLocationAcquired) Color(0xFF059669) else Color(0xFFB45309),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 11.sp
                                            ),
                                            maxLines = 1,
                                            softWrap = false
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(14.dp))

                            // 2x2 Diagnostic Matrix
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
                                        .padding(horizontal = 10.dp, vertical = 8.dp)
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        Text(
                                            text = "GPS Permission",
                                            style = MaterialTheme.typography.labelSmall.copy(color = Color(0xFF64748B), fontSize = 10.5.sp),
                                            maxLines = 1,
                                            softWrap = false,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = if (hasLocationPermission) "Granted" else "Restricted",
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = if (hasLocationPermission) Color(0xFF059669) else Color(0xFFDC2626),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            ),
                                            maxLines = 1,
                                            softWrap = false
                                        )
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
                                        .padding(horizontal = 10.dp, vertical = 8.dp)
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        Text(
                                            text = "Accuracy",
                                            style = MaterialTheme.typography.labelSmall.copy(color = Color(0xFF64748B), fontSize = 10.5.sp),
                                            maxLines = 1,
                                            softWrap = false,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = "±${uiState.locationAccuracy.toInt()}m",
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = Color(0xFF0F172A),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            ),
                                            maxLines = 1,
                                            softWrap = false
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Text(
                                text = "Lat: ${String.format("%.4f", uiState.currentLat)}, Lng: ${String.format("%.4f", uiState.currentLng)}",
                                style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF334155), fontWeight = FontWeight.Bold),
                                maxLines = 1,
                                softWrap = false
                            )
                            Text(
                                text = "Kadapa District, Andhra Pradesh, India",
                                style = MaterialTheme.typography.labelSmall.copy(color = Color(0xFF64748B), fontSize = 11.sp),
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                }

                // 5. ATTENDANCE HISTORY LIST
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Today's Attendance Timeline (${uiState.todayLogs.size})",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0F172A)
                            )
                        )
                    }
                }

                if (uiState.todayLogs.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                                Text(
                                    text = "No attendance events logged today. Tap 'Clock-In' above to begin.",
                                    style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF64748B))
                                )
                            }
                        }
                    }
                } else {
                    items(uiState.todayLogs) { log ->
                        AttendanceRecordCard(log)
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(20.dp)) }
        }
    }

    // Live Face Verification Camera Modal (Pops up when Clock-In or Clock-Out is tapped!)
    if (activePunchType != null) {
        FaceVerificationModal(
            punchType = activePunchType!!,
            currentLat = uiState.currentLat,
            currentLng = uiState.currentLng,
            locationAccuracy = uiState.locationAccuracy,
            isSubmitting = uiState.isLoading,
            onDismiss = { activePunchType = null },
            onSubmitPunch = { photoUri ->
                viewModel.submitAttendance(activePunchType!!, photoUri) { success ->
                    if (success) {
                        activePunchType = null
                    }
                }
            }
        )
    }
}

@Composable
fun AttendanceRecordCard(record: AttendanceResponse) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(14.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val isIn = record.attendanceType.contains("In", ignoreCase = true)
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(if (isIn) Color(0xFFDCFCE7) else Color(0xFFFEE2E2)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isIn) Icons.Default.Login else Icons.Default.Logout,
                    contentDescription = null,
                    tint = if (isIn) Color(0xFF16A34A) else Color(0xFFDC2626),
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = record.attendanceType,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A),
                        fontSize = 15.sp
                    )
                )
                Text(
                    text = "${record.formattedDate} at ${record.formattedTime}",
                    style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF64748B), fontSize = 12.sp)
                )
                if (record.workDurationFormatted.isNotBlank()) {
                    Text(
                        text = "Shift Duration: ${record.workDurationFormatted}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color(0xFF0052CC),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp
                        )
                    )
                }
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFDCFCE7))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "VERIFIED",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF16A34A),
                        fontSize = 10.sp
                    )
                )
            }
        }
    }
}
