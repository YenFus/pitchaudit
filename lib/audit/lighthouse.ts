// Runs Google Lighthouse on this computer, in a headless copy of the user's
// own Chrome. Nothing is sent to Google. If Chrome can't be found and
// PSI_API_KEY is set, falls back to Google's hosted PageSpeed Insights.

import { parseSummary, runPsiMobile, type PsiSummary } from "./psi";

export interface LighthouseResult {
  mobile: PsiSummary | null;
  /** Plain-language reason Lighthouse didn't run, shown in the report. */
  error?: string;
}

const RUN_TIMEOUT_MS = 90_000;

/** Lighthouse runs one at a time: parallel runs compete for CPU and make
 *  every speed measurement worse than it really is. */
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

class ChromeMissingError extends Error {}

async function runLocal(url: string): Promise<PsiSummary> {
  const { launch, Launcher } = await import("chrome-launcher");
  const chromePath = process.env.CHROME_PATH || undefined;
  if (!chromePath && Launcher.getInstallations().length === 0) {
    throw new ChromeMissingError();
  }
  const lighthouse = (await import("lighthouse")).default;
  const chrome = await launch({
    chromePath,
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions"],
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const run = lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "seo", "accessibility", "best-practices"],
    });
    // If the timeout wins, this run is abandoned; don't let its later failure go unhandled.
    run.catch(() => undefined);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Lighthouse timed out")), RUN_TIMEOUT_MS);
    });
    const result = await Promise.race([run, timeout]);
    if (!result?.lhr) throw new Error("Lighthouse returned no result");
    if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message);
    return parseSummary({ lighthouseResult: result.lhr }, "mobile");
  } finally {
    clearTimeout(timer);
    await chrome.kill();
  }
}

export async function runLighthouse(url: string): Promise<LighthouseResult> {
  try {
    return { mobile: await serial(() => runLocal(url)) };
  } catch (err) {
    const key = process.env.PSI_API_KEY;
    if (key) {
      try {
        return { mobile: await runPsiMobile(url, key) };
      } catch (psiErr) {
        console.warn("[pitchaudit] PageSpeed Insights fallback failed:", psiErr);
      }
    }
    if (err instanceof ChromeMissingError) {
      return {
        mobile: null,
        error:
          "Google Chrome wasn't found on this computer, so speed and accessibility couldn't be measured. Install Chrome (or set CHROME_PATH) and run the audit again.",
      };
    }
    console.warn("[pitchaudit] Lighthouse failed:", err);
    return {
      mobile: null,
      error:
        "Lighthouse couldn't finish on this site, so speed and accessibility couldn't be measured. Run the audit again; if it keeps happening, the site may be blocking automated browsers.",
    };
  }
}
