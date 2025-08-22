"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmVariant = "destructive",
  isConfirmDisabled,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  isConfirmDisabled?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (onOpenChange ? onOpenChange(o) : !o && onCancel())}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-[425px]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="mt-2 text-base">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="bg-muted/20 flex flex-row justify-end gap-3 border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="px-6"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            className="px-6"
            disabled={isConfirmDisabled}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
