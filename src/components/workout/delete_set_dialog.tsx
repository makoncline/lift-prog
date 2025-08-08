"use client";
import { ConfirmDialog } from "./confirm_dialog";

export function DeleteSetDialog({
  isOpen,
  exerciseName,
  setNumber,
  isWarmup,
  onCancel,
  onConfirm,
  disabled,
}: {
  isOpen: boolean;
  exerciseName: string;
  setNumber: number;
  isWarmup: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const description = `Are you sure you want to delete ${isWarmup ? "warmup set" : `set ${setNumber}`} from “${exerciseName}”?`;
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title="Delete Set"
      description={description}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      confirmVariant="destructive"
      onCancel={onCancel}
      onConfirm={onConfirm}
      isConfirmDisabled={disabled}
    />
  );
}
