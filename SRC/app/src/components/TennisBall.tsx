import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

export function IconTennisBall({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10.5} fill={colors.primary} />
      <Path
        d="M2.3 7.6C6.2 9.1 8.9 12.4 9.4 21.6"
        stroke={colors.bg}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="M21.7 7.6C17.8 9.1 15.1 12.4 14.6 21.6"
        stroke={colors.bg}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.85}
      />
    </Svg>
  );
}

export function BouncingTennisBall({ size = 30, active = true }: { size?: number; active?: boolean }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      bounce.stopAnimation();
      bounce.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 430, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 430, easing: Easing.in(Easing.quad), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, bounce]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });
  const squashY = bounce.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.82, 1, 1] });
  const shadowScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  const shadowOpacity = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.08] });

  return (
    <View style={{ alignItems: 'center', width: size + 24 }}>
      <Animated.View style={{ transform: [{ translateY }, { scaleY: squashY }] }}>
        <IconTennisBall size={size} />
      </Animated.View>
      <Animated.View
        style={{
          marginTop: 5,
          width: size * 0.75,
          height: size * 0.16,
          borderRadius: 999,
          backgroundColor: colors.text,
          opacity: shadowOpacity,
          transform: [{ scaleX: shadowScale }]
        }}
      />
    </View>
  );
}
