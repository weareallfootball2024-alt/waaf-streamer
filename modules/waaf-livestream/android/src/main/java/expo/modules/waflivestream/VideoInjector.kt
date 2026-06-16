package expo.modules.waflivestream

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.util.Log
import com.pedro.encoder.input.sources.audio.AudioFileSource
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.audio.SilenceAudioSource
import com.pedro.encoder.input.sources.video.Camera2Source
import com.pedro.encoder.input.sources.video.VideoFileSource
import com.pedro.library.generic.GenericStream
import java.io.File

/**
 * Switches live RTMP from camera to a video file and back.
 */
class VideoInjector(
  private val context: Context,
  private val genericStream: GenericStream,
  private val microphoneSource: MicrophoneSource,
  private val mainHandler: Handler,
  private val callbacks: Callbacks,
) {
  interface Callbacks {
    fun onInsertStarted(kind: String, loop: Boolean)
    fun onInsertEnded(kind: String)
    fun onInsertError(code: String)
    fun hideGlFilters()
    fun scheduleScoreboardRestore()
    fun isMicMuted(): Boolean
    fun setMicMuted(muted: Boolean)
    fun createCameraSource(): Camera2Source
  }

  var isActive: Boolean = false
    private set

  private var insertKind = "ad"
  private var insertLoop = false
  private var micMutedBeforeInsert = false
  private var currentVideoSource: VideoFileSource? = null

  fun play(filePath: String, loop: Boolean, kind: String = "ad") {
    if (!genericStream.isStreaming) {
      callbacks.onInsertError("not_streaming")
      return
    }
    if (isActive) {
      callbacks.onInsertError("insert_active")
      return
    }

    mainHandler.post {
      try {
        val uri = toUri(filePath)
        insertKind = kind
        insertLoop = loop
        micMutedBeforeInsert = callbacks.isMicMuted()
        callbacks.hideGlFilters()
        callbacks.setMicMuted(true)

        val onFinish: (Boolean) -> Unit = { isLoopCallback ->
          if (!insertLoop && !isLoopCallback) {
            mainHandler.post { restore() }
          }
        }

        val videoSource = VideoFileSource(context, uri, loop, onFinish)
        currentVideoSource = videoSource

        try {
          val audioSource = AudioFileSource(context, uri, loop, onFinish)
          genericStream.changeAudioSource(audioSource)
        } catch (e: Exception) {
          Log.w(TAG, "Video file has no matching audio track, using silence", e)
          genericStream.changeAudioSource(SilenceAudioSource())
        }

        genericStream.changeVideoSource(videoSource)
        isActive = true
        Log.i(TAG, "video insert started kind=$kind loop=$loop path=${uri.lastPathSegment}")
        callbacks.onInsertStarted(kind, loop)
      } catch (e: Exception) {
        Log.e(TAG, "playVideoInsert failed", e)
        callbacks.onInsertError(e.message ?: "insert_failed")
      }
    }
  }

  fun stop() {
    mainHandler.post { restore() }
  }

  fun restore() {
    if (!isActive) return
    isActive = false
    currentVideoSource = null
    val kind = insertKind
    try {
      val camera = callbacks.createCameraSource()
      genericStream.changeVideoSource(camera)
      genericStream.changeAudioSource(microphoneSource)
      callbacks.setMicMuted(micMutedBeforeInsert)
      callbacks.scheduleScoreboardRestore()
      Log.i(TAG, "video insert ended, camera restored")
      callbacks.onInsertEnded(kind)
    } catch (e: Exception) {
      Log.e(TAG, "restoreLiveAfterInsert failed", e)
      callbacks.onInsertError(e.message ?: "restore_failed")
    }
  }

  companion object {
    private const val TAG = "VideoInjector"

    fun toUri(path: String): Uri {
      val trimmed = path.trim()
      return when {
        trimmed.contains("://") -> Uri.parse(trimmed)
        else -> Uri.fromFile(File(trimmed))
      }
    }
  }
}
