package expo.modules.waflivestream

import android.media.MediaCodec
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import com.pedro.rtsp.utils.RtpConstants
import java.io.File

internal object ReplayExporter {
  private const val TAG = "ReplayExporter"

  fun exportLastSeconds(
    snapshot: ReplayRingBuffer.Snapshot,
    seconds: Int,
    outputPath: String,
  ): Boolean {
    val videoFormat = snapshot.videoFormat ?: return false
    val video = snapshot.videoFrames
    if (video.isEmpty()) return false

    val durationUs = seconds.coerceIn(1, 15) * 1_000_000L
    val endPts = video.last().presentationTimeUs
    val startTarget = endPts - durationUs

    var startIdx = video.indexOfLast {
      it.presentationTimeUs <= startTarget && isKeyFrame(it)
    }
    if (startIdx < 0) {
      startIdx = video.indexOfFirst { isKeyFrame(it) }
    }
    if (startIdx < 0) return false

    val clipVideo = video.subList(startIdx, video.size)
    val firstPts = clipVideo.first().presentationTimeUs
    val clipAudio = snapshot.audioFrames.filter {
      it.presentationTimeUs in firstPts..endPts
    }

    val parent = File(outputPath).parentFile
    if (parent != null && !parent.exists()) parent.mkdirs()
    File(outputPath).delete()

    var muxer: MediaMuxer? = null
    return try {
      muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val videoTrack = muxer.addTrack(videoFormat)
      val audioTrack = snapshot.audioFormat?.let { muxer.addTrack(it) } ?: -1
      muxer.start()

      for (frame in clipVideo) {
        writeFrame(muxer, videoTrack, frame, firstPts)
      }
      if (audioTrack >= 0) {
        for (frame in clipAudio) {
          writeFrame(muxer, audioTrack, frame, firstPts)
        }
      }

      Log.i(TAG, "exported ${clipVideo.size} video + ${clipAudio.size} audio frames → $outputPath")
      true
    } catch (e: Exception) {
      Log.e(TAG, "export failed", e)
      File(outputPath).delete()
      false
    } finally {
      try {
        muxer?.stop()
      } catch (_: Exception) {
      }
      try {
        muxer?.release()
      } catch (_: Exception) {
      }
    }
  }

  private fun writeFrame(
    muxer: MediaMuxer,
    track: Int,
    frame: EncodedFrame,
    basePts: Long,
  ) {
    val info = MediaCodec.BufferInfo().apply {
      set(0, frame.data.size, frame.presentationTimeUs - basePts, frame.flags)
    }
    muxer.writeSampleData(track, java.nio.ByteBuffer.wrap(frame.data), info)
  }

  private fun isKeyFrame(frame: EncodedFrame): Boolean {
    if (frame.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0) return true
    if (frame.data.size < 5) return false
    val nalType = frame.data[4].toInt() and 0x1F
    return nalType == RtpConstants.IDR
  }
}
