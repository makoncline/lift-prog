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
import { Check, ChevronDown, ChevronUp, Trash2, User } from "lucide-react";
import {
  displayReps,
  displayWeight,
  getPreviousSetData,
  type WorkoutExercise,
  type WorkoutSet,
} from "@lift-prog/workout-core";
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
  onSetRestBefore,
  onUpdateSetNote,
  onUpdateSetWeight,
  onUpdateSetReps,
  onApplyQuickSetLine,
  onOpenDelete,
  onAddSet,
  notes,
  onAddExerciseNote,
  onUpdateExerciseNote,
  onDeleteExerciseNote,
  onReorderExerciseNotes,
  onDeleteExercise,
  onMoveExercise,
  canMoveUp,
  canMoveDown,
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
  onSetRestBefore: (
    exerciseIndex: number,
    setIndex: number,
    restBefore: "standard" | "short" | undefined,
  ) => void;
  onUpdateSetNote: (
    exerciseIndex: number,
    setIndex: number,
    notes: string,
  ) => void;
  onUpdateSetWeight: (
    exerciseIndex: number,
    setIndex: number,
    weight: number | null,
  ) => void;
  onUpdateSetReps: (
    exerciseIndex: number,
    setIndex: number,
    reps: number | null,
  ) => void;
  onApplyQuickSetLine: (exerciseIndex: number, line: string) => void;
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
  onDeleteExercise: (exerciseIndex: number) => void;
  onMoveExercise: (exerciseIndex: number, direction: 1 | -1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [quickSetLine, setQuickSetLine] = React.useState("");
  const quickSetLineRef = React.useRef<HTMLInputElement>(null);
  const applyQuickSetLine = () => {
    const line = (quickSetLineRef.current?.value ?? quickSetLine).trim();
    if (!line) return;
    onApplyQuickSetLine(exerciseIndex, line);
    setQuickSetLine("");
    if (quickSetLineRef.current) quickSetLineRef.current.value = "";
  };

  return (
    <div className="mb-4" data-testid={`exercise-section-${exerciseIndex}`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">{exercise.name}</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveUp}
            onClick={() => onMoveExercise(exerciseIndex, -1)}
            aria-label={`Move ${exercise.name} up`}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveDown}
            onClick={() => onMoveExercise(exerciseIndex, 1)}
            aria-label={`Move ${exercise.name} down`}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-7 w-7"
            onClick={() => onDeleteExercise(exerciseIndex)}
            aria-label={`Delete ${exercise.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {exercise.previousNotes ? (
        <div className="bg-muted/40 text-muted-foreground mb-2 rounded p-2 text-xs">
          <p className="font-semibold">Previous notes</p>
          <p>{exercise.previousNotes}</p>
        </div>
      ) : null}
      <div className="mb-2">
        <input
          value={notes[0]?.text ?? ""}
          onChange={(event) => {
            if (notes.length === 0) {
              onAddExerciseNote(exerciseIndex, event.target.value);
            } else {
              onUpdateExerciseNote(exerciseIndex, 0, event.target.value);
            }
          }}
          placeholder="setup note"
          className="border-input bg-background mb-1 h-8 w-full rounded-sm border px-2 font-mono text-sm"
          data-testid={`setup-note-${exerciseIndex}`}
        />
        <form
          className="mb-1 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            applyQuickSetLine();
          }}
          data-testid={`quick-set-form-${exerciseIndex}`}
          aria-label={`Apply sets for ${exercise.name}`}
        >
          <input
            ref={quickSetLineRef}
            name="quickSetLine"
            value={quickSetLine}
            onChange={(event) => setQuickSetLine(event.target.value)}
            placeholder="sets line"
            aria-label={`Sets line for ${exercise.name}`}
            className="border-input bg-background h-8 min-w-0 flex-1 rounded-sm border px-2 font-mono text-sm"
            data-testid={`quick-set-line-${exerciseIndex}`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-sm px-2 font-mono text-xs"
            data-testid={`apply-quick-set-line-${exerciseIndex}`}
            aria-label={`Apply sets for ${exercise.name}`}
            onClick={applyQuickSetLine}
          >
            apply
          </Button>
        </form>
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
                <React.Fragment key={index}>
                  <TableRow
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
                        data-testid={`set-kind-${exerciseIndex}-${index}`}
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
                          <input
                            type="text"
                            value={
                              set.weightModifier === "bodyweight"
                                ? String(Math.abs(set.weight ?? weightValue.weight ?? 0))
                                : (set.weight ?? weightValue.weight ?? "")
                            }
                            onChange={(event) => {
                              const value = event.target.value.trim();
                              onUpdateSetWeight(
                                exerciseIndex,
                                index,
                                value === "" ? null : Number(value),
                              );
                            }}
                            onInput={(event) => {
                              const value = event.currentTarget.value.trim();
                              onUpdateSetWeight(
                                exerciseIndex,
                                index,
                                value === "" ? null : Number(value),
                              );
                            }}
                            onFocus={() =>
                              onFocusField(exerciseIndex, index, "weight")
                            }
                            className={cn(
                              "h-full min-w-0 flex-1 rounded bg-transparent text-center text-sm outline-none",
                              !set.completed &&
                                !set.weightExplicit &&
                                "text-muted-foreground",
                            )}
                            data-testid={`weight-input-${exerciseIndex}-${index}`}
                          />
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
                          <input
                            type="text"
                            value={set.reps ?? repsValue ?? ""}
                            onChange={(event) => {
                              const value = event.target.value.trim();
                              onUpdateSetReps(
                                exerciseIndex,
                                index,
                                value === "" ? null : Number(value),
                              );
                            }}
                            onInput={(event) => {
                              const value = event.currentTarget.value.trim();
                              onUpdateSetReps(
                                exerciseIndex,
                                index,
                                value === "" ? null : Number(value),
                              );
                            }}
                            onFocus={() =>
                              onFocusField(exerciseIndex, index, "reps")
                            }
                            className={cn(
                              "h-full w-full rounded bg-transparent px-1 text-center text-sm outline-none",
                              !set.completed &&
                                !set.repsExplicit &&
                                "text-muted-foreground",
                            )}
                            data-testid={`reps-input-${exerciseIndex}-${index}`}
                          />
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
                  <TableRow>
                    <TableCell colSpan={6} className="px-1 pt-0 pb-2">
                      <div className="flex flex-wrap items-center gap-1 text-xs">
                        {index > 0 ? (
                          <>
                            <Button
                              type="button"
                              size="xs"
                              variant={
                                set.restBefore !== "short"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="h-6 rounded-sm px-2"
                              onClick={() =>
                                onSetRestBefore(
                                  exerciseIndex,
                                  index,
                                  undefined,
                                )
                              }
                            >
                              standard
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant={
                                set.restBefore === "short"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="h-6 rounded-sm px-2"
                              onClick={() =>
                                onSetRestBefore(exerciseIndex, index, "short")
                              }
                            >
                              short
                            </Button>
                          </>
                        ) : null}
                        <input
                          value={set.notes ?? ""}
                          onChange={(event) =>
                            onUpdateSetNote(
                              exerciseIndex,
                              index,
                              event.target.value,
                            )
                          }
                          placeholder="set note"
                          className="border-input bg-background h-7 min-w-0 flex-1 rounded-sm border px-2"
                          data-testid={`set-note-${exerciseIndex}-${index}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
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
