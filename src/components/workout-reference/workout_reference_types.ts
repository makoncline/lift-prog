export type RepPart = number | string;

export type CurrentSetKind = "warmup" | "working";
export type WeightMode = "standard" | "bodyweight";
export type EditorField = "weight" | "reps" | "rest" | "note";
export type RestTypeId = string;

export type ExerciseSet = {
  weight: string;
  reps: RepPart[];
  note?: string;
  restBefore?: RestTypeId;
};

export type PreviousExercise = {
  relation: string;
  relativeDate: string;
  date: string;
  workoutNote?: string;
  workoutExerciseNote?: string;
  exerciseNoteChanged?: boolean;
  historicalExerciseNote?: string;
  warmups: ExerciseSet[];
  workingSets: ExerciseSet[];
};

export type TimedRestType = {
  id: RestTypeId;
  kind: "timed";
  seconds: number;
  isDefault: boolean;
};

export type ShortBreakRestType = {
  id: RestTypeId;
  kind: "short";
  label: string;
  isDefault: boolean;
};

export type RestType = TimedRestType | ShortBreakRestType;

export type CurrentExerciseSet = {
  id: string;
  kind: CurrentSetKind;
  weightMode: WeightMode;
  weightAmount: string;
  weightSign: 1 | -1;
  reps: string;
  note?: string;
  restBefore?: RestTypeId;
  completed: boolean;
};
