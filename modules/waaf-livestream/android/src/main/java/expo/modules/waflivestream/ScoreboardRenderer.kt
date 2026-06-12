package expo.modules.waflivestream

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface

object ScoreboardRenderer {
  private const val WIDTH = 1280
  private const val HEIGHT = 136
  private const val PAD = 20f
  private const val RADIUS = 14f

  private val waafRed = Color.parseColor("#E31E24")
  private val waafBlue = Color.parseColor("#1A4384")
  private val panelDark = Color.argb(235, 12, 14, 18)
  private val panelMid = Color.argb(220, 24, 28, 36)
  private val strokeColor = Color.argb(120, 255, 255, 255)

  fun render(
    teamHome: String,
    teamAway: String,
    scoreHome: Int,
    scoreAway: Int,
    timer: String,
    period: String,
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val home = trimTeam(teamHome, 16)
    val away = trimTeam(teamAway, 16)
    val score = "$scoreHome : $scoreAway"
    val periodLabel = period.trim().ifBlank { "МАТЧ" }.uppercase()

    val outer = RectF(PAD, PAD, WIDTH - PAD, HEIGHT - PAD)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    // Тень
    paint.color = Color.argb(90, 0, 0, 0)
    canvas.drawRoundRect(
      RectF(outer.left + 3f, outer.top + 4f, outer.right + 3f, outer.bottom + 4f),
      RADIUS,
      RADIUS,
      paint,
    )

    // Верхняя плашка — таймер / тайм
    val timerH = 38f
    val timerRect = RectF(outer.left, outer.top, outer.right, outer.top + timerH)
    paint.shader = LinearGradient(
      timerRect.left, timerRect.top, timerRect.right, timerRect.bottom,
      Color.argb(250, 26, 30, 38),
      panelDark,
      Shader.TileMode.CLAMP,
    )
    canvas.drawRoundRect(
      RectF(timerRect.left, timerRect.top, timerRect.right, timerRect.bottom + 6f),
      RADIUS,
      RADIUS,
      paint,
    )
    paint.shader = null

    // Красная полоска WAAF слева
    paint.color = waafRed
    canvas.drawRoundRect(
      RectF(timerRect.left, timerRect.top, timerRect.left + 6f, timerRect.bottom),
      3f,
      3f,
      paint,
    )

    val brandPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = waafRed
      textSize = 13f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      letterSpacing = 0.12f
    }
    val periodPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 18f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val timerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 24f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    }

    canvas.drawText("WAAF", timerRect.left + 16f, timerRect.top + 25f, brandPaint)
    canvas.drawText(periodLabel, timerRect.left + 72f, timerRect.top + 25f, periodPaint)
    val timerW = timerPaint.measureText(timer)
    canvas.drawText(timer, timerRect.right - timerW - 16f, timerRect.top + 27f, timerPaint)

    // Нижняя плашка — команды и счёт
    val scoreTop = timerRect.bottom + 4f
    val scoreRect = RectF(outer.left, scoreTop, outer.right, outer.bottom)
    paint.color = panelMid
    canvas.drawRoundRect(
      RectF(scoreRect.left, scoreRect.top - 6f, scoreRect.right, scoreRect.bottom),
      RADIUS,
      RADIUS,
      paint,
    )

    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 1.5f
    paint.color = strokeColor
    canvas.drawRoundRect(scoreRect, RADIUS - 2f, RADIUS - 2f, paint)
    paint.style = Paint.Style.FILL

    val centerX = scoreRect.centerX()
    val centerW = 148f
    val centerRect = RectF(centerX - centerW / 2f, scoreRect.top + 8f, centerX + centerW / 2f, scoreRect.bottom - 8f)
    paint.color = waafBlue
    canvas.drawRoundRect(centerRect, 10f, 10f, paint)
    paint.color = waafRed
    canvas.drawRoundRect(
      RectF(centerRect.left, centerRect.top, centerRect.left + 4f, centerRect.bottom),
      2f,
      2f,
      paint,
    )

    val teamPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 26f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val scorePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 34f
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }

    val scoreY = centerRect.centerY() + 12f
    val scoreTextW = scorePaint.measureText(score)
    canvas.drawText(score, centerRect.centerX() - scoreTextW / 2f, scoreY, scorePaint)

    val homeMaxW = centerRect.left - scoreRect.left - 24f
    val awayMaxW = scoreRect.right - centerRect.right - 24f
    drawFittedText(canvas, home, teamPaint, scoreRect.left + 16f, scoreY, homeMaxW, alignEnd = false)
    drawFittedText(canvas, away, teamPaint, scoreRect.right - 16f, scoreY, awayMaxW, alignEnd = true)

    return bitmap
  }

  private fun drawFittedText(
    canvas: Canvas,
    text: String,
    basePaint: Paint,
    anchorX: Float,
    y: Float,
    maxWidth: Float,
    alignEnd: Boolean,
  ) {
    val paint = Paint(basePaint)
    var size = paint.textSize
    while (paint.measureText(text) > maxWidth && size > 14f) {
      size -= 1f
      paint.textSize = size
    }
    val w = paint.measureText(text)
    val x = if (alignEnd) anchorX - w else anchorX
    canvas.drawText(text, x, y, paint)
  }

  private fun trimTeam(name: String, maxLen: Int): String {
    val trimmed = name.trim().ifBlank { "—" }
    return if (trimmed.length <= maxLen) trimmed else trimmed.take(maxLen - 1) + "…"
  }
}
