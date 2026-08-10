/**
 * @/ui/kit — the design system barrel.
 *
 * This file used to BE the design system: one 340-line module holding 22 components. It is
 * now a re-export surface over the split modules below.
 *
 * WHY IT STILL EXISTS: 81 import sites across 39 screens say `from '@/ui/kit'`. Keeping the
 * barrel means the split cost zero churn in screen code, and Phase 4 can migrate screens to
 * the specific modules as it rewrites them rather than in one risky sweep.
 *
 * WHERE THINGS LIVE NOW:
 *   ./base       Grad · Screen · Header · SectionHeader · Card · GlassCard · Row · Txt
 *                + Metric · Eyebrow · IconName · noOutline
 *   ./controls   Button · IconBtn · Fab · Chips · SearchBar · Field + Segmented · Stepper
 *   ./feedback   Loader · EmptyState · ProgressBar + Skeleton · Banner · Toast · Meter
 *   ./data       Pill · StatCard · ActionTile + MetricTile · Sparkline · DataRow ·
 *                ListSection · KpiStrip
 *   ./identity   Avatar · AvatarStack + PersonRow
 *   ./spine      Spine · SpineRow — the date-spine signature
 *   ./sheet      Sheet · FilterSheet
 *   ./swipe      SwipeRow
 *
 * NEW CODE SHOULD IMPORT THE MODULE DIRECTLY (`from '@/ui/data'`). Reach for the barrel only
 * when touching a screen that already uses it: a barrel pulls every module into the bundle
 * graph to get one component, which is an acceptable trade for 39 existing screens and the
 * wrong default for the 20+ screens Phases 5-6 add.
 *
 * Two behavioural changes ride in with this swap, both deliberate — see the module headers:
 *   · Button 'primary' and Fab are now SOLID azure, not gradient. The brand gradient is
 *     rationed to the clock-in ring and the active tab indicator.
 *   · Txt's `weight` is narrowed to the six bundled Geist cuts. It was
 *     TextStyle['fontWeight'], which admits weights that have no bundled face and silently
 *     render as regular on Android.
 *
 * Verified free of export-name collisions, so `export *` is unambiguous.
 */

export * from './base';
export * from './controls';
export * from './feedback';
export * from './data';
export * from './identity';
export * from './spine';
export * from './sheet';
export * from './swipe';
