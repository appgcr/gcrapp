package com.gcrapp.valuation.ui.components

import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.Path as AndroidPath
import android.util.Base64
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.gcrapp.valuation.ui.theme.PrimaryNavy
import com.gcrapp.valuation.ui.theme.Slate200
import com.gcrapp.valuation.ui.theme.Slate50
import java.io.ByteArrayOutputStream

data class SignatureStroke(
    val path: Path,
    val points: List<Offset>
)

@Composable
fun SignatureCanvas(
    modifier: Modifier = Modifier,
    initialSignatureUrl: String? = null,
    onSignatureCaptured: (String) -> Unit
) {
    val strokes = remember { mutableStateListOf<SignatureStroke>() }
    var currentPath by remember { mutableStateOf<Path?>(null) }
    var currentPoints by remember { mutableStateOf<MutableList<Offset>>(mutableListOf()) }
    var hasSigned by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.5.dp, PrimaryNavy, RoundedCornerShape(12.dp))
            .background(Color.White)
            .padding(8.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .background(Slate50)
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { offset ->
                            val newPath = Path().apply { moveTo(offset.x, offset.y) }
                            currentPath = newPath
                            currentPoints = mutableListOf(offset)
                            hasSigned = true
                        },
                        onDrag = { change, _ ->
                            change.consume()
                            val offset = change.position
                            currentPath?.lineTo(offset.x, offset.y)
                            currentPoints.add(offset)
                        },
                        onDragEnd = {
                            currentPath?.let { path ->
                                strokes.add(SignatureStroke(path, currentPoints.toList()))
                            }
                            currentPath = null
                            currentPoints = mutableListOf()
                        }
                    )
                }
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                // Draw past strokes
                for (stroke in strokes) {
                    drawPath(
                        path = stroke.path,
                        color = Color.Black,
                        style = Stroke(
                            width = 4.dp.toPx(),
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )
                    )
                }
                // Draw active stroke
                currentPath?.let { activePath ->
                    drawPath(
                        path = activePath,
                        color = Color.Black,
                        style = Stroke(
                            width = 4.dp.toPx(),
                            cap = StrokeCap.Round,
                            join = StrokeJoin.Round
                        )
                    )
                }
            }

            if (!hasSigned && strokes.isEmpty() && initialSignatureUrl.isNullOrBlank()) {
                Text(
                    text = "Sign here with finger or stylus",
                    color = Color.Gray,
                    modifier = Modifier.align(Alignment.Center),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row {
                IconButton(
                    onClick = {
                        if (strokes.isNotEmpty()) {
                            strokes.removeAt(strokes.size - 1)
                            if (strokes.isEmpty()) hasSigned = false
                        }
                    },
                    enabled = strokes.isNotEmpty()
                ) {
                    Icon(imageVector = Icons.Default.Undo, contentDescription = "Undo", tint = PrimaryNavy)
                }

                IconButton(
                    onClick = {
                        strokes.clear()
                        currentPath = null
                        hasSigned = false
                    },
                    enabled = strokes.isNotEmpty()
                ) {
                    Icon(imageVector = Icons.Default.Clear, contentDescription = "Clear", tint = Color.Red)
                }
            }

            Button(
                onClick = {
                    val base64Png = exportStrokesToBase64(strokes)
                    onSignatureCaptured(base64Png)
                },
                enabled = strokes.isNotEmpty(),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryNavy)
            ) {
                Icon(imageVector = Icons.Default.Done, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Confirm Signature", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

private fun exportStrokesToBase64(strokes: List<SignatureStroke>): String {
    val width = 600
    val height = 250
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    canvas.drawColor(android.graphics.Color.WHITE)

    val paint = Paint().apply {
        color = android.graphics.Color.BLACK
        isAntiAlias = true
        style = Paint.Style.STROKE
        strokeWidth = 6f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    for (stroke in strokes) {
        val androidPath = stroke.path.asAndroidPath()
        canvas.drawPath(androidPath, paint)
    }

    val outputStream = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 90, outputStream)
    val bytes = outputStream.toByteArray()
    return "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
}
