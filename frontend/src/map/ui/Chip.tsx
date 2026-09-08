import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_KEYS, IoniconName, mapPalette } from '../tokens';
import { webClass } from '../../design/platform';

/**
 * Compact layer/filter chip — ember dot + label (+ optional leading icon).
 * Press feedback scales the chip; web hover brightens it via `.cm-tap`.
 */
export function Chip({
  label,
  on = true,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  on?: boolean;
  icon?: IoniconName;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pressable,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
      hitSlop={4}
    >
      <View
        {...webClass('cm-tap')}
        style={[
          styles.chip,
          {
            backgroundColor: on ? mapPalette.chipActive : mapPalette.chipIdle,
            borderColor: on ? mapPalette.chipActiveBorder : mapPalette.chipIdleBorder,
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={13}
            color={on ? mapPalette.on : mapPalette.onDim}
          />
        ) : null}
        <View
          style={[
            styles.dot,
            { backgroundColor: on ? mapPalette.chipActiveBorder : mapPalette.onDim },
          ]}
        />
        <Text style={[styles.label, { color: on ? mapPalette.on : mapPalette.onDim }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 999,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.95,
  },
  label: {
    fontFamily: FONT_KEYS.interMedium,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.1,
  },
});
