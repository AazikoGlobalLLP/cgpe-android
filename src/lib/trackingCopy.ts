/** Headless-safe, owner-bound snapshots; ambient and shift wording must never mix. */
export type TrackingNotice = { title: string; body: string };
export type TrackingCopySnapshot = { ownerId: string; ambient?: TrackingNotice; shift?: TrackingNotice };

export function readTrackingCopy(raw: string | null, ownerId: string | null, mode: 'ambient' | 'shift', fallback: TrackingNotice): TrackingNotice {
  if (!raw || !ownerId) return fallback;
  try {
    const saved = JSON.parse(raw) as TrackingCopySnapshot;
    const copy = saved?.ownerId === ownerId ? saved[mode] : undefined;
    return copy && typeof copy.title === 'string' && typeof copy.body === 'string'
      ? { title: copy.title, body: copy.body } : fallback;
  } catch { return fallback; }
}
