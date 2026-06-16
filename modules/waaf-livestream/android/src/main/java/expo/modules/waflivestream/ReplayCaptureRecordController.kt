package expo.modules.waflivestream

import android.media.MediaCodec
import android.media.MediaFormat
import com.pedro.common.AudioCodec
import com.pedro.common.VideoCodec
import com.pedro.library.base.recording.RecordController
import com.pedro.library.util.AndroidMuxerRecordController
import java.io.FileDescriptor
import java.nio.ByteBuffer

/**
 * Feeds encoded frames into the replay ring buffer while delegating file recording.
 */
internal class ReplayCaptureRecordController(
  private val ringBuffer: ReplayRingBuffer,
  private val delegate: AndroidMuxerRecordController = AndroidMuxerRecordController(),
) : RecordController {

  override fun startRecord(path: String, listener: RecordController.Listener?, tracks: RecordController.RecordTracks) {
    delegate.startRecord(path, listener, tracks)
  }

  override fun startRecord(fd: FileDescriptor, listener: RecordController.Listener?, tracks: RecordController.RecordTracks) {
    delegate.startRecord(fd, listener, tracks)
  }

  override fun stopRecord() = delegate.stopRecord()

  override fun recordVideo(videoBuffer: ByteBuffer, videoInfo: MediaCodec.BufferInfo) {
    ringBuffer.addVideo(videoBuffer, videoInfo)
    delegate.recordVideo(videoBuffer, videoInfo)
  }

  override fun recordAudio(audioBuffer: ByteBuffer, audioInfo: MediaCodec.BufferInfo) {
    ringBuffer.addAudio(audioBuffer, audioInfo)
    delegate.recordAudio(audioBuffer, audioInfo)
  }

  override fun setVideoFormat(videoFormat: MediaFormat) {
    ringBuffer.setVideoFormat(videoFormat)
    delegate.setVideoFormat(videoFormat)
  }

  override fun setAudioFormat(audioFormat: MediaFormat) {
    ringBuffer.setAudioFormat(audioFormat)
    delegate.setAudioFormat(audioFormat)
  }

  override fun resetFormats() {
    ringBuffer.clear()
    delegate.resetFormats()
  }

  override fun isRunning(): Boolean = delegate.isRunning()
  override fun isRecording(): Boolean = delegate.isRecording()
  override fun setVideoCodec(videoCodec: VideoCodec) = delegate.setVideoCodec(videoCodec)
  override fun setAudioCodec(audioCodec: AudioCodec) = delegate.setAudioCodec(audioCodec)
  override fun pauseRecord() = delegate.pauseRecord()
  override fun resumeRecord() = delegate.resumeRecord()
  override fun updateInfo(videoCodec: VideoCodec, audioCodec: AudioCodec) = delegate.updateInfo(videoCodec, audioCodec)
  override fun getVideoCodec(): VideoCodec = delegate.getVideoCodec()
  override fun getAudioCodec(): AudioCodec = delegate.getAudioCodec()
  override fun setRequestKeyFrame(requestKeyFrame: RecordController.RequestKeyFrame?) =
    delegate.setRequestKeyFrame(requestKeyFrame)

  override fun getStatus(): RecordController.Status = delegate.getStatus()
}
