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
        "inline-flex max-w-full shrink items-center justify-start rounded-[5px] border-0 px-[7px] py-[3px] font-mono text-[18px] leading-6 font-normal whitespace-normal",
        tone === "muted"
          ? "bg-[#eee9df] text-[#7a7468]"
          : "bg-[#eee9df] text-[#1f1c17]",
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
      className={cn("min-h-6 w-fit max-w-full pl-0", fullWidth && "max-w-full")}
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
        "-ml-px font-mono text-[13px] leading-none font-semibold text-[#7a7468]",
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
      className="inline-flex h-5 min-w-4 shrink-0 items-start justify-center font-mono text-[15px] leading-5 font-semibold text-[#7a7468]"
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
