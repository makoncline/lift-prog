"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { reportClientBoundaryError } from "@/lib/client-error-reporting";

type ErrorBoundaryFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  scope: string;
  screen?: string;
  title?: string;
};

export function ErrorBoundaryFallback({
  error,
  reset,
  scope,
  screen,
  title = "something broke",
}: ErrorBoundaryFallbackProps) {
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    setReportId(reportClientBoundaryError({ error, scope, screen }));
  }, [error, scope, screen]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col justify-center gap-3 bg-[#fbfaf7] px-5 font-mono text-[#1f1c17]">
      <h1 className="text-[30px] leading-8 font-extrabold tracking-normal">
        {title}
      </h1>
      <div className="text-[13px] leading-5 text-[#7a7468]">
        error reported{reportId ? ` · ${reportId.slice(0, 8)}` : ""}
      </div>
      <div className="w-fit max-w-full rounded-[6px] bg-[#eee9df] px-2 py-1 text-[15px] leading-5 break-words">
        {error.message || "Unknown error"}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="min-h-[34px] rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-3 text-[14px] text-[#1f1c17]"
          onClick={reset}
        >
          try again
        </button>
        <Link
          className="flex min-h-[34px] items-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-3 text-[14px] text-[#1f1c17]"
          href="/"
        >
          home
        </Link>
      </div>
    </main>
  );
}
