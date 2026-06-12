package expo.modules.waflivestream

import android.content.Context
import android.content.res.Configuration
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
  val onStreamStats by EventDispatcher()

  private val surfaceView = SurfaceView(context)
  private val microphoneSource = MicrophoneSource()
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
  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingEndpoint: String? = null
  private val publishRunnable = Runnable { publishStream() }
  private val deferredFilterRunnable = Runnable { ensureScoreboardFilter() }
  private val statsRunnable = object : Runnable {
    override fun run() {
      if (!genericStream.isStreaming) return
      val client = genericStream.getStreamClient()
      val videoFrames = client.getSentVideoFrames()
      val audioFrames = client.getSentAudioFrames()
      val bytes = client.getBytesSend()
      post {
        onStreamStats(
          mapOf(
            "videoFrames" to videoFrames,
            "audioFrames" to audioFrames,
            "bytesSent" to bytes,
          ),
        )
      }
      Log.i(TAG, "stats video=$videoFrames audio=$audioFrames bytes=$bytes")
      mainHandler.postDelayed(this, 3000)
    }
  }

  private val connectChecker = object : ConnectChecker {
    override fun onConnectionStarted(url: String) {
      Log.i(TAG, "RTMP connecting: ${maskEndpoint(url)}")
    }

    override fun onConnectionSuccess() {
      Log.i(TAG, "RTMP publish started")
      mainHandler.postDelayed(deferredFilterRunnable, 1500)
      mainHandler.postDelayed(statsRunnable, 2000)
      post { onConnectionSuccess(mapOf()) }
    }

    override fun onConnectionFailed(reason: String) {
      Log.e(TAG, "RTMP failed: $reason")
      stopStats()
      post {
        if (genericStream.isStreaming) genericStream.stopStream()
        onConnectionFailed(mapOf("code" to reason))
      }
    }

    override fun onNewBitrate(bitrate: Long) {
      Log.d(TAG, "bitrate=$bitrate")
    }

    override fun onDisconnect() {
      Log.w(TAG, "RTMP disconnected")
      stopStats()
      post { onDisconnect(mapOf("code" to "disconnected")) }
    }

    override fun onAuthError() {
      Log.e(TAG, "RTMP auth error")
      stopStats()
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
    microphoneSource,
  ).apply {
    getGlInterface().autoHandleOrientation = true
    getStreamClient().apply {
      setReTries(3)
      setDelay(300)
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
        mainHandler.removeCallbacks(deferredFilterRunnable)
        stopStats()
        if (genericStream.isOnPreview) {
          genericStream.stopPreview()
        }
      }
    })
  }

  private fun videoRotation(): Int {
    val o = context.resources.configuration.orientation
    return if (o == Configuration.ORIENTATION_LANDSCAPE) 90 else 0
  }

  private fun prepareEncoder() {
    val rotation = videoRotation()
    isPrepared = try {
      genericStream.prepareVideo(1280, 720, 1_500_000, 30, 1, rotation)
        && genericStream.prepareAudio(44_100, true, 128_000)
    } catch (e: IllegalArgumentException) {
      Log.e(TAG, "prepareEncoder failed", e)
      false
    }
    if (isPrepared) {
      Log.i(TAG, "encoder prepared 1280x720 rotation=$rotation")
    }
  }

  private fun setMicrophoneMuted(muted: Boolean) {
    isMuted = muted
    try {
      if (muted) microphoneSource.mute() else microphoneSource.unMute()
      Log.i(TAG, "microphone muted=$muted")
    } catch (e: Exception) {
      Log.e(TAG, "setMicrophoneMuted failed", e)
    }
  }

  private fun ensureScoreboardFilter() {
    if (scoreboardReady || !genericStream.isStreaming) return
    setupScoreboardFilter()
    scoreboardReady = true
    Log.i(TAG, "scoreboard filter applied")
  }

  private fun setupScoreboardFilter() {
    val filter = ImageObjectFilterRender()
    scoreboardFilter = filter
    genericStream.getGlInterface().setFilter(filter)
    filter.setImage(
      ScoreboardRenderer.render(teamHome, teamAway, scoreHome, scoreAway, timerText, periodText),
    )
    filter.setScale(96f, 19f)
    filter.setPosition(TranslateTo.TOP)
  }

  private fun refreshScoreboardBitmap() {
    val filter = scoreboardFilter ?: return
    filter.setImage(
      ScoreboardRenderer.render(teamHome, teamAway, scoreHome, scoreAway, timerText, periodText),
    )
  }

  private fun stopStats() {
    mainHandler.removeCallbacks(statsRunnable)
  }

  fun setCameraFacing(camera: String) {
    if (camera == "front") {
      (genericStream.videoSource as? Camera2Source)?.switchCamera()
    }
  }

  fun startStreaming(rtmpUrl: String, streamKey: String, muted: Boolean) {
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)
    stopStats()
    scoreboardReady = false
    scoreboardFilter = null

    if (!isPrepared) {
      prepareEncoder()
      if (!isPrepared) {
        onConnectionFailed(mapOf("code" to "encoder_prepare_failed"))
        return
      }
    }

    setMicrophoneMuted(muted)

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

    val delayMs = if (genericStream.isOnPreview) 1200L else 2000L
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
    try {
      Log.i(TAG, "publishStream (no filter yet)")
      genericStream.startStream(url)
    } catch (e: Exception) {
      Log.e(TAG, "startStream exception", e)
      onConnectionFailed(mapOf("code" to (e.message ?: "start_exception")))
    }
  }

  fun stopStreaming() {
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)
    stopStats()
    pendingEndpoint = null
    scoreboardReady = false
    if (genericStream.isStreaming) {
      genericStream.stopStream()
    }
    try {
      genericStream.getGlInterface().clearFilters()
    } catch (_: Exception) {
    }
  }

  fun setMuted(muted: Boolean) {
    setMicrophoneMuted(muted)
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
    mainHandler.removeCallbacks(deferredFilterRunnable)
    stopStats()
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
