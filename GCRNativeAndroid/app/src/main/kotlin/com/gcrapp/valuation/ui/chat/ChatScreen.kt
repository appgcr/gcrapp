package com.gcrapp.valuation.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gcrapp.valuation.data.models.ChatMessageDto
import com.gcrapp.valuation.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    // Auto-scroll to bottom when new messages arrive
    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Box(contentAlignment = Alignment.BottomEnd) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(PrimaryNavy),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.SupportAgent,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .size(11.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF10B981))
                                    .border(1.5.dp, Color.White, CircleShape)
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Column(modifier = Modifier.weight(1f, fill = false)) {
                            Text(
                                text = "Operations & Senior Valuer Desk",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White,
                                    fontSize = 14.sp
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                softWrap = false
                            )
                            Text(
                                text = "SBI Panel Central Desk · Active",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = Color.White.copy(alpha = 0.8f),
                                    fontSize = 11.sp
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                softWrap = false
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = PrimaryNavy
                )
            )
        },
        containerColor = Color(0xFFF1F5F9)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
        ) {
            // Channel Notice Header Banner
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFEFF6FF))
                    .border(0.5.dp, Color(0xFFBFDBFE))
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = Color(0xFF2563EB),
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Encrypted field channel · Messages synced with Central Valuation Portal",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color(0xFF1E40AF),
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Medium
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        softWrap = false
                    )
                }
            }

            // Message Bubble History List
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(uiState.messages) { message ->
                    val isMe = message.senderId.equals("engineer", ignoreCase = true)
                    MessageBubble(message = message, isMe = isMe)
                }
            }

            // Quick Field Response Pills (Horizontal Scroll)
            val quickResponses = listOf(
                "📍 Arrived at Site",
                "📸 Capturing Photos",
                "📐 Boundaries Verified",
                "⚠️ Site Locked / Gate Closed",
                "✅ Valuation Complete"
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                quickResponses.forEach { prompt ->
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFF1F5F9))
                            .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(16.dp))
                            .clickable { viewModel.sendQuickResponse(prompt) }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = prompt,
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = PrimaryNavy,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 11.sp
                            ),
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }

            HorizontalDivider(color = Color(0xFFE2E8F0))

            // Bottom Input Bar
            Surface(
                color = Color.White,
                shadowElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = uiState.currentInput,
                        onValueChange = { viewModel.onInputChanged(it) },
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 44.dp, max = 100.dp),
                        placeholder = {
                            Text(
                                "Type field message or update...",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = Color(0xFF94A3B8),
                                    fontSize = 13.sp
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                softWrap = false
                            )
                        },
                        shape = RoundedCornerShape(22.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF0052CC),
                            unfocusedBorderColor = Color(0xFFCBD5E1),
                            focusedContainerColor = Color(0xFFF8FAFC),
                            unfocusedContainerColor = Color(0xFFF8FAFC)
                        ),
                        singleLine = false,
                        maxLines = 3
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Send Button
                    val canSend = uiState.currentInput.trim().isNotBlank()
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(
                                if (canSend) Brush.linearGradient(listOf(Color(0xFF0052CC), Color(0xFF003E99)))
                                else Brush.linearGradient(listOf(Color(0xFFE2E8F0), Color(0xFFCBD5E1)))
                            )
                            .clickable(enabled = canSend) {
                                viewModel.sendMessage()
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send",
                            tint = if (canSend) Color.White else Color(0xFF94A3B8),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MessageBubble(
    message: ChatMessageDto,
    isMe: Boolean
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isMe) Alignment.End else Alignment.Start
    ) {
        // Sender Label for Desk
        if (!isMe) {
            Text(
                text = "Operations Desk",
                style = MaterialTheme.typography.labelSmall.copy(
                    color = Color(0xFF64748B),
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp
                ),
                modifier = Modifier.padding(start = 6.dp, bottom = 2.dp),
                maxLines = 1,
                softWrap = false
            )
        }

        Box(
            modifier = Modifier
                .widthIn(max = 290.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp,
                        topEnd = 16.dp,
                        bottomStart = if (isMe) 16.dp else 4.dp,
                        bottomEnd = if (isMe) 4.dp else 16.dp
                    )
                )
                .background(
                    if (isMe) Color(0xFF0052CC) else Color.White
                )
                .then(
                    if (!isMe) Modifier.border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 4.dp, bottomEnd = 16.dp))
                    else Modifier
                )
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Column {
                Text(
                    text = message.text,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = if (isMe) Color.White else Color(0xFF0F172A),
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Normal
                    )
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier.align(Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = message.timestamp.ifBlank { "Just now" },
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = if (isMe) Color.White.copy(alpha = 0.7f) else Color(0xFF94A3B8),
                            fontSize = 10.sp
                        ),
                        maxLines = 1,
                        softWrap = false
                    )
                    if (isMe) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.DoneAll,
                            contentDescription = "Delivered",
                            tint = Color(0xFF38BDF8),
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }
            }
        }
    }
}
