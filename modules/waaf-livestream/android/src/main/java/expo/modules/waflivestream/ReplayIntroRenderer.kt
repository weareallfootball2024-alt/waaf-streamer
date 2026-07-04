package expo.modules.waflivestream

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface

object ReplayIntroRenderer {
  private const val WIDTH = 1280
  private const val HEIGHT = 720

  fun render(
    title: String = "ПОВТОР",
    logo: Bitmap? = null,
    teamName: String? = null,
    dimmed: Boolean = false,
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val overlayAlpha = if (dimmed) 140 else 200
    canvas.drawColor(Color.argb(overlayAlpha, 0, 0, 0))

    val centerX = WIDTH / 2f
    val centerY = HEIGHT / 2f

    if (logo != null) {
      val size = 220f
      val rect = RectF(
        centerX - size / 2f,
        centerY - size / 2f - 40f,
        centerX + size / 2f,
        centerY + size / 2f - 40f,
      )
      val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(220, 255, 255, 255)
        style = Paint.Style.STROKE
        strokeWidth = 6f
      }
      canvas.drawBitmap(logo, null, rect, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
      canvas.drawOval(rect, ring)
    }

    val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = if (dimmed) Color.argb(180, 227, 30, 36) else Color.parseColor("#E31E24")
      textSize = if (logo != null) 72f else 96f
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
      letterSpacing = 0.2f
    }
    val titleW = titlePaint.measureText(title)
    val titleY = if (logo != null) centerY + 150f else centerY + 20f
    canvas.drawText(title, centerX - titleW / 2f, titleY, titlePaint)

    val name = teamName?.trim().orEmpty()
    if (name.isNotEmpty()) {
      val namePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(if (dimmed) 160 else 230, 255, 255, 255)
        textSize = 28f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      }
      val nameW = namePaint.measureText(name)
      canvas.drawText(name, centerX - nameW / 2f, titleY + 44f, namePaint)
    }

    return bitmap
  }
}
