package expo.modules.waflivestream

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WaafLivestreamModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WaafLivestream")

    View(WaafLivestreamView::class) {
      Events("onConnectionSuccess", "onConnectionFailed", "onDisconnect")

      Prop("camera") { view: WaafLivestreamView, camera: String ->
        view.setCameraFacing(camera)
      }

      AsyncFunction("startStreaming") { view: WaafLivestreamView, streamKey: String, rtmpUrl: String, muted: Boolean? ->
        view.startStreaming(rtmpUrl, streamKey, muted ?: false)
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
    }
  }
}
