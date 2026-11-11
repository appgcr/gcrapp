package com.gcrapp.valuation.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gcrapp.valuation.ui.components.PrimaryButton
import com.gcrapp.valuation.ui.theme.*

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    onBiometricClick: (() -> Unit)? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var showServerDialog by remember { mutableStateOf(false) }
    var tempServerUrl by remember { mutableStateOf(uiState.baseUrl) }

    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate50)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(40.dp))

            // App Brand Emblem
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(PrimaryNavy),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.AccountBalance,
                    contentDescription = "GCR Emblem",
                    tint = Color.White,
                    modifier = Modifier.size(44.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "GCR VALUATION",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.ExtraBold,
                    color = PrimaryNavy,
                    letterSpacing = 1.2.sp
                )
            )

            Text(
                text = "SBI Bank Panel Field Engineer Portal",
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = Slate500,
                    fontWeight = FontWeight.Medium
                )
            )

            Spacer(modifier = Modifier.height(32.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Authorized Access",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        ),
                        modifier = Modifier.align(Alignment.Start)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Username Field
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text("Username / Employee ID") },
                        placeholder = { Text("Enter username or ID", color = Slate500) },
                        leadingIcon = {
                            Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = PrimaryNavy)
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Password Field
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        placeholder = { Text("Enter password", color = Slate500) },
                        leadingIcon = {
                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = PrimaryNavy)
                        },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                    tint = Slate500
                                )
                            }
                        },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = {
                            focusManager.clearFocus()
                            viewModel.login(username, password, onLoginSuccess)
                        }),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    if (uiState.errorMessage != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = uiState.errorMessage!!,
                            color = DangerRed,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Login Button
                    PrimaryButton(
                        text = "Sign In to Portal",
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.login(username, password, onLoginSuccess)
                        },
                        isLoading = uiState.isLoading,
                        icon = Icons.Default.Login
                    )

                    // Biometric Authentication Button
                    if (onBiometricClick != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = onBiometricClick,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryNavy)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Fingerprint,
                                contentDescription = "Biometric",
                                tint = PrimaryNavy,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Biometric Instant Sign-In",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.SemiBold,
                                    color = PrimaryNavy
                                )
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Server URL Config & Info
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth()
            ) {
                TextButton(onClick = {
                    tempServerUrl = uiState.baseUrl
                    showServerDialog = true
                }) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = Slate500
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Server Settings",
                        style = MaterialTheme.typography.labelSmall.copy(color = Slate500)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Server URL Configuration Dialog
        if (showServerDialog) {
            AlertDialog(
                onDismissRequest = { showServerDialog = false },
                title = { Text("Backend Server Configuration") },
                text = {
                    Column {
                        Text(
                            text = "Set the ValuationBackend REST API address. Use 10.0.2.2:5001 for Android Emulator or your machine's local IP for physical devices.",
                            style = MaterialTheme.typography.bodySmall.copy(color = Slate700)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedTextField(
                            value = tempServerUrl,
                            onValueChange = { tempServerUrl = it },
                            label = { Text("Base URL") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            viewModel.updateServerUrl(tempServerUrl)
                            showServerDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryNavy)
                    ) {
                        Text("Save & Apply")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showServerDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
