import React, { useCallback, useMemo, useRef } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

type Props = {
  value: number;
  min: number;
  max: number;
  opacity?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
};

const TRACK_H = 180;
const THUMB = 22;

export function VerticalZoomSlider({
  value,
  min,
  max,
  opacity = 1,
  disabled = false,
  onChange,
}: Props) {
  const trackHRef = useRef(TRACK_H);
  const range = Math.max(0.001, max - min);
  const ratio = Math.min(1, Math.max(0, (value - min) / range));
  const thumbBottom = ratio * (trackHRef.current - THUMB);

  const applyY = useCallback(
    (locationY: number) => {
      if (disabled || max <= min) return;
      const h = trackHRef.current;
      const fromBottom = Math.min(h, Math.max(0, h - locationY));
      const nextRatio = fromBottom / h;
      const next = min + nextRatio * (max - min);
      onChange(next);
    },
    [disabled, max, min, onChange],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (e) => applyY(e.nativeEvent.locationY),
        onPanResponderMove: (e) => applyY(e.nativeEvent.locationY),
      }),
    [applyY, disabled],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    trackHRef.current = e.nativeEvent.layout.height;
  };

  const pct = Math.round(ratio * 100);

  return (
    <View
      style={[styles.wrap, { opacity: disabled ? Math.min(opacity, 0.35) : opacity }]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <Text style={styles.label}>+</Text>
      <View style={styles.track} onLayout={onLayout} {...pan.panHandlers}>
        <View style={[styles.fill, { height: Math.max(THUMB / 2, thumbBottom + THUMB / 2) }]} />
        <View style={[styles.thumb, { bottom: thumbBottom }]} />
      </View>
      <Text style={styles.label}>−</Text>
      <Text style={styles.pct}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -(TRACK_H / 2 + 28),
    alignItems: 'center',
    width: 36,
    zIndex: 20,
  },
  track: {
    width: 10,
    height: TRACK_H,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'visible',
    justifyContent: 'flex-end',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 5,
    backgroundColor: 'rgba(74,144,226,0.75)',
  },
  thumb: {
    position: 'absolute',
    left: -(THUMB - 10) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4a90e2',
  },
  label: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginVertical: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pct: {
    color: '#ddd',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
