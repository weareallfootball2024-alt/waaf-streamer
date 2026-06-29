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
      )

      Prop("camera") { view: WaafLivestreamView, camera: String ->
        view.setCameraFacing(camera)
      }

      Prop("streamQuality") { view: WaafLivestreamView, quality: String ->
        view.setStreamQuality(quality)
      }

      AsyncFunction("startStreaming") { view: WaafLivestreamView, streamKey: String, rtmpUrl: String, muted: Boolean?, quality: String? ->
        view.startStreaming(rtmpUrl, streamKey, muted ?: false, quality)
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
    }
  }
}
