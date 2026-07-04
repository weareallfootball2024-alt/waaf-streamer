package expo.modules.waflivestream

import android.content.Context
import android.graphics.Bitmap
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
import com.pedro.encoder.utils.gl.AspectRatioMode
import com.pedro.encoder.utils.gl.TranslateTo
import com.pedro.library.generic.GenericStream
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.Executors

@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
class WaafLivestreamView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  val onConnectionSuccess by EventDispatcher()
  val onConnectionFailed by EventDispatcher()
  val onDisconnect by EventDispatcher()
  val onStreamStats by EventDispatcher()
  val onVideoInsertStarted by EventDispatcher()
  val onVideoInsertEnded by EventDispatcher()
  val onVideoInsertError by EventDispatcher()
  val onReplaySaved by EventDispatcher()

  private val surfaceView = SurfaceView(context)
  private val microphoneSource = MicrophoneSource()
  private var scoreboardFilter: ImageObjectFilterRender? = null
  private var eventFilter: ImageObjectFilterRender? = null
  private var eventFilterAdded = false
  private var replayIntroFilter: ImageObjectFilterRender? = null
  private var replayIntroFilterAdded = false
  private var replayIntroTicks = 0
  private var replayIntroTeamSide: String? = null
  private var replayIntroOnComplete: (() -> Unit)? = null
  private val clearEventRunnable = Runnable { hideEventBanner() }
  private val replayIntroBlinkRunnable = object : Runnable {
    override fun run() {
      val filter = replayIntroFilter ?: return
      val dimmed = replayIntroTicks % 2 == 1
      val logo = when (replayIntroTeamSide) {
        "away" -> logoAwayBitmap
        "home" -> logoHomeBitmap
        else -> null
      }
      val teamName = when (replayIntroTeamSide) {
        "away" -> teamAway
        "home" -> teamHome
        else -> null
      }
      filter.setImage(ReplayIntroRenderer.render("ПОВТОР", logo, teamName, dimmed))
      replayIntroTicks++
      if (replayIntroTicks < 6) {
        mainHandler.postDelayed(this, 350)
      } else {
        hideReplayIntro()
        replayIntroOnComplete?.invoke()
        replayIntroOnComplete = null
      }
    }
  }
  private var isPrepared = false
  private var isMuted = false
  private var scoreboardReady = false
  private var scoreboardLayout = ScoreboardLayout.FULL
  private var encoderQuality: StreamQualityPreset = StreamQualityPreset.MEDIUM
  private var surfaceReady = false

  private var teamHome = "Хозяева"
  private var teamAway = "Гости"
  private var logoHomeUrl: String? = null
  private var logoAwayUrl: String? = null
  private var logoHomeBitmap: Bitmap? = null
  private var logoAwayBitmap: Bitmap? = null
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

  private val replayRingBuffer = ReplayRingBuffer()
  private lateinit var videoInjector: VideoInjector
  private lateinit var replayDirectPlayer: ReplayDirectPlayer
  private var replayControllerAttached = false

  private val genericStream: GenericStream = GenericStream(
    context,
    connectChecker,
    Camera2Source(context),
    microphoneSource,
  ).apply {
    getGlInterface().apply {
      autoHandleOrientation = true
      setAspectRatioMode(AspectRatioMode.Fill)
    }
    getStreamClient().apply {
      setReTries(3)
      setDelay(300)
      setWriteChunkSize(4096)
    }
  }

  private fun attachReplayControllerIfNeeded() {
    if (replayControllerAttached) return
    try {
      genericStream.setRecordController(ReplayCaptureRecordController(replayRingBuffer))
      replayControllerAttached = true
    } catch (e: Exception) {
      Log.e(TAG, "replay controller attach failed", e)
    }
  }

  init {
    replayDirectPlayer = ReplayDirectPlayer(
      stream = genericStream,
      ringBuffer = replayRingBuffer,
      mainHandler = mainHandler,
      object : ReplayDirectPlayer.Callbacks {
        override fun onInsertStarted() {
          post { onVideoInsertStarted(mapOf("kind" to "replay", "loop" to false)) }
        }

        override fun onInsertEnded() {
          post { onVideoInsertEnded(mapOf("kind" to "replay")) }
        }

        override fun onInsertError(code: String) {
          post { onVideoInsertError(mapOf("code" to code)) }
        }

        override fun isMicMuted(): Boolean = isMuted

        override fun setMicMuted(muted: Boolean) = setMicrophoneMuted(muted)

        override fun scheduleScoreboardRestore() {
          scoreboardReady = false
          if (genericStream.isStreaming) {
            mainHandler.postDelayed(deferredFilterRunnable, 400)
          }
        }
      },
    )

    videoInjector = VideoInjector(
      context,
      genericStream,
      microphoneSource,
      mainHandler,
      object : VideoInjector.Callbacks {
        override fun onInsertStarted(kind: String, loop: Boolean) {
          post { onVideoInsertStarted(mapOf("kind" to kind, "loop" to loop)) }
        }

        override fun onInsertEnded(kind: String) {
          post { onVideoInsertEnded(mapOf("kind" to kind)) }
        }

        override fun onInsertError(code: String) {
          post { onVideoInsertError(mapOf("code" to code)) }
        }

        override fun hideGlFilters() = hideGlFiltersForInsert()

        override fun scheduleScoreboardRestore() {
          scoreboardReady = false
          if (genericStream.isStreaming) {
            mainHandler.postDelayed(deferredFilterRunnable, 400)
          }
        }

        override fun isMicMuted(): Boolean = isMuted

        override fun setMicMuted(muted: Boolean) = setMicrophoneMuted(muted)

        override fun createCameraSource(): Camera2Source = Camera2Source(context)
      },
    )

    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    addView(
      surfaceView,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )

    surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
      override fun surfaceCreated(holder: SurfaceHolder) {
        surfaceReady = true
        mainHandler.post { startPreviewIfReady("surfaceCreated") }
      }

      override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        if (width > 0 && height > 0) {
          try {
            val previewW = encoderQuality.width
            val previewH = encoderQuality.height
            genericStream.getGlInterface().setPreviewResolution(previewW, previewH)
          } catch (e: Exception) {
            Log.w(TAG, "setPreviewResolution failed", e)
          }
          if (!genericStream.isOnPreview) {
            mainHandler.post { startPreviewIfReady("surfaceChanged") }
          }
        }
      }

      override fun surfaceDestroyed(holder: SurfaceHolder) {
        surfaceReady = false
        mainHandler.removeCallbacks(publishRunnable)
        mainHandler.removeCallbacks(deferredFilterRunnable)
        stopStats()
        if (genericStream.isOnPreview) {
          try {
            genericStream.stopPreview()
          } catch (e: Exception) {
            Log.w(TAG, "stopPreview failed", e)
          }
        }
      }
    })
  }

  private fun hideGlFiltersForInsert() {
    hideEventBanner()
    hideReplayIntro()
    try {
      genericStream.getGlInterface().clearFilters()
    } catch (_: Exception) {
    }
    scoreboardFilter = null
    scoreboardReady = false
  }

  fun playVideoInsert(filePath: String, loop: Boolean) {
    videoInjector.play(filePath, loop, "ad")
  }

  fun stopVideoInsert() {
    videoInjector.stop()
  }

  fun triggerReplay(seconds: Int, teamSide: String? = null) {
    if (!genericStream.isStreaming) {
      post { onVideoInsertError(mapOf("code" to "not_streaming")) }
      return
    }
    if (videoInjector.isActive || replayDirectPlayer.isActive) {
      post { onVideoInsertError(mapOf("code" to "insert_active")) }
      return
    }

    val clipSeconds = seconds.coerceIn(1, 15)
    val snapshot = replayRingBuffer.snapshot()
    mainHandler.post {
      showReplayIntro(teamSide) {
        replayDirectPlayer.play(snapshot, clipSeconds)
      }
    }
  }

  private fun showReplayIntro(teamSide: String?, onComplete: () -> Unit) {
    hideReplayIntro()
    replayIntroTeamSide = teamSide
    replayIntroOnComplete = onComplete
    replayIntroTicks = 0

    val filter = ImageObjectFilterRender().also { replayIntroFilter = it }
    val streamW = encoderQuality.width
    val streamH = encoderQuality.height
    val introW = 1280f
    val introH = 720f
    val scaleX = introW * 100f / streamW
    val scaleY = introH * 100f / streamH
    filter.setScale(scaleX, scaleY)
    filter.setPosition(50f - scaleX / 2f, 50f - scaleY / 2f)

    val logo = when (teamSide) {
      "away" -> logoAwayBitmap
      "home" -> logoHomeBitmap
      else -> null
    }
    val teamName = when (teamSide) {
      "away" -> teamAway
      "home" -> teamHome
      else -> null
    }
    filter.setImage(ReplayIntroRenderer.render("ПОВТОР", logo, teamName, false))

    try {
      genericStream.getGlInterface().addFilter(filter)
      replayIntroFilterAdded = true
    } catch (e: Exception) {
      Log.w(TAG, "replay intro filter failed", e)
      replayIntroOnComplete = null
      onComplete()
      return
    }

    Log.i(TAG, "replay intro team=$teamSide")
    mainHandler.post(replayIntroBlinkRunnable)
  }

  private fun hideReplayIntro() {
    mainHandler.removeCallbacks(replayIntroBlinkRunnable)
    replayIntroFilter?.let { filter ->
      if (replayIntroFilterAdded) {
        try {
          genericStream.getGlInterface().removeFilter(filter)
        } catch (_: Exception) {
        }
        replayIntroFilterAdded = false
      }
    }
    replayIntroFilter = null
    replayIntroTeamSide = null
  }

  private fun videoRotation(): Int = 0

  private fun prepareEncoder(requested: StreamQualityPreset): Boolean {
    if (isPrepared && encoderQuality == requested) return true

    if (isPrepared) {
      if (genericStream.isOnPreview) {
        try {
          genericStream.stopPreview()
        } catch (e: Exception) {
          Log.w(TAG, "stopPreview before re-prepare failed", e)
        }
      }
      isPrepared = false
    }

    val rotation = videoRotation()
    val candidates = linkedSetOf(
      requested,
      StreamQualityPreset.MEDIUM,
      StreamQualityPreset.LOW,
      StreamQualityPreset.HIGH,
    )

    for (preset in candidates) {
      val ok = try {
        genericStream.prepareVideo(preset.width, preset.height, preset.bitrate, preset.fps, 1, rotation)
          && genericStream.prepareAudio(44_100, true, 128_000)
      } catch (e: Exception) {
        Log.w(TAG, "prepareEncoder ${preset.name} failed", e)
        false
      }
      if (ok) {
        encoderQuality = preset
        isPrepared = true
        try {
          genericStream.getGlInterface().setPreviewResolution(preset.width, preset.height)
        } catch (_: Exception) {
        }
        Log.i(
          TAG,
          "encoder prepared ${preset.width}x${preset.height} ${preset.bitrate}bps rotation=$rotation",
        )
        return true
      }
    }

    isPrepared = false
    Log.e(TAG, "prepareEncoder: all quality presets failed")
    return false
  }

  private fun startPreviewIfReady(reason: String) {
    if (!surfaceReady) return
    if (genericStream.isOnPreview) return
    if (surfaceView.holder.surface?.isValid != true) {
      Log.w(TAG, "$reason: surface not valid yet")
      return
    }
    if (!isPrepared && !prepareEncoder(encoderQuality)) {
      Log.e(TAG, "$reason: encoder not prepared")
      return
    }
    try {
      genericStream.startPreview(surfaceView)
      Log.i(TAG, "preview started ($reason)")
    } catch (e: Exception) {
      Log.e(TAG, "$reason preview failed", e)
    }
  }

  fun setStreamQuality(quality: String) {
    if (genericStream.isStreaming) return
    val preset = StreamQualityPreset.from(quality)
    if (preset == encoderQuality && isPrepared) return
    prepareEncoder(preset)
    startPreviewIfReady("setStreamQuality")
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
    refreshScoreboardBitmap()
    Log.i(TAG, "scoreboard filter applied layout=$scoreboardLayout")
  }

  private fun setupScoreboardFilter() {
    val filter = ImageObjectFilterRender()
    scoreboardFilter = filter
    genericStream.getGlInterface().setFilter(filter)
    applyScoreboardLayoutToFilter(filter)
  }

  private fun applyScoreboardLayoutToFilter(filter: ImageObjectFilterRender) {
    val streamW = encoderQuality.width
    val streamH = encoderQuality.height
    val bitmap = buildScoreboardBitmap()
    val scaleX = bitmap.width * 100f / streamW
    val scaleY = bitmap.height * 100f / streamH
    filter.setImage(bitmap)
    filter.setScale(scaleX, scaleY)
    when (scoreboardLayout) {
      ScoreboardLayout.FULL -> filter.setPosition(TranslateTo.TOP)
      ScoreboardLayout.CENTER -> filter.setPosition(50f - scaleX / 2f, 3f)
      ScoreboardLayout.LEFT -> filter.setPosition(TranslateTo.TOP_LEFT)
      ScoreboardLayout.RIGHT -> filter.setPosition(TranslateTo.TOP_RIGHT)
    }
    Log.d(TAG, "scoreboard scale=${scaleX}x${scaleY} stream=${streamW}x${streamH} bmp=${bitmap.width}x${bitmap.height}")
  }

  private fun buildScoreboardBitmap(): Bitmap {
    return ScoreboardRenderer.render(
      teamHome,
      teamAway,
      scoreHome,
      scoreAway,
      timerText,
      periodText,
      logoHomeBitmap,
      logoAwayBitmap,
      scoreboardLayout,
      encoderQuality.width,
    )
  }

  private fun refreshScoreboardBitmap() {
    val filter = scoreboardFilter ?: return
    applyScoreboardLayoutToFilter(filter)
  }

  fun setScoreboardLayout(layout: String) {
    val next = ScoreboardLayout.from(layout)
    if (next == scoreboardLayout) return
    scoreboardLayout = next
    if (scoreboardReady) {
      refreshScoreboardBitmap()
    }
  }

  private fun loadLogoIfNeeded(side: String, url: String?) {
    val trimmed = url?.trim().orEmpty()
    if (trimmed.isEmpty()) {
      if (side == "home") logoHomeBitmap = null else logoAwayBitmap = null
      post { refreshScoreboardBitmap() }
      return
    }
    TeamLogoLoader.load(context, trimmed) { bitmap ->
      mainHandler.post {
        if (side == "home") {
          if (logoHomeUrl?.trim() != trimmed) return@post
          logoHomeBitmap = bitmap
        } else {
          if (logoAwayUrl?.trim() != trimmed) return@post
          logoAwayBitmap = bitmap
        }
        refreshScoreboardBitmap()
      }
    }
  }

  private fun stopStats() {
    mainHandler.removeCallbacks(statsRunnable)
  }

  fun setCameraFacing(camera: String) {
    if (camera == "front") {
      (genericStream.videoSource as? Camera2Source)?.switchCamera()
    }
  }

  fun startStreaming(
    rtmpUrl: String,
    streamKey: String,
    muted: Boolean,
    quality: String? = null,
    captureReplay: Boolean = false,
  ) {
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)
    stopStats()
    scoreboardReady = false
    scoreboardFilter = null

    val preset = StreamQualityPreset.from(quality)
    if (captureReplay) attachReplayControllerIfNeeded()
    if (!prepareEncoder(preset)) {
      onConnectionFailed(mapOf("code" to "encoder_prepare_failed"))
      return
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
    Log.i(TAG, "Start stream → ${maskEndpoint(endpoint)} muted=$muted quality=$preset replay=$captureReplay")

    startPreviewIfReady("startStreaming")
    val delayMs = if (genericStream.isOnPreview) 1200L else 2500L
    mainHandler.postDelayed(publishRunnable, delayMs)
  }

  private fun publishStream() {
    val url = pendingEndpoint ?: return
    if (genericStream.isStreaming) return
    if (!genericStream.isOnPreview) {
      startPreviewIfReady("publishStream")
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
    if (::videoInjector.isInitialized && videoInjector.isActive) {
      videoInjector.stop()
    }
    if (::replayDirectPlayer.isInitialized) {
      replayDirectPlayer.cancel()
    }
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)
    stopStats()
    pendingEndpoint = null
    scoreboardReady = false
    replayRingBuffer.clear()
    hideEventBanner()
    hideReplayIntro()
    if (genericStream.isStreaming) {
      genericStream.stopStream()
    }
    try {
      genericStream.getGlInterface().clearFilters()
    } catch (_: Exception) {
    }
    scoreboardFilter = null
    startPreviewIfReady("stopStreaming")
  }

  fun setMuted(muted: Boolean) {
    setMicrophoneMuted(muted)
  }

  fun showEventBanner(
    eventType: String,
    playerName: String,
    playerNumber: String,
    assistantName: String?,
    assistantNumber: String?,
    durationMs: Long = 6000,
  ) {
    mainHandler.removeCallbacks(clearEventRunnable)
    val bitmap = EventOverlayRenderer.render(
      eventType,
      playerName,
      playerNumber,
      assistantName,
      assistantNumber,
    )
    val filter = eventFilter ?: ImageObjectFilterRender().also { created ->
      eventFilter = created
      created.setScale(96f, 15f)
      created.setPosition(TranslateTo.BOTTOM)
    }
    filter.setImage(bitmap)
    if (scoreboardReady && !eventFilterAdded) {
      genericStream.getGlInterface().addFilter(filter)
      eventFilterAdded = true
    }
    Log.i(TAG, "event banner: $eventType #$playerNumber $playerName")
    mainHandler.postDelayed(clearEventRunnable, durationMs)
  }

  private fun hideEventBanner() {
    eventFilter?.let { filter ->
      if (eventFilterAdded) {
        try {
          genericStream.getGlInterface().removeFilter(filter)
        } catch (_: Exception) {
        }
        eventFilterAdded = false
      }
    }
    eventFilter = null
  }

  fun updateScoreboard(payload: Map<String, Any?>) {
    payload["teamHome"]?.toString()?.let { teamHome = it }
    payload["teamAway"]?.toString()?.let { teamAway = it }
    payload["scoreHome"]?.let { scoreHome = (it as? Number)?.toInt() ?: scoreHome }
    payload["scoreAway"]?.let { scoreAway = (it as? Number)?.toInt() ?: scoreAway }
    payload["timer"]?.toString()?.let { timerText = it }
    payload["period"]?.toString()?.let { periodText = it }

    val nextHomeLogo = payload["logoHome"]?.toString()?.trim()?.takeIf { it.isNotEmpty() }
    val nextAwayLogo = payload["logoAway"]?.toString()?.trim()?.takeIf { it.isNotEmpty() }

    if (nextHomeLogo != logoHomeUrl) {
      logoHomeUrl = nextHomeLogo
      logoHomeBitmap = null
      loadLogoIfNeeded("home", nextHomeLogo)
    }
    if (nextAwayLogo != logoAwayUrl) {
      logoAwayUrl = nextAwayLogo
      logoAwayBitmap = null
      loadLogoIfNeeded("away", nextAwayLogo)
    }

    post {
      if (scoreboardReady) {
        refreshScoreboardBitmap()
      }
    }
  }

  override fun onDetachedFromWindow() {
    if (::videoInjector.isInitialized && videoInjector.isActive) {
      videoInjector.stop()
    }
    replayRingBuffer.clear()
    mainHandler.removeCallbacks(publishRunnable)
    mainHandler.removeCallbacks(deferredFilterRunnable)
    stopStats()
    surfaceReady = false
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
