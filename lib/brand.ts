// White-label brand settings. Stored in localStorage only — branding never
// leaves the browser.

import { notifyLocalStore } from "./local-store";

export interface Brand {
  name: string;
  contact: string;
  color: string;
  /** data URI, ≤ ~200KB */
  logo?: string;
}

export const BRAND_STORAGE_KEY = "pa_brand";

export function setBrand(brand: Brand): void {
  window.localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(brand));
  notifyLocalStore();
}

export function clearBrand(): void {
  window.localStorage.removeItem(BRAND_STORAGE_KEY);
  notifyLocalStore();
}
