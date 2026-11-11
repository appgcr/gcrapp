package com.gcrapp.valuation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gcrapp.valuation.ui.theme.*

@Composable
fun StatusBadge(
    status: String,
    modifier: Modifier = Modifier
) {
    val (bgColor, textColor) = when (status.lowercase()) {
        "approved", "completed", "verified", "clock-in" -> Pair(SuccessGreenLight, SuccessGreen)
        "in progress", "inspecting", "waiting to sync" -> Pair(WarningAmberLight, WarningAmber)
        "rejected", "clock-out", "sync failed" -> Pair(DangerRedLight, DangerRed)
        else -> Pair(Slate200, Slate700)
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = status.uppercase(),
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                color = textColor
            ),
            maxLines = 1,
            softWrap = false
        )
    }
}

@Composable
fun MetricCard(
    title: String,
    value: String,
    subtitle: String? = null,
    icon: ImageVector,
    iconTint: Color = PrimaryNavy,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 12.dp, vertical = 12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(iconTint.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = Slate500,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    ),
                    maxLines = 1,
                    softWrap = false,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleLarge.copy(
                        color = Slate900,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    ),
                    maxLines = 1,
                    softWrap = false
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Slate500,
                            fontSize = 10.sp
                        ),
                        maxLines = 1,
                        softWrap = false,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(
    title: String,
    subtitle: String? = null,
    showBackButton: Boolean = false,
    onBackClick: (() -> Unit)? = null,
    isOnline: Boolean = true,
    onRefresh: (() -> Unit)? = null,
    onLogout: (() -> Unit)? = null
) {
    TopAppBar(
        title = {
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge.copy(
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    )
                }
            }
        },
        navigationIcon = {
            if (showBackButton && onBackClick != null) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }
            }
        },
        actions = {
            // Online/Offline Indicator Pill
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isOnline) SuccessGreen.copy(alpha = 0.2f) else WarningAmber.copy(alpha = 0.25f))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (isOnline) SuccessGreen else WarningAmber)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (isOnline) "LIVE" else "OFFLINE",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                )
            }

            if (onRefresh != null) {
                IconButton(onClick = onRefresh) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = Color.White
                    )
                }
            }

            if (onLogout != null) {
                IconButton(onClick = onLogout) {
                    Icon(
                        imageVector = Icons.Default.ExitToApp,
                        contentDescription = "Logout",
                        tint = Color.White
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = PrimaryNavy,
            titleContentColor = Color.White
        )
    )
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    icon: ImageVector? = null
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(50.dp),
        enabled = enabled && !isLoading,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = PrimaryNavy,
            contentColor = Color.White,
            disabledContainerColor = Slate300
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                color = Color.White,
                strokeWidth = 2.dp
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (icon != null) {
                    Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(
                    text = text,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                )
            }
        }
    }
}

@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(50.dp),
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.5.dp, PrimaryNavy),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = PrimaryNavy
        )
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (icon != null) {
                Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = text,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
            )
        }
    }
}

@Composable
fun OfflineBanner(
    pendingCount: Int,
    onSyncClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (pendingCount <= 0) return

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(12.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = WarningAmberLight)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.CloudSync,
                    contentDescription = null,
                    tint = WarningAmber,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "Offline Queue: $pendingCount pending items",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                    )
                    Text(
                        text = "Saved securely on device storage",
                        style = MaterialTheme.typography.labelSmall.copy(color = Slate700)
                    )
                }
            }

            Button(
                onClick = onSyncClick,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = WarningAmber),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "Sync Now",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                )
            }
        }
    }
}
