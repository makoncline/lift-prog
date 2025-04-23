import React from "react";
import {
  type WorkoutExercise,
  type WorkoutSet,
  type ActiveField,
  displayWeight,
  displayReps,
} from "@/lib/workoutLogic";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetRowProps {
  set: WorkoutSet;
  exercise: WorkoutExercise;
  sets: WorkoutSet[];
  index: number;
  isActive: boolean;
  activeField: "weight" | "reps" | null;
  inputValue: string;
  onFocus: (field: "weight" | "reps") => void;
  onComplete: () => void;
  onTouchStart?: React.TouchEventHandler<HTMLTableRowElement>;
  onTouchMove?: React.TouchEventHandler<HTMLTableRowElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLTableRowElement>;
}

export function SetRow({
  set,
  exercise,
  sets,
  index,
  isActive,
  activeField,
  inputValue,
  onFocus,
  onComplete,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: SetRowProps) {
  const isBodyweight = set.weightModifier === "bodyweight";
  const isWarmup = set.modifier === "warmup";

  // Display values (used estimated or explicit values)
  const weightValue = displayWeight(set, sets, index, exercise);
  const repsValue = displayReps(set, sets, index, exercise);

  // For active input, display current input instead
  const displayedWeight =
    activeField === "weight" ? inputValue : (weightValue?.toString() ?? "");
  const displayedReps =
    activeField === "reps" ? inputValue : (repsValue?.toString() ?? "");

  return (
    <TableRow
      className={cn(
        "transition-colors",
        set.completed ? "bg-muted/50" : "",
        isWarmup ? "text-muted-foreground italic" : "",
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <TableCell
        className={cn(
          "h-12 w-1/3 cursor-pointer",
          activeField === "weight" && "bg-primary/10",
        )}
        onClick={() => onFocus("weight")}
      >
        {isBodyweight ? (
          <span className="flex flex-row items-center gap-1">
            BW
            {displayedWeight !== "" && displayedWeight !== "0" && (
              <span>+{displayedWeight}</span>
            )}
          </span>
        ) : (
          displayedWeight
        )}
      </TableCell>

      <TableCell
        className={cn(
          "h-12 w-1/3 cursor-pointer",
          activeField === "reps" && "bg-primary/10",
        )}
        onClick={() => onFocus("reps")}
      >
        {displayedReps}
      </TableCell>

      <TableCell
        className={cn(
          "h-12 w-12 cursor-pointer",
          set.completed ? "text-green-500" : "text-muted-foreground",
        )}
        onClick={onComplete}
      >
        {set.completed && <Check className="h-5 w-5" />}
      </TableCell>
    </TableRow>
  );
}

interface ExerciseTableProps {
  exercise: WorkoutExercise;
  activeField: ActiveField;
  inputValue: string;
  onFocusField: (
    exerciseId: number,
    setId: number,
    field: "weight" | "reps",
  ) => void;
  onCompleteSet: (exerciseId: number, setId: number) => void;
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

export function WorkoutTable({
  exercise,
  activeField,
  inputValue,
  onFocusField,
  onCompleteSet,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: ExerciseTableProps) {
  return (
    <Table className="border-separate border-spacing-0">
      <TableHeader className="bg-muted/20">
        <TableRow>
          <TableHead className="w-1/3 font-medium">Weight</TableHead>
          <TableHead className="w-1/3 font-medium">Reps</TableHead>
          <TableHead className="w-12 font-medium"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {exercise.sets.map((set, idx) => {
          const isActiveSet =
            activeField.exerciseIndex === exercise.id &&
            activeField.setIndex === set.id;

          return (
            <SetRow
              key={set.id}
              set={set}
              exercise={exercise}
              sets={exercise.sets}
              index={idx}
              isActive={isActiveSet}
              activeField={isActiveSet ? activeField.field : null}
              inputValue={isActiveSet ? inputValue : ""}
              onFocus={(field) => onFocusField(exercise.id, set.id, field)}
              onComplete={() => onCompleteSet(exercise.id, set.id)}
              onTouchStart={
                onTouchStart
                  ? (e) => onTouchStart(e, exercise.id, set.id)
                  : undefined
              }
              onTouchMove={
                onTouchMove
                  ? (e) => onTouchMove(e, exercise.id, set.id)
                  : undefined
              }
              onTouchEnd={
                onTouchEnd
                  ? (e) => onTouchEnd(e, exercise.id, set.id)
                  : undefined
              }
            />
          );
        })}
      </TableBody>
    </Table>
  );
}
