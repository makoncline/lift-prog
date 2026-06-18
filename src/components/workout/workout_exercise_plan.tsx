"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkoutExercisePlan({
  exercises,
  draggingIndex,
  newExerciseName,
  addingExerciseName,
  onNewExerciseNameChange,
  onAddExercise,
  onDeleteExercise,
  onDragStart,
  onDragEnd,
  onDropExercise,
}: {
  exercises: string[];
  draggingIndex: number | null;
  newExerciseName: string;
  addingExerciseName: string | null;
  onNewExerciseNameChange: (name: string) => void;
  onAddExercise: (name: string) => void;
  onDeleteExercise: (exerciseIndex: number) => void;
  onDragStart: (exerciseIndex: number) => void;
  onDragEnd: () => void;
  onDropExercise: (targetIndex: number) => void;
}) {
  return (
    <section className="mb-5 text-[#17150f]" aria-label="Workout exercises">
      <WorkoutExercisePlanHeader />
      <WorkoutExercisePlanList>
        {exercises.map((exerciseName, exerciseIndex) => (
          <WorkoutExercisePlanItem
            key={`${exerciseName}-${exerciseIndex}`}
            exerciseName={exerciseName}
            exerciseIndex={exerciseIndex}
            dragging={draggingIndex === exerciseIndex}
            onDeleteExercise={onDeleteExercise}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDropExercise={onDropExercise}
          />
        ))}
      </WorkoutExercisePlanList>
      <WorkoutExercisePlanAddForm
        exerciseName={newExerciseName}
        addingExerciseName={addingExerciseName}
        onExerciseNameChange={onNewExerciseNameChange}
        onAddExercise={onAddExercise}
      />
    </section>
  );
}

function WorkoutExercisePlanHeader() {
  return (
    <div className="mb-0.5 text-[11px] leading-4 text-[#716b5d]">
      exercises
    </div>
  );
}

function WorkoutExercisePlanList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

function WorkoutExercisePlanItem({
  exerciseName,
  exerciseIndex,
  dragging,
  onDeleteExercise,
  onDragStart,
  onDragEnd,
  onDropExercise,
}: {
  exerciseName: string;
  exerciseIndex: number;
  dragging: boolean;
  onDeleteExercise: (exerciseIndex: number) => void;
  onDragStart: (exerciseIndex: number) => void;
  onDragEnd: () => void;
  onDropExercise: (targetIndex: number) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(exerciseIndex));
        onDragStart(exerciseIndex);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropExercise(exerciseIndex);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex min-h-7 items-center gap-1 rounded-[3px] px-0.5 text-[13px] leading-5",
        dragging && "bg-[#eee8da]",
      )}
    >
      <GripVertical
        className="size-3.5 shrink-0 text-[#a49b86]"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{exerciseName}</span>
      <button
        type="button"
        aria-label={`Delete ${exerciseName}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-[3px] text-[#817a69] hover:bg-[#eee8da] hover:text-[#5f2018]"
        onClick={() => onDeleteExercise(exerciseIndex)}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function WorkoutExercisePlanAddForm({
  exerciseName,
  addingExerciseName,
  onExerciseNameChange,
  onAddExercise,
}: {
  exerciseName: string;
  addingExerciseName: string | null;
  onExerciseNameChange: (name: string) => void;
  onAddExercise: (name: string) => void;
}) {
  return (
    <div className="mt-1.5">
      <form
        className="flex min-w-0 gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          onAddExercise(exerciseName);
        }}
      >
        <input
          value={exerciseName}
          onChange={(event) => onExerciseNameChange(event.target.value)}
          placeholder="exercise name"
          className="h-7 min-w-0 flex-1 rounded-[4px] border border-[#d7cfbc] bg-[#fdfcf8] px-2 font-mono text-[16px] leading-4 text-[#17150f] outline-none focus:ring-1 focus:ring-[#a79b83]"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-7 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] px-2 font-mono text-[12px] font-normal text-[#373226] shadow-none"
          disabled={addingExerciseName != null || !exerciseName.trim()}
        >
          <Plus className="size-3.5" />
          add
        </Button>
      </form>
    </div>
  );
}
