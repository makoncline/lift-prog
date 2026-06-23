"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function WorkoutEditorContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        "top-auto bottom-0 left-1/2 w-[calc(100vw-16px)] max-w-[390px] min-w-0 translate-y-0 gap-3 rounded-t-[4px] border-[#d7cab8] bg-[#fbfaf7] p-3 font-mono text-[#1f1c17] shadow-none sm:top-auto sm:bottom-0 sm:max-w-[390px] sm:translate-y-0",
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function WorkoutEditorLabel({ children }: { children: ReactNode }) {
  return <div className="text-[18px] leading-6 text-[#7a7468]">{children}</div>;
}

export function WorkoutEditorActionRow({
  children,
  columns = "equal",
}: {
  children: ReactNode;
  columns?: "equal" | "icon-primary";
}) {
  return (
    <div
      className={cn(
        "grid gap-1",
        columns === "icon-primary" ? "grid-cols-[auto_1fr]" : "grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

export function WorkoutEditorPrimaryAction({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      className={cn(
        "h-10 rounded-[7px] bg-[#383225] font-mono text-[20px] font-normal text-[#fffefa] shadow-none hover:bg-[#383225]/90",
        className,
      )}
      {...props}
    />
  );
}

export function WorkoutEditorSecondaryAction({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-10 rounded-[7px] border-[#d7cab8] bg-[#fffefa] font-mono text-[20px] font-normal text-[#1f1c17] shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function WorkoutEditorDangerAction({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      className={cn(
        "h-10 rounded-[7px] bg-[#9f2f2f] font-mono text-[20px] font-normal text-[#fffefa] shadow-none hover:bg-[#9f2f2f]/90",
        className,
      )}
      {...props}
    />
  );
}
