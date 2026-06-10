import type { ViewProps } from 'react-native';

export type ScoreboardPayload = {
  teamHome: string;
  teamAway: string;
  scoreHome: number;
  scoreAway: number;
  timer: string;
  period?: string;
};

export type WaafLivestreamViewProps = ViewProps & {
  camera?: 'front' | 'back';
  onConnectionSuccess?: () => void;
  onConnectionFailed?: (event: { nativeEvent: { code: string } }) => void;
  onDisconnect?: () => void;
};

export type WaafLivestreamViewRef = {
  startStreaming: (streamKey: string, rtmpUrl: string) => Promise<void>;
  stopStreaming: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  updateScoreboard: (payload: ScoreboardPayload) => Promise<void>;
};
