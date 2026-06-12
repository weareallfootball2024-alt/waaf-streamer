package expo.modules.waflivestream

enum class StreamQualityPreset(val width: Int, val height: Int, val bitrate: Int, val fps: Int) {
  HIGH(1280, 720, 1_500_000, 30),
  MEDIUM(854, 480, 1_000_000, 30),
  LOW(640, 360, 500_000, 24);

  companion object {
    fun from(raw: String?): StreamQualityPreset = when (raw?.lowercase()) {
      "high" -> HIGH
      "low" -> LOW
      else -> MEDIUM
    }
  }
}
