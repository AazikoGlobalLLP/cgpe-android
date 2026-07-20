import { Linking, Platform } from 'react-native';

const digits = (phone: string) => phone.replace(/[^\d+]/g, '');

/** Native dialer. */
export function call(phone: string) {
  Linking.openURL(`tel:${digits(phone)}`).catch(() => {});
}

/** Open WhatsApp chat (wa.me) with an optional prefilled message. */
export function whatsapp(phone: string, message?: string) {
  const p = digits(phone).replace('+', '');
  const q = message ? `?text=${encodeURIComponent(message)}` : '';
  const url = `whatsapp://send?phone=${p}${message ? `&text=${encodeURIComponent(message)}` : ''}`;
  const web = `https://wa.me/${p}${q}`;
  Linking.canOpenURL(url).then((ok) => Linking.openURL(ok ? url : web)).catch(() => Linking.openURL(web));
}

/** SMS. */
export function sms(phone: string, body?: string) {
  const sep = Platform.OS === 'ios' ? '&' : '?';
  Linking.openURL(`sms:${digits(phone)}${body ? `${sep}body=${encodeURIComponent(body)}` : ''}`).catch(() => {});
}

/** Compose email. */
export function email(addr: string, subject?: string) {
  Linking.openURL(`mailto:${addr}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`).catch(() => {});
}
