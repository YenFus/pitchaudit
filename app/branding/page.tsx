"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { ReportHeader } from "@/components/ReportHeader";
import { config } from "@/lib/config";
import { BRAND_STORAGE_KEY, clearBrand, setBrand, type Brand } from "@/lib/brand";
import { useStoredJSON } from "@/lib/local-store";

const MAX_LOGO_BYTES = 200 * 1024;

const fieldClass =
  "w-full rounded-md border border-rule-strong bg-card px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none";

export default function BrandingPage() {
  const storedBrand = useStoredJSON<Brand | null>(BRAND_STORAGE_KEY, null);
  const [edits, setEdits] = useState<Partial<Brand>>({});
  const [logoError, setLogoError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const form: Brand = {
    name: "",
    contact: "",
    color: config.accentDefault,
    ...(storedBrand ?? {}),
    ...edits,
  };

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("The logo must be under 200 KB. Try a smaller PNG or SVG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEdits((b) => ({ ...b, logo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setBrand(form);
    setEdits({});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-20">
      <div className="py-5">
        <Link href="/" aria-label="Back to the home page">
          <Logo size={20} />
        </Link>
      </div>

      <p className="pa-eyebrow mt-6">Your branding</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold text-ink">What your clients see</h1>
      <p className="mt-2 text-ink-2">
        Your name, logo, colour and contact line go on every report and PDF instead of ours.
        They&apos;re stored in this browser only and never sent to the server.
      </p>

      <div className="pa-sheet mt-6 px-5 py-4">
        <ReportHeader brand={form.name ? form : null} date="Preview" />
        <p className="mt-4 font-serif text-lg font-semibold text-ink">clientwebsite.com</p>
      </div>

      <form onSubmit={save} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Business name</span>
          <input
            value={form.name}
            onChange={(e) => setEdits((b) => ({ ...b, name: e.target.value }))}
            placeholder="e.g. Northside Web Co."
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Contact line (shown at the top and bottom of the report)
          </span>
          <input
            value={form.contact}
            onChange={(e) => setEdits((b) => ({ ...b, contact: e.target.value }))}
            placeholder="e.g. hello@northsideweb.com · 555 010 1234"
            className={fieldClass}
          />
        </label>
        <div className="flex items-end gap-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Accent colour</span>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setEdits((b) => ({ ...b, color: e.target.value }))}
              className="h-10 w-16 cursor-pointer rounded-md border border-rule-strong bg-card"
            />
          </label>
          <div className="flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Logo (PNG or SVG, under 200 KB)
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-rule-strong bg-card px-3 py-2.5 text-sm font-medium text-ink hover:bg-sunken"
              >
                Upload a logo
              </button>
              {form.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo}
                  alt="Logo preview"
                  className="h-9 w-9 rounded-sm border border-rule-strong object-contain"
                />
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
          </div>
        </div>
        {logoError && (
          <p role="alert" className="text-sm text-bad">
            {logoError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="pa-btn-accent">
            {saved ? "Saved" : "Save branding"}
          </button>
          {storedBrand && (
            <button
              type="button"
              onClick={() => {
                clearBrand();
                setEdits({});
              }}
              className="text-sm text-muted underline underline-offset-2 hover:text-ink"
            >
              Remove branding
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
