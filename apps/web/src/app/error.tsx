"use client";

import { ErrorFallbackContent } from "@/components/error-boundary/app_error_boundary";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallbackContent error={error} reset={reset} scope="app" />
  );
}
