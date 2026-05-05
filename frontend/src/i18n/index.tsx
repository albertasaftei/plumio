import * as i18n from "@solid-primitives/i18n";
import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  onMount,
  useContext,
  type ParentComponent,
} from "solid-js";

import enDict from "./en.json";

// ── Types ────────────────────────────────────────────────────────────

export type Locale =
  | "en"
  | "ro"
  | "it"
  | "fr"
  | "es"
  | "de"
  | "zh"
  | "ja"
  | "nl"
  | "pt"
  | "ru"
  | "pl";

export type RawDictionary = typeof enDict;
export type Dictionary = i18n.Flatten<RawDictionary>;

// ── Constants ────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES: Locale[] = [
  "en",
  "ro",
  "it",
  "fr",
  "es",
  "de",
  "zh",
  "ja",
  "nl",
  "pt",
  "ru",
  "pl",
];

const LOCALE_STORAGE_KEY = "plumio_locale";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ro: "Română",
  it: "Italiano",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  zh: "中文",
  ja: "日本語",
  nl: "Nederlands",
  pt: "Português",
  ru: "Русский",
  pl: "Polski",
};

export { LOCALE_NAMES };

// ── Locale detection ─────────────────────────────────────────────────

function toLocale(raw: string): Locale | null {
  const lower = raw.toLowerCase();
  // Exact match first
  if (SUPPORTED_LOCALES.includes(lower as Locale)) return lower as Locale;
  // Language prefix match (e.g. "ro-RO" → "ro")
  const prefix = lower.split("-")[0];
  if (SUPPORTED_LOCALES.includes(prefix as Locale)) return prefix as Locale;
  return null;
}

function detectLocale(): Locale {
  // SSR guard — default to English server-side to avoid hydration mismatch
  if (typeof window === "undefined") return "en";

  // 1. Persisted preference
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) {
    const matched = toLocale(stored);
    if (matched) return matched;
  }

  // 2. Browser language
  const browserLocale = navigator.language || navigator.languages?.[0];
  if (browserLocale) {
    const matched = toLocale(browserLocale);
    if (matched) return matched;
  }

  return "en";
}

// ── Dictionary loader ─────────────────────────────────────────────────

const flatEnDict = i18n.flatten(enDict);

async function fetchDictionary(locale: Locale): Promise<Dictionary> {
  if (locale === "en") return flatEnDict;
  const raw = (await import(`./${locale}.json`)) as {
    default: Partial<RawDictionary>;
  };
  // Merge with English as fallback for any missing keys
  return i18n.flatten({ ...enDict, ...raw.default } as RawDictionary);
}

// ── Context ───────────────────────────────────────────────────────────

interface I18nContextValue {
  t: i18n.Translator<Dictionary>;
  locale: () => Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  t: i18n.translator(() => flatEnDict, i18n.resolveTemplate),
  locale: () => "en" as Locale,
  setLocale: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────

export const I18nProvider: ParentComponent = (props) => {
  // Start with "en" to match SSR output and avoid hydration mismatch.
  // onMount reads the persisted locale and updates after hydration,
  // which causes createResource to re-fetch the correct dictionary.
  const [locale, setLocaleSignal] = createSignal<Locale>("en");

  const [dict] = createResource(locale, fetchDictionary, {
    initialValue: flatEnDict,
  });

  const t = i18n.translator(dict, i18n.resolveTemplate);

  const setLocale = (newLocale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    setLocaleSignal(newLocale);
  };

  // Sync html[lang] attribute
  createEffect(() => {
    document.documentElement.lang = locale();
  });

  // After hydration, apply the persisted locale.
  // This triggers createResource to re-fetch if the locale differs from "en".
  onMount(() => {
    const detected = detectLocale();
    if (detected !== locale()) {
      setLocaleSignal(detected);
    }
  });

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {props.children}
    </I18nContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)!;
}
