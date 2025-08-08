"use client";
import { ExerciseNotes } from "./exercise_notes";

export function WorkoutNotes({
  visible,
  notes,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: {
  visible: boolean;
  notes: { text: string }[];
  onAdd: (text: string) => void;
  onUpdate: (index: number, text: string) => void;
  onDelete: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  if (!visible) return null;
  return (
    <div className="mb-4">
      <ExerciseNotes
        title="Workout Notes"
        notes={notes}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onReorder={onReorder}
      />
    </div>
  );
}
