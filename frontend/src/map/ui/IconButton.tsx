import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mapPalette, IoniconName } from '../tokens';
import { webClass } from '../../design/platform';

/**
 * Round glass icon button (map controls, chrome). Frosted on web via
 * `.cm-blur-sm`, translucent dark glass on native; pressed scale feedback.
 */
export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
  color = mapPalette.text,
  dim = false,
}: {
  icon: IoniconName;
  onPress?: () => void;
  /** Accessibility label — always required. */
  label: string;
  size?: number;
  color?: string;
  dim?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        { width: size, height: size },
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.92 },
      ]}
    >
      <View
        {...webClass('cm-tap cm-blur-sm')}
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            backgroundColor: dim ? 'rgba(13,17,23,0.62)' : mapPalette.glass,
          },
        ]}
      >
        <Ionicons name={icon} size={Math.round(size * 0.46)} color={color} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    // soft float shadow — subtle, never harsh
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
