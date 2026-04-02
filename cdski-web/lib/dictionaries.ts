import "server-only";

export type Locale = "es" | "en" | "pt";

const dictionaries = {
  es: () => import("@/dictionaries/es.json").then((m) => m.default),
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
  pt: () => import("@/dictionaries/pt.json").then((m) => m.default),
};

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};

export const locales: Locale[] = ["es", "en", "pt"];
export const defaultLocale: Locale = "es";

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
