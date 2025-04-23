import React, { useState } from "react";
import {
  type WorkoutExercise,
  type WorkoutSet,
  type ActiveField,
  type Note,
} from "@/lib/workoutLogic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { H4 } from "@/components/ui/typography";
import { MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkoutTable } from "./WorkoutTable";

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  isActive: boolean;
  activeField: ActiveField;
  inputValue: string;
  showNotes: boolean;
  onToggleNotes: () => void;
  onNoteChange: (notes: string) => void;
  onFocusField: (
    exerciseId: number,
    setId: number,
    field: "weight" | "reps",
  ) => void;
  onCompleteSet: (exerciseId: number, setId: number) => void;
  onAddSet: (exerciseId: number) => void;
  onTouchStart?: (
    e: React.TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => void;
  onTouchMove?: (
    e: React.TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => void;
  onTouchEnd?: (
    e: React.TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => void;
}

export function ExerciseCard({
  exercise,
  isActive,
  activeField,
  inputValue,
  showNotes,
  onToggleNotes,
  onNoteChange,
  onFocusField,
  onCompleteSet,
  onAddSet,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: ExerciseCardProps) {
  const noteText = exercise.notes.map((note) => note.text).join("\n");

  return (
    <div
      className={cn(
        "bg-card border-border relative mb-6 rounded-lg border p-4 shadow-sm",
        isActive && "ring-primary ring-1",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <H4>{exercise.name}</H4>

        <Button
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground", showNotes && "text-primary")}
          onClick={onToggleNotes}
          title="Toggle notes"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>

      {showNotes && (
        <div className="mb-4">
          <Textarea
            placeholder="Exercise notes..."
            value={noteText}
            onChange={(e) => onNoteChange(e.target.value)}
            className="h-[100px] resize-none"
          />
        </div>
      )}

      <WorkoutTable
        exercise={exercise}
        activeField={activeField}
        inputValue={inputValue}
        onFocusField={onFocusField}
        onCompleteSet={onCompleteSet}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />

      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddSet(exercise.id)}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          <span>Add Set</span>
        </Button>
      </div>
    </div>
  );
}
