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
        "top-auto bottom-0 left-1/2 w-[calc(100vw-16px)] max-w-[390px] min-w-0 translate-y-0 gap-2 rounded-none border-x-0 border-b-0 border-[#d7cfbc] bg-[#fdfcf8] p-2 font-mono text-[#17150f] shadow-none sm:top-auto sm:bottom-0 sm:max-w-[390px] sm:translate-y-0",
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function WorkoutEditorLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] leading-4 text-[#716b5d]">{children}</div>;
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
        "h-8 rounded-[4px] bg-[#373226] font-mono text-[12px] font-normal text-[#fdfcf8] shadow-none hover:bg-[#373226]/90",
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
        "h-8 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] font-mono text-[12px] font-normal text-[#373226] shadow-none",
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
        "h-8 rounded-[4px] bg-[#5f2018] font-mono text-[12px] font-normal text-[#fdfcf8] shadow-none hover:bg-[#5f2018]/90",
        className,
      )}
      {...props}
    />
  );
}
