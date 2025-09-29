"use client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Check, User, Trash2 } from "lucide-react";
import type { WorkoutExercise, WorkoutSet } from "@/lib/workoutLogic";
import {
  displayReps,
  displayWeight,
  getPreviousSetData,
} from "@/lib/workoutLogic";
import React from "react";
import { ExerciseNotes } from "./exercise_notes";

export function ExerciseSection({
  exercise,
  exerciseIndex,
  activeField,
  inputValue,
  onFocusField,
  onToggleWarmup,
  onToggleComplete,
  onOpenDelete,
  onAddSet,
  notes,
  onAddExerciseNote,
  onUpdateExerciseNote,
  onDeleteExerciseNote,
  onReorderExerciseNotes,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  activeField: {
    exerciseIndex: number | null;
    setIndex: number | null;
    field: "weight" | "reps" | null;
  };
  inputValue: string;
  onFocusField: (
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "reps",
  ) => void;
  onToggleWarmup: (exerciseIndex: number, setIndex: number) => void;
  onToggleComplete: (exerciseIndex: number, setIndex: number) => void;
  onOpenDelete: (
    exerciseIndex: number,
    setIndex: number,
    exercise: WorkoutExercise,
    set: WorkoutSet,
  ) => void;
  onAddSet: (exerciseIndex: number) => void;
  notes: { text: string }[];
  onAddExerciseNote: (exerciseIndex: number, text: string) => void;
  onUpdateExerciseNote: (
    exerciseIndex: number,
    noteIndex: number,
    text: string,
  ) => void;
  onDeleteExerciseNote: (exerciseIndex: number, noteIndex: number) => void;
  onReorderExerciseNotes: (
    exerciseIndex: number,
    from: number,
    to: number,
  ) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">{exercise.name}</h2>
      </div>
      {exercise.previousNotes ? (
        <div className="mb-2 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
          <p className="font-semibold">Previous notes</p>
          <p>{exercise.previousNotes}</p>
        </div>
      ) : null}
      <div className="mb-2">
        <ExerciseNotes
          title="Exercise Notes"
          notes={notes}
          onAdd={(t) => onAddExerciseNote(exerciseIndex, t)}
          onUpdate={(i, t) => onUpdateExerciseNote(exerciseIndex, i, t)}
          onDelete={(i) => onDeleteExerciseNote(exerciseIndex, i)}
          onReorder={(from, to) =>
            onReorderExerciseNotes(exerciseIndex, from, to)
          }
        />
      </div>

      <div className="overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[8%] px-1 py-1 text-xs"></TableHead>
              <TableHead className="w-[10%] px-1 py-1 text-xs">Set</TableHead>
              <TableHead className="w-[25%] px-1 py-1 text-xs">
                Previous
              </TableHead>
              <TableHead className="w-[20%] px-1 py-1 text-xs">lbs</TableHead>
              <TableHead className="w-[15%] px-1 py-1 text-xs">Reps</TableHead>
              <TableHead className="w-[10%] px-1 py-1 text-xs">✓</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercise.sets.map((set, index) => {
              const weightValue = displayWeight(
                set,
                exercise.sets,
                index,
                exercise,
              );
              const repsValue = displayReps(
                set,
                exercise.sets,
                index,
                exercise,
              );
              // const isRepsEstimated = !set.repsExplicit && !set.completed;
              const workingSetNumber =
                exercise.sets
                  .filter((s) => s.modifier !== "warmup")
                  .indexOf(set) + 1;

              return (
                <TableRow
                  key={index}
                  className={cn(
                    "relative",
                    set.completed && "bg-success/5",
                    set.weightModifier === "bodyweight" &&
                      "bg-blue-100/30 dark:bg-blue-900/20",
                  )}
                >
                  <TableCell className="py-1 text-center">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-5 w-5 p-0"
                      onClick={() =>
                        onOpenDelete(exerciseIndex, index, exercise, set)
                      }
                      data-testid={`delete-btn-${exerciseIndex}-${index}`}
                      aria-label="Delete set"
                    >
                      <Trash2 className="text-muted-foreground size-3" />
                    </Button>
                  </TableCell>
                  <TableCell className="px-1 py-1 text-center">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md text-sm",
                        set.modifier === "warmup"
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-700",
                      )}
                      onClick={() => onToggleWarmup(exerciseIndex, index)}
                    >
                      {set.modifier === "warmup" ? "W" : workingSetNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-1 py-1 text-center text-xs">
                    {(() => {
                      const prevData = getPreviousSetData(
                        exercise,
                        set,
                        exercise.sets,
                      );
                      if (prevData.weight === null || prevData.reps === null)
                        return "-";
                      let formattedWeight: React.ReactNode | string | number =
                        "";
                      if (prevData.weightModifier === "bodyweight") {
                        formattedWeight = (
                          <span className="inline-flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5 flex-shrink-0" />
                            <span className="font-medium">
                              {prevData.weight >= 0 ? "+" : "-"}
                            </span>
                            <span>{Math.abs(prevData.weight)}</span>
                          </span>
                        );
                      } else {
                        formattedWeight = `${prevData.weight}lb`;
                      }
                      return (
                        <>
                          {formattedWeight} × {prevData.reps}
                          {set.modifier === "warmup" ? " (W)" : ""}
                        </>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-1 py-1">
                    <div
                      className={cn(
                        "flex h-8 w-full items-center justify-center rounded-md bg-gray-100",
                        activeField.exerciseIndex === exerciseIndex &&
                          activeField.setIndex === index &&
                          activeField.field === "weight" &&
                          "bg-white ring-2 ring-blue-400",
                        set.weightModifier === "bodyweight" &&
                          "border-input border",
                      )}
                    >
                      <div
                        className="flex h-full w-full items-center justify-center gap-1 px-1"
                        onClick={() =>
                          onFocusField(exerciseIndex, index, "weight")
                        }
                        data-testid={`weight-cell-${exerciseIndex}-${index}`}
                      >
                        {set.weightModifier === "bodyweight" && (
                          <User className="text-muted-foreground h-3 w-3 flex-shrink-0" />
                        )}
                        {set.weightModifier === "bodyweight" && (
                          <span className="text-muted-foreground flex-shrink-0 text-sm font-medium">
                            {activeField.exerciseIndex === exerciseIndex &&
                            activeField.setIndex === index &&
                            activeField.field === "weight"
                              ? (parseFloat(inputValue) || 0) >= 0
                                ? "+"
                                : "-"
                              : (weightValue.weight ?? 0) >= 0
                                ? "+"
                                : "-"}
                          </span>
                        )}
                        {activeField.exerciseIndex === exerciseIndex &&
                        activeField.setIndex === index &&
                        activeField.field === "weight" ? (
                          <input
                            type="text"
                            value={
                              set.weightModifier === "bodyweight"
                                ? String(Math.abs(parseFloat(inputValue) || 0))
                                : inputValue
                            }
                            readOnly
                            autoFocus
                            className="inline-block h-full w-auto rounded bg-transparent text-center text-sm outline-none"
                            size={inputValue.length + 1}
                          />
                        ) : (
                          <span
                            className={cn(
                              "w-auto",
                              !set.completed &&
                                !set.weightExplicit &&
                                "text-muted-foreground",
                            )}
                          >
                            {set.weightModifier === "bodyweight"
                              ? String(Math.abs(weightValue.weight ?? 0))
                              : (weightValue.weight ?? "-")}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-1 py-1">
                    <div
                      className={cn(
                        "flex h-8 w-full items-center justify-center rounded-md bg-gray-100",
                        activeField.exerciseIndex === exerciseIndex &&
                          activeField.setIndex === index &&
                          activeField.field === "reps" &&
                          "bg-white ring-2 ring-blue-400",
                      )}
                    >
                      <div
                        className="h-full w-full"
                        onClick={() =>
                          onFocusField(exerciseIndex, index, "reps")
                        }
                        data-testid={`reps-cell-${exerciseIndex}-${index}`}
                      >
                        {activeField.exerciseIndex === exerciseIndex &&
                        activeField.setIndex === index &&
                        activeField.field === "reps" ? (
                          <input
                            type="text"
                            value={inputValue}
                            readOnly
                            autoFocus
                            className="h-full w-full rounded bg-transparent px-1 text-center text-sm outline-none"
                          />
                        ) : (
                          <div
                            className={cn(
                              "flex h-full w-full items-center justify-center text-center text-sm",
                              !set.completed &&
                                !set.repsExplicit &&
                                "text-muted-foreground",
                            )}
                          >
                            {repsValue ?? "-"}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-1 py-1">
                    <Button
                      size="icon"
                      variant={set.completed ? "default" : "secondary"}
                      className={cn(
                        "h-8 w-8",
                        set.completed && "bg-success hover:bg-success/90",
                      )}
                      onClick={() => onToggleComplete(exerciseIndex, index)}
                      data-testid={`complete-btn-${exerciseIndex}-${index}`}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          set.completed
                            ? "text-success-foreground"
                            : "text-muted-foreground",
                        )}
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-2 space-y-2">
        <Button
          variant="secondary"
          size="xs"
          className="text-muted-foreground w-full"
          onClick={() => onAddSet(exerciseIndex)}
          data-testid={`add-set-${exerciseIndex}`}
        >
          + Add Set
        </Button>
      </div>
    </div>
  );
}
