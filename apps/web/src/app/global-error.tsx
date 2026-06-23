"use client";

import { ErrorBoundaryFallback } from "@/components/error-boundary-fallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundaryFallback
          error={error}
          reset={reset}
          scope="web-root"
          screen="app"
          title="app crashed"
        />
      </body>
    </html>
  );
}
