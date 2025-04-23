import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

import { H4 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Save,
  Loader2,
} from "lucide-react";

import { RestTimer } from "@/components/RestTimer";
import { useWorkout } from "../contexts/WorkoutContext";
import { ExerciseCard } from "./ExerciseCard";
import { NumericKeyboard } from "./NumericKeyboard";
import { api } from "@/trpc/react";
import { type WeightModifier } from "@/lib/workoutLogic";

interface WorkoutComponentProps {
  workoutName: string;
}

export function WorkoutComponent({ workoutName }: WorkoutComponentProps) {
  const router = useRouter();
  const { user } = useUser();

  // Get workout state and functions from context
  const {
    state,
    currentExercise,
    activeField,
    inputValue,
    completeSet,
    focusField,
    handleKeyPress,
    addSet,
    navigateExercise,
    addExerciseNote,
    addWorkoutNote,
    updateNotes,
    completeWorkout,
  } = useWorkout();

  // Component state (UI-specific)
  const [showWorkoutNotes, setShowWorkoutNotes] = useState(false);
  const [visibleExerciseNotes, setVisibleExerciseNotes] = useState<number[]>(
    [],
  );
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [startTime] = useState<Date>(new Date());

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Display keyboard when focusing on a field
  useEffect(() => {
    if (activeField.field) {
      setShowKeyboard(true);
    }
  }, [activeField]);

  // Handlers
  const toggleWorkoutNotes = () => {
    setShowWorkoutNotes(!showWorkoutNotes);

    // Focus on textarea when showing notes
    if (!showWorkoutNotes) {
      setTimeout(() => {
        textAreaRef.current?.focus();
      }, 100);
    }
  };

  const toggleExerciseNotes = (exerciseId: number) => {
    setVisibleExerciseNotes((prev) => {
      return prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId];
    });
  };

  const updateWorkoutNote = (text: string) => {
    addWorkoutNote(text);
  };

  const getWorkoutNoteText = () => {
    return state.notes.map((n) => n.text).join("\n");
  };

  const handleUpdateExerciseNote = (exerciseId: number, notes: string) => {
    updateNotes(exerciseId, notes);
  };

  const handleTouchStart = (
    e: React.TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => {
    // Touch handling logic
  };

  const handleTouchMove = (
    e: React.TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => {
    // Touch handling logic
  };

  const handleTouchEnd = (
    e: React.TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => {
    // Touch handling logic
  };

  // tRPC mutation
  const saveWorkoutMutation = api.workout.saveWorkout.useMutation({
    onSuccess: () => {
      toast.success("Workout saved successfully!");
      router.push("/history");
    },
    onError: (error) => {
      toast.error(`Failed to save workout: ${error.message}`);
      setIsSaving(false);
    },
  });

  // Finish workout handler
  const handleFinishWorkout = () => {
    if (!user) {
      toast.error("You must be signed in to save a workout");
      return;
    }

    setIsSaving(true);

    const now = new Date();
    const durationSeconds = Math.floor(
      (now.getTime() - startTime.getTime()) / 1000,
    );

    const finalWorkout = completeWorkout(durationSeconds);

    saveWorkoutMutation.mutate({
      userId: user.id,
      name: finalWorkout.name,
      completedAt: new Date(finalWorkout.date),
      notes: finalWorkout.notes.map((n) => n.text).join("\n"),
      exercises: finalWorkout.exercises.map((ex, i) => ({
        name: ex.name,
        order: i,
        notes: ex.notes.map((n) => n.text).join("\n"),
        sets: ex.sets.map((set) => ({
          order: set.order,
          weight: set.weight,
          reps: set.reps,
          modifier: set.modifier ?? null,
          weightModifier: set.weightModifier ?? null,
          completed: set.completed,
        })),
      })),
    });
  };

  // Get active set weight modifier safely
  const getActiveSetWeightModifier = (): WeightModifier | undefined => {
    if (
      activeField.exerciseIndex !== null &&
      activeField.setIndex !== null &&
      state.exercises.length > 0 &&
      activeField.exerciseIndex < state.exercises.length
    ) {
      const exercise = state.exercises[activeField.exerciseIndex];
      if (exercise?.sets) {
        const set = exercise.sets.find((s) => s.id === activeField.setIndex);
        return set?.weightModifier;
      }
    }
    return undefined;
  };

  // Main render function
  return (
    <div className="pb-20" ref={containerRef}>
      {/* Workout Header */}
      <div className="mb-4 flex items-center justify-between">
        <H4>{workoutName}</H4>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={
              showWorkoutNotes ? "text-primary" : "text-muted-foreground"
            }
            onClick={toggleWorkoutNotes}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setShowFinishDialog(true)}
          >
            <Save className="mr-2 h-4 w-4" />
            Finish
          </Button>
        </div>
      </div>

      {/* Workout Notes */}
      {showWorkoutNotes && (
        <div className="mb-6">
          <Textarea
            ref={textAreaRef}
            placeholder="Enter workout notes..."
            value={getWorkoutNoteText()}
            onChange={(e) => updateWorkoutNote(e.target.value)}
            className="h-[100px] resize-none"
          />
        </div>
      )}

      {/* Rest Timer */}
      <div className="mb-6">
        <RestTimer />
      </div>

      {/* Exercise Navigation */}
      {state.exercises.length > 1 && (
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateExercise(-1)}
            disabled={state.currentExerciseIndex === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <span className="text-muted-foreground text-sm">
            {state.currentExerciseIndex + 1} of {state.exercises.length}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateExercise(1)}
            disabled={state.currentExerciseIndex === state.exercises.length - 1}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Current Exercise Card */}
      {currentExercise && (
        <ExerciseCard
          exercise={currentExercise}
          isActive={true}
          activeField={activeField}
          inputValue={inputValue}
          showNotes={visibleExerciseNotes.includes(currentExercise.id)}
          onToggleNotes={() => toggleExerciseNotes(currentExercise.id)}
          onNoteChange={(notes) =>
            handleUpdateExerciseNote(currentExercise.id, notes)
          }
          onFocusField={focusField}
          onCompleteSet={completeSet}
          onAddSet={addSet}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* Numeric Keyboard */}
      {showKeyboard && activeField.field && (
        <NumericKeyboard
          onKeyPress={handleKeyPress}
          inputType={activeField.field}
          activeSetWeightModifier={getActiveSetWeightModifier()}
        />
      )}

      {/* Finish Workout Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish Workout</DialogTitle>
            <DialogDescription>
              Are you sure you want to finish and save this workout?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFinishDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleFinishWorkout} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Workout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
