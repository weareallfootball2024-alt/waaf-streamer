package expo.modules.waflivestream

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import kotlin.math.min

object ScoreboardRenderer {
  private const val WIDTH = 1280
  private const val HEIGHT = 96

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

    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(200, 0, 0, 0)
      style = Paint.Style.FILL
    }
    canvas.drawRoundRect(RectF(0f, 0f, WIDTH.toFloat(), HEIGHT.toFloat()), 12f, 12f, bgPaint)

    val home = trimTeam(teamHome, 18)
    val away = trimTeam(teamAway, 18)
    val score = "$scoreHome  :  $scoreAway"
    val meta = if (period.isNotBlank()) "$period   $timer" else timer

    val teamPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 30f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val scorePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 44f
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
    val metaPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#E31E24")
      textSize = 22f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    val centerY = HEIGHT / 2f + 12f
    val homeW = teamPaint.measureText(home)
    val awayW = teamPaint.measureText(away)
    val scoreW = scorePaint.measureText(score)
    val gap = 28f
    val totalW = homeW + gap + scoreW + gap + awayW
    var x = (WIDTH - totalW) / 2f

    canvas.drawText(home, x, centerY, teamPaint)
    x += homeW + gap
    canvas.drawText(score, x, centerY + 4f, scorePaint)
    x += scoreW + gap
    canvas.drawText(away, x, centerY, teamPaint)

    val metaW = metaPaint.measureText(meta)
    canvas.drawText(meta, (WIDTH - metaW) / 2f, HEIGHT - 14f, metaPaint)

    return bitmap
  }

  private fun trimTeam(name: String, maxLen: Int): String {
    val trimmed = name.trim().ifBlank { "—" }
    return if (trimmed.length <= maxLen) trimmed else trimmed.take(maxLen - 1) + "…"
  }
}
