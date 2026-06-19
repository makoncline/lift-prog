"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteWorkoutDialog({
  open,
  workoutName,
  isDeleting = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  workoutName: string;
  isDeleting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 left-1/2 w-[calc(100vw-16px)] max-w-[390px] min-w-0 translate-y-0 gap-2 rounded-none border-x-0 border-b-0 border-[#d7cfbc] bg-[#fdfcf8] p-2 font-mono text-[#17150f] shadow-none sm:top-auto sm:bottom-0 sm:max-w-[390px] sm:translate-y-0">
        <DialogTitle className="text-[13px] leading-5 font-normal">
          delete workout
        </DialogTitle>
        <DialogDescription className="text-[12px] leading-4 text-[#716b5d]">
          {workoutName}
        </DialogDescription>
        <div className="grid grid-cols-[1fr_1fr] gap-1">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] font-mono text-[12px] font-normal text-[#373226] shadow-none"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            cancel
          </Button>
          <Button
            type="button"
            className="h-8 rounded-[4px] bg-[#5f2018] font-mono text-[12px] font-normal text-[#fdfcf8] shadow-none hover:bg-[#5f2018]/90"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
