package com.gcrapp.valuation.ui.attendance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gcrapp.valuation.data.models.AttendanceResponse
import com.gcrapp.valuation.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun MonthlyCalendarView(
    history: List<AttendanceResponse>,
    modifier: Modifier = Modifier
) {
    var calendar by remember { mutableStateOf(Calendar.getInstance()) }
    val currentMonthYear = remember(calendar.timeInMillis) {
        SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(calendar.time)
    }

    val daysInMonth = remember(calendar.timeInMillis) {
        val cal = calendar.clone() as Calendar
        cal.set(Calendar.DAY_OF_MONTH, 1)
        val maxDays = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val firstDayOfWeek = cal.get(Calendar.DAY_OF_WEEK) // 1=Sun, 2=Mon...
        Pair(maxDays, firstDayOfWeek)
    }

    // Map date string to attendance status
    val attendanceMap = remember(history, calendar.timeInMillis) {
        val map = mutableMapOf<Int, String>()
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH)

        history.forEach { item ->
            try {
                val epoch = item.timestamp.toLongOrNull()
                if (epoch != null) {
                    val logCal = Calendar.getInstance().apply { timeInMillis = epoch }
                    if (logCal.get(Calendar.YEAR) == year && logCal.get(Calendar.MONTH) == month) {
                        val day = logCal.get(Calendar.DAY_OF_MONTH)
                        map[day] = item.status.ifBlank { "Verified" }
                    }
                }
            } catch (e: Exception) {}
        }
        map
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            // Month Header with Prev/Next
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = currentMonthYear,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Slate900
                    )
                )

                Row {
                    IconButton(
                        onClick = {
                            val newCal = calendar.clone() as Calendar
                            newCal.add(Calendar.MONTH, -1)
                            calendar = newCal
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(imageVector = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Prev Month", tint = Slate700)
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    IconButton(
                        onClick = {
                            val newCal = calendar.clone() as Calendar
                            newCal.add(Calendar.MONTH, 1)
                            calendar = newCal
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(imageVector = Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Next Month", tint = Slate700)
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Weekday Headers
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa").forEach { day ->
                    Text(
                        text = day,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = Slate500
                        ),
                        modifier = Modifier.weight(1f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Days Grid
            val (maxDays, firstDayOfWeek) = daysInMonth
            val totalSlots = 35 // 5 rows x 7 days
            val offset = firstDayOfWeek - 1

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (row in 0 until 5) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        for (col in 0 until 7) {
                            val slotIndex = row * 7 + col
                            val dayNum = slotIndex - offset + 1

                            if (dayNum in 1..maxDays) {
                                val hasAttendance = attendanceMap.containsKey(dayNum)
                                val today = Calendar.getInstance()
                                val isToday = today.get(Calendar.YEAR) == calendar.get(Calendar.YEAR) &&
                                        today.get(Calendar.MONTH) == calendar.get(Calendar.MONTH) &&
                                        today.get(Calendar.DAY_OF_MONTH) == dayNum

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .aspectRatio(1f)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                hasAttendance -> SuccessGreen.copy(alpha = 0.15f)
                                                isToday -> PrimaryNavy.copy(alpha = 0.1f)
                                                else -> Color.Transparent
                                            }
                                        )
                                        .then(
                                            if (isToday) Modifier.border(1.5.dp, PrimaryNavy, CircleShape)
                                            else Modifier
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(
                                            text = dayNum.toString(),
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                fontWeight = if (isToday || hasAttendance) FontWeight.Bold else FontWeight.Normal,
                                                color = if (hasAttendance) SuccessGreen else if (isToday) PrimaryNavy else Slate700
                                            )
                                        )
                                        if (hasAttendance) {
                                            Box(
                                                modifier = Modifier
                                                    .size(4.dp)
                                                    .clip(CircleShape)
                                                    .background(SuccessGreen)
                                            )
                                        }
                                    }
                                }
                            } else {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Legend
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(SuccessGreen))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(text = "Present / Verified", style = MaterialTheme.typography.labelSmall.copy(color = Slate500))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).border(1.dp, PrimaryNavy, CircleShape))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(text = "Today", style = MaterialTheme.typography.labelSmall.copy(color = Slate500))
                }
            }
        }
    }
}
