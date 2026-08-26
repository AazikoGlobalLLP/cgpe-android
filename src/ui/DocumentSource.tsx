import React, { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n';
import { Txt } from '@/ui/base';
import { Button } from '@/ui/controls';
import { Sheet } from '@/ui/sheet';
import { ALLOWED_UPLOAD_MIME, ALLOWED_UPLOAD_LABEL, MAX_UPLOAD_MB, type PickedFile } from '@/lib/fileUpload';

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

export type PickSource = 'camera' | 'gallery' | 'document';

/** What came back from the OS picker, normalised across the two native modules. */
export type PickOutcome =
  | { kind: 'picked'; file: PickedFile }
  | { kind: 'cancelled' }
  | { kind: 'blocked' };   // the user has denied the permission this source needs

function fromImageAsset(a: ImagePicker.ImagePickerAsset): PickedFile {
  return {
    uri: a.uri,
    name: a.fileName || `document-${Date.now()}.jpg`,
    mimeType: a.mimeType || 'image/jpeg',
    size: a.fileSize,
  };
}

async function pickFromCamera(): Promise<PickOutcome> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { kind: 'blocked' };
  const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
  if (r.canceled || !r.assets?.length) return { kind: 'cancelled' };
  return { kind: 'picked', file: fromImageAsset(r.assets[0]) };
}

async function pickFromGallery(): Promise<PickOutcome> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { kind: 'blocked' };
  const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
  if (r.canceled || !r.assets?.length) return { kind: 'cancelled' };
  return { kind: 'picked', file: fromImageAsset(r.assets[0]) };
}

async function pickDocument(): Promise<PickOutcome> {
  // Constrain the OS document browser to the types the backend accepts — a PDF/Doc/image is
  // selectable, a `.zip` mostly isn't, so a type_rejected round-trip is avoided up front.
  const r = await DocumentPicker.getDocumentAsync({
    type: [...ALLOWED_UPLOAD_MIME],
    copyToCacheDirectory: true,   // so the uri stays readable for the multipart upload
    multiple: false,
  });
  if (r.canceled || !r.assets?.length) return { kind: 'cancelled' };
  const a = r.assets[0];
  return { kind: 'picked', file: { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size } };
}

const RUN: Record<PickSource, () => Promise<PickOutcome>> = {
  camera: pickFromCamera,
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
        <Button label={t('doc.gallery')} icon="images-outline" variant="outline" full onPress={() => choose('gallery')} />
        <Button label={t('doc.file')} icon="document-outline" variant="outline" full onPress={() => choose('document')} />
        <Txt size={c.font.cap} color={c.faint} numberOfLines={2} style={{ textAlign: 'center', lineHeight: 17, marginTop: spacing.xs }}>
          You can attach {ALLOWED_UPLOAD_LABEL}, up to {MAX_UPLOAD_MB} MB.
        </Txt>
      </View>
    </Sheet>
  );
}
