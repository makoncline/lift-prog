import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NoteBadgeTone = "default" | "muted";

export function NoteBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: NoteBadgeTone;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex max-w-[31ch] shrink items-center justify-start rounded-[4px] border-0 px-1.5 py-0.5 font-mono text-[12px] leading-4 font-normal whitespace-normal",
        tone === "muted"
          ? "bg-[#f2eee4] text-[#6f6858]"
          : "bg-[#eee8da] text-[#433e33]",
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export function SetNote({
  children,
  refCallback,
  marker,
  fullWidth,
  onClick,
}: {
  children: ReactNode;
  refCallback: (node: HTMLDivElement | null) => void;
  marker?: ReactNode;
  fullWidth?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      {marker}
      <NoteBadge className={cn(fullWidth && "max-w-full")}>
        {children}
      </NoteBadge>
    </>
  );

  return (
    <div
      ref={refCallback}
      className={cn("min-h-5 w-fit max-w-full pl-0", fullWidth && "max-w-full")}
    >
      {onClick ? (
        <button
          type="button"
          className={cn(
            "inline-flex max-w-full items-center justify-start gap-1 text-left",
            fullWidth && "max-w-full",
          )}
          onClick={onClick}
        >
          {content}
        </button>
      ) : (
        <span
          className={cn(
            "inline-flex max-w-full items-center justify-start gap-1",
            fullWidth && "max-w-full",
          )}
        >
          {content}
        </span>
      )}
    </div>
  );
}

export function TimelineFootnoteRef({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <sup
      aria-hidden="true"
      className={cn(
        "-ml-px font-mono text-[9px] leading-none font-semibold text-[#817a69]",
        className,
      )}
    >
      {children}
    </sup>
  );
}

export function TimelineFootnoteMarker({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 min-w-3 shrink-0 items-start justify-center font-mono text-[9px] leading-3 font-semibold text-[#817a69]"
    >
      {children}
    </span>
  );
}

export function getTimelineNoteMarker(
  sets: Array<{ note?: string }>,
  setIndex: number,
) {
  const noteIndex =
    sets.slice(0, setIndex + 1).filter((set) => Boolean(set.note)).length - 1;

  return String.fromCharCode(97 + (noteIndex % 26));
}
