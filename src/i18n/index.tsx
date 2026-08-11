import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { storage } from '@/lib/storage';

/* ------------------------------------------------------------------ *
 * Language support.
 *
 * FIVE LANGUAGES, THREE SCRIPTS. English, Gujarati and Hindi are written in their own
 * script. Hinglish and Roman Gujarati are the SAME two regional languages written in the
 * English alphabet, and they exist because a large share of advisors in Gujarat speak
 * Gujarati or Hindi fluently but read the Roman alphabet far faster than they read
 * Devanagari or the Gujarati abugida — they type that way on WhatsApp all day.
 *
 * THEY ARE NOT THE SAME DICTIONARY TWICE. Hinglish is Hindi vocabulary ("Aaj ke kaam",
 * "Nayi lead", "ka / ki / ke", "bhejein"); Roman Gujarati is Gujarati vocabulary
 * ("Aaj na kaam", "Navi lead", "nu / ni / na", "moklo"). A native reader spots a
 * copy-pasted line instantly, so every string below is written in its own language.
 *
 * TRADE VOCABULARY STAYS IN ENGLISH. Nobody in this business says "prabhaar jama karein";
 * they say "Premium bharo". policy, premium, claim, lead, WhatsApp, KYC, renewal,
 * maturity, target, commission and report are left in English inside the romanized
 * strings, because translating them to Sanskritised Hindi or literary Gujarati would read
 * as absurd and, worse, as unfamiliar.
 *
 * t(key) falls back to English and then to the key itself, so an untranslated string can
 * never render as blank space.
 * ------------------------------------------------------------------ */

export type Lang = 'en' | 'gu' | 'hi' | 'hi-en' | 'gu-en';

/**
 * The Settings screen maps over this. English first, then the two script languages, then
 * the romanized pair — a reader scanning for their language finds it under its own name
 * in `native`, which is the only field they are guaranteed to be able to read.
 */
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'hi-en', label: 'Hinglish', native: 'Hinglish' },
  { code: 'gu-en', label: 'Roman Gujarati', native: 'Gujarati (Roman)' },
];

/** The app default. Deliberately NOT device-locale detected: a shared handset set to
 *  hi-IN must not silently put a new advisor into a script they may not read. */
const DEFAULT_LANG: Lang = 'en';

// English is the source of truth. Left unannotated on purpose so its keys infer as string
// literals — every other dictionary is typed against them, so a missing or misspelled key
// in any translation is a compile error rather than a blank label at runtime.
const en = {
  'tab.home': 'Today', 'tab.tasks': 'Tasks', 'tab.leads': 'Leads', 'tab.clients': 'Clients', 'tab.claims': 'Claims', 'tab.more': 'More',
  'tasks.title': 'My Tasks', 'tasks.today': 'Today', 'tasks.overdue': 'Overdue', 'tasks.inProgress': 'In progress',
  'tasks.upcoming': 'Upcoming', 'tasks.doneLabel': 'Done', 'tasks.dueNow': 'due now', 'tasks.add': 'Add task',
  'tasks.todayProgress': "Today's progress", 'tasks.allClear': 'All clear!', 'tasks.nothingHere': 'No tasks in this view.',
  'home.tasksToday': "Today's tasks", 'home.taskProgress': 'Task progress', 'home.viewAll': 'View all',
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

/** Every dictionary carries exactly the English key set. */
type TKey = keyof typeof en;
type Dict = Record<TKey, string>;

const gu: Dict = {
  'tab.home': 'આજે', 'tab.tasks': 'કાર્યો', 'tab.leads': 'લીડ્સ', 'tab.clients': 'ગ્રાહકો', 'tab.claims': 'ક્લેમ', 'tab.more': 'વધુ',
  'tasks.title': 'મારા કાર્યો', 'tasks.today': 'આજે', 'tasks.overdue': 'મુદત વીતી', 'tasks.inProgress': 'ચાલુ',
  'tasks.upcoming': 'આવનારા', 'tasks.doneLabel': 'પૂર્ણ', 'tasks.dueNow': 'બાકી', 'tasks.add': 'કાર્ય ઉમેરો',
  'tasks.todayProgress': 'આજની પ્રગતિ', 'tasks.allClear': 'બધું પૂર્ણ!', 'tasks.nothingHere': 'આ યાદીમાં કોઈ કાર્ય નથી.',
  'home.tasksToday': 'આજના કાર્યો', 'home.taskProgress': 'કાર્ય પ્રગતિ', 'home.viewAll': 'બધું જુઓ',
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

const hi: Dict = {
  'tab.home': 'आज', 'tab.tasks': 'कार्य', 'tab.leads': 'लीड्स', 'tab.clients': 'ग्राहक', 'tab.claims': 'क्लेम', 'tab.more': 'और',
  'tasks.title': 'मेरे कार्य', 'tasks.today': 'आज', 'tasks.overdue': 'अतिदेय', 'tasks.inProgress': 'चालू',
  'tasks.upcoming': 'आगामी', 'tasks.doneLabel': 'पूर्ण', 'tasks.dueNow': 'बाकी', 'tasks.add': 'कार्य जोड़ें',
  'tasks.todayProgress': 'आज की प्रगति', 'tasks.allClear': 'सब पूरा!', 'tasks.nothingHere': 'इस सूची में कोई कार्य नहीं.',
  'home.tasksToday': 'आज के कार्य', 'home.taskProgress': 'कार्य प्रगति', 'home.viewAll': 'सभी देखें',
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

/**
 * HINGLISH — Hindi vocabulary in the Roman alphabet.
 * Hindi possessives (ka / ki / ke), Hindi verbs (bhejein, dekhein, jodein, banayein) and
 * the Hindi copula (hai / hain). Business nouns stay English.
 */
const hiEn: Dict = {
  'tab.home': 'Aaj', 'tab.tasks': 'Kaam', 'tab.leads': 'Leads', 'tab.clients': 'Client', 'tab.claims': 'Claim', 'tab.more': 'Aur',
  'tasks.title': 'Mere kaam', 'tasks.today': 'Aaj', 'tasks.overdue': 'Bakaya', 'tasks.inProgress': 'Chalu',
  'tasks.upcoming': 'Aane wale', 'tasks.doneLabel': 'Ho gaya', 'tasks.dueNow': 'baaki hain', 'tasks.add': 'Kaam jodein',
  'tasks.todayProgress': 'Aaj ki progress', 'tasks.allClear': 'Sab poora!', 'tasks.nothingHere': 'Is list mein koi kaam nahi hai.',
  'home.tasksToday': 'Aaj ke kaam', 'home.taskProgress': 'Kaam ki progress', 'home.viewAll': 'Sab dekhein',
  'greet.morning': 'Suprabhat', 'greet.afternoon': 'Shubh dopahar', 'greet.evening': 'Shubh sandhya',
  'home.commission': 'Is mahine ka commission', 'home.vsLast': 'pichhle mahine se', 'home.target': 'Mahine ka target',
  'home.markAttendance': 'Haazri lagayein', 'home.gpsCheckin': 'Aaj ki GPS haazri',
  'home.clockedIn': 'Haazri lag gayi', 'home.clockIn': 'Haazri lagayein', 'home.clockOut': 'Clock out',
  'home.hotLeads': 'Hot leads', 'home.openClaims': 'Khule claim', 'home.renewals': 'Renewal',
  'home.quickActions': 'Turant kaam', 'home.followups': 'Aaj ke follow-up', 'home.quickContacts': 'Turant contact',
  'home.allCaught': 'Sab ho gaya!', 'home.noFollowups': 'Abhi koi follow-up baaki nahi hai.',
  'act.newLead': 'Nayi lead', 'act.newClaim': 'Naya claim', 'act.whatsapp': 'WhatsApp', 'act.licPlans': 'LIC plan',
  'act.calendar': 'Calendar', 'act.contests': 'Contest', 'act.premiumDue': 'Premium bakaya', 'act.birthdays': 'Janmdin',
  'common.signIn': 'Sign in', 'common.signOut': 'Sign out', 'common.cancel': 'Radd karein', 'common.send': 'Bhejein',
  'common.call': 'Call', 'common.whatsapp': 'WhatsApp', 'common.seeAll': 'Sab dekhein', 'common.search': 'Khojein',
  'common.pipeline': 'Pipeline', 'common.delete': 'Delete', 'common.save': 'Save karein',
  'premium.title': 'Premium aur shubhkamnaein', 'premium.dueThisMonth': 'Is mahine premium bakaya', 'premium.birthdaysThisMonth': 'Is mahine ke janmdin',
  'premium.sendReminder': 'Reminder bhejein', 'premium.sendAll': 'Sabko bhejein', 'premium.oneClick': 'Ek tap se har matching client ko personal WhatsApp message chala jata hai.',
  'premium.renewalDue': 'Renewal bakaya', 'premium.maturitySoon': 'Maturity nazdeek', 'premium.anniversaries': 'Anniversary',
  'report.generate': 'Client report banayein', 'report.generating': 'Report ban rahi hai…', 'report.title': 'Client report',
  'signout.title': 'Sign out karein?', 'signout.msg': 'Kya aap sach mein CGPE Connect se sign out karna chahte hain?',
  'settings.language': 'App ki bhasha', 'settings.title': 'Settings',
};

/**
 * ROMAN GUJARATI — Gujarati vocabulary in the Roman alphabet.
 * Gujarati possessives (nu / ni / na), Gujarati verbs (moklo, juo, umero, banavo), the
 * Gujarati copula (chhe) and the Gujarati negative (nathi). Business nouns stay English.
 */
const guEn: Dict = {
  'tab.home': 'Aaje', 'tab.tasks': 'Kaam', 'tab.leads': 'Leads', 'tab.clients': 'Client', 'tab.claims': 'Claim', 'tab.more': 'Vadhu',
  'tasks.title': 'Mara kaam', 'tasks.today': 'Aaje', 'tasks.overdue': 'Mudat viti', 'tasks.inProgress': 'Chaalu',
  'tasks.upcoming': 'Aavnara', 'tasks.doneLabel': 'Thai gayu', 'tasks.dueNow': 'baaki chhe', 'tasks.add': 'Kaam umero',
  'tasks.todayProgress': 'Aaj ni progress', 'tasks.allClear': 'Badhu puru!', 'tasks.nothingHere': 'Aa list ma koi kaam nathi.',
  'home.tasksToday': 'Aaj na kaam', 'home.taskProgress': 'Kaam ni progress', 'home.viewAll': 'Badhu juo',
  'greet.morning': 'Suprabhat', 'greet.afternoon': 'Shubh bapor', 'greet.evening': 'Shubh sanjh',
  'home.commission': 'Aa mahina nu commission', 'home.vsLast': 'gaya mahina karta', 'home.target': 'Mahina nu target',
  'home.markAttendance': 'Hajari nondho', 'home.gpsCheckin': 'Aaj ni GPS hajari',
  'home.clockedIn': 'Hajari nondhai gai', 'home.clockIn': 'Hajari nondho', 'home.clockOut': 'Clock out',
  'home.hotLeads': 'Hot leads', 'home.openClaims': 'Khulla claim', 'home.renewals': 'Renewal',
  'home.quickActions': 'Zadapi kaam', 'home.followups': 'Aaj na follow-up', 'home.quickContacts': 'Zadapi contact',
  'home.allCaught': 'Badhu thai gayu!', 'home.noFollowups': 'Atyare koi follow-up baaki nathi.',
  'act.newLead': 'Navi lead', 'act.newClaim': 'Navo claim', 'act.whatsapp': 'WhatsApp', 'act.licPlans': 'LIC plan',
  'act.calendar': 'Calendar', 'act.contests': 'Contest', 'act.premiumDue': 'Premium baaki', 'act.birthdays': 'Janmdivas',
  'common.signIn': 'Sign in', 'common.signOut': 'Sign out', 'common.cancel': 'Radd karo', 'common.send': 'Moklo',
  'common.call': 'Call', 'common.whatsapp': 'WhatsApp', 'common.seeAll': 'Badhu juo', 'common.search': 'Shodho',
  'common.pipeline': 'Pipeline', 'common.delete': 'Delete', 'common.save': 'Save karo',
  'premium.title': 'Premium ane shubhechha', 'premium.dueThisMonth': 'Aa mahine premium baaki', 'premium.birthdaysThisMonth': 'Aa mahina na janmdivas',
  'premium.sendReminder': 'Reminder moklo', 'premium.sendAll': 'Badha ne moklo', 'premium.oneClick': 'Ek tap thi darek matching client ne personal WhatsApp message jaay chhe.',
  'premium.renewalDue': 'Renewal baaki', 'premium.maturitySoon': 'Maturity najik', 'premium.anniversaries': 'Anniversary',
  'report.generate': 'Client report banavo', 'report.generating': 'Report bani rahi chhe…', 'report.title': 'Client report',
  'signout.title': 'Sign out karvu chhe?', 'signout.msg': 'Shu tame kharekhar CGPE Connect mathi sign out karva mango chho?',
  'settings.language': 'App ni bhasha', 'settings.title': 'Settings',
};

/**
 * Exported for the Phase 19 dictionary-parity test (`__tests__/dictionaries.test.ts`), which
 * asserts every language carries the exact same key set with no empty / key-identical values —
 * the value checks `Dict = Record<TKey, string>` cannot make at compile time. Nothing under
 * `src/app` imports this: screens read strings through `t()`, never the raw table.
 */
export const DICT: Record<Lang, Dict> = { en, gu, hi, 'hi-en': hiEn, 'gu-en': guEn };

/* ------------------------------------------------------------------ *
 * Persistence — per user, on a handset that is shared.
 *
 * Language is a PERSONAL preference and these phones are passed between staff, so the
 * choice is stored under `cgpe.lang.<userId>`. `cgpe.lang` (no suffix) remains the
 * signed-out / pre-upgrade key.
 *
 * WHY THE USER ID IS READ FROM STORAGE AND NOT FROM THE AUTH STORE. `store/auth.tsx` is
 * mounted around this provider and importing it here would be a require cycle, which Metro
 * resolves by handing one module a half-initialised copy of the other (the same reasoning
 * `lib/session.ts` documents). Instead we read the session record that auth already
 * persists. The coupling is one key name, `cgpe.user`, and if that record is missing or
 * unparseable we simply fall back to the device-level key — the app never breaks over it.
 * ------------------------------------------------------------------ */

const DEVICE_KEY = 'cgpe.lang';
const SESSION_USER_KEY = 'cgpe.user'; // written by store/auth.tsx

// expo-secure-store only accepts alphanumerics, '.', '-' and '_' in a key. Ids are Mongo
// hex in practice, but a phone-shaped or email-shaped id must not silently fail to persist.
const langKeyFor = (uid: string) => `${DEVICE_KEY}.${uid.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64)}`;

const isLang = (v: string | null): v is Lang => !!v && LANGS.some((l) => l.code === v);

/** Reads the signed-in user's id from the persisted session, or null when signed out. */
async function readUserId(): Promise<string | null> {
  try {
    const raw = await storage.get(SESSION_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string | number } | null;
    const id = parsed && parsed.id != null ? String(parsed.id).trim() : '';
    return id || null;
  } catch {
    return null; // corrupt record: behave exactly as if signed out
  }
}

/**
 * Resolves the language for a given account.
 *
 * The migration branch matters on a shared handset. An advisor who already chose Gujarati
 * before this build must keep it, so the first account to sign in adopts the device-level
 * value — and then CLAIMS it (removes it), so the next person to sign in on the same phone
 * starts from the app default instead of inheriting a colleague's language.
 */
async function loadLang(uid: string | null): Promise<Lang> {
  if (uid) {
    const mine = await storage.get(langKeyFor(uid));
    if (isLang(mine)) return mine;
    const device = await storage.get(DEVICE_KEY);
    if (isLang(device)) {
      await storage.set(langKeyFor(uid), device);
      await storage.remove(DEVICE_KEY);
      return device;
    }
    return DEFAULT_LANG;
  }
  const device = await storage.get(DEVICE_KEY);
  return isLang(device) ? device : DEFAULT_LANG;
}

/* Sign-in and sign-out happen in a module this one cannot import, so the provider listens
 * on a tiny bus instead. `refreshI18nUser()` is the seam: calling it after a login or a
 * logout re-reads the session and swaps the language to that account's choice within the
 * same app run. Nothing breaks if it is never called — the provider also re-checks on
 * mount and whenever the app returns to the foreground, which covers the common
 * hand-the-phone-over case. */
type Watcher = () => void;
const watchers = new Set<Watcher>();

function watchUser(fn: Watcher): () => void {
  watchers.add(fn);
  return () => { watchers.delete(fn); };
}

/** Ask the i18n provider to re-read who is signed in. Safe to call at any time. */
export function refreshI18nUser(): void {
  watchers.forEach((fn) => {
    try {
      fn();
    } catch {
      // one bad listener must not stop the others
    }
  });
}

/** Widen a fixed-key dictionary so an arbitrary runtime key can be looked up safely. */
const loose = (table: Dict): Record<string, string | undefined> => table;

/** Empty strings count as missing, otherwise a blank translation renders as blank UI. */
function pick(table: Dict, key: string): string | undefined {
  const v = loose(table)[key];
  return v ? v : undefined;
}

type I18n = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const I18nContext = createContext<I18n>({ lang: DEFAULT_LANG, setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const uidRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  // Sequence token: a foreground event can land while the mount read is still in flight,
  // and the older of the two must not be the one that wins.
  const seqRef = useRef(0);

  useEffect(() => {
    let alive = true;

    const sync = async () => {
      const mine = ++seqRef.current;
      const uid = await readUserId();
      if (!alive || mine !== seqRef.current) return;
      if (loadedRef.current && uid === uidRef.current) return; // same account, nothing to do
      const next = await loadLang(uid);
      if (!alive || mine !== seqRef.current) return;
      uidRef.current = uid;
      loadedRef.current = true;
      setLangState(next);
    };

    void sync();
    const off = watchUser(() => { void sync(); });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void sync(); });
    return () => {
      alive = false;
      seqRef.current++; // invalidate anything still awaiting
      off();
      sub.remove();
    };
  }, []);

  /**
   * The write re-reads who is signed in rather than trusting the cached id, so a choice
   * made straight after a user switch still lands on the right account's key instead of
   * overwriting the previous advisor's preference.
   */
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    loadedRef.current = true;
    seqRef.current++; // an explicit choice outranks any read still in flight
    void (async () => {
      const uid = await readUserId();
      uidRef.current = uid;
      await storage.set(uid ? langKeyFor(uid) : DEVICE_KEY, l);
    })();
  }, []);

  const t = useCallback(
    (key: string) => pick(DICT[lang], key) ?? pick(en, key) ?? key,
    [lang],
  );

  const value = useMemo<I18n>(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
