package expo.modules.waflivestream

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.widget.FrameLayout
import androidx.annotation.RequiresApi
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.gl.render.filters.`object`.ImageObjectFilterRender
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.audio.SilenceAudioSource
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
  private var streamConnected = false

  private var teamHome = "Хозяева"
  private var teamAway = "Гости"
  private var scoreHome = 0
  private var scoreAway = 0
  private var timerText = "00:00"
  private var periodText = ""
  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingEndpoint: String? = null
  private val publishRunnable = Runnable { publishStream() }
  private val scoreboardRunnable = Runnable { ensureScoreboardFilter() }
  private val deferredFilterRunnable = Runnable {
    if (!scoreboardReady) {
      ensureScoreboardFilter()
    }
  }

  private val connectChecker = object : ConnectChecker {
    override fun onConnectionStarted(url: String) {
      Log.i(TAG, "RTMP connecting: ${maskEndpoint(url)}")
    }

    override fun onConnectionSuccess() {
      Log.i(TAG, "RTMP connected, sending frames")
      streamConnected = true
      mainHandler.postDelayed(deferredFilterRunnable, 400)
      post { onConnectionSuccess(mapOf()) }
    }

    override fun onConnectionFailed(reason: String) {
      Log.e(TAG, "RTMP failed: $reason")
      streamConnected = false
      post {
        if (genericStream.isStreaming) genericStream.stopStream()
        onConnectionFailed(mapOf("code" to reason))
      }
    }

    override fun onNewBitrate(bitrate: Long) {
      val client = genericStream.getStreamClient()
      Log.d(
        TAG,
        "bitrate=$bitrate video=${client.getSentVideoFrames()} audio=${client.getSentAudioFrames()}",
      )
    }

    override fun onDisconnect() {
      Log.w(TAG, "RTMP disconnected")
      streamConnected = false
      post { onDisconnect(mapOf("code" to "disconnected")) }
    }

    override fun onAuthError() {
      Log.e(TAG, "RTMP auth error")
      streamConnected = false
      post {
        if (genericStream.isStreaming) genericStream.stopStream()
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
    getStreamClient().apply {
      setReTries(3)
      setDelay(500)
      forceIncrementalTs(true)
      setWriteChunkSize(4096)
    }
  }

  init {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    addView(
      surfaceView,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )

    surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
      override fun surfaceCreated(holder: SurfaceHolder) {
        if (!genericStream.isOnPreview) {
          if (!isPrepared) prepareEncoder()
          genericStream.startPreview(surfaceView)
        }
      }

      override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        genericStream.getGlInterface().setPreviewResolution(width, height)
      }

      override fun surfaceDestroyed(holder: SurfaceHolder) {
        mainHandler.removeCallbacks(publishRunnable)
        mainHandler.removeCallbacks(scoreboardRunnable)
        mainHandler.removeCallbacks(deferredFilterRunnable)
        if (genericStream.isOnPreview) {
          genericStream.stopPreview()
        }
      }
    })
  }

  private fun prepareEncoder() {
    isPrepared = try {
      genericStream.prepareVideo(1280, 720, 1_500_000, 30, 1, 0)
        && genericStream.prepareAudio(44_100, true, 128_000)
    } catch (e: IllegalArgumentException) {
      Log.e(TAG, "prepareEncoder failed", e)
      false
    }
    if (isPrepared) {
      Log.i(TAG, "encoder prepared 1280x720 @ 1.5Mbps GOP=1s")
    }
  }

  private fun applyAudioSource(muted: Boolean) {
    try {
      val source = if (muted) SilenceAudioSource() else MicrophoneSource()
      genericStream.changeAudioSource(source)
      Log.i(TAG, "audio source: ${if (muted) "silence" else "microphone"}")
    } catch (e: Exception) {
      Log.e(TAG, "applyAudioSource failed", e)
    }
  }

  private fun ensureScoreboardFilter() {
    if (scoreboardReady) return
    setupScoreboardFilter()
    scoreboardReady = true
  }

  private fun setupScoreboardFilter() {
    val filter = ImageObjectFilterRender()
    scoreboardFilter = filter
    genericStream.getGlInterface().setFilter(filter)
    filter.setImage(
      ScoreboardRenderer.render(teamHome, teamAway, scoreHome, scoreAway, timerText, periodText),
    )
    filter.setScale(100f, 12f)
    filter.setPosition(TranslateTo.TOP)
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

  fun startStreaming(rtmpUrl: String, streamKey: String, muted: Boolean) {
    isMuted = muted
    streamConnected = false
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)

    if (!isPrepared) {
      prepareEncoder()
      if (!isPrepared) {
        onConnectionFailed(mapOf("code" to "encoder_prepare_failed"))
        return
      }
    }

    applyAudioSource(muted)

    val endpoint = buildRtmpEndpoint(rtmpUrl, streamKey)
    if (endpoint.isBlank()) {
      onConnectionFailed(mapOf("code" to "empty_rtmp_endpoint"))
      return
    }
    if (!endpoint.startsWith("rtmp", ignoreCase = true)) {
      onConnectionFailed(mapOf("code" to "invalid_rtmp_scheme"))
      return
    }

    pendingEndpoint = endpoint
    Log.i(TAG, "Start stream → ${maskEndpoint(endpoint)} muted=$muted")

    val delayMs = if (genericStream.isOnPreview) 800L else 1500L
    if (!genericStream.isOnPreview) {
      genericStream.startPreview(surfaceView)
    }
    mainHandler.postDelayed(publishRunnable, delayMs)
  }

  private fun publishStream() {
    val url = pendingEndpoint ?: return
    if (genericStream.isStreaming) return
    if (!genericStream.isOnPreview) {
      Log.w(TAG, "preview not ready, retry publish")
      mainHandler.postDelayed(publishRunnable, 500)
      return
    }
    if (!scoreboardReady && !streamConnected) {
      ensureScoreboardFilter()
    }
    try {
      Log.i(TAG, "publishStream now")
      genericStream.startStream(url)
    } catch (e: Exception) {
      Log.e(TAG, "startStream exception", e)
      onConnectionFailed(mapOf("code" to (e.message ?: "start_exception")))
    }
  }

  fun stopStreaming() {
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)
    pendingEndpoint = null
    streamConnected = false
    if (genericStream.isStreaming) {
      genericStream.stopStream()
    }
  }

  fun setMuted(muted: Boolean) {
    isMuted = muted
    if (genericStream.isStreaming) {
      Log.w(TAG, "setMuted ignored while streaming")
      return
    }
    applyAudioSource(muted)
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
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(scoreboardRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)
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
    private const val TAG = "WaafLivestream"

    fun buildRtmpEndpoint(rtmpUrl: String, streamKey: String): String {
      var base = rtmpUrl.trim().trimEnd('/')
      val key = streamKey.trim()
      if (base.isEmpty()) return ""
      if (key.isNotEmpty() && base.endsWith(key)) {
        base = base.removeSuffix("/$key").removeSuffix(key).trimEnd('/')
      }
      if (key.isEmpty()) return base
      if (base.contains("/$key")) return base
      return "$base/$key"
    }

    private fun maskEndpoint(endpoint: String): String {
      val idx = endpoint.lastIndexOf('/')
      if (idx < 0 || idx >= endpoint.length - 1) return endpoint
      val streamKey = endpoint.substring(idx + 1)
      val masked = if (streamKey.length <= 8) "***" else "${streamKey.take(4)}…${streamKey.takeLast(4)}"
      return endpoint.substring(0, idx + 1) + masked
    }
  }
}
