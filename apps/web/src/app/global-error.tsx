"use client";

import "@/styles/globals.css";

import { ErrorFallbackContent } from "@/components/error-boundary/app_error_boundary";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background font-sans antialiased">
        <ErrorFallbackContent
          error={error}
          reset={reset}
          scope="global"
          title="app crashed"
        />
      </body>
    </html>
  );
}
