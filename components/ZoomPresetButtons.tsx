import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const ZOOM_PRESETS = [0.6, 1, 2, 3.2, 4] as const;

type Props = {
  value: number;
  min: number;
  max: number;
  opacity?: number;
  disabled?: boolean;
  onSelect: (preset: number) => void;
};

function formatPreset(v: number): string {
  if (Number.isInteger(v)) return `${v}x`;
  return `${v}x`;
}

export function ZoomPresetButtons({
  value,
  min,
  max,
  opacity = 1,
  disabled = false,
  onSelect,
}: Props) {
  const available = useMemo(
    () => ZOOM_PRESETS.filter((p) => p >= min - 0.05 && p <= max + 0.05),
    [min, max],
  );

  if (available.length === 0) return null;

  const active = available.reduce((best, p) =>
    Math.abs(p - value) < Math.abs(best - value) ? p : best,
  available[0]);

  // Higher zoom at top (4x → 0.6x)
  const ordered = [...available].sort((a, b) => b - a);

  return (
    <View
      style={[styles.wrap, { opacity: disabled ? Math.min(opacity, 0.35) : opacity }]}
      pointerEvents={disabled ? 'none' : 'box-none'}
    >
      {ordered.map((preset) => {
        const isActive = preset === active;
        return (
          <TouchableOpacity
            key={preset}
            style={[styles.btn, isActive && styles.btnActive]}
            onPress={() => onSelect(preset)}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <Text style={[styles.btnText, isActive && styles.btnTextActive]}>
              {formatPreset(preset)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -110,
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  btn: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: 'rgba(74,144,226,0.92)',
    borderColor: '#fff',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  btnTextActive: {
    color: '#fff',
  },
});
