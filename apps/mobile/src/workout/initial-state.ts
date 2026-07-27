export type MobileWorkoutInitialState = {
  freezeEffects?: boolean;
  workoutErrorMessage?: string;
  home?: {
    limit?: number;
    copyingWorkoutId?: string;
    editingWorkoutId?: string;
    settingsOpen?: boolean;
    deletingAccount?: boolean;
    dialog?: "delete-workout" | "delete-account";
  };
  workout?: {
    newExerciseName?: string;
    setEditor?: "weight" | "reps" | "pause-reps";
    noteEditor?: "pinned" | "workout-exercise" | "set";
    noteDraft?: string;
    exercisePlanOpen?: boolean;
    exercisePlanAutoFocus?: boolean;
    workoutMenuOpen?: boolean;
    workoutNameEditing?: boolean;
    workoutNoteDraft?: string;
    timingOpen?: boolean;
    timingField?: "start" | "end";
    workoutRestTimesOpen?: boolean;
    exerciseRestTimesOpen?: boolean;
    timeEditor?:
      | "start-date"
      | "end-time"
      | "finish-duration"
      | "finish-end-date"
      | "finish-end-time";
    finishPreviewOpen?: boolean;
    bodyWeightDialog?: {
      loading?: boolean;
      error?: string;
    };
    restTimer?: {
      durationSeconds?: number;
      runningSeconds?: number;
      picker?: "presets" | "custom";
    };
    dialog?:
      | "delete-set"
      | "delete-pause"
      | "incomplete-sets"
      | "remove-exercise"
      | "close-workout"
      | "change-set-kind";
    details?: {
      open?: boolean;
      tab?: "about" | "history" | "charts" | "records";
      editing?: boolean;
      startingWeightPicker?: boolean;
      startingWeight?: number;
      autoFocusNote?: boolean;
    };
    exerciseMenuOpen?: boolean;
    previousGroupIndex?: number;
    actionSheet?: "set-command" | "rest-choice";
    swipe?: "base" | "pause";
    helper?: {
      kind: "increase" | "plates";
      mode?: "equal-sides" | "total";
      addedWeight?: number;
      startingWeight?: number;
      targetWeight?: number;
      targetWeightOffset?: number;
      startingWeightPicker?: boolean;
    };
  };
};
