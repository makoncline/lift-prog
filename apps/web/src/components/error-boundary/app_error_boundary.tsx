"use client";

import * as React from "react";
import { Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  reportClientError,
  type ClientErrorReportInput,
} from "@/lib/client-error-reporting";
import { cn } from "@/lib/utils";

type ErrorWithDigest = Error & { digest?: string };

type ErrorFallbackContentProps = {
  error: ErrorWithDigest;
  scope: string;
  reset?: () => void;
  componentStack?: string;
  title?: string;
  className?: string;
};

export function ErrorFallbackContent({
  error,
  scope,
  reset,
  componentStack,
  title = "something broke",
  className,
}: ErrorFallbackContentProps) {
  const reportId = useClientErrorReport({ error, scope, componentStack });

  return (
    <ErrorFallbackView
      error={error}
      reset={reset}
      reportId={reportId}
      title={title}
      className={className}
    />
  );
}

function useClientErrorReport({
  error,
  scope,
  componentStack,
}: ClientErrorReportInput) {
  const [reportId, setReportId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReportId(reportClientError({ error, scope, componentStack }));
  }, [componentStack, error, scope]);

  return reportId;
}

function ErrorFallbackView({
  error,
  reset,
  reportId,
  title,
  className,
}: {
  error: ErrorWithDigest;
  reset?: () => void;
  reportId?: string | null;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center p-4 font-mono",
        className,
      )}
    >
      <div className="space-y-3">
        <div>
          <p className="text-3xl font-bold tracking-normal text-[#1f1b16]">
            {title}
          </p>
          <p className="mt-1 text-sm text-[#7d7668]">
            error reported
            {reportId ? ` · ${reportId.slice(0, 8)}` : null}
          </p>
        </div>

        <div className="space-y-1 text-sm text-[#3e392f]">
          <p className="rounded-md bg-[#eee8dd] px-2 py-1">
            {error.message || "Unknown error"}
          </p>
          {error.digest ? (
            <p className="text-xs text-[#7d7668]">digest · {error.digest}</p>
          ) : null}
        </div>

        <div className="flex gap-2 pt-1">
          {reset ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-[#d8cdb9] bg-transparent px-2 font-mono"
              onClick={reset}
            >
              <RotateCcw className="size-4" />
              try again
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-[#d8cdb9] bg-transparent px-2 font-mono"
            onClick={() => {
              window.location.assign("/");
            }}
          >
            <Home className="size-4" />
            home
          </Button>
        </div>
      </div>
    </div>
  );
}

type ClientErrorBoundaryProps = {
  children: React.ReactNode;
  scope: ClientErrorReportInput["scope"];
  title?: string;
};

type ClientErrorBoundaryState = {
  error: ErrorWithDigest | null;
  componentStack?: string;
  reportId?: string;
};

export class ClientErrorBoundary extends React.Component<
  ClientErrorBoundaryProps,
  ClientErrorBoundaryState
> {
  state: ClientErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: ErrorWithDigest) {
    return { error };
  }

  componentDidCatch(error: ErrorWithDigest, info: React.ErrorInfo) {
    const componentStack = info.componentStack ?? undefined;
    const reportId = reportClientError({
      error,
      scope: this.props.scope,
      componentStack,
    });

    this.setState({ componentStack, reportId });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallbackView
          error={this.state.error}
          reportId={this.state.reportId}
          title={this.props.title ?? "something broke"}
          reset={() => {
            this.setState({
              error: null,
              componentStack: undefined,
              reportId: undefined,
            });
          }}
        />
      );
    }

    return this.props.children;
  }
}
