package expo.modules.waflivestream

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WaafLivestreamModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WaafLivestream")

    View(WaafLivestreamView::class) {
      Events(
        "onConnectionSuccess",
        "onConnectionFailed",
        "onDisconnect",
        "onStreamStats",
        "onVideoInsertStarted",
        "onVideoInsertEnded",
        "onVideoInsertError",
        "onReplaySaved",
      )

      Prop("camera") { view: WaafLivestreamView, camera: String ->
        view.setCameraFacing(camera)
      }

      Prop("streamQuality") { view: WaafLivestreamView, quality: String ->
        view.setStreamQuality(quality)
      }

      Prop("scoreboardLayout") { view: WaafLivestreamView, layout: String ->
        view.setScoreboardLayout(layout)
      }

      AsyncFunction("startStreaming") { view: WaafLivestreamView, streamKey: String, rtmpUrl: String, muted: Boolean?, quality: String?, captureReplay: Boolean? ->
        view.startStreaming(rtmpUrl, streamKey, muted ?: false, quality, captureReplay ?: false)
      }

      AsyncFunction("stopStreaming") { view: WaafLivestreamView ->
        view.stopStreaming()
      }

      AsyncFunction("setMuted") { view: WaafLivestreamView, muted: Boolean ->
        view.setMuted(muted)
      }

      AsyncFunction("updateScoreboard") { view: WaafLivestreamView, payload: Map<String, Any?> ->
        view.updateScoreboard(payload)
      }

      AsyncFunction("showEventBanner") { view: WaafLivestreamView, payload: Map<String, Any?> ->
        view.showEventBanner(
          eventType = payload["eventType"]?.toString() ?: "goal",
          playerName = payload["playerName"]?.toString() ?: "",
          playerNumber = payload["playerNumber"]?.toString() ?: "",
          assistantName = payload["assistantName"]?.toString(),
          assistantNumber = payload["assistantNumber"]?.toString(),
          durationMs = (payload["durationMs"] as? Number)?.toLong() ?: 6000L,
        )
      }

      AsyncFunction("playVideoInsert") { view: WaafLivestreamView, filePath: String, loop: Boolean? ->
        view.playVideoInsert(filePath, loop ?: false)
      }

      AsyncFunction("stopVideoInsert") { view: WaafLivestreamView ->
        view.stopVideoInsert()
      }

      AsyncFunction("triggerReplay") { view: WaafLivestreamView, seconds: Int?, teamSide: String? ->
        view.triggerReplay(seconds ?: 10, teamSide)
      }
    }
  }
}
