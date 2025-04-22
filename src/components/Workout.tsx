"use client";
import React, { useState } from "react";
import { H4 } from "@/components/ui/typography";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Keyboard as KeyboardIcon,
  ChevronLeft,
  Plus,
  Minus,
  Delete,
  ChevronDown,
  Check,
  ChevronRight,
} from "lucide-react";

// App constants
const ONE_REP_MAX_INCREASE_LB = -5; // Pounds to add to estimated 1RM when progressing

// TypeScript interfaces
interface ExerciseSet {
  id: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  isWeightExplicitlySet: boolean;
  isRepsExplicitlySet: boolean;
  previousWeight: number | null;
  previousReps: number | null;
}

interface Exercise {
  id: number;
  name: string;
  sets: ExerciseSet[];
}

interface PreviousExerciseData {
  name: string;
  sets: Array<{ weight: number | null; reps: number | null }>;
}

// Keyboard Container Component
interface KeyboardContainerProps {
  children: React.ReactNode;
  className?: string;
}

const KeyboardContainer = ({ children, className }: KeyboardContainerProps) => {
  return (
    <div
      className={cn(
        "bg-background border-border fixed right-0 bottom-0 left-0 border-t p-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

// KeyboardButton component for all buttons
interface KeyboardButtonProps {
  onKeyPress: (value: string) => void;
  value: string;
  children: React.ReactNode;
  className?: string;
  gridArea: string;
  variant?: "default" | "outline" | "primary";
}

const KeyboardButton = ({
  onKeyPress,
  value,
  children,
  className,
  gridArea,
  variant = "outline",
}: KeyboardButtonProps) => {
  return (
    <div className="h-full w-full" style={{ gridArea }}>
      <Button
        variant={variant === "primary" ? "default" : "outline"}
        className={cn(
          "h-full w-full",
          variant === "primary" && "bg-primary hover:bg-primary/90",
          className,
        )}
        onClick={() => onKeyPress(value)}
      >
        {children}
      </Button>
    </div>
  );
};

// Main Keyboard Grid Component
const Keyboard = ({
  onKeyPress,
  inputType,
}: {
  onKeyPress: (value: string) => void;
  inputType: "weight" | "reps";
}) => {
  return (
    <KeyboardContainer>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(4, 1fr)",
          gridTemplateAreas: `
            "btn1  btn2  btn3  collapse"
            "btn4  btn5  btn6  minus-plus"
            "btn7  btn8  btn9  empty"
            "decimal btn0 backspace next"
          `,
          height: "300px",
        }}
      >
        {/* Number buttons */}
        <KeyboardButton onKeyPress={onKeyPress} value="1" gridArea="btn1">
          1
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="2" gridArea="btn2">
          2
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="3" gridArea="btn3">
          3
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="4" gridArea="btn4">
          4
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="5" gridArea="btn5">
          5
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="6" gridArea="btn6">
          6
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="7" gridArea="btn7">
          7
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="8" gridArea="btn8">
          8
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="9" gridArea="btn9">
          9
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="0" gridArea="btn0">
          0
        </KeyboardButton>

        {/* Decimal button (conditional) */}
        {inputType === "weight" ? (
          <KeyboardButton onKeyPress={onKeyPress} value="." gridArea="decimal">
            .
          </KeyboardButton>
        ) : (
          <div style={{ gridArea: "decimal" }}></div>
        )}

        {/* Backspace button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="backspace"
          gridArea="backspace"
        >
          <Delete size={24} />
        </KeyboardButton>

        {/* Collapse button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="collapse"
          gridArea="collapse"
        >
          <div className="flex flex-col items-center">
            <KeyboardIcon size={24} />
            <ChevronDown size={16} />
          </div>
        </KeyboardButton>

        {/* Plus/Minus buttons in one grid area */}
        <div
          className="grid grid-cols-2 gap-2"
          style={{ gridArea: "minus-plus" }}
        >
          <KeyboardButton onKeyPress={onKeyPress} value="minus" gridArea="">
            <Minus size={24} />
          </KeyboardButton>
          <KeyboardButton onKeyPress={onKeyPress} value="plus" gridArea="">
            <Plus size={24} />
          </KeyboardButton>
        </div>

        {/* Empty slot */}
        <div style={{ gridArea: "empty" }}></div>

        {/* Next button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="next"
          gridArea="next"
          variant="primary"
          className="text-2xl"
        >
          Next
        </KeyboardButton>
      </div>
    </KeyboardContainer>
  );
};

// Add success class variants for Tailwind
const successVariants = {
  outline:
    "border-success/20 text-success hover:bg-success/10 hover:text-success",
  success: "bg-success text-success-foreground hover:bg-success/90",
  successLight: "bg-success/10 text-success hover:bg-success/20",
};

export default function Workout({
  workoutName = "Today's Workout",
  exercises = [
    {
      name: "Bench Press",
      sets: [
        { weight: 135, reps: 12 },
        { weight: 145, reps: 8 },
        { weight: 155, reps: 6 },
      ],
    },
    {
      name: "Incline Press",
      sets: [
        { weight: 115, reps: 10 },
        { weight: 115, reps: 9 },
      ],
    },
  ],
  minReps = 8,
  maxReps = 12,
}: {
  workoutName?: string;
  exercises?: PreviousExerciseData[];
  minReps?: number;
  maxReps?: number;
}) {
  // Initialize exercises with previous data
  const createInitialExercises = (): Exercise[] => {
    return exercises.map((exercise, exerciseIndex) => {
      // Initialize sets based on previous workout data
      const sets = exercise.sets.map((prevSet, setIndex) => ({
        id: setIndex + 1,
        weight: null,
        reps: null,
        completed: false,
        isWeightExplicitlySet: false,
        isRepsExplicitlySet: false,
        previousWeight: prevSet.weight,
        previousReps: prevSet.reps,
      }));

      return {
        id: exerciseIndex + 1,
        name: exercise.name,
        sets,
      };
    });
  };

  const [activeExercises, setActiveExercises] = useState<Exercise[]>(
    createInitialExercises(),
  );
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0);
  const [activeField, setActiveField] = useState<{
    exerciseId: number | null;
    setId: number | null;
    field: "weight" | "reps" | null;
  }>({
    exerciseId: null,
    setId: null,
    field: null,
  });
  const [inputValue, setInputValue] = useState<string>("");
  const [isFirstInteraction, setIsFirstInteraction] = useState<boolean>(false);

  // Current exercise being displayed
  const currentExercise = activeExercises[currentExerciseIndex] ?? null;

  // Function to calculate the next weight and reps progression
  const calculateNextProgression = (
    prevWeight: number | null,
    prevReps: number | null,
    min: number = minReps,
  ): { weight: number | null; reps: number | null } => {
    // If no previous data, return null values
    if (prevWeight === null || prevReps === null) {
      return { weight: prevWeight, reps: prevReps };
    }

    // If previous reps reached or exceeded the max, increase weight and reset reps
    if (prevReps >= maxReps) {
      // 1RM-based progression

      // Calculate estimated 1RM using Brzycki formula: 1RM = weight × (36 / (37 - reps))
      const estimated1RM = prevWeight * (36 / (37 - prevReps));

      // Increase 1RM by the configured amount for progression
      const new1RM = estimated1RM + ONE_REP_MAX_INCREASE_LB;

      // Calculate weight for target reps using the formula: weight = 1RM × (37 - targetReps) / 36
      // Round to nearest 2.5 pounds
      const newWeight = Math.round((new1RM * (37 - min)) / 36 / 2.5) * 2.5;

      return {
        weight: newWeight,
        reps: min, // Reset to minimum reps
      };
    }

    // Otherwise, maintain weight and increment reps by 1
    return {
      weight: prevWeight,
      reps: prevReps + 1,
    };
  };

  // Function to get estimated values based on previous set or provided values
  const getEstimatedValues = (
    sets: ExerciseSet[],
    currentSetId: number,
  ): { weight: number | null; reps: number | null } => {
    // Find the current set
    const currentSet = sets.find((set) => set.id === currentSetId)!;
    if (!currentSet) return { weight: null, reps: null };

    // For the first set, use its own previous values with rep progression
    const firstSet = sets[0];
    if (firstSet && currentSetId === firstSet.id) {
      // Use the correct progression logic through calculateNextProgression
      return calculateNextProgression(
        currentSet.previousWeight,
        currentSet.previousReps,
      );
    }

    // For other sets, cascade from explicitly set values in the current workout
    // Find the index of the current set
    const currentIndex = sets.findIndex((set) => set.id === currentSetId);
    if (currentIndex <= 0) return { weight: null, reps: null };

    // Use the first set's values as the base for estimation
    if (firstSet) {
      // Get the current values for the first set (either explicit or estimated)
      let weightFromFirstSet: number | null = null;
      let repsFromFirstSet: number | null = null;

      if (firstSet.isWeightExplicitlySet) {
        weightFromFirstSet = firstSet.weight;
      } else {
        // Use first set's estimate if not explicitly set
        weightFromFirstSet =
          firstSet.weight ??
          calculateNextProgression(
            firstSet.previousWeight,
            firstSet.previousReps,
          ).weight;
      }

      if (firstSet.isRepsExplicitlySet) {
        repsFromFirstSet = firstSet.reps;
      } else {
        // Use first set's estimate if not explicitly set
        repsFromFirstSet =
          firstSet.reps ??
          calculateNextProgression(
            firstSet.previousWeight,
            firstSet.previousReps,
          ).reps;
      }

      // Start with first set's values
      let currentWeight: number | null = weightFromFirstSet;
      let currentReps: number | null = repsFromFirstSet;

      // Then override with any explicitly set values between first set and current set
      for (let i = 1; i < currentIndex; i++) {
        const prevSet = sets[i];
        if (!prevSet) continue;

        if (prevSet.isWeightExplicitlySet) {
          currentWeight = prevSet.weight;
        }

        if (prevSet.isRepsExplicitlySet) {
          currentReps = prevSet.reps;
        }
      }

      return { weight: currentWeight, reps: currentReps };
    }

    // Fallback
    return { weight: null, reps: null };
  };

  const handleKeyPress = (value: string) => {
    if (
      activeField.exerciseId === null ||
      activeField.setId === null ||
      activeField.field === null ||
      !currentExercise
    )
      return;

    if (value === "backspace") {
      if (isFirstInteraction) {
        // First interaction with backspace clears the entire value
        if (activeField.field === "weight" && activeField.setId !== null) {
          updateWeight(activeField.setId, null, false);
        } else if (activeField.field === "reps" && activeField.setId !== null) {
          updateReps(activeField.setId, null, false);
        }
        setInputValue("");
        setIsFirstInteraction(false);
      } else {
        // After first interaction, delete one character at a time
        setInputValue((prev) => {
          const newValue = prev.slice(0, -1);

          // If input is now empty, set value to null and mark as not explicitly set
          if (newValue === "") {
            if (activeField.field === "weight" && activeField.setId !== null) {
              updateWeight(activeField.setId, null, false);
            } else if (
              activeField.field === "reps" &&
              activeField.setId !== null
            ) {
              updateReps(activeField.setId, null, false);
            }
            return "";
          }

          // Update the actual value in the sets array
          if (activeField.field === "weight" && activeField.setId !== null) {
            updateWeight(activeField.setId, parseFloat(newValue) || 0);
          } else if (
            activeField.field === "reps" &&
            activeField.setId !== null
          ) {
            updateReps(activeField.setId, parseInt(newValue) || 0);
          }

          return newValue;
        });
      }
    } else if (value === "next") {
      // Different behavior based on active field
      if (activeField.field === "weight") {
        // Move from weight field to reps field of the same set
        setActiveField({
          exerciseId: activeField.exerciseId,
          setId: activeField.setId,
          field: "reps",
        });

        // Initialize input value with current reps and mark as first interaction
        const setIndex = currentExercise.sets.findIndex(
          (s) => s.id === activeField.setId,
        );
        const set = currentExercise.sets[setIndex];
        if (set) {
          const displayValues = displayValue(set, "reps");
          if (displayValues.value !== null) {
            setInputValue(displayValues.value.toString());
          } else {
            setInputValue("");
          }
        }

        setIsFirstInteraction(true);
      } else if (activeField.field === "reps") {
        // Mark the current set as complete
        toggleCompleted(activeField.setId);

        // Find the next set (if any)
        const currentIndex = currentExercise.sets.findIndex(
          (s) => s.id === activeField.setId,
        );
        const nextSet = currentExercise.sets[currentIndex + 1];

        if (nextSet) {
          // Move to the weight field of the next set
          setActiveField({
            exerciseId: activeField.exerciseId,
            setId: nextSet.id,
            field: "weight",
          });

          // Initialize input value with next set's display weight and mark as first interaction
          const displayValues = displayValue(nextSet, "weight");
          if (displayValues.value !== null) {
            setInputValue(displayValues.value.toString());
          } else {
            setInputValue("");
          }

          setIsFirstInteraction(true);
        } else {
          // If it's the last set, close the keyboard
          setActiveField({ exerciseId: null, setId: null, field: null });
        }
      }
    } else if (value === "plus" || value === "minus") {
      // Plus/minus should work regardless of first interaction status
      if (value === "plus") {
        // Increment by 2.5 to nearest 2.5
        if (activeField.field === "weight" && activeField.setId !== null) {
          const setIndex = currentExercise.sets.findIndex(
            (s) => s.id === activeField.setId,
          );
          const set = currentExercise.sets[setIndex];
          if (set) {
            const displayValues = displayValue(set, "weight");
            const currentWeight =
              displayValues.value !== null
                ? parseFloat(displayValues.value.toString())
                : 0;
            const nextWeight = Math.ceil(currentWeight / 2.5) * 2.5;

            // Ensure we always increase by at least 2.5
            const finalWeight =
              currentWeight === nextWeight ? currentWeight + 2.5 : nextWeight;

            setInputValue(finalWeight.toString());
            updateWeight(activeField.setId, finalWeight);
            setIsFirstInteraction(false);
          }
        }
      } else if (value === "minus") {
        // Decrement by 2.5 to nearest 2.5
        if (activeField.field === "weight" && activeField.setId !== null) {
          const setIndex = currentExercise.sets.findIndex(
            (s) => s.id === activeField.setId,
          );
          const set = currentExercise.sets[setIndex];
          if (set) {
            const displayValues = displayValue(set, "weight");
            const currentWeight =
              displayValues.value !== null
                ? parseFloat(displayValues.value.toString())
                : 0;
            const prevWeight = Math.floor(currentWeight / 2.5) * 2.5;
            const newWeight = Math.max(
              0,
              prevWeight === currentWeight ? prevWeight - 2.5 : prevWeight,
            );

            setInputValue(newWeight.toString());
            updateWeight(activeField.setId, newWeight);
            setIsFirstInteraction(false);
          }
        }
      }
    } else if (value === "collapse") {
      // Collapse keyboard
      setActiveField({ exerciseId: null, setId: null, field: null });
    } else {
      // Add digit to input (numbers, decimal, etc.)
      if (isFirstInteraction) {
        // First interaction clears the input and sets the new value
        setInputValue(value);

        // Update the actual value in the sets array
        if (activeField.field === "weight" && activeField.setId !== null) {
          updateWeight(activeField.setId, parseFloat(value) || 0);
        } else if (activeField.field === "reps" && activeField.setId !== null) {
          updateReps(activeField.setId, parseInt(value) || 0);
        }

        setIsFirstInteraction(false);
      } else {
        // After first interaction, append digits normally
        setInputValue((prev) => {
          const newValue = prev === "0" ? value : prev + value;
          // Update the actual value in the sets array
          if (activeField.field === "weight" && activeField.setId !== null) {
            updateWeight(activeField.setId, parseFloat(newValue) || 0);
          } else if (
            activeField.field === "reps" &&
            activeField.setId !== null
          ) {
            updateReps(activeField.setId, parseInt(newValue) || 0);
          }
          return newValue;
        });
      }
    }
  };

  // Function to display value (either explicit or estimated)
  const displayValue = (set: ExerciseSet, field: "weight" | "reps") => {
    if (!currentExercise) return { value: null, isEstimated: false };

    if (field === "weight") {
      // If weight is explicitly set or the set is completed, show the actual value
      if (set.isWeightExplicitlySet || set.completed) {
        return { value: set.weight, isEstimated: false };
      }
      // Otherwise show estimated value
      const estimated = getEstimatedValues(currentExercise.sets, set.id);
      return { value: estimated.weight, isEstimated: true };
    } else {
      // If reps is explicitly set or the set is completed, show the actual value
      if (set.isRepsExplicitlySet || set.completed) {
        return { value: set.reps, isEstimated: false };
      }
      // Otherwise show estimated value
      const estimated = getEstimatedValues(currentExercise.sets, set.id);
      return { value: estimated.reps, isEstimated: true };
    }
  };

  // Function to add a set to the current exercise
  const addSet = () => {
    if (!currentExercise) return;

    setActiveExercises((prevExercises) => {
      // Create a copy of the exercises array
      const updatedExercises = [...prevExercises];

      // Get the current exercise
      const exercise = updatedExercises[currentExerciseIndex];
      if (!exercise) return prevExercises;

      // Get index of the new set being added
      const newSetIndex = exercise.sets.length;

      // Check if this set has a corresponding previous set from previous workout
      const originalExercise = exercises[currentExerciseIndex];
      const hasPreviousSetData =
        originalExercise && newSetIndex < (originalExercise?.sets?.length ?? 0);

      // If there's previous data for this set index, use it
      // Otherwise, use null to display "-" in the UI
      const previousData =
        hasPreviousSetData && originalExercise.sets[newSetIndex]
          ? originalExercise.sets[newSetIndex]
          : { weight: null, reps: null };

      // Add the new set to this exercise
      exercise.sets.push({
        id: Date.now(),
        weight: null,
        reps: null,
        completed: false,
        isWeightExplicitlySet: false,
        isRepsExplicitlySet: false,
        previousWeight: previousData.weight,
        previousReps: previousData.reps,
      });

      return updatedExercises;
    });
  };

  // Function to toggle set completion for the current exercise
  const toggleCompleted = (setId: number) => {
    if (!currentExercise) return;

    setActiveExercises((prevExercises) => {
      // Create a copy of the exercises array
      const updatedExercises = [...prevExercises];

      // Get the current exercise
      const exercise = updatedExercises[currentExerciseIndex];
      if (!exercise) return prevExercises;

      // Update the specified set
      exercise.sets = exercise.sets.map((s) => {
        if (s.id === setId) {
          // When completing a set, save any estimated values as explicit
          if (!s.completed) {
            const estimatedValues = getEstimatedValues(exercise.sets, setId);
            const estimatedWeight = !s.isWeightExplicitlySet
              ? estimatedValues.weight
              : s.weight;
            const estimatedReps = !s.isRepsExplicitlySet
              ? estimatedValues.reps
              : s.reps;

            return {
              ...s,
              completed: !s.completed,
              weight: estimatedWeight,
              reps: estimatedReps,
              isWeightExplicitlySet: true,
              isRepsExplicitlySet: true,
            };
          }
          return { ...s, completed: !s.completed };
        }
        return s;
      });

      return updatedExercises;
    });
  };

  // Functions to update weight and reps
  const updateWeight = (
    setId: number,
    value: number | null,
    isExplicit = true,
  ) => {
    if (!currentExercise) return;

    setActiveExercises((prevExercises) => {
      // Create a copy of the exercises array
      const updatedExercises = [...prevExercises];

      // Get the current exercise
      const exercise = updatedExercises[currentExerciseIndex];
      if (!exercise) return prevExercises;

      // Update the weight for the specified set
      exercise.sets = exercise.sets.map((s) =>
        s.id === setId
          ? { ...s, weight: value, isWeightExplicitlySet: isExplicit }
          : s,
      );

      return updatedExercises;
    });
  };

  const updateReps = (
    setId: number,
    value: number | null,
    isExplicit = true,
  ) => {
    if (!currentExercise) return;

    setActiveExercises((prevExercises) => {
      // Create a copy of the exercises array
      const updatedExercises = [...prevExercises];

      // Get the current exercise
      const exercise = updatedExercises[currentExerciseIndex];
      if (!exercise) return prevExercises;

      // Update the reps for the specified set
      exercise.sets = exercise.sets.map((s) =>
        s.id === setId
          ? { ...s, reps: value, isRepsExplicitlySet: isExplicit }
          : s,
      );

      return updatedExercises;
    });
  };

  // UI interaction handlers
  const handleFocus = (setId: number, field: "weight" | "reps") => {
    if (!currentExercise) return;

    setActiveField({
      exerciseId: currentExercise.id,
      setId,
      field,
    });

    // Set initial input value based on the active field and the current display value
    const setIndex = currentExercise.sets.findIndex((s) => s.id === setId);
    const set = currentExercise.sets[setIndex];

    if (set) {
      const displayValues = displayValue(set, field);
      if (displayValues.value !== null) {
        setInputValue(displayValues.value.toString());
      } else {
        setInputValue("");
      }
    }

    // Mark as first interaction when focusing on a field
    setIsFirstInteraction(true);
  };

  // Navigation between exercises
  const goToNextExercise = () => {
    if (currentExerciseIndex < activeExercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      // Close keyboard when switching exercises
      setActiveField({ exerciseId: null, setId: null, field: null });
    }
  };

  const goToPreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(currentExerciseIndex - 1);
      // Close keyboard when switching exercises
      setActiveField({ exerciseId: null, setId: null, field: null });
    }
  };

  return (
    <div className="container mx-auto max-w-md p-4 pb-[340px]">
      <div className="mb-4 flex items-center justify-between">
        <H4>{workoutName}</H4>
        <div className="text-muted-foreground text-sm">
          Exercise {currentExerciseIndex + 1} of {activeExercises.length}
        </div>
      </div>

      {currentExercise && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPreviousExercise}
              disabled={currentExerciseIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <h2 className="text-xl font-bold">{currentExercise.name}</h2>

            <Button
              variant="outline"
              size="icon"
              onClick={goToNextExercise}
              disabled={currentExerciseIndex === activeExercises.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[10%] px-2 py-2">Set</TableHead>
                  <TableHead className="w-[25%] px-2 py-2">Previous</TableHead>
                  <TableHead className="w-[20%] px-2 py-2">Weight</TableHead>
                  <TableHead className="w-[15%] px-2 py-2">Reps</TableHead>
                  <TableHead className="w-[10%] px-2 py-2">Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentExercise.sets.map((set, index) => {
                  const weightDisplay = displayValue(set, "weight");
                  const repsDisplay = displayValue(set, "reps");

                  return (
                    <TableRow
                      key={set.id}
                      className={cn(set.completed && "bg-success/5")}
                    >
                      <TableCell className="px-2 py-2 text-center">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-2 py-2 text-center">
                        {set.previousWeight && set.previousReps
                          ? `${set.previousWeight}lb × ${set.previousReps}`
                          : "-"}
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div
                          className={cn(
                            "flex h-10 w-full items-center justify-center rounded-md bg-gray-100",
                            activeField.setId === set.id &&
                              activeField.field === "weight" &&
                              "bg-white ring-2 ring-blue-400",
                          )}
                        >
                          <div
                            className="h-full w-full"
                            onClick={() => handleFocus(set.id, "weight")}
                          >
                            {activeField.setId === set.id &&
                            activeField.field === "weight" ? (
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                autoFocus
                                className="h-full w-full rounded bg-transparent px-2 text-center outline-none"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex h-full w-full items-center justify-center text-center",
                                  weightDisplay.isEstimated &&
                                    !set.completed &&
                                    "text-muted-foreground",
                                )}
                              >
                                {weightDisplay.value ?? "-"}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <div
                          className={cn(
                            "flex h-10 w-full items-center justify-center rounded-md bg-gray-100",
                            activeField.setId === set.id &&
                              activeField.field === "reps" &&
                              "bg-white ring-2 ring-blue-400",
                          )}
                        >
                          <div
                            className="h-full w-full"
                            onClick={() => handleFocus(set.id, "reps")}
                          >
                            {activeField.setId === set.id &&
                            activeField.field === "reps" ? (
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                autoFocus
                                className="h-full w-full rounded bg-transparent px-2 text-center outline-none"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex h-full w-full items-center justify-center text-center",
                                  repsDisplay.isEstimated &&
                                    !set.completed &&
                                    "text-muted-foreground",
                                )}
                              >
                                {repsDisplay.value ?? "-"}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2">
                        <Button
                          size="icon"
                          variant={set.completed ? "default" : "secondary"}
                          className={cn(
                            "h-10 w-10",
                            set.completed && "bg-success hover:bg-success/90",
                          )}
                          onClick={() => toggleCompleted(set.id)}
                        >
                          <Check
                            className={cn(
                              "h-5 w-5",
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
          <div className="mt-4 space-y-4">
            <button
              className="flex h-12 w-full items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={addSet}
            >
              + Add Set
            </button>

            {currentExerciseIndex < activeExercises.length - 1 && (
              <Button className="w-full" onClick={goToNextExercise}>
                Next Exercise
              </Button>
            )}
          </div>
        </>
      )}

      {activeField.setId !== null && activeField.field !== null && (
        <Keyboard onKeyPress={handleKeyPress} inputType={activeField.field} />
      )}
    </div>
  );
}
