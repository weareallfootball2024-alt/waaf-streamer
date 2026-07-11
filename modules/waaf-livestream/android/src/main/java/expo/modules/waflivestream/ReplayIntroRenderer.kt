package expo.modules.waflivestream

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import kotlin.math.roundToInt

object ReplayIntroRenderer {
  private const val WIDTH = 1280
  private const val HEIGHT = 720
  private const val FRAME_INSET = 16f
  private const val BRAND_RED = 0xFFE31E24.toInt()

  fun render(
    logo: Bitmap? = null,
    teamName: String? = null,
    dimmed: Boolean = false,
    logoAlpha: Float = 1f,
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    drawFrame(canvas)

    val recDotAlpha = if (dimmed) 120 else 255
    drawRecBadge(canvas, recDotAlpha)

    val alpha = logoAlpha.coerceIn(0f, 1f)
    if (alpha > 0.01f && logo != null) {
      drawTeamLogo(canvas, logo, teamName, alpha)
    }

    return bitmap
  }

  private fun drawFrame(canvas: Canvas) {
    val outer = RectF(
      FRAME_INSET,
      FRAME_INSET,
      WIDTH - FRAME_INSET,
      HEIGHT - FRAME_INSET,
    )
    val inner = RectF(
      outer.left + 6f,
      outer.top + 6f,
      outer.right - 6f,
      outer.bottom - 6f,
    )

    val outerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(100, 255, 255, 255)
      style = Paint.Style.STROKE
      strokeWidth = 2f
    }
    val innerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = BRAND_RED
      style = Paint.Style.STROKE
      strokeWidth = 3f
    }

    canvas.drawRoundRect(outer, 8f, 8f, outerPaint)
    canvas.drawRoundRect(inner, 6f, 6f, innerPaint)
  }

  private fun drawRecBadge(canvas: Canvas, dotAlpha: Int) {
    val margin = 24f
    val dotRadius = 5f
    val dotCx = WIDTH - margin - 60f
    val dotCy = margin + 10f

    val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(dotAlpha, 227, 30, 36)
      style = Paint.Style.FILL
    }
    canvas.drawCircle(dotCx, dotCy, dotRadius, dotPaint)

    val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(230, 255, 255, 255)
      textSize = 20f
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
    canvas.drawText("повтор", dotCx + dotRadius + 8f, dotCy + 7f, labelPaint)
  }

  private fun drawTeamLogo(canvas: Canvas, logo: Bitmap, teamName: String?, alpha: Float) {
    val centerX = WIDTH / 2f
    val centerY = HEIGHT / 2f
    val size = 120f
    val rect = RectF(
      centerX - size / 2f,
      centerY - size / 2f - 16f,
      centerX + size / 2f,
      centerY + size / 2f - 16f,
    )

    val a = (alpha * 255f).roundToInt().coerceIn(0, 255)
    val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
      this.alpha = a
    }
    canvas.drawBitmap(logo, null, rect, bitmapPaint)

    val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb((a * 0.85f).roundToInt(), 255, 255, 255)
      style = Paint.Style.STROKE
      strokeWidth = 2f
    }
    canvas.drawOval(rect, ringPaint)

    val name = teamName?.trim().orEmpty()
    if (name.isNotEmpty()) {
      val namePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb((a * 0.9f).roundToInt(), 255, 255, 255)
        textSize = 22f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      }
      val nameW = namePaint.measureText(name)
      canvas.drawText(name, centerX - nameW / 2f, rect.bottom + 32f, namePaint)
    }
  }
}
