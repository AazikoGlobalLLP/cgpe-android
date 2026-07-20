import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '@/lib/storage';

/** Language support — English / Gujarati / Hindi. t(key) falls back to English then the key. */
export type Lang = 'en' | 'gu' | 'hi';
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

const en: Record<string, string> = {
  'tab.home': 'Today', 'tab.leads': 'Leads', 'tab.clients': 'Clients', 'tab.claims': 'Claims', 'tab.more': 'More',
  'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening',
  'home.commission': "This month's commission", 'home.vsLast': 'vs last month', 'home.target': 'Monthly target',
  'home.markAttendance': 'Mark attendance', 'home.gpsCheckin': 'GPS check-in for the day',
  'home.clockedIn': 'Clocked in', 'home.clockIn': 'Clock in', 'home.clockOut': 'Clock out',
  'home.hotLeads': 'Hot leads', 'home.openClaims': 'Open claims', 'home.renewals': 'Renewals',
  'home.quickActions': 'Quick actions', 'home.followups': "Today's follow-ups", 'home.quickContacts': 'Quick contacts',
  'home.allCaught': 'All caught up!', 'home.noFollowups': 'No pending follow-ups right now.',
  'act.newLead': 'New lead', 'act.newClaim': 'New claim', 'act.whatsapp': 'WhatsApp', 'act.licPlans': 'LIC plans',
  'act.calendar': 'Calendar', 'act.contests': 'Contests', 'act.premiumDue': 'Premium due', 'act.birthdays': 'Birthdays',
  'common.signIn': 'Sign in', 'common.signOut': 'Sign out', 'common.cancel': 'Cancel', 'common.send': 'Send',
  'common.call': 'Call', 'common.whatsapp': 'WhatsApp', 'common.seeAll': 'See all', 'common.search': 'Search',
  'common.pipeline': 'Pipeline', 'common.delete': 'Delete', 'common.save': 'Save',
  'premium.title': 'Premium & Greetings', 'premium.dueThisMonth': 'Premium due this month', 'premium.birthdaysThisMonth': 'Birthdays this month',
  'premium.sendReminder': 'Send reminder', 'premium.sendAll': 'Send to all', 'premium.oneClick': 'One tap sends a personalised WhatsApp to every matching client.',
  'premium.renewalDue': 'Renewal due', 'premium.maturitySoon': 'Maturity soon', 'premium.anniversaries': 'Anniversaries',
  'report.generate': 'Generate client report', 'report.generating': 'Generating report…', 'report.title': 'Client report',
  'signout.title': 'Sign out?', 'signout.msg': 'Are you sure you want to sign out of CGPE Connect?',
  'settings.language': 'App language', 'settings.title': 'Settings',
};

const gu: Record<string, string> = {
  'tab.home': 'આજે', 'tab.leads': 'લીડ્સ', 'tab.clients': 'ગ્રાહકો', 'tab.claims': 'ક્લેમ', 'tab.more': 'વધુ',
  'greet.morning': 'સુપ્રભાત', 'greet.afternoon': 'શુભ બપોર', 'greet.evening': 'શુભ સાંજ',
  'home.commission': 'આ મહિનાનું કમિશન', 'home.vsLast': 'ગયા મહિના કરતાં', 'home.target': 'માસિક લક્ષ્ય',
  'home.markAttendance': 'હાજરી નોંધો', 'home.gpsCheckin': 'આજની GPS હાજરી',
  'home.clockedIn': 'હાજરી નોંધાઈ', 'home.clockIn': 'હાજરી', 'home.clockOut': 'ક્લોક આઉટ',
  'home.hotLeads': 'હોટ લીડ્સ', 'home.openClaims': 'ખુલ્લા ક્લેમ', 'home.renewals': 'રિન્યુઅલ',
  'home.quickActions': 'ઝડપી ક્રિયાઓ', 'home.followups': 'આજના ફોલો-અપ', 'home.quickContacts': 'ઝડપી સંપર્કો',
  'home.allCaught': 'બધું પૂર્ણ!', 'home.noFollowups': 'હાલ કોઈ ફોલો-અપ બાકી નથી.',
  'act.newLead': 'નવી લીડ', 'act.newClaim': 'નવો ક્લેમ', 'act.whatsapp': 'વોટ્સએપ', 'act.licPlans': 'LIC પ્લાન',
  'act.calendar': 'કેલેન્ડર', 'act.contests': 'સ્પર્ધાઓ', 'act.premiumDue': 'પ્રીમિયમ બાકી', 'act.birthdays': 'જન્મદિવસ',
  'common.signIn': 'સાઇન ઇન', 'common.signOut': 'સાઇન આઉટ', 'common.cancel': 'રદ કરો', 'common.send': 'મોકલો',
  'common.call': 'કૉલ', 'common.whatsapp': 'વોટ્સએપ', 'common.seeAll': 'બધું જુઓ', 'common.search': 'શોધો',
  'common.pipeline': 'પાઇપલાઇન', 'common.delete': 'ડિલીટ', 'common.save': 'સાચવો',
  'premium.title': 'પ્રીમિયમ અને શુભેચ્છા', 'premium.dueThisMonth': 'આ મહિને પ્રીમિયમ બાકી', 'premium.birthdaysThisMonth': 'આ મહિનાના જન્મદિવસ',
  'premium.sendReminder': 'રિમાઇન્ડર મોકલો', 'premium.sendAll': 'બધાને મોકલો', 'premium.oneClick': 'એક ટેપથી દરેક ગ્રાહકને વ્યક્તિગત વોટ્સએપ સંદેશ જાય છે.',
  'premium.renewalDue': 'રિન્યુઅલ બાકી', 'premium.maturitySoon': 'મેચ્યોરિટી નજીક', 'premium.anniversaries': 'એનિવર્સરી',
  'report.generate': 'ગ્રાહક રિપોર્ટ બનાવો', 'report.generating': 'રિપોર્ટ બની રહી છે…', 'report.title': 'ગ્રાહક રિપોર્ટ',
  'signout.title': 'સાઇન આઉટ કરવું?', 'signout.msg': 'શું તમે ખરેખર CGPE Connect માંથી સાઇન આઉટ કરવા માંગો છો?',
  'settings.language': 'એપ ભાષા', 'settings.title': 'સેટિંગ્સ',
};

const hi: Record<string, string> = {
  'tab.home': 'आज', 'tab.leads': 'लीड्स', 'tab.clients': 'ग्राहक', 'tab.claims': 'क्लेम', 'tab.more': 'और',
  'greet.morning': 'सुप्रभात', 'greet.afternoon': 'शुभ दोपहर', 'greet.evening': 'शुभ संध्या',
  'home.commission': 'इस महीने का कमीशन', 'home.vsLast': 'पिछले महीने से', 'home.target': 'मासिक लक्ष्य',
  'home.markAttendance': 'हाज़िरी दर्ज करें', 'home.gpsCheckin': 'आज की GPS हाज़िरी',
  'home.clockedIn': 'हाज़िरी दर्ज', 'home.clockIn': 'हाज़िरी', 'home.clockOut': 'क्लॉक आउट',
  'home.hotLeads': 'हॉट लीड्स', 'home.openClaims': 'खुले क्लेम', 'home.renewals': 'रिन्यूअल',
  'home.quickActions': 'त्वरित क्रियाएँ', 'home.followups': 'आज के फ़ॉलो-अप', 'home.quickContacts': 'त्वरित संपर्क',
  'home.allCaught': 'सब पूरा!', 'home.noFollowups': 'अभी कोई फ़ॉलो-अप बाकी नहीं.',
  'act.newLead': 'नई लीड', 'act.newClaim': 'नया क्लेम', 'act.whatsapp': 'व्हाट्सएप', 'act.licPlans': 'LIC प्लान',
  'act.calendar': 'कैलेंडर', 'act.contests': 'प्रतियोगिताएँ', 'act.premiumDue': 'प्रीमियम देय', 'act.birthdays': 'जन्मदिन',
  'common.signIn': 'साइन इन', 'common.signOut': 'साइन आउट', 'common.cancel': 'रद्द करें', 'common.send': 'भेजें',
  'common.call': 'कॉल', 'common.whatsapp': 'व्हाट्सएप', 'common.seeAll': 'सभी देखें', 'common.search': 'खोजें',
  'common.pipeline': 'पाइपलाइन', 'common.delete': 'डिलीट', 'common.save': 'सहेजें',
  'premium.title': 'प्रीमियम और शुभकामनाएँ', 'premium.dueThisMonth': 'इस महीने प्रीमियम देय', 'premium.birthdaysThisMonth': 'इस महीने के जन्मदिन',
  'premium.sendReminder': 'रिमाइंडर भेजें', 'premium.sendAll': 'सभी को भेजें', 'premium.oneClick': 'एक टैप से हर ग्राहक को व्यक्तिगत व्हाट्सएप संदेश जाता है.',
  'premium.renewalDue': 'रिन्यूअल देय', 'premium.maturitySoon': 'मैच्योरिटी नज़दीक', 'premium.anniversaries': 'एनिवर्सरी',
  'report.generate': 'ग्राहक रिपोर्ट बनाएँ', 'report.generating': 'रिपोर्ट बन रही है…', 'report.title': 'ग्राहक रिपोर्ट',
  'signout.title': 'साइन आउट करें?', 'signout.msg': 'क्या आप वाकई CGPE Connect से साइन आउट करना चाहते हैं?',
  'settings.language': 'ऐप भाषा', 'settings.title': 'सेटिंग्स',
};

const DICT: Record<Lang, Record<string, string>> = { en, gu, hi };
const KEY = 'cgpe.lang';

type I18n = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const I18nContext = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => { storage.get(KEY).then((v) => { if (v === 'en' || v === 'gu' || v === 'hi') setLangState(v); }); }, []);
  const setLang = (l: Lang) => { setLangState(l); storage.set(KEY, l); };
  const t = (key: string) => DICT[lang][key] ?? DICT.en[key] ?? key;
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}
export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
