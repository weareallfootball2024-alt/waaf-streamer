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
    fun beginReplayAudioIsolation()
    fun endReplayAudioIsolation()
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
      var wasRunning = false
      var micMutedBefore = false
      var audioIsolated = false
      var notifyEnd = false
      try {
        val clip = ReplayClipBuilder.build(snapshot, seconds)
        if (clip == null || clip.videoFrames.isEmpty()) {
          mainHandler.post { callbacks.onInsertError("replay_buffer_empty") }
          return@execute
        }

        val ready = CountDownLatch(1)
        mainHandler.post {
          micMutedBefore = callbacks.isMicMuted()
          callbacks.setMicMuted(true)
          callbacks.beginReplayAudioIsolation()
          audioIsolated = true
          wasRunning = EncodedStreamInject.pauseLiveCapture(stream)
          callbacks.onInsertStarted()
          ready.countDown()
        }
        ready.await(500, TimeUnit.MILLISECONDS)
        Thread.sleep(50)

        playClip(clip)
        notifyEnd = true
      } catch (e: Exception) {
        Log.e(TAG, "replay direct play failed", e)
        mainHandler.post {
          callbacks.onInsertError(e.message ?: "replay_failed")
        }
      } finally {
        val cleanup = CountDownLatch(1)
        mainHandler.post {
          try {
            EncodedStreamInject.resumeLiveCapture(stream, wasRunning)
            if (audioIsolated) {
              callbacks.endReplayAudioIsolation()
              callbacks.setMicMuted(micMutedBefore)
            }
            callbacks.scheduleScoreboardRestore()
            if (notifyEnd) {
              callbacks.onInsertEnded()
            }
          } finally {
            active.set(false)
            cleanup.countDown()
          }
        }
        cleanup.await(500, TimeUnit.MILLISECONDS)
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
    val audioAnchorPts = ringBuffer.lastAudioPtsUs.coerceAtLeast(outputVideoPts)
    var audioIdx = 0
    val audioFrames = clip.audioFrames
    val clipStartNanos = System.nanoTime()
    var timelineUs = 0L

    for (i in videoFrames.indices) {
      if (!active.get()) break

      val frame = videoFrames[i]
      val srcPts = frame.presentationTimeUs
      val nextSrcPts = videoFrames.getOrNull(i + 1)?.presentationTimeUs
        ?: (srcPts + 33_333L)
      val frameDurationUs = (nextSrcPts - srcPts).coerceIn(16_000L, 100_000L)

      outputVideoPts += frameDurationUs
      timelineUs += frameDurationUs

      val videoInfo = MediaCodec.BufferInfo().apply {
        set(0, frame.data.size, outputVideoPts, frame.flags)
      }
      EncodedStreamInject.sendVideo(stream, ByteBuffer.wrap(frame.data), videoInfo)

      while (audioIdx < audioFrames.size) {
        val audio = audioFrames[audioIdx]
        if (audio.presentationTimeUs > srcPts + frameDurationUs) break
        val outputAudioPts = audioAnchorPts + (audio.presentationTimeUs - firstSrcPts)
        val audioInfo = MediaCodec.BufferInfo().apply {
          set(0, audio.data.size, outputAudioPts, audio.flags)
        }
        EncodedStreamInject.sendAudio(stream, ByteBuffer.wrap(audio.data), audioInfo)
        ringBuffer.lastAudioPtsUs = outputAudioPts
        audioIdx++
      }

      ringBuffer.lastVideoPtsUs = outputVideoPts

      val targetNanos = clipStartNanos + timelineUs * 1000
      val waitMs = (targetNanos - System.nanoTime()) / 1_000_000
      if (waitMs > 0) Thread.sleep(waitMs)
    }

    Log.i(TAG, "replay injected ${videoFrames.size} video + $audioIdx audio frames")
  }

  companion object {
    private const val TAG = "ReplayDirectPlayer"
  }
}
