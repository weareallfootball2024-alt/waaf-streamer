import type { ViewProps } from 'react-native';

export type ScoreboardPayload = {
  teamHome: string;
  teamAway: string;
  scoreHome: number;
  scoreAway: number;
  timer: string;
  period?: string;
};

export type EventBannerPayload = {
  eventType: 'goal' | 'penalty' | 'own_goal' | 'yellow_card' | 'red_card' | 'second_yellow_card' | string;
  playerName: string;
  playerNumber?: string | number;
  assistantName?: string;
  assistantNumber?: string | number;
  durationMs?: number;
};

export type ResolvedStreamQuality = 'high' | 'medium' | 'low';

export type WaafLivestreamViewProps = ViewProps & {
  camera?: 'front' | 'back';
  streamQuality?: ResolvedStreamQuality;
  onConnectionSuccess?: () => void;
  onConnectionFailed?: (event: { nativeEvent: { code: string } }) => void;
  onDisconnect?: () => void;
  onStreamStats?: (event: {
    nativeEvent: { videoFrames: number; audioFrames: number; bytesSent: number };
  }) => void;
};

export type WaafLivestreamViewRef = {
  startStreaming: (
    streamKey: string,
    rtmpUrl: string,
    muted?: boolean,
    quality?: ResolvedStreamQuality,
  ) => Promise<void>;
  stopStreaming: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  updateScoreboard: (payload: ScoreboardPayload) => Promise<void>;
  showEventBanner: (payload: EventBannerPayload) => Promise<void>;
};
