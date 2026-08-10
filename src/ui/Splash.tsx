import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, useColorScheme, useWindowDimensions, Animated, Platform, Easing } from 'react-native';
import { Image } from 'expo-image';
import { type, useTheme } from '@/theme/theme';

/** CGPE Connect splash — the real C.G.P.E LLP logo with a soft fade/scale reveal. */
// Web: stable public URL (react-native-web's own Image is flaky in this SDK; expo-image
// renders a real <img>). Native: the bundled asset.
const LOGO_SRC: any = Platform.OS === 'web' ? { uri: '/cgpe-logo.png' } : require('../../assets/images/cgpe-logo.png');

export function Splash({ onDone }: { onDone?: () => void }) {
  const c = useTheme();
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const size = Math.min((width || 390) * 0.62, 280); // guard against width=0 on first web paint

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const line = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }),
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: useNative }),
      ]),
      Animated.parallel([
        Animated.timing(line, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(tag, { toValue: 1, duration: 380, useNativeDriver: useNative }),
      ]),
    ]).start();
    const t = setTimeout(() => onDone?.(), 1900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const AText = Animated.Text as any;

  return (
    <View style={[styles.fill, { backgroundColor: dark ? c.bg : '#ffffff' }]}>
      <View style={{ alignItems: 'center' }}>
        <Animated.View style={{ alignItems: 'center', opacity: fade, transform: [{ scale }] }}>
          <View style={{ width: size, height: Math.round(size * 1.16) }}>
            <Image source={LOGO_SRC} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={0} />
          </View>
        </Animated.View>
        {/* Azure, not the logo's leaf-green: the logo's own fingertips are this blue, and it
            is the panel's primary — so chrome tracks the brand while the mark keeps its green. */}
        <View style={{ height: 3, width: size * 0.56, marginTop: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: c.primarySoft }}>
          <Animated.View style={{ height: '100%', backgroundColor: c.primary, borderRadius: 2, width: line.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
        </View>
        <AText style={{ color: c.muted, ...type('500', 13), marginTop: 16, letterSpacing: 0.4, opacity: tag }}>
          Khushiyo Ka Financial Planner
        </AText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Written out rather than spreading StyleSheet.absoluteFillObject, which RN 0.86 dropped
  // from the public types (absoluteFill is a registered style ID and cannot be spread).
  fill: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
});
