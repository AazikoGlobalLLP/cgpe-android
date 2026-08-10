import React, { createContext, useContext, useRef, useState } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';

/**
 * Cross-platform confirm + action-sheet. React Native Web's Alert.alert does NOT
 * fire button callbacks, which is why Sign Out / Delete did nothing in the browser.
 * This renders a real Modal that works everywhere.
 */

type ConfirmOpts = { title: string; message?: string; confirmText?: string; cancelText?: string; destructive?: boolean; icon?: any };
type ChooseOption<T> = { label: string; value: T; destructive?: boolean; icon?: any };

type Ctx = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  choose: <T,>(title: string, options: ChooseOption<T>[]) => Promise<T | null>;
  toast: (message: string) => void;
};

const ConfirmContext = createContext<Ctx>({} as Ctx);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  // React 19 requires an explicit initial value; the ref legitimately starts empty and is
  // cleared back to undefined in `finish`, so the type has to admit it.
  const resolver = useRef<((v: any) => void) | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const confirm = (opts: ConfirmOpts) =>
    new Promise<boolean>((res) => { resolver.current = res as any; setState({ kind: 'confirm', ...opts }); });
  const choose = <T,>(title: string, options: ChooseOption<T>[]) =>
    new Promise<T | null>((res) => { resolver.current = res as any; setState({ kind: 'choose', title, options }); });
  const toast = (message: string) => {
    setToastMsg(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  };
  const finish = (val: any) => { setState(null); const r = resolver.current; resolver.current = undefined; r?.(val); };

  return (
    <ConfirmContext.Provider value={{ confirm, choose, toast }}>
      {children}

      <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => finish(state?.kind === 'confirm' ? false : null)}>
        <Pressable onPress={() => finish(state?.kind === 'confirm' ? false : null)} style={{ flex: 1, backgroundColor: c.overlay, justifyContent: state?.kind === 'choose' ? 'flex-end' : 'center', padding: state?.kind === 'choose' ? 0 : spacing.xl }}>
          {state?.kind === 'confirm' && (
            <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: c.card, borderRadius: radius.xl, padding: spacing.xl, ...shadow(c, 2) }}>
              {state.icon && (
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: (state.destructive ? c.danger : c.primary) + '1f', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Ionicons name={state.icon} size={26} color={state.destructive ? c.danger : c.primary} />
                </View>
              )}
              <Text style={{ color: c.text, fontSize: 19, fontFamily: 'Geist_800ExtraBold', fontWeight: '800' }}>{state.title}</Text>
              {state.message ? <Text style={{ color: c.muted, fontSize: 14, marginTop: 8, lineHeight: 20 }}>{state.message}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
                <Pressable onPress={() => finish(false)} style={{ flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: c.text, fontFamily: 'Geist_700Bold', fontWeight: '700', fontSize: 15 }}>{state.cancelText || 'Cancel'}</Text>
                </Pressable>
                <Pressable onPress={() => finish(true)} style={{ flex: 1, height: 48, borderRadius: radius.md, backgroundColor: state.destructive ? c.danger : c.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontFamily: 'Geist_800ExtraBold', fontWeight: '800', fontSize: 15 }}>{state.confirmText || 'Confirm'}</Text>
                </Pressable>
              </View>
            </Pressable>
          )}

          {state?.kind === 'choose' && (
            <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + 12, paddingTop: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginVertical: 8 }} />
              <Text style={{ color: c.muted, fontSize: 13, fontFamily: 'Geist_700Bold', fontWeight: '700', textAlign: 'center', paddingVertical: 10 }}>{state.title}</Text>
              {state.options.map((o: any, i: number) => (
                <Pressable key={i} onPress={() => finish(o.value)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.xl, paddingVertical: 16, borderTopWidth: 1, borderTopColor: c.hairline, opacity: pressed ? 0.6 : 1 }]}>
                  {o.icon && <Ionicons name={o.icon} size={20} color={o.destructive ? c.danger : c.primary} />}
                  <Text style={{ color: o.destructive ? c.danger : c.text, fontSize: 16, fontFamily: 'Geist_600SemiBold', fontWeight: '600' }}>{o.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => finish(null)} style={{ paddingVertical: 16, marginTop: 6, marginHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.cardAlt, alignItems: 'center' }}>
                <Text style={{ color: c.muted, fontFamily: 'Geist_700Bold', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {toastMsg && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 90, alignItems: 'center', paddingHorizontal: spacing.lg }}>
          {/* Inverted surface: c.text/c.bg swap with the scheme, so the toast always contrasts. */}
          <View style={{ backgroundColor: c.text, paddingHorizontal: 18, paddingVertical: 13, borderRadius: radius.pill, maxWidth: '92%', ...shadow(c, 2) }}>
            <Text style={{ color: c.bg, fontSize: 13.5, fontFamily: 'Geist_600SemiBold', fontWeight: '600', textAlign: 'center' }}>{toastMsg}</Text>
          </View>
        </View>
      )}
    </ConfirmContext.Provider>
  );
}
