import React, { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n';
import { Txt } from '@/ui/base';
import { Button } from '@/ui/controls';
import { Sheet } from '@/ui/sheet';
import { ALL_UPLOAD_MIME, ALLOWED_UPLOAD_LABEL, MAX_UPLOAD_MB, type PickedFile } from '@/lib/fileUpload';
import { MAX_VIDEO_SECONDS } from '@/lib/videoCompress';

/* ------------------------------------------------------------------ *
 * DocumentSource — the "how do you want to attach it?" sheet.
 *
 * Owner backlog Point 11: the button said "Capture or upload" but there was no upload — the
 * gallery was only reachable by DENYING the camera, and there was no file/PDF path at all.
 * This gives the three real sources up front:
 *
 *   • Take a photo         → camera (expo-image-picker)
 *   • Choose from gallery  → photo library (expo-image-picker)
 *   • Choose a file        → any document (expo-document-picker), constrained to the types
 *                            the server actually accepts so most bad-type picks never happen.
 *
 * This module is the ONE place the native pickers are imported. Kept out of the Vitest graph
 * on purpose (native modules break Node without a stub); the tested decisions — what's too big,
 * what type is allowed, how a failure reads — live in the pure `lib/fileUpload.ts`.
 * ------------------------------------------------------------------ */

export type PickSource = 'camera' | 'video' | 'gallery' | 'document';

/** What came back from the OS picker, normalised across the two native modules. */
export type PickOutcome =
  | { kind: 'picked'; file: PickedFile }
  | { kind: 'cancelled' }
  | { kind: 'blocked' };   // the user has denied the permission this source needs

/**
 * Normalise an image-picker asset. Video and stills come back through the SAME asset shape,
 * so the fallbacks have to branch: defaulting a recorded clip to `document-….jpg` /
 * `image/jpeg` would hand the server an mp4 labelled as a photo, which its `fileFilter`
 * reads as an allowed type and then stores under the wrong extension.
 */
function fromImageAsset(a: ImagePicker.ImagePickerAsset): PickedFile {
  const isVideo = a.type === 'video' || (a.mimeType || '').toLowerCase().startsWith('video/');
  return {
    uri: a.uri,
    name: a.fileName || (isVideo ? `evidence-${Date.now()}.mp4` : `document-${Date.now()}.jpg`),
    mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
    size: a.fileSize,
    // `duration` is milliseconds on the asset, and only present for video.
    durationMs: typeof a.duration === 'number' ? a.duration : undefined,
  };
}

async function pickFromCamera(): Promise<PickOutcome> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { kind: 'blocked' };
  // Unchanged: stills only, so the photo path behaves exactly as it did.
  const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
  if (r.canceled || !r.assets?.length) return { kind: 'cancelled' };
  return { kind: 'picked', file: fromImageAsset(r.assets[0]) };
}

/**
 * Record a clip. A SEPARATE entry point from the photo camera rather than a combined
 * media-type picker, because on Android a combined camera intent makes the user choose
 * between stills and video inside the camera app — an extra step on the path people take
 * every day (photographing a document) to serve the rarer one.
 *
 * `videoMaxDuration` is a REQUEST on Android — the docs say its effect "depends on support
 * of installed camera app" — so it is a hint, not a guarantee, and the compressor sizes its
 * bitrate from the clip's REAL duration for exactly that reason. `videoQuality` is
 * documented iOS-only and does nothing here; it is passed anyway so an iOS build (if one
 * ever happens) records at a sane size instead of 4K.
 */
async function pickVideoFromCamera(): Promise<PickOutcome> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { kind: 'blocked' };
  const r = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: MAX_VIDEO_SECONDS,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  });
  if (r.canceled || !r.assets?.length) return { kind: 'cancelled' };
  return { kind: 'picked', file: fromImageAsset(r.assets[0]) };
}

async function pickFromGallery(): Promise<PickOutcome> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { kind: 'blocked' };
  // Now offers videos as well as images. `quality` still applies to stills only.
  const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ['images', 'videos'] });
  if (r.canceled || !r.assets?.length) return { kind: 'cancelled' };
  return { kind: 'picked', file: fromImageAsset(r.assets[0]) };
}

async function pickDocument(): Promise<PickOutcome> {
  // Constrain the OS document browser to the types the backend accepts — a PDF/Doc/image is
  // selectable, a `.zip` mostly isn't, so a type_rejected round-trip is avoided up front.
  const r = await DocumentPicker.getDocumentAsync({
    type: [...ALL_UPLOAD_MIME],
    copyToCacheDirectory: true,   // so the uri stays readable for the multipart upload
    multiple: false,
  });
  if (r.canceled || !r.assets?.length) return { kind: 'cancelled' };
  const a = r.assets[0];
  return { kind: 'picked', file: { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size } };
}

const RUN: Record<PickSource, () => Promise<PickOutcome>> = {
  camera: pickFromCamera,
  video: pickVideoFromCamera,
  gallery: pickFromGallery,
  document: pickDocument,
};

export function DocumentSourceSheet({ visible, onClose, onResult }: {
  visible: boolean;
  onClose: () => void;
  /** Fires after the OS picker returns. The screen owns what happens next (precheck + upload). */
  onResult: (source: PickSource, out: PickOutcome) => void;
}) {
  const c = useTheme();
  const t = useT();
  const { spacing } = c;
  // Guards against a double-tap launching two OS pickers while the first is presenting.
  const [busy, setBusy] = useState<PickSource | null>(null);

  const choose = async (source: PickSource) => {
    if (busy) return;
    setBusy(source);
    // Dismiss our sheet first: launching the camera/gallery modal ON TOP of an open Modal is
    // flaky on Android. The OS picker presents over the screen; its result comes back here.
    onClose();
    try {
      const out = await RUN[source]();
      onResult(source, out);
    } catch {
      onResult(source, { kind: 'cancelled' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('doc.attachTitle')}
      subtitle={t('doc.attachSubtitle')}
    >
      <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
        <Button label={t('doc.takePhoto')} icon="camera-outline" variant="outline" full onPress={() => choose('camera')} />
        {/* English on purpose. `doc.recordVideo` does NOT exist in the dictionary, and t() falls
            back to the KEY, so calling it would render the literal text "doc.recordVideo" on
            screen. Inventing the Gujarati/Hindi spelling of "video" would be machine translation,
            which is forbidden here (PHASE-19 §4) — so this joins the other not-yet-translated
            strings and is listed in docs/i18n/COPY-REQUEST-2026-08-26.md for the owner. */}
        <Button label="Record a video" icon="videocam-outline" variant="outline" full onPress={() => choose('video')} />
        <Button label={t('doc.gallery')} icon="images-outline" variant="outline" full onPress={() => choose('gallery')} />
        <Button label={t('doc.file')} icon="document-outline" variant="outline" full onPress={() => choose('document')} />
        <Txt size={c.font.cap} color={c.faint} numberOfLines={3} style={{ textAlign: 'center', lineHeight: 17, marginTop: spacing.xs }}>
          You can attach {ALLOWED_UPLOAD_LABEL}, up to {MAX_UPLOAD_MB} MB. Videos are limited to{' '}
          {MAX_VIDEO_SECONDS} seconds and are made smaller on your phone before they are sent.
        </Txt>
      </View>
    </Sheet>
  );
}
