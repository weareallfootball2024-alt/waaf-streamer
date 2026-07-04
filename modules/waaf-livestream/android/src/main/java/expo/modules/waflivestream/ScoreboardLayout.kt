package expo.modules.waflivestream

enum class ScoreboardLayout(val key: String) {
  FULL("full"),
  CENTER("center"),
  LEFT("left"),
  RIGHT("right");

  val isCompact: Boolean
    get() = this != FULL

  companion object {
    fun from(raw: String?): ScoreboardLayout =
      entries.find { it.key == raw?.trim()?.lowercase() } ?: FULL
  }
}
