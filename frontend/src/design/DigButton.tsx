import React, { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { COLOR, COPY, FONT } from './constants';
import { isWeb, toWebStyle, webPillProps } from './platform';

interface DigButtonProps {
  onPress?: () => void;
}

/**
 * "Start Digging" pill — ember orange, scale feedback on press.
 * Web: rendered as a real <div> so the injected `.cd-dig` CSS can drive
 * hover (scale 1.03 + glow) and active (scale 0.95). Native: quick JS
 * press scale on the Animated.View inside the Pressable.
 */
export default function DigButton({ onPress }: DigButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressTo = (to: number) => {
    Animated.timing(scale, {
      toValue: to,
      duration: to < 1 ? 120 : 160,
      easing: to < 1 ? Easing.out(Easing.cubic) : Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  };

  const text = (
    <Text
      style={[
        styles.label,
        isWeb ? styles.colorInheritWeb : { color: COLOR.white },
      ]}
    >
      {COPY.cta}
    </Text>
  );

  if (isWeb) {
    return (
      <div
        {...webPillProps('cd-click cd-dig')}
        style={{ ...toWebStyle(styles.button), cursor: 'pointer' }}
      >
        {text}
      </div>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => pressTo(0.95)}
      onPressOut={() => pressTo(1)}
    >
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: COLOR.accent },
          { transform: [{ scale }] },
        ]}
      >
        {text}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FONT.interMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  colorInheritWeb: { color: 'inherit' },
});
