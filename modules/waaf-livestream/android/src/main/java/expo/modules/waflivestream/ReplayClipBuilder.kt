package expo.modules.waflivestream

import android.media.MediaCodec

internal object ReplayClipBuilder {
  data class Clip(
    val videoFrames: List<EncodedFrame>,
    val audioFrames: List<EncodedFrame>,
    val durationUs: Long,
  )

  fun build(snapshot: ReplayRingBuffer.Snapshot, seconds: Int): Clip? {
    val video = snapshot.videoFrames.filter {
      it.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0
    }
    if (video.isEmpty()) return null

    val durationUs = seconds.coerceIn(1, 15) * 1_000_000L
    val endPts = video.last().presentationTimeUs
    val startTarget = endPts - durationUs

    var startIdx = video.indexOfLast {
      it.presentationTimeUs <= startTarget && isKeyFrame(it)
    }
    if (startIdx < 0) {
      startIdx = video.indexOfFirst { isKeyFrame(it) }
    }
    if (startIdx < 0) return null

    val clipVideo = video.subList(startIdx, video.size)
    val firstPts = clipVideo.first().presentationTimeUs
    val clipAudio = snapshot.audioFrames.filter {
      it.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0 &&
        it.presentationTimeUs in firstPts..endPts
    }

    val clipDuration = (clipVideo.last().presentationTimeUs - firstPts).coerceAtLeast(1L)
    return Clip(clipVideo, clipAudio, clipDuration)
  }

  private fun isKeyFrame(frame: EncodedFrame): Boolean {
    if (frame.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0) return true
    if (frame.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) return false
    if (frame.data.size < 5) return false
    val nalType = frame.data[4].toInt() and 0x1F
    return nalType == 5
  }
}
