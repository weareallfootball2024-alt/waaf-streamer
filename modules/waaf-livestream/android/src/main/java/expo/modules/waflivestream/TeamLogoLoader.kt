package expo.modules.waflivestream

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.net.Uri
import android.util.LruCache
import java.net.URL

object TeamLogoLoader {
  private const val LOGO_PX = 96
  private val cache = LruCache<String, Bitmap>(12)

  fun load(context: Context, rawUrl: String?, onResult: (Bitmap?) -> Unit) {
    val url = rawUrl?.trim().orEmpty()
    if (url.isEmpty()) {
      onResult(null)
      return
    }
    cache.get(url)?.let {
      onResult(it)
      return
    }
    Thread {
      val bitmap = try {
        decodeLogo(context, url)?.let { circleCrop(it, LOGO_PX) }
      } catch (_: Exception) {
        null
      }
      if (bitmap != null) {
        cache.put(url, bitmap)
      }
      onResult(bitmap)
    }.start()
  }

  private fun decodeLogo(context: Context, url: String): Bitmap? {
    val stream = when {
      url.startsWith("http://", ignoreCase = true) || url.startsWith("https://", ignoreCase = true) ->
        URL(url).openStream()
      url.startsWith("content://") || url.startsWith("file://") ->
        context.contentResolver.openInputStream(Uri.parse(url))
      else -> URL(url).openStream()
    } ?: return null
    stream.use { input ->
      return BitmapFactory.decodeStream(input)
    }
  }

  private fun circleCrop(source: Bitmap, size: Int): Bitmap {
    val scaled = Bitmap.createScaledBitmap(source, size, size, true)
    if (scaled != source && !source.isRecycled) {
      source.recycle()
    }
    val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    canvas.drawARGB(0, 0, 0, 0)
    canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
    paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
    canvas.drawBitmap(scaled, 0f, 0f, paint)
    if (!scaled.isRecycled) {
      scaled.recycle()
    }
    return output
  }
}
