package com.gcrapp.valuation

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.biometric.BiometricPrompt
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.gcrapp.valuation.core.security.TokenManager
import com.gcrapp.valuation.ui.auth.AuthViewModel
import com.gcrapp.valuation.ui.auth.LoginScreen
import com.gcrapp.valuation.ui.cases.CaseListViewModel
import com.gcrapp.valuation.ui.dashboard.DashboardViewModel
import com.gcrapp.valuation.ui.attendance.AttendanceViewModel
import com.gcrapp.valuation.ui.inspection.InspectionViewModel
import com.gcrapp.valuation.ui.inspection.InspectionWorkflowScreen
import com.gcrapp.valuation.ui.navigation.MainScaffoldScreen
import com.gcrapp.valuation.ui.navigation.MainTab
import com.gcrapp.valuation.ui.reports.ReportViewerScreen
import com.gcrapp.valuation.ui.theme.GCRTheme

sealed class Screen {
    object Login : Screen()
    data class Main(val tab: MainTab = MainTab.ATTENDANCE) : Screen()
    data class Inspection(val caseId: String) : Screen()
    data class Report(val caseId: String) : Screen()
}

class MainActivity : FragmentActivity() {

    private val authViewModel: AuthViewModel by viewModels()
    private val dashboardViewModel: DashboardViewModel by viewModels()
    private val attendanceViewModel: AttendanceViewModel by viewModels()
    private val caseListViewModel: CaseListViewModel by viewModels()
    private val inspectionViewModel: InspectionViewModel by viewModels()

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        attendanceViewModel.setPermissions(cameraGranted, locationGranted)
        if (locationGranted) {
            attendanceViewModel.fetchLocation()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request runtime permissions on modern Android
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
        }
        requestPermissionLauncher.launch(permissions.toTypedArray())

        setContent {
            GCRTheme {
                val tokenManager = remember { TokenManager.getInstance(applicationContext) }
                val initialScreen = if (tokenManager.isLoggedIn()) Screen.Main(MainTab.ATTENDANCE) else Screen.Login
                var currentScreen by remember { mutableStateOf<Screen>(initialScreen) }
                var currentMainTab by remember { mutableStateOf(MainTab.ATTENDANCE) }

                Surface(modifier = Modifier.fillMaxSize()) {
                    Crossfade(targetState = currentScreen, label = "ScreenTransition") { screen ->
                        when (screen) {
                            is Screen.Login -> {
                                LoginScreen(
                                    viewModel = authViewModel,
                                    onLoginSuccess = {
                                        dashboardViewModel.loadDashboard(forceRefresh = true)
                                        attendanceViewModel.loadHistory()
                                        currentMainTab = MainTab.ATTENDANCE
                                        currentScreen = Screen.Main(MainTab.ATTENDANCE)
                                    },
                                    onBiometricClick = {
                                        showBiometricPrompt {
                                            dashboardViewModel.loadDashboard(forceRefresh = true)
                                            attendanceViewModel.loadHistory()
                                            currentMainTab = MainTab.ATTENDANCE
                                            currentScreen = Screen.Main(MainTab.ATTENDANCE)
                                        }
                                    }
                                )
                            }
                            is Screen.Main -> {
                                MainScaffoldScreen(
                                    currentTab = currentMainTab,
                                    onTabSelected = { tab ->
                                        currentMainTab = tab
                                    },
                                    attendanceViewModel = attendanceViewModel,
                                    dashboardViewModel = dashboardViewModel,
                                    caseListViewModel = caseListViewModel,
                                    onNavigateToInspection = { caseId ->
                                        inspectionViewModel.loadCase(caseId)
                                        currentScreen = Screen.Inspection(caseId)
                                    },
                                    onNavigateToReport = { caseId ->
                                        currentScreen = Screen.Report(caseId)
                                    },
                                    onLogout = {
                                        authViewModel.logout()
                                        currentScreen = Screen.Login
                                    }
                                )
                            }
                            is Screen.Inspection -> {
                                BackHandler {
                                    currentMainTab = MainTab.CASES
                                    currentScreen = Screen.Main(MainTab.CASES)
                                }
                                InspectionWorkflowScreen(
                                    viewModel = inspectionViewModel,
                                    onBack = {
                                        dashboardViewModel.loadDashboard(forceRefresh = true)
                                        currentMainTab = MainTab.CASES
                                        currentScreen = Screen.Main(MainTab.CASES)
                                    },
                                    onSubmitSuccess = {
                                        dashboardViewModel.loadDashboard(forceRefresh = true)
                                        currentMainTab = MainTab.CASES
                                        currentScreen = Screen.Main(MainTab.CASES)
                                    }
                                )
                            }
                            is Screen.Report -> {
                                BackHandler {
                                    currentMainTab = MainTab.CASES
                                    currentScreen = Screen.Main(MainTab.CASES)
                                }
                                ReportViewerScreen(
                                    caseId = screen.caseId,
                                    onBack = {
                                        currentMainTab = MainTab.CASES
                                        currentScreen = Screen.Main(MainTab.CASES)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    private fun showBiometricPrompt(onSuccess: () -> Unit) {
        val executor = ContextCompat.getMainExecutor(this)
        val prompt = BiometricPrompt(
            this,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("GCR Field Biometrics")
            .setSubtitle("Authenticate using your registered device fingerprint")
            .setNegativeButtonText("Use Password Instead")
            .build()

        prompt.authenticate(promptInfo)
    }
}
