"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkoutExercisePlan({
  exercises,
  draggingIndex,
  newExerciseName,
  addingExerciseName,
  exerciseSuggestions,
  exerciseSuggestionsLoaded,
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
  exerciseSuggestions: string[];
  exerciseSuggestionsLoaded: boolean;
  onNewExerciseNameChange: (name: string) => void;
  onAddExercise: (name: string) => void;
  onDeleteExercise: (exerciseIndex: number) => void;
  onDragStart: (exerciseIndex: number) => void;
  onDragEnd: () => void;
  onDropExercise: (targetIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className="mb-[22px] text-[#1f1c17]"
      aria-label="Workout exercises"
    >
      <button
        type="button"
        className="flex min-h-[34px] w-full min-w-0 items-center gap-1 text-left font-mono text-[18px] leading-6 text-[#7a7468]"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="shrink-0">exercises</span>
      </button>
      {expanded ? (
        <div className="mt-1">
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
            exerciseSuggestions={exerciseSuggestions}
            exerciseSuggestionsLoaded={exerciseSuggestionsLoaded}
            onExerciseNameChange={onNewExerciseNameChange}
            onAddExercise={onAddExercise}
          />
        </div>
      ) : null}
    </section>
  );
}

function WorkoutExercisePlanList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-[7px]">{children}</div>;
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
        "group flex min-h-[34px] items-center gap-[7px] rounded-[5px] px-0.5 text-[19px] leading-6",
        dragging && "bg-[#eee9df]",
      )}
    >
      <GripVertical
        className="size-4 shrink-0 text-[#7a7468]"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{exerciseName}</span>
      <button
        type="button"
        aria-label={`Delete ${exerciseName}`}
        className="inline-flex h-[34px] min-w-[44px] shrink-0 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] hover:bg-[#eee9df] hover:text-[#9f2f2f]"
        onClick={() => onDeleteExercise(exerciseIndex)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function WorkoutExercisePlanAddForm({
  exerciseName,
  addingExerciseName,
  exerciseSuggestions,
  exerciseSuggestionsLoaded,
  onExerciseNameChange,
  onAddExercise,
}: {
  exerciseName: string;
  addingExerciseName: string | null;
  exerciseSuggestions: string[];
  exerciseSuggestionsLoaded: boolean;
  onExerciseNameChange: (name: string) => void;
  onAddExercise: (name: string) => void;
}) {
  const trimmedName = exerciseName.trim();
  const matchingSuggestions = trimmedName
    ? exerciseSuggestions
        .filter((name) =>
          name.toLowerCase().includes(trimmedName.toLowerCase()),
        )
        .slice(0, 8)
    : [];
  const hasExactMatch = matchingSuggestions.some(
    (name) => name.toLowerCase() === trimmedName.toLowerCase(),
  );

  return (
    <div className="mt-2">
      <form
        className="flex min-w-0 gap-[6px]"
        onSubmit={(event) => {
          event.preventDefault();
          onAddExercise(exerciseName);
        }}
      >
        <input
          value={exerciseName}
          onChange={(event) => onExerciseNameChange(event.target.value)}
          placeholder="exercise name"
          className="h-10 min-w-0 flex-1 rounded-[5px] border border-[#d7cab8] bg-[#fffefa] px-2 font-mono text-[20px] leading-6 text-[#1f1c17] outline-none placeholder:text-[#7a7468] focus:ring-1 focus:ring-[#383225]"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-10 rounded-[7px] border-[#d7cab8] bg-[#fffefa] px-3 font-mono text-[16px] font-normal text-[#7a7468] shadow-none hover:bg-[#eee9df]"
          disabled={addingExerciseName != null || !exerciseName.trim()}
        >
          <Plus className="size-4" />
          add
        </Button>
      </form>
      {trimmedName ? (
        <div className="mt-1 flex max-h-32 flex-col overflow-y-auto font-mono text-[18px] leading-6">
          {matchingSuggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="rounded-[5px] px-2 py-1 text-left text-[#1f1c17] hover:bg-[#eee9df]"
              onClick={() => onAddExercise(name)}
            >
              {name}
            </button>
          ))}
          {exerciseSuggestionsLoaded && !hasExactMatch ? (
            <button
              type="button"
              className="rounded-[5px] px-2 py-1 text-left text-[#7a7468] hover:bg-[#eee9df] hover:text-[#1f1c17]"
              onClick={() => onAddExercise(trimmedName)}
            >
              create {trimmedName}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
