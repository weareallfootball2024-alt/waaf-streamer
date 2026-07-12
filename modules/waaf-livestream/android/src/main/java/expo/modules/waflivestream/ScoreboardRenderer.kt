package expo.modules.waflivestream

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import kotlin.math.roundToInt

/**
 * Broadcast-style scoreboard inspired by UEFA / FIFA tournament graphics.
 */
object ScoreboardRenderer {
  private const val DESIGN_WIDTH = 1280
  private const val DESIGN_HEIGHT = 132
  private const val LOGO_SIZE = 44f
  private const val LOGO_SIZE_COMPACT = 30f
  private const val LOGO_PAD = 8f

  private val navyDark = Color.parseColor("#0B1D3A")
  private val navyMid = Color.parseColor("#122849")
  private val navyLight = Color.parseColor("#1E3A6E")
  private val gold = Color.parseColor("#D4AF37")
  private val goldBright = Color.parseColor("#F5D061")
  private val liveRed = Color.parseColor("#E31E24")
  private val white = Color.WHITE
  private val whiteSoft = Color.argb(220, 255, 255, 255)

  fun render(
    teamHome: String,
    teamAway: String,
    scoreHome: Int,
    scoreAway: Int,
    timer: String,
    period: String,
    logoHome: Bitmap? = null,
    logoAway: Bitmap? = null,
    layout: ScoreboardLayout = ScoreboardLayout.FULL,
    streamWidth: Int = DESIGN_WIDTH,
    opacity: Float = 1f,
  ): Bitmap {
    val bitmap = if (layout.isCompact) {
      renderCompact(
        teamHome, teamAway, scoreHome, scoreAway, timer, period,
        logoHome, logoAway, layout, streamWidth,
      )
    } else {
      renderFullBar(
        teamHome, teamAway, scoreHome, scoreAway, timer, period,
        logoHome, logoAway, streamWidth,
      )
    }
    return applyOpacity(bitmap, opacity)
  }

  private fun applyOpacity(source: Bitmap, opacity: Float): Bitmap {
    val o = opacity.coerceIn(0.1f, 1f)
    if (o >= 0.99f) return source
    val out = Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
      alpha = (o * 255f).roundToInt().coerceIn(0, 255)
    }
    canvas.drawBitmap(source, 0f, 0f, paint)
    if (source != out) source.recycle()
    return out
  }

  private fun renderFullBar(
    teamHome: String,
    teamAway: String,
    scoreHome: Int,
    scoreAway: Int,
    timer: String,
    period: String,
    logoHome: Bitmap?,
    logoAway: Bitmap?,
    streamWidth: Int,
  ): Bitmap {
    val width = streamWidth.coerceAtLeast(320)
    val height = (width * DESIGN_HEIGHT / DESIGN_WIDTH.toFloat()).toInt().coerceAtLeast(52)
    val scale = width / DESIGN_WIDTH.toFloat()

    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    val home = trimTeam(teamHome, if (logoHome != null) 14 else 18)
    val away = trimTeam(teamAway, if (logoAway != null) 14 else 18)
    val periodLabel = period.trim().ifBlank { "МАТЧ" }.uppercase()
    val scoreText = "$scoreHome  –  $scoreAway"
    val timerLabel = timer.ifBlank { "00:00" }

    paint.color = Color.argb(110, 0, 0, 0)
    canvas.drawRoundRect(RectF(6f * scale, 8f * scale, width - 6f * scale, height - 4f * scale), 6f * scale, 6f * scale, paint)

    val bar = RectF(6f * scale, 6f * scale, width - 6f * scale, height - 6f * scale)
    paint.shader = LinearGradient(
      bar.left, bar.top, bar.left, bar.bottom,
      intArrayOf(navyDark, navyMid, navyLight),
      floatArrayOf(0f, 0.55f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawRect(bar, paint)
    paint.shader = null

    paint.color = gold
    canvas.drawRect(bar.left, bar.top, bar.right, bar.top + 3f * scale, paint)

    val headerBottom = bar.top + 36f * scale
    paint.color = Color.argb(180, 0, 0, 0)
    canvas.drawRect(bar.left, bar.top + 3f * scale, bar.right, headerBottom, paint)

    paint.color = liveRed
    canvas.drawCircle(bar.left + 24f * scale, bar.top + 22f * scale, 4f * scale, paint)

    val livePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 12f * scale
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      letterSpacing = 0.15f
    }
    canvas.drawText("LIVE", bar.left + 34f * scale, bar.top + 26f * scale, livePaint)

    val periodPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = goldBright
      textSize = 14f * scale
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      letterSpacing = 0.08f
    }
    canvas.drawText(periodLabel, bar.left + 96f * scale, bar.top + 27f * scale, periodPaint)

    val headerTimerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 18f * scale
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    }
    val headerTimerW = headerTimerPaint.measureText(timerLabel)
    canvas.drawText(timerLabel, bar.right - headerTimerW - 16f * scale, bar.top + 28f * scale, headerTimerPaint)

    paint.color = Color.argb(90, 212, 175, 55)
    canvas.drawRect(bar.left + 12f * scale, headerBottom, bar.right - 12f * scale, headerBottom + 1.5f * scale, paint)

    val rowTop = headerBottom + 8f * scale
    val rowBottom = bar.bottom - 8f * scale
    val centerX = bar.centerX()

    val homePill = RectF(bar.left + 14f * scale, rowTop, centerX - 100f * scale, rowBottom)
    drawTeamPill(canvas, homePill, home, Color.parseColor("#2563EB"), false, logoHome, scale)

    val awayPill = RectF(centerX + 100f * scale, rowTop, bar.right - 14f * scale, rowBottom)
    drawTeamPill(canvas, awayPill, away, Color.parseColor("#DC2626"), true, logoAway, scale)

    val scoreBoxW = 170f * scale
    val scoreBox = RectF(centerX - scoreBoxW / 2f, rowTop, centerX + scoreBoxW / 2f, rowBottom)
    paint.color = Color.argb(240, 8, 18, 40)
    canvas.drawRoundRect(scoreBox, 6f * scale, 6f * scale, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 2f * scale
    paint.color = gold
    canvas.drawRoundRect(scoreBox, 6f * scale, 6f * scale, paint)
    paint.style = Paint.Style.FILL

    val scorePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 30f * scale
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
    val scoreW = scorePaint.measureText(scoreText)
    val scoreY = scoreBox.centerY() - 4f * scale
    canvas.drawText(scoreText, centerX - scoreW / 2f, scoreY, scorePaint)

    val centerTimerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = goldBright
      textSize = 16f * scale
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    }
    val centerTimerW = centerTimerPaint.measureText(timerLabel)
    canvas.drawText(timerLabel, centerX - centerTimerW / 2f, scoreBox.bottom - 6f * scale, centerTimerPaint)

    return bitmap
  }

  private fun renderCompact(
    teamHome: String,
    teamAway: String,
    scoreHome: Int,
    scoreAway: Int,
    timer: String,
    period: String,
    logoHome: Bitmap?,
    logoAway: Bitmap?,
    layout: ScoreboardLayout,
    streamWidth: Int,
  ): Bitmap {
    val width = (streamWidth * 0.48f).toInt().coerceIn(260, streamWidth)
    val height = (width * 0.15f).toInt().coerceAtLeast(48)
    val timerLabel = timer.ifBlank { "00:00" }
    val periodLabel = period.trim().ifBlank { "МАТЧ" }.uppercase()

    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    val home = trimTeam(teamHome, if (logoHome != null) 10 else 14)
    val away = trimTeam(teamAway, if (logoAway != null) 10 else 14)

    val bar = RectF(3f, 3f, width - 3f, height - 3f)
    paint.shader = LinearGradient(
      bar.left, bar.top, bar.left, bar.bottom,
      intArrayOf(navyDark, navyMid),
      floatArrayOf(0f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawRoundRect(bar, 6f, 6f, paint)
    paint.shader = null

    paint.color = gold
    canvas.drawRect(bar.left, bar.top, bar.right, bar.top + 2f, paint)

    val rowTop = bar.top + 5f
    val rowBottom = bar.bottom - 5f
    val centerX = bar.centerX()

    val homePill = RectF(bar.left + 6f, rowTop, centerX - 60f, rowBottom)
    drawTeamPill(canvas, homePill, home, Color.parseColor("#2563EB"), false, logoHome, 1f, LOGO_SIZE_COMPACT)

    val awayPill = RectF(centerX + 60f, rowTop, bar.right - 6f, rowBottom)
    drawTeamPill(canvas, awayPill, away, Color.parseColor("#DC2626"), true, logoAway, 1f, LOGO_SIZE_COMPACT)

    val scoreText = "$scoreHome : $scoreAway"
    val scorePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 24f
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
    val scoreW = scorePaint.measureText(scoreText)
    val scoreY = rowTop + (rowBottom - rowTop) * 0.42f
    canvas.drawText(scoreText, centerX - scoreW / 2f, scoreY, scorePaint)

    val timerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = goldBright
      textSize = 15f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    }
    val timerW = timerPaint.measureText(timerLabel)
    canvas.drawText(timerLabel, centerX - timerW / 2f, rowTop + (rowBottom - rowTop) * 0.82f, timerPaint)

    val periodPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(200, 255, 255, 255)
      textSize = 9f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      letterSpacing = 0.06f
    }
    val periodW = periodPaint.measureText(periodLabel)
    val periodX = when (layout) {
      ScoreboardLayout.LEFT -> bar.left + 6f
      ScoreboardLayout.RIGHT -> bar.right - periodW - 6f
      else -> centerX - periodW / 2f
    }
    canvas.drawText(periodLabel, periodX, bar.top + 12f, periodPaint)

    return bitmap
  }

  private fun drawTeamPill(
    canvas: Canvas,
    rect: RectF,
    teamName: String,
    accentColor: Int,
    alignEnd: Boolean,
    logo: Bitmap?,
    scale: Float,
    logoSize: Float = LOGO_SIZE,
  ) {
    val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(210, 15, 30, 58)
    }
    canvas.drawRoundRect(rect, 5f * scale, 5f * scale, bg)

    val accent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accentColor }
    if (alignEnd) {
      canvas.drawRoundRect(
        RectF(rect.right - 4f * scale, rect.top, rect.right, rect.bottom),
        2f * scale, 2f * scale, accent,
      )
    } else {
      canvas.drawRoundRect(
        RectF(rect.left, rect.top, rect.left + 4f * scale, rect.bottom),
        2f * scale, 2f * scale, accent,
      )
    }

    var textStartX = rect.left + 12f * scale
    var textEndX = rect.right - 12f * scale

    if (logo != null) {
      val logoLeft = if (alignEnd) {
        rect.right - LOGO_PAD * scale - logoSize
      } else {
        rect.left + LOGO_PAD * scale + 4f * scale
      }
      val logoTop = rect.centerY() - logoSize / 2f
      val logoRect = RectF(logoLeft, logoTop, logoLeft + logoSize, logoTop + logoSize)

      val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(200, 255, 255, 255)
        style = Paint.Style.STROKE
        strokeWidth = 1.5f * scale
      }
      canvas.drawBitmap(logo, null, logoRect, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
      canvas.drawOval(logoRect, ring)

      if (alignEnd) {
        textEndX = logoRect.left - 6f * scale
      } else {
        textStartX = logoRect.right + 6f * scale
      }
    }

    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = whiteSoft
      textSize = 20f * scale
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val maxW = textEndX - textStartX
    var size = textPaint.textSize
    while (textPaint.measureText(teamName) > maxW && size > 10f * scale) {
      size -= 1f * scale
      textPaint.textSize = size
    }
    val textW = textPaint.measureText(teamName)
    val x = if (alignEnd) textEndX - textW else textStartX
    canvas.drawText(teamName, x, rect.centerY() + 7f * scale, textPaint)
  }

  private fun trimTeam(name: String, maxLen: Int): String {
    val trimmed = name.trim().ifBlank { "—" }
    return if (trimmed.length <= maxLen) trimmed else trimmed.take(maxLen - 1) + "…"
  }
}
