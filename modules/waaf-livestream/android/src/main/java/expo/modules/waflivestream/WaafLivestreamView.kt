package expo.modules.waflivestream

import android.content.Context
import android.os.Build
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.widget.FrameLayout
import androidx.annotation.RequiresApi
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.gl.render.filters.`object`.ImageObjectFilterRender
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.audio.NoAudioSource
import com.pedro.encoder.input.sources.video.Camera2Source
import com.pedro.encoder.utils.gl.TranslateTo
import com.pedro.library.generic.GenericStream
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
class WaafLivestreamView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  val onConnectionSuccess by EventDispatcher()
  val onConnectionFailed by EventDispatcher()
  val onDisconnect by EventDispatcher()

  private val surfaceView = SurfaceView(context)
  private var scoreboardFilter: ImageObjectFilterRender? = null
  private var isPrepared = false
  private var isMuted = false
  private var scoreboardReady = false

  private var teamHome = "Хозяева"
  private var teamAway = "Гости"
  private var scoreHome = 0
  private var scoreAway = 0
  private var timerText = "00:00"
  private var periodText = ""

  private val connectChecker = object : ConnectChecker {
    override fun onConnectionStarted(url: String) {}

    override fun onConnectionSuccess() {
      post { onConnectionSuccess(mapOf()) }
    }

    override fun onConnectionFailed(reason: String) {
      post {
        genericStream.stopStream()
        onConnectionFailed(mapOf("code" to reason))
      }
    }

    override fun onNewBitrate(bitrate: Long) {}

    override fun onDisconnect() {
      post { onDisconnect(mapOf()) }
    }

    override fun onAuthError() {
      post {
        genericStream.stopStream()
        onConnectionFailed(mapOf("code" to "auth_error"))
      }
    }

    override fun onAuthSuccess() {}
  }

  private val genericStream: GenericStream = GenericStream(
    context,
    connectChecker,
    Camera2Source(context),
    MicrophoneSource(),
  ).apply {
    getGlInterface().autoHandleOrientation = true
    getStreamClient().setReTries(5)
  }

  init {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    addView(
      surfaceView,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )

    surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
      override fun surfaceCreated(holder: SurfaceHolder) {
        if (!scoreboardReady) {
          setupScoreboardFilter()
          scoreboardReady = true
        }
        if (!genericStream.isOnPreview) {
          genericStream.startPreview(surfaceView)
        }
      }

      override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        genericStream.getGlInterface().setPreviewResolution(width, height)
      }

      override fun surfaceDestroyed(holder: SurfaceHolder) {
        if (genericStream.isOnPreview) {
          genericStream.stopPreview()
        }
      }
    })

    prepareEncoder()
  }

  private fun prepareEncoder() {
    isPrepared = try {
      genericStream.prepareVideo(1280, 720, 2_000_000, 30, 2, 0)
        && genericStream.prepareAudio(44100, true, 128_000)
    } catch (_: IllegalArgumentException) {
      false
    }
  }

  private fun setupScoreboardFilter() {
    val filter = ImageObjectFilterRender()
    scoreboardFilter = filter
    filter.setImage(
      ScoreboardRenderer.render(teamHome, teamAway, scoreHome, scoreAway, timerText, periodText),
    )
    filter.setPosition(TranslateTo.TOP)
    filter.setScale(100f, 12f)
    genericStream.getGlInterface().setFilter(filter)
  }

  private fun refreshScoreboardBitmap() {
    val filter = scoreboardFilter ?: return
    filter.setImage(
      ScoreboardRenderer.render(teamHome, teamAway, scoreHome, scoreAway, timerText, periodText),
    )
  }

  fun setCameraFacing(camera: String) {
    if (camera == "front") {
      (genericStream.videoSource as? Camera2Source)?.switchCamera()
    }
  }

  fun startStreaming(rtmpUrl: String, streamKey: String) {
    if (!isPrepared) {
      prepareEncoder()
      if (!isPrepared) {
        onConnectionFailed(mapOf("code" to "encoder_prepare_failed"))
        return
      }
    }
    if (!genericStream.isOnPreview) {
      genericStream.startPreview(surfaceView)
    }
    val endpoint = buildRtmpEndpoint(rtmpUrl, streamKey)
    genericStream.startStream(endpoint)
  }

  fun stopStreaming() {
    if (genericStream.isStreaming) {
      genericStream.stopStream()
    }
  }

  fun setMuted(muted: Boolean) {
    isMuted = muted
    try {
      if (muted) {
        genericStream.changeAudioSource(NoAudioSource())
      } else {
        genericStream.changeAudioSource(MicrophoneSource())
      }
    } catch (_: Exception) {
    }
  }

  fun updateScoreboard(payload: Map<String, Any?>) {
    payload["teamHome"]?.toString()?.let { teamHome = it }
    payload["teamAway"]?.toString()?.let { teamAway = it }
    payload["scoreHome"]?.let { scoreHome = (it as? Number)?.toInt() ?: scoreHome }
    payload["scoreAway"]?.let { scoreAway = (it as? Number)?.toInt() ?: scoreAway }
    payload["timer"]?.toString()?.let { timerText = it }
    payload["period"]?.toString()?.let { periodText = it }
    post { refreshScoreboardBitmap() }
  }

  override fun onDetachedFromWindow() {
    if (genericStream.isStreaming) {
      genericStream.stopStream()
    }
    if (genericStream.isOnPreview) {
      genericStream.stopPreview()
    }
    genericStream.release()
    super.onDetachedFromWindow()
  }

  companion object {
    fun buildRtmpEndpoint(rtmpUrl: String, streamKey: String): String {
      val base = rtmpUrl.trim().trimEnd('/')
      val key = streamKey.trim()
      if (base.isEmpty() || key.isEmpty()) return base
      if (base.endsWith(key)) return base
      return "$base/$key"
    }
  }
}
