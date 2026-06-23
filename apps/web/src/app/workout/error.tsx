"use client";

import { ErrorBoundaryFallback } from "@/components/error-boundary-fallback";

export default function WorkoutError({
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
      scope="web-workout"
      screen="workout"
      title="workout crashed"
    />
  );
}
