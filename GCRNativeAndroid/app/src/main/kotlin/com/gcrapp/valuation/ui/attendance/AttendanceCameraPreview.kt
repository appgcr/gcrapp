package com.gcrapp.valuation.ui.attendance

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.util.Base64
import android.util.Log
import android.view.ViewGroup
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.gcrapp.valuation.ui.theme.PrimaryNavy
import com.gcrapp.valuation.ui.theme.Slate100
import com.gcrapp.valuation.ui.theme.Slate500
import com.gcrapp.valuation.ui.theme.SuccessGreen
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executor

@Composable
fun AttendanceCameraPreview(
    modifier: Modifier = Modifier,
    hasCameraPermission: Boolean,
    capturedBitmap: Bitmap?,
    onImageCaptureCreated: (ImageCapture) -> Unit,
    onRetake: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Pulsing animation for face alignment oval
    val infiniteTransition = rememberInfiniteTransition(label = "ReticlePulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 0.95f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "PulseAlpha"
    )

    Box(
        modifier = modifier
            .size(200.dp)
            .clip(CircleShape)
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        if (capturedBitmap != null) {
            // Display captured selfie photo
            Image(
                bitmap = capturedBitmap.asImageBitmap(),
                contentDescription = "Captured Selfie",
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            // Retake overlay button
            IconButton(
                onClick = onRetake,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 8.dp)
                    .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                    .size(36.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Retake",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
        } else if (hasCameraPermission) {
            // Live Front Camera Preview
            var previewViewRef by remember { mutableStateOf<PreviewView?>(null) }

            AndroidView(
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                        previewViewRef = this
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            LaunchedEffect(previewViewRef) {
                val previewView = previewViewRef ?: return@LaunchedEffect
                val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

                cameraProviderFuture.addListener({
                    try {
                        val cameraProvider = cameraProviderFuture.get()

                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        val imageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                            .setTargetRotation(previewView.display?.rotation ?: android.view.Surface.ROTATION_0)
                            .build()

                        onImageCaptureCreated(imageCapture)

                        // Prefer Front Camera for Attendance Selfie
                        val cameraSelector = if (cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
                            CameraSelector.DEFAULT_FRONT_CAMERA
                        } else {
                            CameraSelector.DEFAULT_BACK_CAMERA
                        }

                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            preview,
                            imageCapture
                        )
                    } catch (e: Exception) {
                        Log.e("AttendanceCamera", "Camera binding failed", e)
                    }
                }, ContextCompat.getMainExecutor(context))
            }

            // Face reticle overlay guide
            Canvas(modifier = Modifier.fillMaxSize()) {
                val strokeWidth = 3.dp.toPx()
                val radius = (size.minDimension / 2) - strokeWidth
                drawCircle(
                    color = SuccessGreen.copy(alpha = pulseAlpha),
                    radius = radius,
                    style = Stroke(width = strokeWidth)
                )
            }
        } else {
            // Fallback when camera permission not granted
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Slate100),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.CameraAlt,
                    contentDescription = null,
                    tint = Slate500,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Camera Offline",
                    style = MaterialTheme.typography.labelSmall.copy(color = Slate500)
                )
            }
        }
    }
}

/**
 * Utility function to capture photo from CameraX ImageCapture and return a scaled, rotated Bitmap
 */
fun captureSelfiePhoto(
    context: Context,
    imageCapture: ImageCapture?,
    executor: Executor,
    onSuccess: (Bitmap, String) -> Unit,
    onError: (Exception) -> Unit
) {
    if (imageCapture == null) {
        onError(IllegalStateException("Camera is not ready yet. Please wait a moment."))
        return
    }

    val photoFile = File(context.cacheDir, "selfie_${System.currentTimeMillis()}.jpg")
    val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

    imageCapture.takePicture(
        outputOptions,
        executor,
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                try {
                    val rawBitmap = BitmapFactory.decodeFile(photoFile.absolutePath)
                    if (rawBitmap == null) {
                        onError(IllegalStateException("Failed to decode captured image."))
                        return
                    }

                    // Scale down to max 640px to ensure fast network transmission and memory safety
                    val maxDim = 640
                    val scale = if (rawBitmap.width > maxDim || rawBitmap.height > maxDim) {
                        val factor = maxDim.toFloat() / maxOf(rawBitmap.width, rawBitmap.height)
                        Matrix().apply { postScale(factor, factor) }
                    } else {
                        Matrix()
                    }

                    val scaledBitmap = Bitmap.createBitmap(
                        rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, scale, true
                    )

                    // Convert to Base64 JPEG data URI
                    val stream = ByteArrayOutputStream()
                    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 75, stream)
                    val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
                    val dataUri = "data:image/jpeg;base64,$base64"

                    ContextCompat.getMainExecutor(context).execute {
                        onSuccess(scaledBitmap, dataUri)
                    }
                } catch (e: Exception) {
                    ContextCompat.getMainExecutor(context).execute {
                        onError(e)
                    }
                }
            }

            override fun onError(exception: ImageCaptureException) {
                ContextCompat.getMainExecutor(context).execute {
                    onError(exception)
                }
            }
        }
    )
}
