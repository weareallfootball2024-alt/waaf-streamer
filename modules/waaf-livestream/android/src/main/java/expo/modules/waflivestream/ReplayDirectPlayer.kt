package expo.modules.waflivestream

import android.media.MediaCodec
import android.os.Handler
import android.util.Log
import com.pedro.library.generic.GenericStream
import java.nio.ByteBuffer
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Plays buffered encoded frames directly into the RTMP stream (no MP4 decode/re-encode).
 */
internal class ReplayDirectPlayer(
  private val stream: GenericStream,
  private val ringBuffer: ReplayRingBuffer,
  private val mainHandler: Handler,
  private val callbacks: Callbacks,
) {
  interface Callbacks {
    fun onInsertStarted()
    fun onInsertEnded()
    fun onInsertError(code: String)
    fun isMicMuted(): Boolean
    fun setMicMuted(muted: Boolean)
    fun scheduleScoreboardRestore()
  }

  private val executor = Executors.newSingleThreadExecutor()
  private val active = AtomicBoolean(false)

  val isActive: Boolean
    get() = active.get()

  fun play(snapshot: ReplayRingBuffer.Snapshot, seconds: Int) {
    if (!stream.isStreaming) {
      mainHandler.post { callbacks.onInsertError("not_streaming") }
      return
    }
    if (!active.compareAndSet(false, true)) {
      mainHandler.post { callbacks.onInsertError("insert_active") }
      return
    }

    executor.execute {
      try {
        val clip = ReplayClipBuilder.build(snapshot, seconds)
        if (clip == null || clip.videoFrames.isEmpty()) {
          active.set(false)
          mainHandler.post { callbacks.onInsertError("replay_buffer_empty") }
          return@execute
        }

        var wasRunning = false
        var micMutedBefore = false
        val ready = CountDownLatch(1)
        mainHandler.post {
          micMutedBefore = callbacks.isMicMuted()
          callbacks.setMicMuted(true)
          wasRunning = EncodedStreamInject.pauseLiveCapture(stream)
          callbacks.onInsertStarted()
          ready.countDown()
        }
        ready.await(500, TimeUnit.MILLISECONDS)
        Thread.sleep(50)

        playClip(clip)

        mainHandler.post {
          EncodedStreamInject.resumeLiveCapture(stream, wasRunning)
          callbacks.setMicMuted(micMutedBefore)
          callbacks.scheduleScoreboardRestore()
          callbacks.onInsertEnded()
          active.set(false)
        }
      } catch (e: Exception) {
        Log.e(TAG, "replay direct play failed", e)
        active.set(false)
        mainHandler.post {
          callbacks.onInsertError(e.message ?: "replay_failed")
        }
      }
    }
  }

  fun cancel() {
    active.set(false)
  }

  private fun playClip(clip: ReplayClipBuilder.Clip) {
    val videoFrames = clip.videoFrames
    val firstSrcPts = videoFrames.first().presentationTimeUs
    var outputVideoPts = ringBuffer.lastVideoPtsUs.coerceAtLeast(firstSrcPts)
    var audioIdx = 0
    val audioFrames = clip.audioFrames

    for (i in videoFrames.indices) {
      if (!active.get()) break

      val frame = videoFrames[i]
      val srcPts = frame.presentationTimeUs
      val nextSrcPts = videoFrames.getOrNull(i + 1)?.presentationTimeUs
        ?: (srcPts + 33_333L)
      val frameDurationUs = (nextSrcPts - srcPts).coerceIn(16_000L, 100_000L)

      outputVideoPts += frameDurationUs

      val videoInfo = MediaCodec.BufferInfo().apply {
        set(0, frame.data.size, outputVideoPts, frame.flags)
      }
      EncodedStreamInject.sendVideo(stream, ByteBuffer.wrap(frame.data), videoInfo)

      while (audioIdx < audioFrames.size) {
        val audio = audioFrames[audioIdx]
        if (audio.presentationTimeUs > srcPts + frameDurationUs) break
        val audioInfo = MediaCodec.BufferInfo().apply {
          set(0, audio.data.size, outputVideoPts, audio.flags)
        }
        EncodedStreamInject.sendAudio(stream, ByteBuffer.wrap(audio.data), audioInfo)
        audioIdx++
      }

      ringBuffer.lastVideoPtsUs = outputVideoPts
      Thread.sleep((frameDurationUs / 1000L).coerceAtLeast(1L))
    }

    Log.i(TAG, "replay injected ${videoFrames.size} video + $audioIdx audio frames")
  }

  companion object {
    private const val TAG = "ReplayDirectPlayer"
  }
}
