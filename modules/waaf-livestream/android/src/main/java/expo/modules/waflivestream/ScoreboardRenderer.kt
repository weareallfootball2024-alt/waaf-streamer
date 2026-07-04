package expo.modules.waflivestream

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface

/**
 * Broadcast-style scoreboard inspired by UEFA / FIFA tournament graphics.
 */
object ScoreboardRenderer {
  private const val WIDTH = 1280
  private const val HEIGHT = 168
  private const val LOGO_SIZE = 52f
  private const val LOGO_PAD = 10f

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
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    val home = trimTeam(teamHome, if (logoHome != null) 14 else 18)
    val away = trimTeam(teamAway, if (logoAway != null) 14 else 18)
    val periodLabel = period.trim().ifBlank { "МАТЧ" }.uppercase()
    val scoreText = "$scoreHome  –  $scoreAway"

    paint.color = Color.argb(110, 0, 0, 0)
    canvas.drawRoundRect(RectF(12f, 14f, WIDTH - 8f, HEIGHT - 6f), 6f, 6f, paint)

    val bar = RectF(8f, 8f, WIDTH - 8f, HEIGHT - 10f)
    paint.shader = LinearGradient(
      bar.left, bar.top, bar.left, bar.bottom,
      intArrayOf(navyDark, navyMid, navyLight),
      floatArrayOf(0f, 0.55f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawRect(bar, paint)
    paint.shader = null

    paint.color = gold
    canvas.drawRect(bar.left, bar.top, bar.right, bar.top + 4f, paint)

    val headerBottom = bar.top + 44f
    paint.color = Color.argb(180, 0, 0, 0)
    canvas.drawRect(bar.left, bar.top + 4f, bar.right, headerBottom, paint)

    paint.color = liveRed
    canvas.drawCircle(bar.left + 28f, bar.top + 26f, 5f, paint)

    val livePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 14f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      letterSpacing = 0.15f
    }
    canvas.drawText("LIVE", bar.left + 40f, bar.top + 30f, livePaint)

    val periodPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = goldBright
      textSize = 16f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      letterSpacing = 0.08f
    }
    canvas.drawText(periodLabel, bar.left + 110f, bar.top + 31f, periodPaint)

    val timerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 22f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    }
    val timerW = timerPaint.measureText(timer)
    canvas.drawText(timer, bar.right - timerW - 20f, bar.top + 32f, timerPaint)

    paint.color = Color.argb(90, 212, 175, 55)
    canvas.drawRect(bar.left + 16f, headerBottom, bar.right - 16f, headerBottom + 1.5f, paint)

    val rowTop = headerBottom + 10f
    val rowBottom = bar.bottom - 12f
    val centerX = bar.centerX()

    val homePill = RectF(bar.left + 18f, rowTop, centerX - 118f, rowBottom)
    drawTeamPill(
      canvas, homePill, home,
      accentColor = Color.parseColor("#2563EB"),
      alignEnd = false,
      logo = logoHome,
    )

    val awayPill = RectF(centerX + 118f, rowTop, bar.right - 18f, rowBottom)
    drawTeamPill(
      canvas, awayPill, away,
      accentColor = Color.parseColor("#DC2626"),
      alignEnd = true,
      logo = logoAway,
    )

    val scoreBoxW = 200f
    val scoreBox = RectF(centerX - scoreBoxW / 2f, rowTop, centerX + scoreBoxW / 2f, rowBottom)
    paint.color = Color.argb(240, 8, 18, 40)
    canvas.drawRoundRect(scoreBox, 8f, 8f, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 2f
    paint.color = gold
    canvas.drawRoundRect(scoreBox, 8f, 8f, paint)
    paint.style = Paint.Style.FILL

    val scorePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 40f
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
    val scoreW = scorePaint.measureText(scoreText)
    val scoreY = scoreBox.centerY() + 14f
    canvas.drawText(scoreText, centerX - scoreW / 2f, scoreY, scorePaint)

    return bitmap
  }

  private fun drawTeamPill(
    canvas: Canvas,
    rect: RectF,
    teamName: String,
    accentColor: Int,
    alignEnd: Boolean,
    logo: Bitmap?,
  ) {
    val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(210, 15, 30, 58)
    }
    canvas.drawRoundRect(rect, 6f, 6f, bg)

    val accent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accentColor }
    if (alignEnd) {
      canvas.drawRoundRect(
        RectF(rect.right - 5f, rect.top, rect.right, rect.bottom),
        3f, 3f, accent,
      )
    } else {
      canvas.drawRoundRect(
        RectF(rect.left, rect.top, rect.left + 5f, rect.bottom),
        3f, 3f, accent,
      )
    }

    var textStartX = rect.left + 16f
    var textEndX = rect.right - 16f

    if (logo != null) {
      val logoLeft = if (alignEnd) {
        rect.right - LOGO_PAD - LOGO_SIZE
      } else {
        rect.left + LOGO_PAD + 6f
      }
      val logoTop = rect.centerY() - LOGO_SIZE / 2f
      val logoRect = RectF(logoLeft, logoTop, logoLeft + LOGO_SIZE, logoTop + LOGO_SIZE)

      val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(200, 255, 255, 255)
        style = Paint.Style.STROKE
        strokeWidth = 2f
      }
      canvas.drawBitmap(logo, null, logoRect, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
      canvas.drawOval(logoRect, ring)

      if (alignEnd) {
        textEndX = logoRect.left - 8f
      } else {
        textStartX = logoRect.right + 8f
      }
    }

    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = whiteSoft
      textSize = 24f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val maxW = if (alignEnd) textEndX - textStartX else textEndX - textStartX
    var size = textPaint.textSize
    while (textPaint.measureText(teamName) > maxW && size > 12f) {
      size -= 1f
      textPaint.textSize = size
    }
    val textW = textPaint.measureText(teamName)
    val x = if (alignEnd) textEndX - textW else textStartX
    canvas.drawText(teamName, x, rect.centerY() + 9f, textPaint)
  }

  private fun trimTeam(name: String, maxLen: Int): String {
    val trimmed = name.trim().ifBlank { "—" }
    return if (trimmed.length <= maxLen) trimmed else trimmed.take(maxLen - 1) + "…"
  }
}
