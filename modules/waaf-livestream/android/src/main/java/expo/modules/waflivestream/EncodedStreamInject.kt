package expo.modules.waflivestream

import android.media.MediaCodec
import com.pedro.library.generic.GenericStream
import java.nio.ByteBuffer

/**
 * Sends pre-encoded frames directly to the active RTMP/RTSP client.
 */
internal object EncodedStreamInject {
  private val videoMethod by lazy {
    Class.forName("com.pedro.library.base.StreamBase")
      .getDeclaredMethod("getVideoDataImp", ByteBuffer::class.java, MediaCodec.BufferInfo::class.java)
      .apply { isAccessible = true }
  }

  private val audioMethod by lazy {
    Class.forName("com.pedro.library.base.StreamBase")
      .getDeclaredMethod("getAudioDataImp", ByteBuffer::class.java, MediaCodec.BufferInfo::class.java)
      .apply { isAccessible = true }
  }

  fun sendVideo(stream: GenericStream, buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
    videoMethod.invoke(stream, buffer, info)
  }

  fun sendAudio(stream: GenericStream, buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
    audioMethod.invoke(stream, buffer, info)
  }

  fun pauseLiveCapture(stream: GenericStream): Boolean {
    val wasRunning = stream.videoSource.isRunning()
    if (wasRunning) stream.videoSource.stop()
    return wasRunning
  }

  fun resumeLiveCapture(stream: GenericStream, wasRunning: Boolean) {
    if (wasRunning && !stream.videoSource.isRunning()) {
      stream.videoSource.start(stream.getGlInterface().surfaceTexture)
    }
    if (stream.isStreaming) {
      stream.requestKeyframe()
    }
  }
}
