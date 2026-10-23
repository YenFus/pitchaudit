"use client";

// Applies body.print-mode:
//  - during real printing (beforeprint/afterprint, fired by window.print())
//  - persistently when the URL has ?print=1 (visual testing hook)
//
// It also opens every collapsed finding while printing. Modern browsers hide
// the content of a closed <details> in a way CSS can't override, so without
// this a PDF could come out with every finding collapsed.

import { useEffect } from "react";

const OPENED_FOR_PRINT = "data-print-opened";

function openAllFindings() {
  document
    .querySelectorAll<HTMLDetailsElement>("details:not([open])")
    .forEach((d) => {
      d.setAttribute(OPENED_FOR_PRINT, "");
      d.open = true;
    });
}

function restoreFindings() {
  document
    .querySelectorAll<HTMLDetailsElement>(`details[${OPENED_FOR_PRINT}]`)
    .forEach((d) => {
      d.open = false;
      d.removeAttribute(OPENED_FOR_PRINT);
    });
}

export function PrintModeManager() {
  useEffect(() => {
    const hasPrintParam = () =>
      new URLSearchParams(window.location.search).get("print") === "1";

    const apply = () => {
      document.body.classList.add("print-mode");
      openAllFindings();
    };
    const restore = () => {
      if (hasPrintParam()) return;
      document.body.classList.remove("print-mode");
      restoreFindings();
    };

    let observer: MutationObserver | undefined;
    if (hasPrintParam()) {
      apply();
      // The report renders after the audit returns, so keep opening late arrivals.
      observer = new MutationObserver(openAllFindings);
      observer.observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("beforeprint", apply);
    window.addEventListener("afterprint", restore);
    return () => {
      observer?.disconnect();
      window.removeEventListener("beforeprint", apply);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  return null;
}
