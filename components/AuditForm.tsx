"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuditForm({
  large = false,
  autoFocus = false,
}: {
  large?: boolean;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || !trimmed.replace(/^https?:\/\//, "").includes(".")) {
      setError("Enter a website address, like acmeplumbing.com");
      return;
    }
    router.push(`/report?url=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={`flex items-stretch gap-2 rounded-md border bg-card transition-colors focus-within:border-ink ${
          error ? "border-bad" : "border-rule-strong"
        } ${large ? "p-2" : "p-1.5"}`}
      >
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          placeholder="acmeplumbing.com"
          aria-label="Website address to audit"
          aria-invalid={Boolean(error)}
          className={`min-w-0 flex-1 bg-transparent px-3 font-mono text-ink placeholder:text-faint focus:outline-none ${
            large ? "py-2.5 text-lg" : "py-1.5 text-sm"
          }`}
        />
        <button
          type="submit"
          className={`pa-btn-accent shrink-0 ${large ? "px-6 text-base" : "px-4 !py-2 text-sm"}`}
        >
          Run the audit
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
