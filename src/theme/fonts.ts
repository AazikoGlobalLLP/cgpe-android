import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Geist_900Black,
} from '@expo-google-fonts/geist';

/**
 * Geist — the admin panel's typeface, bundled here as static TTF cuts.
 *
 * Six weights only. The panel loads a variable font over HTTP and can afford the full
 * 100-900 range; an APK pays for every cut on disk, and the kit uses exactly these six.
 * Italics are not loaded — nothing in the UI sets them, and they would add ~9 more files.
 *
 * The map keys MUST match `FAMILY` in ./theme.tsx — that map is what every text style
 * resolves through.
 */
export const APP_FONTS = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Geist_900Black,
};

/**
 * Returns true once the faces are on disk and usable.
 *
 * Callers must not block the UI forever on this: if a cut fails to decode, `type()`
 * still emits a `fontWeight`, so text degrades to the system face at roughly the right
 * weight rather than disappearing. See the boot gate in `src/app/_layout.tsx`.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(APP_FONTS);
  return loaded || !!error;
}
