/**
 * Voice mode state: whether the full-screen surface is open, and the male/female persona (persisted).
 * Native-free (storage is web-guarded), so `_layout` can mount it and any screen can `useVoiceMode()`
 * to open voice or read/change the persona.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '@/lib/storage';
import type { Persona } from '@/ui/voice/voiceVisual';

const PERSONA_KEY = 'cgpe.voice.persona';

type VoiceModeCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  persona: Persona;
  setPersona: (p: Persona) => void;
};

const Ctx = createContext<VoiceModeCtx>({
  isOpen: false, open: () => {}, close: () => {}, persona: 'female', setPersona: () => {},
});

export const useVoiceMode = () => useContext(Ctx);

export function VoiceModeProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [persona, setPersonaState] = useState<Persona>('female');

  useEffect(() => {
    let alive = true;
    void storage.get(PERSONA_KEY).then((v) => {
      if (alive && (v === 'male' || v === 'female')) setPersonaState(v);
    });
    return () => { alive = false; };
  }, []);

  const setPersona = useCallback((p: Persona) => {
    setPersonaState(p);
    void storage.set(PERSONA_KEY, p);
  }, []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<VoiceModeCtx>(
    () => ({ isOpen, open, close, persona, setPersona }),
    [isOpen, open, close, persona, setPersona],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
