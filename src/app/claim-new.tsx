import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Header, KeyboardScroll, Row, Screen, Txt } from '@/ui/base';
import { Button, Chips, Field, IconBtn, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { DataRow, ListSection } from '@/ui/data';
import { Avatar, PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { DocumentSourceSheet, type PickSource, type PickOutcome } from '@/ui/DocumentSource';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { precheckUpload, describeUploadFailure, resolveMime, type UploadFailure } from '@/lib/fileUpload';

import * as api from '@/data/api';
import type { Claim, ClaimDoc, Client } from '@/data/types';
import { inr } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * New claim — the app's second data-entry screen, and the higher-stakes one.
 *
 * A claim cannot be filed against a name typed from memory: the backend needs a real
 * client_id out of the book, so the client is PICKED, never typed. That single constraint
 * shapes the screen:
 *
 *   1. THE PICKER IS A SHEET WITH FACES IN IT. Search runs server-side across the whole
 *      book (9,000 rows), debounced, and shows real people with their real numbers. It has
 *      the same three states as any async surface: skeleton rows, results, honest empty.
 *   2. THE SUBMIT NEVER HIDES BEHIND THE KEYBOARD. `<Screen keyboard>` plus a footer bar
 *      outside the scroller, so the commit is on screen at every scroll position. The form
 *      itself rides in a `<KeyboardScroll>`, which is the other half of the pair: the
 *      shrinking container keeps the footer up, the scroller keeps the FOCUSED FIELD up.
 *      This form is long enough that the amount and the notes both sit below the fold, which
 *      is exactly where the naive version hides what you are typing. iOS scrolls by the
 *      keyboard inset, Android by the resized window.
 *   3. REJECTIONS ARRIVE ATTACHED TO WHAT CAUSED THEM. A missing amount is an inline error
 *      under the amount field; a refusal from the server is a Banner naming the role that
 *      is missing. Neither is a modal that has to be dismissed before the form can be
 *      corrected.
 *   4. DOCUMENTS ARE CAPTURED HERE, NOT LATER. Half of a claim's delay is paperwork that
 *      was never collected at the first conversation, so the camera is on this screen.
 *      Each capture is a REAL upload; nothing is listed as uploaded unless the server took
 *      it, and a failure raises a Banner rather than a checkmark that means nothing.
 *
 * WHAT THE ENDPOINT ACTUALLY STORES. POST /claims/ accepts client_id, claim_amount,
 * claim_type, policy_number and notes. It has no field for the insurer and no way to link
 * an uploaded file to a claim, so both are folded into the notes on submit rather than
 * being collected into a control that quietly discards them. The screen says so under the
 * two fields concerned, because a form that drops what you typed is the same class of lie
 * as a fabricated record.
 * ------------------------------------------------------------------ */

const TYPES: { key: Claim['type']; label: string }[] = [
  { key: 'Health', label: 'Health' },
  { key: 'Death', label: 'Death' },
  { key: 'Maturity', label: 'Maturity' },
  { key: 'Surrender', label: 'Surrender' },
  { key: 'Accident', label: 'Accident' },
];

const MIN_QUERY = 2;

/** Label above, control, caption below. Matches Field's own label metrics exactly. */
function Group({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Txt size={font.sub} weight="700" color={error ? c.danger : c.muted} numberOfLines={1}>{label}</Txt>
      {children}
      {error ? (
        <Txt size={font.cap} weight="500" color={c.danger} numberOfLines={2}>{error}</Txt>
      ) : hint ? (
        <Txt size={font.cap} color={c.faint} numberOfLines={2}>{hint}</Txt>
      ) : null}
    </View>
  );
}

/** A client's first real policy number, or '' when the book has none on record. */
function firstPolicy(cl: Client): string {
  const n = cl.policies[0]?.number;
  return n && n !== '—' ? n : '';
}

export default function ClaimNew() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const toast = useToast();
  const health = useDataHealth();

  // The picker is deliberately TALL and fixed rather than content-sized. A sheet is
  // bottom-anchored, so a short one sits entirely under the keyboard the search bar just
  // raised; a tall one keeps the field and the first few faces above it, and its height
  // does not jump every time a result set lands. Sheet clamps this to the usable area.
  const pickerHeight = Math.round(win.height * 0.82);

  /* client picker */
  const [picked, setPicked] = useState<Client | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState('');
  // PHASE 75 (C1 twin): focus the picker search on the modal's `onShown` — `autoFocus` fires
  // before the Sheet's modal attaches on Android, so the soft keyboard never rises. See `Sheet.onShown`.
  const pickerSearchRef = useRef<TextInput>(null);
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [clientError, setClientError] = useState('');

  /* claim */
  const [type, setType] = useState<Claim['type']>('Health');
  const [policy, setPolicy] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [insurer, setInsurer] = useState('LIC of India');
  const [notes, setNotes] = useState('');
  const [docs, setDocs] = useState<ClaimDoc[]>([]);

  const [uploading, setUploading] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  /* The camera, the upload and the POST all outlive a back-press, so every handler below
   * re-checks this before it touches state. The debounced search does not need it: its
   * effect owns a per-run `live` flag that the cleanup flips. */
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Debounced, server-side search over the whole book. Only runs while the sheet is open,
  // so closing it cannot leave a request racing against a picked client.
  useEffect(() => {
    const term = q.trim();
    if (!pickerOpen || term.length < MIN_QUERY) { setResults([]); setSearching(false); return; }
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const page = await api
        .getClientsPage(1, term)
        .catch(() => ({ items: [] as Client[], hasMore: false, total: 0 }));
      if (!live) return;
      setResults(page.items.slice(0, 12));
      setSearching(false);
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [q, pickerOpen]);

  const openPicker = () => { setQ(''); setResults([]); setPickerOpen(true); };

  const pick = (cl: Client) => {
    haptics.select();
    setPicked(cl);
    setPolicy(firstPolicy(cl));
    setClientError('');
    setResults([]);
    setQ('');
    setPickerOpen(false);
  };

  const chooseType = (v: Claim['type']) => {
    if (v === type) return;
    haptics.select();
    setType(v);
  };

  const onAmount = (v: string) => {
    setAmount(v);
    if (amountError) setAmountError('');
  };

  /* ---------- documents ---------- */

  // Raise the named failure attached to what caused it: a bad file type is a warning about the
  // pick, a dead socket is a danger about the transport. `describeUploadFailure` owns the copy.
  const showUploadFailure = (reason: UploadFailure) => {
    const d = describeUploadFailure(reason);
    if (d.tone === 'danger') haptics.error(); else haptics.warn();
    setNotice(d);
  };

  // POINT 11: the "Capture a document" button now opens a source sheet (photo / gallery / file).
  // This handler runs AFTER the OS picker returns and owns precheck → upload → honest result.
  const onPicked = async (source: PickSource, out: PickOutcome) => {
    if (!mounted.current) return;
    if (out.kind === 'cancelled') return;
    if (out.kind === 'blocked') {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: source === 'camera' ? 'Camera access is off' : 'Photo access is off',
        message: source === 'camera'
          ? 'Allow camera access in your device settings, or choose a file or a photo from your gallery instead.'
          : 'Allow photo access in your device settings, or take a photo or choose a file instead.',
      });
      return;
    }

    const file = out.file;
    // Catch the two commonest mistakes (too big / wrong type) before wasting an upload — the
    // reason is precise because the check uses the server's own limits.
    const pre = precheckUpload(file);
    if (pre) { showUploadFailure(pre); return; }

    setUploading(true);
    const up = await api.uploadFile(file.uri, file.name, resolveMime(file) || 'application/octet-stream');
    if (!mounted.current) return;
    setUploading(false);

    if (!up.ok) { showUploadFailure(up.reason); return; }
    // Reached the server but landed on throwaway disk (cloud storage not configured): it will be
    // wiped on the next redeploy, so it is NOT listed as an attached document — say so instead.
    if (up.ephemeral) { showUploadFailure('not_stored'); return; }

    haptics.success();
    setDocs((prev) => [...prev, { id: `d${Date.now()}`, name: file.name, received: true }]);
    setNotice(null);
  };

  const removeDoc = (docId: string) => {
    haptics.tap();
    setDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  /* ---------- submit ---------- */

  const amountValue = Number(amount.replace(/[^\d.]/g, ''));
  const amountValid = Number.isFinite(amountValue) && amountValue > 0;

  const save = async () => {
    if (!picked) {
      haptics.warn();
      setClientError('Choose the client this claim belongs to. A claim cannot be filed without a record from the book.');
      setPickerOpen(true);
      return;
    }
    if (!amountValid) {
      haptics.warn();
      setAmountError('Enter the amount being claimed, in rupees.');
      return;
    }

    setClientError('');
    setAmountError('');
    setNotice(null);
    setSaving(true);

    /* POST /claims/ takes client_id, claim_amount, claim_type, policy_number and notes,
     * and nothing else. The insurer and the uploaded file names would therefore be
     * silently dropped, and the detail screen would re-read the claim from the register
     * and show different values from the ones just typed. Folding them into `notes` is
     * what makes those two fields actually persist: the claims desk reads them on the
     * record instead of them evaporating between this screen and the next one. */
    const extras: string[] = [];
    const namedInsurer = insurer.trim();
    if (namedInsurer) extras.push(`Insurer or TPA: ${namedInsurer}`);
    if (docs.length > 0) extras.push(`Documents uploaded: ${docs.map((d) => d.name).join(', ')}`);
    const noteText = [notes.trim(), ...extras].filter(Boolean).join('\n');

    const created = await api.addClaim({
      clientId: picked.id,
      clientName: picked.name,
      clientPhone: picked.phone,
      type,
      policyNumber: policy.trim(),
      amount: amountValue,
      insurer: namedInsurer,
      notes: noteText,
      docs,
    });
    if (!mounted.current) return;
    setSaving(false);

    if (created.forbidden) {
      // A refusal is a normal, explainable condition, not an error dialog.
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'This account cannot register claims',
        message: 'Filing a claim needs an admin or super admin role. Ask your branch admin to raise it, or ask them to register this claim for you.',
      });
      return;
    }

    if (created.error) {
      haptics.error();
      setNotice({
        tone: 'danger',
        title: 'The claim was not created',
        message: created.error,
      });
      return;
    }

    // Without a real session `addClaim` keeps the record in the in-process buffer and
    // returns it looking exactly like a created one. That is not a 201, so it does not get
    // the success haptic or the confirmation copy.
    if (!api.isRealSession()) {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'The claim was not filed',
        message: 'This session is not signed in to the register, so what you typed is only held on this handset. Sign in again and register it.',
      });
      return;
    }

    haptics.success();
    toast(`Claim registered for ${picked.name}.`, 'success');

    // A 201 that carries no usable id (the endpoint can answer `{ success: true }` alone)
    // would push to /claim/undefined and land on "Claim not found" right after a success
    // message. Fall back to the register, which reloads on focus.
    const newId = created.id && created.id !== 'undefined' ? created.id : '';
    if (newId) router.replace(`/claim/${newId}`);
    else router.back();
  };

  const term = q.trim();

  return (
    <Screen keyboard>
      <Header title="New claim" back subtitle="File against a client already in the book" />

      <KeyboardScroll
        contentStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xl }}
        bottomPad={spacing.xxl}
      >
        {notice ? (
          <Banner
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {/* WHO. An open set of real people, so it opens a sheet with faces in it. */}
        <Appear>
          <Group
            label="Client"
            error={clientError}
            hint={picked ? 'Tap to pick a different client.' : 'Required. Search your book by name, policy number or mobile.'}
          >
            <Pressable
              onPress={openPicker}
              accessibilityRole="button"
              accessibilityLabel={picked ? `Client, currently ${picked.name}. Tap to change` : 'Choose a client'}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                minHeight: 58, paddingHorizontal: 13, paddingVertical: spacing.sm,
                backgroundColor: pressed ? c.cardAlt : c.card,
                borderWidth: 1,
                borderColor: clientError ? c.danger : c.border,
                borderRadius: radius.md,
              }]}
            >
              {picked ? <Avatar name={picked.name} size={40} /> : (
                <View style={{
                  width: 40, height: 40, borderRadius: 40 / 2.6, backgroundColor: c.cardAlt,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="person-add-outline" size={19} color={c.faint} />
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={font.body} weight="700" color={picked ? c.text : c.faint} numberOfLines={1}>
                  {picked ? picked.name : 'Search your client book'}
                </Txt>
                {picked ? (
                  <Txt size={font.sub} color={c.muted} numeric numberOfLines={1}>
                    {[picked.phone || 'No number on file', firstPolicy(picked)].filter(Boolean).join(' · ')}
                  </Txt>
                ) : null}
              </View>
              <Ionicons name={picked ? 'chevron-down' : 'search-outline'} size={18} color={c.faint} />
            </Pressable>
          </Group>
        </Appear>

        {/* WHAT KIND. A closed set, so it is a chip rail rather than a text field. */}
        <Appear index={1}>
          <Group label="Claim type">
            <Chips options={TYPES} value={type} onChange={chooseType} />
          </Group>
        </Appear>

        <Appear index={2}>
          <View style={{ gap: spacing.xl }}>
            <Field
              label="Policy number"
              value={policy}
              onChange={setPolicy}
              placeholder="Policy the claim is filed against"
              icon="document-text-outline"
              hint={picked && !firstPolicy(picked)
                ? 'No policy number is on record for this client. Type the one on the bond.'
                : 'Prefilled from the book when a number is on record.'}
            />
            <Field
              label="Claim amount"
              value={amount}
              onChange={onAmount}
              placeholder="500000"
              keyboardType="numeric"
              icon="cash-outline"
              error={amountError}
              hint={amountValid ? `${inr(amountValue)} claimed` : 'Required. Rupees, digits only.'}
            />
            <Field
              label="Insurer or TPA"
              value={insurer}
              onChange={setInsurer}
              placeholder="LIC of India"
              icon="business-outline"
              hint="The register has no insurer field on a new claim, so this is written into the notes."
            />
            <Field
              label="Notes"
              value={notes}
              onChange={setNotes}
              placeholder="Anything the claims desk should know before they open this"
              multiline
            />
          </View>
        </Appear>

        {/* PAPERWORK, collected now rather than chased later. */}
        <Appear index={3}>
          <Group
            label="Documents"
            hint={docs.length === 0
              ? 'Optional. Take a photo, pick one from your gallery, or choose a file — it uploads as soon as you pick it.'
              : `${docs.length} file${docs.length === 1 ? '' : 's'} on the server. The register cannot link a file to a claim yet, so the names go into the notes.`}
          >
            <View style={{ gap: spacing.md }}>
              {docs.length > 0 ? (
                <ListSection>
                  {docs.map((d, i) => (
                    <Appear key={d.id} index={i} distance={6}>
                      <DataRow
                        icon="document-attach-outline"
                        label={d.name}
                        value="Uploaded"
                        tone="success"
                        right={
                          <IconBtn
                            icon="close"
                            size={32}
                            bg={c.cardAlt}
                            color={c.muted}
                            accessibilityLabel={`Do not mention ${d.name} in the claim notes`}
                            onPress={() => removeDoc(d.id)}
                          />
                        }
                      />
                    </Appear>
                  ))}
                </ListSection>
              ) : null}

              <Button
                label={uploading ? 'Uploading' : 'Capture or upload a document'}
                icon="camera"
                variant="outline"
                full
                loading={uploading}
                onPress={() => setSourceOpen(true)}
              />
            </View>
          </Group>
        </Appear>
      </KeyboardScroll>

      {/* The commit, above the keyboard, at every scroll position. Outside the scroller on
          purpose: iOS lifts it with the Screen's KeyboardAvoidingView, Android with the
          resized window, so it is reachable without dismissing the keyboard first. */}
      <View style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        backgroundColor: c.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.hairline,
      }}>
        <Button label="Register claim" icon="checkmark" onPress={save} loading={saving} size="lg" full />
      </View>

      {/* ---------- document source (photo / gallery / file) ---------- */}
      <DocumentSourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onResult={onPicked}
      />

      {/* ---------- client picker ---------- */}
      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onShown={() => pickerSearchRef.current?.focus()}
        title="Choose a client"
        subtitle="Search runs across your whole book"
        height={pickerHeight}
      >
        <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
          <SearchBar
            ref={pickerSearchRef}
            value={q}
            onChange={setQ}
            placeholder="Name, policy number or mobile"
          />

          {searching ? (
            <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
              {[0, 1, 2, 3].map((i) => (
                <Row key={i} style={{ gap: spacing.md }}>
                  <Skeleton width={44} height={44} radius={44 / 2.6} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <Skeleton width="56%" height={12} />
                    <Skeleton width="38%" height={10} />
                  </View>
                </Row>
              ))}
            </View>
          ) : results.length > 0 ? (
            <View>
              {results.map((cl, i) => (
                <PersonRow
                  key={cl.id}
                  name={cl.name}
                  subtitle={[cl.phone || 'No number on file', firstPolicy(cl)].filter(Boolean).join(' · ')}
                  subtitleIcon={cl.phone ? 'call-outline' : 'alert-circle-outline'}
                  subtitleNumeric
                  chevron
                  onPress={() => pick(cl)}
                  style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline } : undefined}
                />
              ))}
            </View>
          ) : term.length >= MIN_QUERY ? (
            <EmptyState
              icon={health.degraded ? 'cloud-offline-outline' : 'search-outline'}
              title={health.degraded ? 'The book did not load' : `No client matches "${term}"`}
              subtitle={health.degraded
                ? 'The server could not be reached, so this is not a confirmed empty result. Try the search again in a moment.'
                : 'Search covers the whole book by name, policy number and mobile number. Check the spelling, or try the policy number.'}
              action={{ label: 'Clear search', onPress: () => setQ('') }}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="Search your client book"
              subtitle="Type at least two letters of a name, or the start of a policy or mobile number."
            />
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
