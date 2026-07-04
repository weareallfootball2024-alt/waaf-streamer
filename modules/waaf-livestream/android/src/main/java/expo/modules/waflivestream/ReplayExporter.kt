package expo.modules.waflivestream

import android.media.MediaCodec
import android.media.MediaMuxer
import android.util.Log
import java.io.File

internal object ReplayExporter {
  private const val TAG = "ReplayExporter"

  fun exportLastSeconds(
    snapshot: ReplayRingBuffer.Snapshot,
    seconds: Int,
    outputPath: String,
  ): Boolean {
    val clip = ReplayClipBuilder.build(snapshot, seconds) ?: return false
    val videoFormat = snapshot.videoFormat ?: return false
    val clipVideo = clip.videoFrames
    if (clipVideo.isEmpty()) return false

    val firstPts = clipVideo.first().presentationTimeUs
    val clipAudio = clip.audioFrames

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
}
