"use client";

import { ErrorBoundaryFallback } from "@/components/error-boundary-fallback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryFallback
      error={error}
      reset={reset}
      scope="web-app"
      screen="app"
      title="app crashed"
    />
  );
}
