import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportClient } from "./report-client";

export const metadata: Metadata = {
  title: "Audit Report",
  robots: { index: false },
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      {/* Keyed by URL so navigating to a new audit remounts with a clean state. */}
      <ReportClient key={params.url ?? ""} />
    </Suspense>
  );
}
