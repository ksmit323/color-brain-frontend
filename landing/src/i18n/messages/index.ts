import type { Locale } from "../locales";
import { en } from "./en";
import { zh } from "./zh";
import type { ForecastMessages, Messages } from "./types";

const catalogs: Record<Locale, Messages> = {
  en,
  zh,
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

export function getForecastMessages(locale: Locale): ForecastMessages {
  return getMessages(locale).forecast;
}

export type { ForecastMessages, Messages };
export { en, zh };
