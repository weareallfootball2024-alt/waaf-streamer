package expo.modules.waflivestream

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface

object EventOverlayRenderer {
  private const val WIDTH = 1280
  private const val HEIGHT = 108

  fun render(
    eventType: String,
    playerName: String,
    playerNumber: String,
    assistantName: String?,
    assistantNumber: String?,
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val label = when (eventType) {
      "goal" -> "⚽  ГОЛ"
      "penalty" -> "⚽  ПЕНАЛЬТИ"
      "own_goal" -> "⚽  АВТОГОЛ"
      "yellow_card" -> "🟨  ЖЁЛТАЯ КАРТОЧКА"
      "red_card", "second_yellow_card" -> "🟥  КРАСНАЯ КАРТОЧКА"
      else -> eventType.uppercase()
    }

    val card = RectF(220f, 8f, WIDTH - 220f, HEIGHT - 8f)
    val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(230, 12, 14, 18)
      style = Paint.Style.FILL
    }
    canvas.drawRoundRect(card, 16f, 16f, bg)

    val accent = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#E31E24")
      style = Paint.Style.FILL
    }
    canvas.drawRoundRect(RectF(card.left, card.top, card.left + 6f, card.bottom), 4f, 4f, accent)

    val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#E31E24")
      textSize = 22f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val numPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 34f
      typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
    val namePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = 28f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.argb(200, 255, 255, 255)
      textSize = 20f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.ITALIC)
    }

    canvas.drawText(label, card.left + 18f, card.top + 30f, labelPaint)

    val number = playerNumber.trim().ifBlank { "—" }
    val name = playerName.trim().ifBlank { "Игрок" }
    val numText = if (number == "—") "" else "#$number"
    val numW = if (numText.isEmpty()) 0f else numPaint.measureText(numText)
    val lineY = card.top + 72f
    if (numText.isNotEmpty()) {
      canvas.drawText(numText, card.left + 20f, lineY, numPaint)
    }
    canvas.drawText(trim(name, 28), card.left + 20f + numW + if (numW > 0) 12f else 0f, lineY, namePaint)

    val assistName = assistantName?.trim().orEmpty()
    if (assistName.isNotEmpty()) {
      val assistNum = assistantNumber?.trim().orEmpty()
      val assistLine = buildString {
        append("Ассист: ")
        if (assistNum.isNotEmpty()) append("#$assistNum ")
        append(trim(assistName, 22))
      }
      canvas.drawText(assistLine, card.left + 20f, card.bottom - 16f, subPaint)
    }

    return bitmap
  }

  private fun trim(text: String, max: Int): String {
    return if (text.length <= max) text else text.take(max - 1) + "…"
  }
}
