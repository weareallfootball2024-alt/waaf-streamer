package expo.modules.waflivestream

import android.media.MediaCodec
import android.media.MediaFormat
import java.nio.ByteBuffer

internal data class EncodedFrame(
  val data: ByteArray,
  val presentationTimeUs: Long,
  val flags: Int,
)

/**
 * Rolling buffer of encoded H.264/AAC frames from the live encoder.
 */
internal class ReplayRingBuffer(
  private val maxDurationUs: Long = 15_000_000L,
) {
  private val videoFrames = ArrayDeque<EncodedFrame>()
  private val audioFrames = ArrayDeque<EncodedFrame>()

  @Volatile
  var videoFormat: MediaFormat? = null
    private set

  @Volatile
  var audioFormat: MediaFormat? = null
    private set

  @Synchronized
  fun setVideoFormat(format: MediaFormat) {
    videoFormat = MediaFormat(format)
  }

  @Synchronized
  fun setAudioFormat(format: MediaFormat) {
    audioFormat = MediaFormat(format)
  }

  @Synchronized
  fun addVideo(buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
    if (info.size <= 0) return
    videoFrames.addLast(copyFrame(buffer, info))
    trim(videoFrames)
  }

  @Synchronized
  fun addAudio(buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
    if (info.size <= 0) return
    audioFrames.addLast(copyFrame(buffer, info))
    trim(audioFrames)
  }

  @Synchronized
  fun snapshot(): Snapshot {
    return Snapshot(
      videoFormat = videoFormat?.let { MediaFormat(it) },
      audioFormat = audioFormat?.let { MediaFormat(it) },
      videoFrames = videoFrames.toList(),
      audioFrames = audioFrames.toList(),
    )
  }

  @Synchronized
  fun clear() {
    videoFrames.clear()
    audioFrames.clear()
    videoFormat = null
    audioFormat = null
  }

  private fun trim(frames: ArrayDeque<EncodedFrame>) {
    if (frames.isEmpty()) return
    val latest = frames.last().presentationTimeUs
    val minPts = latest - maxDurationUs
    while (frames.size > 1 && frames.first().presentationTimeUs < minPts) {
      frames.removeFirst()
    }
  }

  private fun copyFrame(buffer: ByteBuffer, info: MediaCodec.BufferInfo): EncodedFrame {
    val bytes = ByteArray(info.size)
    buffer.duplicate().apply {
      position(info.offset)
      limit(info.offset + info.size)
    }.get(bytes)
    return EncodedFrame(bytes, info.presentationTimeUs, info.flags)
  }

  data class Snapshot(
    val videoFormat: MediaFormat?,
    val audioFormat: MediaFormat?,
    val videoFrames: List<EncodedFrame>,
    val audioFrames: List<EncodedFrame>,
  )
}
