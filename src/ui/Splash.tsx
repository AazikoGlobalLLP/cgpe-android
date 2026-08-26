import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, Animated, Platform, Easing } from 'react-native';
import { Image } from 'expo-image';
import { type } from '@/theme/theme';

/**
 * CGPE Connect splash — the JS half of the launch sequence.
 *
 * PHASE 77 — THIS IS THE SECOND OF TWO SPLASHES, AND IT MUST LOOK LIKE THE FIRST ONE.
 *
 * The recorded report is "Splash layout broken, text invisible"
 * (docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md). Three measured causes, all fixed here. None of
 * the numbers below is guesswork — each was read off the real asset or the installed plugin.
 *
 * 1. THE LOGO USED TO JUMP ~50% THE MOMENT THIS SCREEN APPEARED.
 *    The NATIVE splash (app.json → expo-splash-screen, `imageWidth: 190`) is built by
 *    `setSplashImageDrawablesForThemeAsync` in the installed plugin, which fits the logo
 *    `contain`-style into a 190×190 SQUARE and centres it on a 288×288 canvas. `cgpe-logo.png`
 *    is 827×975, so it comes out height-limited: 190 dp tall and 190 × 827/975 = 161 dp wide.
 *    This screen then re-drew the same logo at `min(width * 0.62, 280)` ≈ 242 dp wide and
 *    animated it in from scale 0.9 — so the mark visibly grew and re-announced itself in the
 *    handover. It now renders at exactly the native size and does NOT animate: the logo is
 *    already on screen, and only the rule and the tagline below it are new.
 *
 * 2. THE LOGO HAD TO STAY PUT, NOT JUST STAY THE SAME SIZE. The native splash centres its icon
 *    in the window, and `SplashScreenManager.kt` cross-fades that view out over 400 ms — so for
 *    most of the handover BOTH marks are on screen. Centring a logo-plus-tagline COLUMN would sit
 *    the logo about 27 dp above where the native one is and produce a visible double-image, which
 *    is why the logo below is centred on the SCREEN and the rule and tagline are positioned
 *    beneath it without ever moving it.
 *
 * 3. THE TAGLINE FAILED CONTRAST. It was `c.muted` (#738296) at 13 px on white — a measured
 *    3.92:1, under WCAG AA's 4.5:1 for normal text. It is now the logo's OWN ink at 15 px /
 *    weight 600, which measures 14.42:1. It is deliberately left free to WRAP: at Android's 1.3×
 *    font scale a one-line clamp would ellipsise the brand line, and truncated is no better than
 *    faint.
 *
 * THE PALETTE HERE IS DELIBERATELY FIXED, NOT THEMED. The native splash has no dark variant
 * (`backgroundColor: "#ffffff"`, and no `dark` key), and `cgpe-logo.png` is dark-ink artwork —
 * 70% transparent, and of its opaque pixels ZERO are lighter than 0.75 luminance while 60% are
 * darker than 0.35. On the dark palette's #070c14 the mark turns to mud, which is what this
 * screen used to do in dark mode, on top of a hard white→black flash between the two splashes.
 * So both splashes stay white and the ink stays dark: one identity, no flash, always legible.
 * Every colour below is either the native splash's own background or a value measured from the
 * logo itself — a light-on-dark variant would mean inventing brand colours, which is an owner
 * decision, not ours.
 */

// Web: stable public URL (react-native-web's own Image is flaky in this SDK; expo-image
// renders a real <img>). Native: the bundled asset.
const LOGO_SRC: any = Platform.OS === 'web' ? { uri: '/cgpe-logo.png' } : require('../../assets/images/cgpe-logo.png');

/** app.json → plugins → expo-splash-screen → `imageWidth`. Keep these two in step. */
const NATIVE_IMAGE_WIDTH = 190;
/** `cgpe-logo.png` is 827×975; the native splash fits it into a square, so height wins. */
const LOGO_ASPECT = 827 / 975;
const LOGO_H = NATIVE_IMAGE_WIDTH;
const LOGO_W = Math.round(NATIVE_IMAGE_WIDTH * LOGO_ASPECT);

/** Measured off `assets/images/cgpe-logo.png`: its dominant ink, 14.42:1 on white. */
const INK = '#252357';
/** The logo's own azure — the fingertips in the mark. 5.13:1 on white. */
const AZURE = '#0e72b5';
/** The light palette's `primarySoft`, used as the rule's unfilled track. */
const AZURE_SOFT = '#e7f0fe';
/** The native splash's background, verbatim, so the handover is invisible. */
const CANVAS = '#ffffff';

export function Splash({ onDone }: { onDone?: () => void }) {
  const { width } = useWindowDimensions();
  // Guard against width=0 on the first web paint, and against a phone narrower than the mark.
  const scale = width > 0 ? Math.min(1, (width * 0.72) / LOGO_W) : 1;
  const logoW = Math.round(LOGO_W * scale);
  const logoH = Math.round(LOGO_H * scale);

  const line = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    // The logo is inherited from the native splash and must not move. Only the rule and the
    // tagline arrive, which is what makes this read as a continuation rather than a restart.
    Animated.parallel([
      Animated.timing(line, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(tag, { toValue: 1, duration: 420, delay: 90, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }),
    ]).start();
    const t = setTimeout(() => onDone?.(), 1900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const AText = Animated.Text as any;

  return (
    <View style={[styles.fill, { backgroundColor: CANVAS }]}>
      {/* The logo, and ONLY the logo, is centred on the screen — exactly where the native splash
          puts it. Nothing below may be allowed to push it off that centre. */}
      <View style={{ width: logoW, height: logoH }}>
        <Image source={LOGO_SRC} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={0} />
      </View>

      {/* Hung off the screen's midpoint rather than stacked under the logo, so the logo's position
          is independent of this block's height and the tagline is free to wrap onto a second line
          at large font scales without shifting the mark. */}
      <View
        style={{
          position: 'absolute', top: '50%', marginTop: Math.round(logoH / 2) + 18,
          left: 0, right: 0, alignItems: 'center', paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            height: 3, width: Math.round(logoW * 0.68),
            borderRadius: 2, overflow: 'hidden', backgroundColor: AZURE_SOFT,
          }}
        >
          <Animated.View
            style={{
              height: '100%', backgroundColor: AZURE, borderRadius: 2,
              width: line.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>
        <AText
          style={{
            color: INK, ...type('600', 15), marginTop: 14,
            letterSpacing: 0.3, textAlign: 'center', opacity: tag,
          }}
        >
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
