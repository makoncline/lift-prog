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
      <DialogContent className="top-auto bottom-0 left-1/2 w-[calc(100vw-16px)] max-w-[390px] min-w-0 translate-y-0 gap-3 rounded-t-[4px] border-[#d7cab8] bg-[#fbfaf7] p-3 font-mono text-[#1f1c17] shadow-none sm:top-auto sm:bottom-0 sm:max-w-[390px] sm:translate-y-0">
        <DialogTitle className="text-[18px] leading-6 font-normal text-[#7a7468]">
          delete workout
        </DialogTitle>
        <DialogDescription className="text-[20px] leading-7 text-[#1f1c17]">
          {workoutName}
        </DialogDescription>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-[7px] border-[#d7cab8] bg-[#fffefa] font-mono text-[20px] font-normal text-[#1f1c17] shadow-none hover:bg-[#eee9df]"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            cancel
          </Button>
          <Button
            type="button"
            className="h-10 rounded-[7px] bg-[#9f2f2f] font-mono text-[20px] font-normal text-[#fffefa] shadow-none hover:bg-[#9f2f2f]/90"
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
