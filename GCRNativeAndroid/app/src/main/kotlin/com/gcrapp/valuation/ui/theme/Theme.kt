package com.gcrapp.valuation.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = PrimaryNavy,
    onPrimary = SurfaceLight,
    primaryContainer = PrimaryNavyLight,
    onPrimaryContainer = SurfaceLight,
    secondary = AccentIndigo,
    onSecondary = SurfaceLight,
    background = Slate50,
    onBackground = Slate900,
    surface = SurfaceLight,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate700,
    outline = CardBorder,
    error = DangerRed,
    onError = SurfaceLight
)

private val DarkColorScheme = darkColorScheme(
    primary = AccentIndigoLight,
    onPrimary = Slate900,
    secondary = AccentIndigo,
    background = Slate900,
    onBackground = Slate50,
    surface = SurfaceDark,
    onSurface = Slate50,
    surfaceVariant = Slate800,
    onSurfaceVariant = Slate300,
    outline = Slate700,
    error = DangerRed,
    onError = SurfaceLight
)

@Composable
fun GCRTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = PrimaryNavy.toArgb()
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
