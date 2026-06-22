"use client";

import { ClientErrorBoundary } from "@/components/error-boundary/app_error_boundary";

export default function WorkoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientErrorBoundary scope="workout" title="workout crashed">
      {children}
    </ClientErrorBoundary>
  );
}
