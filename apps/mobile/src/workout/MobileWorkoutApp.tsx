import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as SecureStore from "expo-secure-store";
import {
  createWorkoutApiClient,
  getWorkoutApiErrorMessage,
} from "@lift-prog/workout-sdk";
import {
  estimate1RM,
  finalizeWorkout,
  initialiseExercises,
  workoutReducer,
  type Action,
  type CompletedWorkout,
  type PlateLoadMode,
  type PreviousExerciseData,
  type SetRestType,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from "@lift-prog/workout-core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { mobileWorkoutApiBaseUrl } from "../lib/config";
import {
  cancelStrengthWorkout,
  finishStrengthWorkout,
  getLatestBodyWeight,
  isHealthAvailable,
  requestHealthAuthorization,
  scheduleWorkoutTimerNotification,
  startStrengthWorkout,
} from "../../modules/lift-health/src";
import { MobileErrorBoundary } from "./MobileErrorBoundary";
import {
  countCompletedExerciseWorkingSets,
  countWorkoutWorkingSets,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelativeDate,
  formatSetInline,
  formatTime,
  formatWeightLabel,
  getSetDisplayValues,
  splitSets,
  summarizeCompletedExerciseSetGroup,
  summarizeWorkoutExerciseSetGroup,
  type IndexedWorkoutSet,
} from "./format";
import { styles } from "./styles";
import { palette } from "./theme";
import {
  buildAddedWeightRepRows,
  calculatePlatePlan,
  formatPlateWeight,
  PLATES,
  type PlateWeight,
  type WeightSuggestion,
} from "./weight_helper";

type WorkoutApiClient = ReturnType<typeof createWorkoutApiClient>;
type RecentWorkout = Awaited<
  ReturnType<WorkoutApiClient["listRecent"]>
>[number];
type PreparedWorkout = Awaited<
  ReturnType<WorkoutApiClient["prepareInitialWorkout"]>
>;
type WorkoutDetails = Awaited<
  ReturnType<WorkoutApiClient["getWorkoutDetails"]>
>;
type ExerciseSuggestion = Awaited<
  ReturnType<WorkoutApiClient["listExercises"]>
>[number];

type LocalWorkoutFixtures = {
  pullDayPrepared: PreparedWorkout;
  preparedByWorkoutId: Map<number, PreparedWorkout>;
  recent: RecentWorkout[];
};

type AppScreen =
  | { name: "home"; refreshKey: number }
  | {
      name: "workout";
      key: number;
      prepared: PreparedWorkout;
      draftWorkout?: Workout;
      workoutId?: number;
      startedAt?: Date;
      completedAt?: Date | null;
      notes?: string | null;
      contextLabel?: string;
    };

type SetEditTarget = {
  exerciseIndex: number;
  setId: string;
  field?: SetEditField;
};

type SetEditField = "weight" | "reps";

type NoteEditTarget =
  | { kind: "workout" }
  | { kind: "exercise"; exerciseIndex: number }
  | { kind: "workout-exercise"; exerciseIndex: number }
  | { kind: "set"; exerciseIndex: number; setId: string };
type TimeEditTarget =
  | "start-date"
  | "start-time"
  | "end-date"
  | "end-time"
  | "finish-end-date"
  | "finish-end-time";
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ACTIVE_WORKOUT_DRAFT_KEY = "lift-prog-active-workout-draft-v1";
const REST_TIMER_SECONDS = 180;

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

type StoredWorkoutDraft = {
  workout: Workout;
  completedAt: string | null;
  savedAt: number;
};

type PendingWorkoutDraft = StoredWorkoutDraft & {
  dismissed?: boolean;
};

type WorkoutSession = {
  past: Workout[];
  present: Workout;
  future: Workout[];
  pendingHistoryBase?: Workout;
};

type WorkoutDispatchOptions = {
  track?: boolean;
  deferHistory?: boolean;
};

type HealthWorkoutState = {
  requested: boolean;
  live: boolean;
  starting: boolean;
  saving: boolean;
  message: string | null;
};

const MAX_MOBILE_DRAFT_HISTORY = 80;
const EPHEMERAL_WORKOUT_ACTIONS = new Set<Action["type"]>([
  "FOCUS_FIELD",
  "COLLAPSE_KEYBOARD",
  "NAV_EXERCISE",
]);

let nextClientId = 1;

function makeClientId() {
  const id = `mobile-set-${nextClientId}`;
  nextClientId += 1;
  return id;
}

function normalizeBodyWeightLb(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : null;

  return numeric != null && Number.isFinite(numeric) && numeric > 0
    ? numeric
    : null;
}

function getUnknownErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function Icon({
  name,
  size = 22,
  color = palette.muted,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function ensureWorkoutSetIds(workout: Workout): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        clientId: set.clientId ?? makeClientId(),
      })),
    })),
  };
}

function createWorkoutState(
  prepared: PreparedWorkout,
  options: {
    startedAt?: Date;
    notes?: string | null;
    isInProgress?: boolean;
    preservePreparedValues?: boolean;
  } = {},
): Workout {
  const exercises = initialiseExercises(
    prepared.exercises as PreviousExerciseData[],
  );
  const hydratedExercises = options.preservePreparedValues
    ? exercises.map((exercise, exerciseIndex) => {
        const preparedExercise = prepared.exercises[exerciseIndex];
        if (!preparedExercise) return exercise;

        return {
          ...exercise,
          notes: preparedExercise.notes?.trim()
            ? [{ text: preparedExercise.notes.trim() }]
            : [],
          sets: exercise.sets.map((set, setIndex) => {
            const preparedSet = preparedExercise.sets[setIndex];
            if (!preparedSet) return set;
            const modifier =
              preparedSet.modifier ??
              (preparedSet.isWarmup ? "warmup" : undefined);

            return {
              ...set,
              weight: preparedSet.weight,
              reps: preparedSet.reps,
              completed: true,
              weightExplicit: preparedSet.weight !== null,
              repsExplicit: preparedSet.reps !== null,
              prevWeight: preparedSet.weight,
              prevReps: preparedSet.reps,
              modifier,
              weightModifier: preparedSet.weightModifier,
              restBefore: preparedSet.restBefore,
              notes: preparedSet.notes ?? undefined,
              rir: preparedSet.rir,
            };
          }),
        };
      })
    : exercises;

  return ensureWorkoutSetIds({
    currentExerciseIndex: 0,
    exercises: hydratedExercises,
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
    notes: options.notes?.trim() ? [{ text: options.notes.trim() }] : [],
    startTime: options.startedAt?.getTime() ?? Date.now(),
    name: prepared.workoutName || "Workout",
    bodyWeightLb: normalizeBodyWeightLb(prepared.bodyWeightLb),
    isInProgress: options.isInProgress ?? true,
  });
}

function blankPreparedWorkout(
  bodyWeightLb: number | null = null,
): PreparedWorkout {
  return {
    workoutName: "Custom Workout",
    bodyWeightLb,
    exercises: [],
  };
}

function applyWorkoutAction(workout: Workout, action: Action) {
  return ensureWorkoutSetIds(workoutReducer(workout, action));
}

function createWorkoutSession(workout: Workout): WorkoutSession {
  return {
    past: [],
    present: ensureWorkoutSetIds(workout),
    future: [],
  };
}

function applyWorkoutSessionAction(
  session: WorkoutSession,
  action: Action,
  options: WorkoutDispatchOptions = {},
): WorkoutSession {
  const nextWorkout = applyWorkoutAction(session.present, action);
  const shouldTrack =
    options.track ?? !EPHEMERAL_WORKOUT_ACTIONS.has(action.type);

  if (!shouldTrack) {
    return { ...session, present: nextWorkout };
  }

  if (options.deferHistory) {
    return {
      ...session,
      present: nextWorkout,
      future: [],
      pendingHistoryBase: session.pendingHistoryBase ?? session.present,
    };
  }

  return pushWorkoutHistory(session, nextWorkout);
}

function pushWorkoutHistory(
  session: WorkoutSession,
  nextWorkout: Workout,
): WorkoutSession {
  const base = session.pendingHistoryBase ?? session.present;
  return {
    past: [...session.past, base].slice(-MAX_MOBILE_DRAFT_HISTORY),
    present: nextWorkout,
    future: [],
    pendingHistoryBase: undefined,
  };
}

function commitPendingWorkoutHistory(session: WorkoutSession): WorkoutSession {
  if (!session.pendingHistoryBase) return session;
  return {
    ...session,
    past: [...session.past, session.pendingHistoryBase].slice(
      -MAX_MOBILE_DRAFT_HISTORY,
    ),
    future: [],
    pendingHistoryBase: undefined,
  };
}

function undoWorkoutSession(session: WorkoutSession): WorkoutSession {
  if (session.pendingHistoryBase) {
    return {
      ...session,
      present: session.pendingHistoryBase,
      future: [session.present, ...session.future],
      pendingHistoryBase: undefined,
    };
  }

  const previous = session.past[session.past.length - 1];
  if (!previous) return session;

  return {
    past: session.past.slice(0, -1),
    present: previous,
    future: [session.present, ...session.future],
  };
}

function redoWorkoutSession(session: WorkoutSession): WorkoutSession {
  const next = session.future[0];
  if (!next) return session;

  return {
    past: [...session.past, session.present].slice(-MAX_MOBILE_DRAFT_HISTORY),
    present: next,
    future: session.future.slice(1),
  };
}

async function readActiveWorkoutDraft(): Promise<StoredWorkoutDraft | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? getWebStorageItem(ACTIVE_WORKOUT_DRAFT_KEY)
        : await SecureStore.getItemAsync(ACTIVE_WORKOUT_DRAFT_KEY);
    return parseStoredWorkoutDraft(raw);
  } catch {
    return null;
  }
}

async function writeActiveWorkoutDraft(draft: StoredWorkoutDraft) {
  const raw = JSON.stringify(draft);
  if (Platform.OS === "web") {
    setWebStorageItem(ACTIVE_WORKOUT_DRAFT_KEY, raw);
    return;
  }

  await SecureStore.setItemAsync(ACTIVE_WORKOUT_DRAFT_KEY, raw);
}

async function clearActiveWorkoutDraft() {
  try {
    if (Platform.OS === "web") {
      removeWebStorageItem(ACTIVE_WORKOUT_DRAFT_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(ACTIVE_WORKOUT_DRAFT_KEY);
  } catch {
    // Draft cleanup should never block navigation after a save or discard.
  }
}

function parseStoredWorkoutDraft(
  raw: string | null,
): StoredWorkoutDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredWorkoutDraft>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.workout ||
      !Array.isArray(parsed.workout.exercises) ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }

    const workout = ensureWorkoutSetIds(parsed.workout);

    return {
      workout: {
        ...workout,
        bodyWeightLb: normalizeBodyWeightLb(workout.bodyWeightLb),
      },
      completedAt:
        typeof parsed.completedAt === "string" ? parsed.completedAt : null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

function getWebStorageItem(key: string) {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
}

function setWebStorageItem(key: string, value: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}

function removeWebStorageItem(key: string) {
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}

function createLocalWorkoutFixtures(): LocalWorkoutFixtures {
  const now = new Date();
  const pullDayDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const pushDayDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const pullDayExercises: PreparedWorkout["exercises"] = [
    {
      userExerciseId: 1,
      name: "Pull-ups",
      exerciseNotes: "Hold dumbbell in thighs",
      sets: [
        {
          weight: -95,
          reps: 15,
          modifier: "warmup",
          weightModifier: "bodyweight",
          notes: "Assisted pull machine",
        },
        { weight: 20, reps: 13, weightModifier: "bodyweight" },
        { weight: null, reps: 8, restBefore: "standard" },
        {
          weight: 0,
          reps: 3,
          weightModifier: "bodyweight",
          restBefore: "short",
        },
      ],
      history: [
        {
          relation: "last time",
          relativeDate: "3 days ago",
          date: "jun 17",
          workoutNote: "Pull day felt low energy",
          workoutExerciseNote: "Feeling weak today",
          sets: [
            {
              weight: -100,
              reps: 15,
              modifier: "warmup",
              weightModifier: "bodyweight",
              notes: "Foot assist",
            },
            { weight: 20, reps: 13, weightModifier: "bodyweight" },
            {
              weight: null,
              reps: 8,
              restBefore: "standard",
              notes: "failed clean on final rep",
            },
          ],
        },
      ],
    },
    {
      userExerciseId: 2,
      name: "Rows",
      sets: [
        { weight: 0, reps: 30, modifier: "warmup" },
        { weight: 75, reps: 11, notes: "12 back only shrugs after" },
        { weight: null, reps: 11, restBefore: "standard" },
      ],
      history: [
        {
          relation: "last time",
          relativeDate: "3 days ago",
          date: "jun 17",
          sets: [
            { weight: 0, reps: 30, modifier: "warmup" },
            { weight: 75, reps: 11, notes: "good control" },
          ],
        },
      ],
    },
    {
      userExerciseId: 3,
      name: "Bicep curl",
      sets: [
        { weight: 30, reps: 13 },
        { weight: null, reps: 9, restBefore: "standard" },
      ],
    },
  ];

  const pushDayExercises: PreparedWorkout["exercises"] = [
    {
      userExerciseId: 4,
      name: "Machine bench press",
      sets: [
        { weight: 45, reps: 12, modifier: "warmup" },
        { weight: 90, reps: 10 },
        { weight: 100, reps: 8, restBefore: "standard" },
        { weight: null, reps: 3, restBefore: "short" },
      ],
    },
    {
      userExerciseId: 5,
      name: "Chest fly",
      sets: [
        { weight: 80, reps: 12 },
        { weight: null, reps: 10, restBefore: "standard" },
      ],
    },
  ];

  const recent: RecentWorkout[] = [
    {
      id: 2,
      name: "Pull day",
      startedAt: pullDayDate,
      completedAt: new Date(pullDayDate.getTime() + 43 * 60 * 1000),
      bodyWeightLb: 173,
      exerciseSummaries: [
        "Pull-ups - BW+20lbx13,8+BWx3",
        "Rows - 75lbx11,11",
        "Bicep curl - 30lbx13,9",
      ],
    },
    {
      id: 1,
      name: "Push day",
      startedAt: pushDayDate,
      completedAt: new Date(pushDayDate.getTime() + 49 * 60 * 1000),
      bodyWeightLb: 174,
      exerciseSummaries: [
        "Machine bench press - 90lbx10,100lbx8+3",
        "Chest fly - 80lbx12,10",
      ],
    },
  ];

  const preparedByWorkoutId = new Map<number, PreparedWorkout>([
    [
      2,
      {
        workoutName: "Pull day",
        bodyWeightLb: 173,
        exercises: pullDayExercises,
      },
    ],
    [
      1,
      {
        workoutName: "Push day",
        bodyWeightLb: 174,
        exercises: pushDayExercises,
      },
    ],
  ]);

  return {
    pullDayPrepared: preparedByWorkoutId.get(2)!,
    preparedByWorkoutId,
    recent,
  };
}

function createLocalWorkoutApiClient(
  fixtures: LocalWorkoutFixtures = createLocalWorkoutFixtures(),
): WorkoutApiClient {
  const { preparedByWorkoutId, recent } = fixtures;
  const getLatestBodyWeightLb = () =>
    recent.find((workout) => workout.bodyWeightLb != null)?.bodyWeightLb ??
    null;

  return {
    async listRecent(input) {
      return recent.slice(0, input?.limit ?? 10);
    },
    async prepareInitialWorkout(input) {
      if (input.mode === "workoutReference") {
        return (
          preparedByWorkoutId.get(input.workoutId) ??
          blankPreparedWorkout(getLatestBodyWeightLb())
        );
      }

      return {
        workoutName: input.workoutName ?? "Custom Workout",
        bodyWeightLb: getLatestBodyWeightLb(),
        exercises: input.exerciseNames.map((name, index) => ({
          userExerciseId: 100 + index,
          name,
          sets: [],
          history: [],
        })),
      };
    },
    async listExercises() {
      const byName = new Map<
        string,
        RecentWorkout["exerciseSummaries"][number]
      >();
      for (const workout of recent) {
        for (const summary of workout.exerciseSummaries) {
          const { exerciseName } = splitExerciseSummary(summary);
          if (exerciseName && !byName.has(exerciseName)) {
            byName.set(exerciseName, summary);
          }
        }
      }

      return Array.from(byName.keys())
        .sort((a, b) => a.localeCompare(b))
        .map((name, index) => ({
          id: 10_000 + index,
          name,
          notes: null,
          exerciseId: null,
          plateStartingWeight: null,
          plateLoadMode: null,
        }));
    },
    async saveWorkout(input) {
      const nextId = recent.length + 1;
      recent.unshift({
        id: nextId,
        name: input.name,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        bodyWeightLb: input.bodyWeightLb,
        exerciseSummaries: input.exercises.map(
          (exercise) =>
            `${exercise.name} - ${
              summarizeCompletedExerciseSetGroup(
                exercise.sets.filter((set) => set.modifier !== "warmup"),
              ) ?? ""
            }`,
        ),
      });
      return { success: true, workoutId: nextId };
    },
    async getWorkoutDetails(input) {
      const prepared =
        preparedByWorkoutId.get(input.workoutId) ??
        blankPreparedWorkout(getLatestBodyWeightLb());
      const recentWorkout = recent.find(
        (workout) => workout.id === input.workoutId,
      );

      return {
        ...prepared,
        bodyWeightLb: prepared.bodyWeightLb ?? getLatestBodyWeightLb(),
        startedAt: recentWorkout?.startedAt ?? new Date(),
        completedAt: recentWorkout?.completedAt ?? null,
        notes: null,
      };
    },
    async updateWorkout(input) {
      const existingIndex = recent.findIndex(
        (workout) => workout.id === input.workoutId,
      );
      if (existingIndex >= 0) {
        recent[existingIndex] = {
          id: input.workoutId,
          name: input.workout.name,
          startedAt: input.workout.startedAt,
          completedAt: input.workout.completedAt,
          bodyWeightLb: input.workout.bodyWeightLb,
          exerciseSummaries: input.workout.exercises.map(
            (exercise) =>
              `${exercise.name} - ${
                summarizeCompletedExerciseSetGroup(
                  exercise.sets.filter((set) => set.modifier !== "warmup"),
                ) ?? ""
              }`,
          ),
        };
      }
      return { success: true, workoutId: input.workoutId };
    },
    async deleteWorkout(input) {
      const existingIndex = recent.findIndex(
        (workout) => workout.id === input.workoutId,
      );
      if (existingIndex >= 0) {
        recent.splice(existingIndex, 1);
      }
      return { success: true };
    },
  };
}

export function LiftMobileApp({
  getHeaders,
  localDevUserId,
  onSignOut,
}: {
  getHeaders?: () => Promise<Record<string, string>>;
  localDevUserId?: string;
  onSignOut?: () => void;
}) {
  const localFixtures = useMemo(
    () => (localDevUserId ? createLocalWorkoutFixtures() : null),
    [localDevUserId],
  );
  const api = useMemo(
    () =>
      localFixtures
        ? createLocalWorkoutApiClient(localFixtures)
        : createWorkoutApiClient({
            baseUrl: mobileWorkoutApiBaseUrl,
            getHeaders,
          }),
    [getHeaders, localFixtures],
  );
  const [screen, setScreen] = useState<AppScreen>(() => ({
    name: "home",
    refreshKey: 0,
  }));
  const [pendingDraft, setPendingDraft] = useState<PendingWorkoutDraft | null>(
    null,
  );
  const checkedDraftRef = useRef(false);
  const returnHome = useCallback(() => {
    setScreen((current) => ({
      name: "home",
      refreshKey: current.name === "home" ? current.refreshKey + 1 : Date.now(),
    }));
  }, []);

  useEffect(() => {
    if (checkedDraftRef.current) return;
    checkedDraftRef.current = true;

    let cancelled = false;
    void readActiveWorkoutDraft().then((draft) => {
      if (cancelled || !draft || draft.workout.exercises.length === 0) return;
      setPendingDraft(draft);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (screen.name === "workout") {
    return (
      <MobileErrorBoundary
        key={`workout-boundary-${screen.key}`}
        scope="mobile-workout"
        screen={screen.workoutId ? "workout-edit" : "workout"}
        title="workout crashed"
        getHeaders={getHeaders}
        recoverLabel="home"
        onRecover={returnHome}
      >
        <WorkoutScreen
          api={api}
          prepared={screen.prepared}
          draftWorkout={screen.draftWorkout}
          workoutId={screen.workoutId}
          startedAt={screen.startedAt}
          completedAt={screen.completedAt}
          workoutNote={screen.notes ?? null}
          contextLabel={screen.contextLabel}
          onBack={returnHome}
        />
      </MobileErrorBoundary>
    );
  }

  return (
    <HomeScreen
      api={api}
      refreshKey={screen.refreshKey}
      pendingDraft={pendingDraft}
      onSignOut={onSignOut}
      onContinueDraft={(draft) => {
        setPendingDraft(null);
        setScreen({
          name: "workout",
          key: Date.now(),
          prepared: blankPreparedWorkout(draft.workout.bodyWeightLb ?? null),
          draftWorkout: draft.workout,
          completedAt: draft.completedAt ? new Date(draft.completedAt) : null,
          contextLabel: "continued active workout",
        });
      }}
      onDismissDraft={() =>
        setPendingDraft((current) =>
          current ? { ...current, dismissed: true } : current,
        )
      }
      onDiscardDraft={() => {
        setPendingDraft(null);
        void clearActiveWorkoutDraft();
      }}
      onStartBlank={(bodyWeightLb) =>
        setScreen({
          name: "workout",
          key: Date.now(),
          prepared: blankPreparedWorkout(bodyWeightLb),
        })
      }
      onStartPrepared={(prepared) =>
        setScreen({ name: "workout", key: Date.now(), prepared })
      }
      onEditWorkout={(workoutId, details) =>
        setScreen({
          name: "workout",
          key: Date.now(),
          workoutId,
          prepared: details,
          startedAt: details.startedAt,
          completedAt: details.completedAt,
          notes: details.notes ?? null,
          contextLabel: `editing past workout #${workoutId}`,
        })
      }
    />
  );
}

function HomeScreen({
  api,
  refreshKey,
  pendingDraft,
  onSignOut,
  onContinueDraft,
  onDismissDraft,
  onDiscardDraft,
  onStartBlank,
  onStartPrepared,
  onEditWorkout,
}: {
  api: WorkoutApiClient;
  refreshKey: number;
  pendingDraft: PendingWorkoutDraft | null;
  onSignOut?: () => void;
  onContinueDraft: (draft: StoredWorkoutDraft) => void;
  onDismissDraft: () => void;
  onDiscardDraft: () => void;
  onStartBlank: (bodyWeightLb: number | null) => void;
  onStartPrepared: (prepared: PreparedWorkout) => void;
  onEditWorkout: (workoutId: number, details: WorkoutDetails) => void;
}) {
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<RecentWorkout[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyingWorkoutId, setCopyingWorkoutId] = useState<number | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(
    null,
  );
  const loadRequestIdRef = useRef(0);
  const navigationRequestIdRef = useRef(0);
  const latestBodyWeightLb = useMemo(
    () =>
      workouts.find((workout) => workout.bodyWeightLb != null)?.bodyWeightLb ??
      null,
    [workouts],
  );
  const getPreviousBodyWeightLb = useCallback(
    (workout: RecentWorkout) => {
      const workoutIndex = workouts.findIndex(
        (entry) => entry.id === workout.id,
      );
      if (workoutIndex < 0) return latestBodyWeightLb;

      return (
        workouts
          .slice(workoutIndex + 1)
          .find((entry) => entry.bodyWeightLb != null)?.bodyWeightLb ??
        latestBodyWeightLb
      );
    },
    [latestBodyWeightLb, workouts],
  );

  const loadWorkouts = useCallback(
    async (nextLimit: number, options: { refresh?: boolean } = {}) => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      if (options.refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const recent = await api.listRecent({ limit: nextLimit });
        if (loadRequestIdRef.current !== requestId) return;
        setWorkouts(recent);
      } catch (loadError) {
        if (loadRequestIdRef.current !== requestId) return;
        setError(getWorkoutApiErrorMessage(loadError));
      } finally {
        if (loadRequestIdRef.current !== requestId) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void loadWorkouts(limit);
  }, [limit, loadWorkouts, refreshKey]);

  const copyWorkout = async (workout: RecentWorkout) => {
    const requestId = navigationRequestIdRef.current + 1;
    navigationRequestIdRef.current = requestId;
    setCopyingWorkoutId(workout.id);
    setEditingWorkoutId(null);
    setError(null);
    try {
      const prepared = await api.prepareInitialWorkout({
        mode: "workoutReference",
        workoutId: workout.id,
      });
      if (navigationRequestIdRef.current !== requestId) return;
      onStartPrepared({
        ...prepared,
        bodyWeightLb: normalizeBodyWeightLb(
          prepared.bodyWeightLb ??
            workout.bodyWeightLb ??
            getPreviousBodyWeightLb(workout),
        ),
      });
    } catch (copyError) {
      if (navigationRequestIdRef.current !== requestId) return;
      setError(getWorkoutApiErrorMessage(copyError));
    } finally {
      if (navigationRequestIdRef.current === requestId) {
        setCopyingWorkoutId(null);
      }
    }
  };

  const editWorkout = async (workout: RecentWorkout) => {
    const requestId = navigationRequestIdRef.current + 1;
    navigationRequestIdRef.current = requestId;
    setEditingWorkoutId(workout.id);
    setCopyingWorkoutId(null);
    setError(null);
    try {
      const details = await api.getWorkoutDetails({ workoutId: workout.id });
      if (navigationRequestIdRef.current !== requestId) return;
      onEditWorkout(workout.id, {
        ...details,
        bodyWeightLb:
          details.bodyWeightLb ?? getPreviousBodyWeightLb(workout) ?? null,
      });
    } catch (editError) {
      if (navigationRequestIdRef.current !== requestId) return;
      setError(getWorkoutApiErrorMessage(editError));
    } finally {
      if (navigationRequestIdRef.current === requestId) {
        setEditingWorkoutId(null);
      }
    }
  };

  const deleteWorkout = async (workout: RecentWorkout) => {
    setDeletingWorkoutId(workout.id);
    setError(null);
    try {
      await api.deleteWorkout({ workoutId: workout.id });
      await loadWorkouts(limit);
    } catch (deleteError) {
      setError(getWorkoutApiErrorMessage(deleteError));
    } finally {
      setDeletingWorkoutId(null);
    }
  };

  const confirmDeleteWorkout = (workout: RecentWorkout) => {
    Alert.alert("Delete workout?", workout.name, [
      { text: "cancel", style: "cancel" },
      {
        text: "delete",
        style: "destructive",
        onPress: () => void deleteWorkout(workout),
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.topActions}>
        <Pressable
          accessibilityLabel="Start new workout"
          accessibilityRole="button"
          style={styles.iconButton}
          testID="home-start-new-workout"
          onPress={() => onStartBlank(latestBodyWeightLb)}
        >
          <Text style={styles.iconButtonText}>+</Text>
        </Pressable>
        {onSignOut ? (
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            style={styles.iconButton}
            testID="home-sign-out"
            onPress={onSignOut}
          >
            <Icon name="log-out-outline" />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          { paddingBottom: insets.bottom + 24 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadWorkouts(limit, { refresh: true })}
          />
        }
      >
        <Text style={styles.title}>Lift Prog</Text>
        <Text style={styles.subtleTitle}>workouts</Text>

        {loading && workouts.length === 0 ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color={palette.active} />
            <Text style={styles.mutedText}>loading workouts</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {workouts.map((workout) => (
          <WorkoutHistoryRow
            key={workout.id}
            workout={workout}
            copying={copyingWorkoutId === workout.id}
            editing={editingWorkoutId === workout.id}
            deleting={deletingWorkoutId === workout.id}
            onCopy={() => void copyWorkout(workout)}
            onEdit={() => void editWorkout(workout)}
            onDelete={() => confirmDeleteWorkout(workout)}
          />
        ))}

        {workouts.length >= limit ? (
          <Pressable
            accessibilityLabel="Show more workouts"
            accessibilityRole="button"
            style={styles.textButton}
            testID="home-show-more-workouts"
            onPress={() => setLimit((current) => current + 10)}
          >
            <Text style={styles.textButtonText}>show more</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <ActiveWorkoutDraftSheet
        draft={pendingDraft?.dismissed ? null : pendingDraft}
        onContinue={onContinueDraft}
        onDismiss={onDismissDraft}
        onDiscard={onDiscardDraft}
      />
    </SafeAreaView>
  );
}

function ActiveWorkoutDraftSheet({
  draft,
  onContinue,
  onDismiss,
  onDiscard,
}: {
  draft: PendingWorkoutDraft | null;
  onContinue: (draft: StoredWorkoutDraft) => void;
  onDismiss: () => void;
  onDiscard: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!draft) return null;

  const exerciseCount = draft.workout.exercises.length;
  const savedAt = new Date(draft.savedAt);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <DismissibleModalShade onDismiss={onDismiss}>
        <View style={styles.recoverySheetSafeArea}>
          <View
            style={[
              styles.recoverySheet,
              { paddingBottom: Math.max(12, insets.bottom + 8) },
            ]}
          >
            <Text style={styles.subtleTitle}>workout in progress</Text>
            <Text style={styles.historyTitle}>{draft.workout.name}</Text>
            <Text style={styles.metaText}>
              {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"} .
              saved {formatRelativeDate(savedAt)} . {formatTime(savedAt)}
            </Text>
            <Text style={styles.mutedText}>
              Continue where you left off, leave it saved for later, or discard
              the saved draft from this phone.
            </Text>
            <View style={styles.recoveryActions}>
              <Pressable
                accessibilityLabel="Discard saved workout draft"
                accessibilityRole="button"
                style={styles.textButton}
                testID="active-draft-discard"
                onPress={onDiscard}
              >
                <Text style={styles.textButtonText}>discard</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Keep saved workout draft for later"
                accessibilityRole="button"
                style={styles.textButton}
                testID="active-draft-not-now"
                onPress={onDismiss}
              >
                <Text style={styles.textButtonText}>not now</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Continue workout in progress"
                accessibilityRole="button"
                style={[styles.textButton, styles.primaryWideButton]}
                testID="active-draft-continue"
                onPress={() => onContinue(draft)}
              >
                <Text style={styles.primaryWideButtonText}>continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </DismissibleModalShade>
    </Modal>
  );
}

function DismissibleModalShade({
  children,
  keyboardAvoiding = false,
  onDismiss,
  style = styles.modalShade,
}: {
  children: React.ReactNode;
  keyboardAvoiding?: boolean;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <Pressable
      style={styles.dismissibleModalContent}
      onPress={(event) => event.stopPropagation()}
    >
      {children}
    </Pressable>
  );

  return (
    <Pressable style={style} onPress={onDismiss}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoidingModalContent}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Pressable>
  );
}

function useNativeKeyboardFrame() {
  const [frame, setFrame] = useState({ height: 0, visible: false });

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) =>
      setFrame({
        height: Math.max(0, event.endCoordinates.height),
        visible: true,
      }),
    );
    const hide = Keyboard.addListener(hideEvent, () =>
      setFrame((current) => ({ ...current, visible: false })),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return frame;
}

function WorkoutHistoryRow({
  workout,
  copying,
  editing,
  deleting,
  onCopy,
  onEdit,
  onDelete,
}: {
  workout: RecentWorkout;
  copying: boolean;
  editing: boolean;
  deleting: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const completedAt = workout.completedAt;
  return (
    <View style={styles.historyRow}>
      <View style={styles.rowHeader}>
        <View style={styles.flexColumn}>
          <Text style={styles.historyTitle}>{workout.name}</Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            accessibilityLabel={`Copy ${workout.name} into a new workout`}
            accessibilityRole="button"
            style={styles.iconButtonSmall}
            testID={`home-copy-workout-${workout.id}`}
            onPress={onCopy}
            disabled={copying}
          >
            {copying ? (
              <Text style={styles.iconButtonTextSmall}>...</Text>
            ) : (
              <Icon name="copy-outline" size={20} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel={`Edit ${workout.name}`}
            accessibilityRole="button"
            style={styles.iconButtonSmall}
            testID={`home-edit-workout-${workout.id}`}
            onPress={onEdit}
            disabled={editing}
          >
            {editing ? (
              <Text style={styles.iconButtonTextSmall}>...</Text>
            ) : (
              <Icon name="pencil-outline" size={20} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel={`Delete ${workout.name}`}
            accessibilityRole="button"
            style={styles.iconButtonSmall}
            testID={`home-delete-workout-${workout.id}`}
            onPress={onDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Text style={styles.iconButtonTextSmall}>...</Text>
            ) : (
              <Icon name="trash-outline" size={20} />
            )}
          </Pressable>
        </View>
      </View>
      <Text style={styles.metaText}>
        {formatRelativeDate(completedAt)} . {formatDateTime(completedAt)} (
        {formatDuration(workout.startedAt, completedAt)})
      </Text>
      {workout.bodyWeightLb ? (
        <Text style={styles.noteBadge}>
          {formatNumber(workout.bodyWeightLb)}lb body weight
        </Text>
      ) : null}
      {workout.exerciseSummaries.map((summary) => {
        const { exerciseName, sets } = splitExerciseSummary(summary);
        return (
          <View key={summary} style={styles.historySummaryRow}>
            <Text style={styles.historySummaryName}>{exerciseName}</Text>
            <Text style={styles.historySummarySets}>{sets}</Text>
          </View>
        );
      })}
    </View>
  );
}

function splitExerciseSummary(summary: string) {
  const separator = " - ";
  const index = summary.indexOf(separator);
  if (index === -1) return { exerciseName: summary, sets: "" };
  return {
    exerciseName: summary.slice(0, index),
    sets: summary.slice(index + separator.length),
  };
}

function WorkoutScreen({
  api,
  prepared,
  draftWorkout,
  workoutId,
  startedAt,
  completedAt: initialCompletedAt,
  workoutNote,
  contextLabel,
  onBack,
}: {
  api: WorkoutApiClient;
  prepared: PreparedWorkout;
  draftWorkout?: Workout;
  workoutId?: number;
  startedAt?: Date;
  completedAt?: Date | null;
  workoutNote?: string | null;
  contextLabel?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isEditingPastWorkout = workoutId != null;
  const [session, setSession] = useState(() =>
    createWorkoutSession(
      draftWorkout
        ? ensureWorkoutSetIds(draftWorkout)
        : createWorkoutState(prepared, {
            startedAt,
            notes: workoutNote,
            isInProgress: !isEditingPastWorkout,
            preservePreparedValues: isEditingPastWorkout,
          }),
    ),
  );
  const workout = session.present;
  const canUndo =
    session.past.length > 0 || Boolean(session.pendingHistoryBase);
  const canRedo = session.future.length > 0;
  const [completedAt, setCompletedAt] = useState<Date | null>(
    initialCompletedAt ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [addingExercise, setAddingExercise] = useState(false);
  const [exerciseSuggestions, setExerciseSuggestions] = useState<
    ExerciseSuggestion[]
  >([]);
  const [exerciseSuggestionsLoaded, setExerciseSuggestionsLoaded] =
    useState(false);
  const [setEditor, setSetEditor] = useState<SetEditTarget | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditTarget | null>(null);
  const [timeEditor, setTimeEditor] = useState<TimeEditTarget | null>(null);
  const [finishPreviewOpen, setFinishPreviewOpen] = useState(false);
  const [healthWorkout, setHealthWorkout] = useState<HealthWorkoutState>({
    requested: false,
    live: false,
    starting: false,
    saving: false,
    message: null,
  });
  const [timerStatus, setTimerStatus] = useState<string | null>(null);
  const [restTimerEndsAt, setRestTimerEndsAt] = useState<number | null>(null);
  const [planDragging, setPlanDragging] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const draftWriteGenerationRef = useRef(0);
  const draftWritePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const draftWritesSuppressedRef = useRef(false);
  const bodyWeightEditedRef = useRef(false);
  const healthPromptShownRef = useRef(false);
  const restTimerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const tickMs = restTimerEndsAt == null ? 30_000 : 1_000;
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [restTimerEndsAt]);

  useEffect(
    () => () => {
      if (restTimerTimeoutRef.current) {
        clearTimeout(restTimerTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (isEditingPastWorkout || workout.exercises.length === 0) return;

    const generation = draftWriteGenerationRef.current + 1;
    draftWriteGenerationRef.current = generation;
    const timeout = setTimeout(() => {
      if (
        draftWritesSuppressedRef.current ||
        draftWriteGenerationRef.current !== generation
      ) {
        return;
      }

      const writePromise = writeActiveWorkoutDraft({
        workout,
        completedAt: completedAt?.toISOString() ?? null,
        savedAt: Date.now(),
      }).catch(() => {
        // A failed draft write should not block the active workout.
      });
      draftWritePromiseRef.current = writePromise;
      void writePromise;
    }, 300);

    return () => clearTimeout(timeout);
  }, [completedAt, isEditingPastWorkout, workout]);

  useEffect(() => {
    let cancelled = false;
    setExerciseSuggestionsLoaded(false);
    void api
      .listExercises()
      .then((suggestions) => {
        if (!cancelled) setExerciseSuggestions(suggestions);
      })
      .catch(() => {
        if (!cancelled) setExerciseSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setExerciseSuggestionsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  const dispatch = useCallback(
    (action: Action, options?: WorkoutDispatchOptions) => {
      setSession((current) =>
        applyWorkoutSessionAction(current, action, options),
      );
    },
    [],
  );
  const commitPendingHistory = useCallback(() => {
    setSession(commitPendingWorkoutHistory);
  }, []);
  const clearPersistedActiveWorkout = useCallback(async () => {
    draftWriteGenerationRef.current += 1;
    draftWritesSuppressedRef.current = true;
    await draftWritePromiseRef.current;
    await clearActiveWorkoutDraft();
  }, []);

  const applyLatestHealthBodyWeight = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    const latest = await getLatestBodyWeight();
    const latestBodyWeight = normalizeBodyWeightLb(latest?.valueLb);
    if (latestBodyWeight == null || bodyWeightEditedRef.current) return;
    dispatch({
      type: "UPDATE_BODY_WEIGHT",
      bodyWeightLb: latestBodyWeight,
    });
  }, [dispatch]);

  const startHealthWorkoutFlow = useCallback(async () => {
    if (Platform.OS !== "ios" || !isHealthAvailable()) {
      setHealthWorkout((current) => ({
        ...current,
        message: "Apple Health is not available on this device.",
      }));
      return;
    }

    setHealthWorkout((current) => ({
      ...current,
      starting: true,
      message: "starting health workout",
    }));

    try {
      const authorization = await requestHealthAuthorization();
      await applyLatestHealthBodyWeight().catch(() => undefined);

      if (!authorization.canWriteWorkouts) {
        setHealthWorkout({
          requested: false,
          live: false,
          starting: false,
          saving: false,
          message: "Health workout permission is off.",
        });
        return;
      }

      const result = await withTimeout(
        startStrengthWorkout(workout.startTime),
        15_000,
        "Apple Health workout did not start.",
      );
      setHealthWorkout({
        requested: result.started,
        live: result.live,
        starting: false,
        saving: false,
        message:
          result.message ??
          (result.live
            ? "health workout running"
            : "health workout will save on finish"),
      });
    } catch (healthError) {
      setHealthWorkout({
        requested: false,
        live: false,
        starting: false,
        saving: false,
        message: getUnknownErrorMessage(healthError),
      });
    }
  }, [applyLatestHealthBodyWeight, workout.startTime]);

  useEffect(() => {
    if (isEditingPastWorkout || draftWorkout || healthPromptShownRef.current) {
      return;
    }
    if (Platform.OS !== "ios" || !isHealthAvailable()) {
      return;
    }

    healthPromptShownRef.current = true;
    Alert.alert(
      "Start Apple Health workout?",
      "Save this as strength training and collect available Health metrics.",
      [
        { text: "not now", style: "cancel" },
        { text: "start", onPress: () => void startHealthWorkoutFlow() },
      ],
    );
  }, [draftWorkout, isEditingPastWorkout, startHealthWorkoutFlow]);

  const moveExerciseTo = useCallback(
    (exerciseIndex: number, targetIndex: number) => {
      dispatch({ type: "MOVE_EXERCISE_TO", exerciseIndex, targetIndex });
    },
    [dispatch],
  );

  const addExercise = async (exerciseName = newExerciseName) => {
    const name = exerciseName.trim();
    if (!name) return;
    setAddingExercise(true);
    setError(null);
    try {
      const preparedExercise = await api.prepareInitialWorkout({
        mode: "exerciseList",
        exerciseNames: [name],
        workoutName: workout.name,
      });
      const [exercise] = initialiseExercises(
        preparedExercise.exercises as PreviousExerciseData[],
      );
      if (!exercise) return;
      dispatch({ type: "ADD_EXERCISE", exercise });
      setNewExerciseName("");
    } catch (addError) {
      setError(getWorkoutApiErrorMessage(addError));
    } finally {
      setAddingExercise(false);
    }
  };

  const updateWorkoutNote = (text: string) => {
    const nextText = text.trim();
    if (!nextText) {
      if (workout.notes[0]) {
        dispatch({ type: "DELETE_WORKOUT_NOTE", noteIndex: 0 });
      }
      return;
    }
    if (workout.notes[0]) {
      dispatch({ type: "UPDATE_WORKOUT_NOTE", noteIndex: 0, text: nextText });
    } else {
      dispatch({ type: "ADD_WORKOUT_NOTE", text: nextText });
    }
  };

  const updateWorkoutExerciseNote = (exerciseIndex: number, text: string) => {
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return;
    const nextText = text.trim();
    if (!nextText) {
      if (exercise.notes[0]) {
        dispatch({ type: "DELETE_EXERCISE_NOTE", exerciseIndex, noteIndex: 0 });
      }
      return;
    }
    if (exercise.notes[0]) {
      dispatch({
        type: "UPDATE_EXERCISE_NOTE",
        exerciseIndex,
        noteIndex: 0,
        text: nextText,
      });
    } else {
      dispatch({ type: "ADD_EXERCISE_NOTE", exerciseIndex, text: nextText });
    }
  };

  const updateStartTime = (startTime: number) => {
    const previousStartTime = workout.startTime;
    if (!Number.isFinite(startTime) || startTime === previousStartTime) return;

    if (isEditingPastWorkout && completedAt) {
      const durationMs = completedAt.getTime() - previousStartTime;
      setCompletedAt(new Date(startTime + Math.max(60_000, durationMs)));
    }

    dispatch({ type: "UPDATE_WORKOUT_START_TIME", startTime });
  };

  const updateCompletedAt = (completedTime: number) => {
    if (!Number.isFinite(completedTime)) return;
    setCompletedAt(
      new Date(Math.max(workout.startTime + 60_000, completedTime)),
    );
  };

  const handleFinishPress = () => {
    if (workout.exercises.length === 0) {
      setError("Add at least one exercise before finishing.");
      return;
    }
    if (isEditingPastWorkout) {
      void saveEditedWorkout();
      return;
    }
    if (!completedAt) {
      setCompletedAt(defaultCompletedAtForStartTime(workout.startTime));
    }
    setFinishPreviewOpen(true);
  };

  const closeWorkout = () => {
    if (isEditingPastWorkout || workout.exercises.length === 0) {
      onBack();
      return;
    }

    Alert.alert(
      "Close workout?",
      "This workout draft will stay saved on this device.",
      [
        { text: "keep editing", style: "cancel" },
        { text: "close", onPress: onBack },
        {
          text: "discard",
          style: "destructive",
          onPress: () => {
            void Promise.allSettled([
              clearPersistedActiveWorkout(),
              cancelStrengthWorkout(),
            ]).finally(onBack);
          },
        },
      ],
    );
  };

  const finishedWorkout = useMemo(() => {
    if (!finishPreviewOpen) return null;
    const workoutNote = workout.notes[0]?.text;
    const payload = finalizeWorkout(workout, workoutNote);
    return {
      ...payload,
      completedAt:
        completedAt ?? defaultCompletedAtForStartTime(workout.startTime),
      startedAt: new Date(workout.startTime),
    };
  }, [completedAt, finishPreviewOpen, workout]);

  const saveFinishedWorkout = async () => {
    if (!finishedWorkout) return;
    setSaving(true);
    setError(null);
    try {
      if (healthWorkout.requested) {
        setHealthWorkout((current) => ({
          ...current,
          saving: true,
          message: "saving health workout",
        }));
        try {
          const healthResult = await withTimeout(
            finishStrengthWorkout(
              finishedWorkout.startedAt.getTime(),
              finishedWorkout.completedAt.getTime(),
            ),
            20_000,
            "Apple Health workout did not finish.",
          );
          setHealthWorkout((current) => ({
            ...current,
            live: false,
            saving: false,
            message: healthResult.saved
              ? "health workout saved"
              : (healthResult.message ?? "health workout was not saved"),
          }));
        } catch (healthError) {
          setHealthWorkout((current) => ({
            ...current,
            live: false,
            saving: false,
            message: `health save failed: ${getUnknownErrorMessage(healthError)}`,
          }));
        }
      }
      await api.saveWorkout(finishedWorkout);
      await clearPersistedActiveWorkout();
      setFinishPreviewOpen(false);
      onBack();
    } catch (saveError) {
      setError(getWorkoutApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const buildUpdatedWorkout = () => {
    const workoutNoteText = workout.notes[0]?.text;
    const payload = finalizeWorkout(workout, workoutNoteText);
    return {
      ...payload,
      completedAt:
        completedAt ?? defaultCompletedAtForStartTime(workout.startTime),
      startedAt: new Date(workout.startTime),
    };
  };

  const saveEditedWorkout = async () => {
    if (!workoutId) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateWorkout({
        workoutId,
        workout: buildUpdatedWorkout(),
      });
      onBack();
    } catch (saveError) {
      setError(getWorkoutApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkout = () => {
    if (!workoutId) return;
    Alert.alert("Delete workout?", workout.name, [
      { text: "cancel", style: "cancel" },
      {
        text: "delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          setError(null);
          try {
            await api.deleteWorkout({ workoutId });
            onBack();
          } catch (deleteError) {
            setError(getWorkoutApiErrorMessage(deleteError));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const deleteExercise = (exerciseIndex: number) => {
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return;
    Alert.alert("Delete exercise?", exercise.name, [
      { text: "cancel", style: "cancel" },
      {
        text: "delete",
        style: "destructive",
        onPress: () => dispatch({ type: "DELETE_EXERCISE", exerciseIndex }),
      },
    ]);
  };

  const stopRestTimer = () => {
    if (restTimerTimeoutRef.current) {
      clearTimeout(restTimerTimeoutRef.current);
      restTimerTimeoutRef.current = null;
    }
    setRestTimerEndsAt(null);
    setTimerStatus(null);
  };

  const startRestTimer = async () => {
    stopRestTimer();

    setTimerStatus("starting 3m timer");
    try {
      const result = await withTimeout(
        scheduleWorkoutTimerNotification(REST_TIMER_SECONDS),
        60_000,
        "Notification permission did not respond.",
      );
      if (result.scheduled) {
        const endsAt = Date.now() + REST_TIMER_SECONDS * 1000;
        setNow(Date.now());
        setRestTimerEndsAt(endsAt);
        setTimerStatus(null);
        restTimerTimeoutRef.current = setTimeout(() => {
          setRestTimerEndsAt(null);
          setTimerStatus("3m timer done");
          restTimerTimeoutRef.current = null;
        }, REST_TIMER_SECONDS * 1000);
        return;
      }

      setTimerStatus(result.message ?? "timer was not scheduled");
    } catch (timerError) {
      setTimerStatus(getUnknownErrorMessage(timerError));
    }
  };

  const toggleRestTimer = async () => {
    if (restTimerEndsAt != null || restTimerTimeoutRef.current) {
      stopRestTimer();
      return;
    }

    await startRestTimer();
  };

  const restTimerRemainingSeconds =
    restTimerEndsAt == null ? null : Math.ceil((restTimerEndsAt - now) / 1000);
  const restTimerCountdown =
    restTimerRemainingSeconds == null || restTimerRemainingSeconds <= 0
      ? null
      : formatCountdown(restTimerRemainingSeconds);
  const timerStatusText = restTimerCountdown
    ? `rest ${restTimerCountdown}`
    : timerStatus;
  const healthStatusText = healthWorkout.starting
    ? "health starting"
    : healthWorkout.saving
      ? "health saving"
      : healthWorkout.requested
        ? healthWorkout.live
          ? "health running"
          : "health save on finish"
        : healthWorkout.message;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.workoutPage,
          { paddingBottom: insets.bottom + 24 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        scrollEnabled={!planDragging}
      >
        <View style={styles.topActions}>
          <Pressable
            accessibilityLabel={
              restTimerCountdown
                ? "Stop rest timer"
                : "Start three minute rest timer"
            }
            accessibilityRole="button"
            style={styles.timerButton}
            testID="workout-rest-timer"
            onPress={() => void toggleRestTimer()}
          >
            <Text style={styles.timerButtonText}>
              {restTimerCountdown ?? "3m"}
            </Text>
          </Pressable>

          <View style={styles.topActionButtons}>
            <Pressable
              accessibilityLabel="Close workout"
              accessibilityRole="button"
              style={styles.iconButton}
              testID="workout-close"
              onPress={closeWorkout}
            >
              <Icon name="close-outline" size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="Undo workout edit"
              accessibilityRole="button"
              disabled={!canUndo}
              style={[
                styles.iconButton,
                !canUndo ? styles.iconButtonDisabled : null,
              ]}
              testID="workout-undo"
              onPress={() => setSession(undoWorkoutSession)}
            >
              <Icon
                name="arrow-undo-outline"
                size={20}
                color={canUndo ? palette.muted : palette.disabled}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Redo workout edit"
              accessibilityRole="button"
              disabled={!canRedo}
              style={[
                styles.iconButton,
                !canRedo ? styles.iconButtonDisabled : null,
              ]}
              testID="workout-redo"
              onPress={() => setSession(redoWorkoutSession)}
            >
              <Icon
                name="arrow-redo-outline"
                size={20}
                color={canRedo ? palette.muted : palette.disabled}
              />
            </Pressable>
            {isEditingPastWorkout ? (
              <Pressable
                accessibilityLabel="Delete workout"
                accessibilityRole="button"
                style={styles.iconButton}
                testID="workout-delete"
                onPress={deleteWorkout}
              >
                <Icon name="trash-outline" size={20} color={palette.muted} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={
                isEditingPastWorkout ? "Save workout changes" : "Finish workout"
              }
              accessibilityRole="button"
              style={styles.iconButton}
              testID="workout-save"
              onPress={handleFinishPress}
              disabled={saving}
            >
              <Icon name="save-outline" size={20} color={palette.ink} />
            </Pressable>
          </View>
        </View>

        <View style={styles.titleRow}>
          <TextInput
            value={workout.name}
            onChangeText={(name) =>
              dispatch({ type: "UPDATE_WORKOUT_NAME", name })
            }
            style={styles.workoutTitleInput}
          />
          <Pressable
            accessibilityLabel="Edit workout note"
            accessibilityRole="button"
            style={styles.iconButtonSmall}
            testID="workout-note"
            onPress={() => setNoteEditor({ kind: "workout" })}
          >
            <Icon name="pencil-outline" size={20} />
          </Pressable>
        </View>

        {contextLabel ? (
          <Text style={styles.metaText}>{contextLabel}</Text>
        ) : null}
        <View style={styles.timeInlineRow}>
          <Text style={styles.metaText}>
            {formatRelativeDate(new Date(workout.startTime), new Date(now))}{" "}
            .{" "}
          </Text>
          <Pressable
            accessibilityLabel="Edit start date"
            accessibilityRole="button"
            style={styles.timeTextButton}
            testID="workout-start-date"
            onPress={() => setTimeEditor("start-date")}
          >
            <Text style={styles.timeTextButtonText}>
              {formatWorkoutStartDate(new Date(workout.startTime))}
            </Text>
          </Pressable>
          <Text style={styles.metaText}> </Text>
          <Pressable
            accessibilityLabel="Edit start time"
            accessibilityRole="button"
            style={styles.timeTextButton}
            testID="workout-start-time"
            onPress={() => setTimeEditor("start-time")}
          >
            <Text style={styles.timeTextButtonText}>
              {formatTime(new Date(workout.startTime))}
            </Text>
          </Pressable>
          {completedAt ? (
            <>
              <Text style={styles.metaText}> - </Text>
              {isEditingPastWorkout ? (
                <Pressable
                  accessibilityLabel="Edit end time"
                  accessibilityRole="button"
                  style={styles.timeTextButton}
                  testID="workout-end-time"
                  onPress={() => setTimeEditor("end-time")}
                >
                  <Text style={styles.timeTextButtonText}>
                    {formatTime(completedAt)}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.metaText}>{formatTime(completedAt)}</Text>
              )}
              <Text style={styles.metaText}>
                {" "}
                ({formatDuration(new Date(workout.startTime), completedAt)})
              </Text>
            </>
          ) : (
            <Text style={styles.metaText}>
              {" "}
              ({formatDuration(new Date(workout.startTime), new Date(now))})
            </Text>
          )}
        </View>
        {healthStatusText || timerStatusText ? (
          <Text style={styles.metaText}>
            {[healthStatusText, timerStatusText].filter(Boolean).join(" . ")}
          </Text>
        ) : null}

        <View style={styles.inlineEditRow}>
          <Text style={styles.subtleTitle}>body weight</Text>
          <View style={styles.bodyWeightInputBox}>
            <TextInput
              value={
                workout.bodyWeightLb == null
                  ? ""
                  : formatNumber(workout.bodyWeightLb)
              }
              placeholder="add"
              placeholderTextColor={palette.muted}
              onChangeText={(value) => {
                bodyWeightEditedRef.current = true;
                const trimmed = value.trim();
                if (!trimmed) {
                  dispatch({ type: "UPDATE_BODY_WEIGHT", bodyWeightLb: null });
                  return;
                }

                const nextBodyWeight = Number(trimmed);
                if (Number.isFinite(nextBodyWeight) && nextBodyWeight > 0) {
                  dispatch({
                    type: "UPDATE_BODY_WEIGHT",
                    bodyWeightLb: nextBodyWeight,
                  });
                }
              }}
              keyboardType="decimal-pad"
              style={styles.bodyWeightInput}
            />
            {workout.bodyWeightLb == null ? null : (
              <Text style={styles.bodyWeightUnit}>lb</Text>
            )}
          </View>
        </View>

        {workout.notes[0]?.text ? (
          <Pressable
            accessibilityLabel="Edit workout note"
            accessibilityRole="button"
            style={styles.noteBadgeSelf}
            testID="workout-note-badge"
            onPress={() => setNoteEditor({ kind: "workout" })}
          >
            <Text style={styles.noteBadgeText}>{workout.notes[0].text}</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ExercisePlan
          exercises={workout.exercises}
          newExerciseName={newExerciseName}
          addingExercise={addingExercise}
          exerciseSuggestions={exerciseSuggestions}
          exerciseSuggestionsLoaded={exerciseSuggestionsLoaded}
          onNewExerciseNameChange={setNewExerciseName}
          onAddExercise={(name) => void addExercise(name)}
          onMoveTo={moveExerciseTo}
          onDragStateChange={setPlanDragging}
          onDelete={deleteExercise}
        />

        {workout.exercises.map((exercise, exerciseIndex) => (
          <ExerciseSection
            key={`${exercise.userExerciseId ?? exercise.name}-${exerciseIndex}`}
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            onDispatch={dispatch}
            onOpenSetEditor={(setId, field) =>
              setSetEditor({ exerciseIndex, setId, field })
            }
            onOpenNoteEditor={setNoteEditor}
            onDeleteExercise={deleteExercise}
          />
        ))}
      </ScrollView>

      <SetEditorModal
        workout={workout}
        target={setEditor}
        onClose={() => {
          commitPendingHistory();
          setSetEditor(null);
        }}
        onRetarget={(nextTarget) => {
          commitPendingHistory();
          setSetEditor(nextTarget);
        }}
        onDispatch={dispatch}
      />
      <NoteEditorModal
        workout={workout}
        target={noteEditor}
        onClose={() => setNoteEditor(null)}
        onSave={(target, text) => {
          if (target.kind === "workout") updateWorkoutNote(text);
          if (target.kind === "exercise") {
            dispatch({
              type: "UPDATE_USER_EXERCISE_NOTE",
              exerciseIndex: target.exerciseIndex,
              note: text.trim(),
            });
          }
          if (target.kind === "workout-exercise") {
            updateWorkoutExerciseNote(target.exerciseIndex, text);
          }
          if (target.kind === "set") {
            const setIndex = findSetIndex(
              workout.exercises[target.exerciseIndex],
              target.setId,
            );
            if (setIndex != null) {
              dispatch({
                type: "UPDATE_SET_NOTE",
                exerciseIndex: target.exerciseIndex,
                setIndex,
                notes: text,
              });
            }
          }
        }}
      />
      <WorkoutStartTimeEditor
        target={timeEditor}
        startTime={workout.startTime}
        completedAt={completedAt}
        onClose={() => setTimeEditor(null)}
        onSaveStartTime={updateStartTime}
        onSaveCompletedAt={updateCompletedAt}
      />
      <FinishPreviewModal
        workout={finishedWorkout}
        saving={saving}
        open={finishPreviewOpen}
        onEditEndDate={() => setTimeEditor("finish-end-date")}
        onEditEndTime={() => setTimeEditor("finish-end-time")}
        onBack={() => setFinishPreviewOpen(false)}
        onSave={() => void saveFinishedWorkout()}
      />
    </SafeAreaView>
  );
}

function ExercisePlan({
  exercises,
  newExerciseName,
  addingExercise,
  exerciseSuggestions,
  exerciseSuggestionsLoaded,
  onNewExerciseNameChange,
  onAddExercise,
  onMoveTo,
  onDragStateChange,
  onDelete,
}: {
  exercises: WorkoutExercise[];
  newExerciseName: string;
  addingExercise: boolean;
  exerciseSuggestions: ExerciseSuggestion[];
  exerciseSuggestionsLoaded: boolean;
  onNewExerciseNameChange: (name: string) => void;
  onAddExercise: (name?: string) => void;
  onMoveTo: (exerciseIndex: number, targetIndex: number) => void;
  onDragStateChange: (dragging: boolean) => void;
  onDelete: (exerciseIndex: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragState, setDragState] = useState<PlanDragState | null>(null);
  const dragTranslateY = useMemo(() => new Animated.Value(0), []);
  const trimmedExerciseName = newExerciseName.trim();
  const matchingExerciseSuggestions = trimmedExerciseName
    ? exerciseSuggestions
        .filter((exercise) =>
          exercise.name
            .toLowerCase()
            .includes(trimmedExerciseName.toLowerCase()),
        )
        .slice(0, 6)
    : [];
  const hasExactExerciseSuggestion = matchingExerciseSuggestions.some(
    (exercise) =>
      exercise.name.toLowerCase() === trimmedExerciseName.toLowerCase(),
  );
  const toggleOpen = useCallback(() => setOpen((current) => !current), []);
  const getTargetIndex = useCallback(
    (exerciseIndex: number, dy: number) =>
      clampIndex(
        exerciseIndex + Math.round(dy / PLAN_ROW_DRAG_DISTANCE),
        exercises.length,
      ),
    [exercises.length],
  );
  const startDrag = useCallback(
    (exerciseIndex: number) => {
      dragTranslateY.setValue(0);
      setDragState({ exerciseIndex, targetIndex: exerciseIndex });
      onDragStateChange(true);
    },
    [dragTranslateY, onDragStateChange],
  );
  const moveDrag = useCallback(
    (exerciseIndex: number, dy: number) => {
      dragTranslateY.setValue(dy);
      const targetIndex = getTargetIndex(exerciseIndex, dy);
      setDragState((current) => {
        if (!current || current.exerciseIndex !== exerciseIndex) {
          return current;
        }
        if (current.targetIndex === targetIndex) {
          return current;
        }
        return { ...current, targetIndex };
      });
    },
    [dragTranslateY, getTargetIndex],
  );
  const finishDrag = useCallback(
    (exerciseIndex: number, dy: number) => {
      const targetIndex = getTargetIndex(exerciseIndex, dy);
      dragTranslateY.setValue(0);
      setDragState(null);
      onDragStateChange(false);
      if (targetIndex !== exerciseIndex) {
        onMoveTo(exerciseIndex, targetIndex);
      }
    },
    [dragTranslateY, getTargetIndex, onDragStateChange, onMoveTo],
  );
  const cancelDrag = useCallback(() => {
    dragTranslateY.setValue(0);
    setDragState(null);
    onDragStateChange(false);
  }, [dragTranslateY, onDragStateChange]);

  return (
    <View style={styles.planBlock}>
      <Pressable
        accessibilityLabel={`${open ? "Collapse" : "Expand"} exercises`}
        accessibilityRole="button"
        hitSlop={10}
        style={styles.planHeader}
        testID="plan-toggle"
        onPress={toggleOpen}
      >
        <Icon
          name={open ? "chevron-down-outline" : "chevron-forward-outline"}
          size={17}
          color={palette.muted}
        />
        <Text style={styles.subtleTitle}>exercises</Text>
      </Pressable>
      {open ? (
        <>
          {exercises.map((exercise, index) => {
            const isDragging = dragState?.exerciseIndex === index;
            const translateY = isDragging
              ? dragTranslateY
              : getPlanRowShift(index, dragState);

            return (
              <Animated.View
                key={`${exercise.name}-${index}`}
                style={[
                  styles.planRow,
                  isDragging ? styles.planRowDragging : null,
                  { transform: [{ translateY }] },
                ]}
              >
                <ExerciseDragHandle
                  exerciseName={exercise.name}
                  exerciseIndex={index}
                  dragging={isDragging}
                  onDragStart={startDrag}
                  onDragMove={moveDrag}
                  onDragEnd={finishDrag}
                  onDragCancel={cancelDrag}
                />
                <Text style={styles.planName}>{exercise.name}</Text>
                <Pressable
                  accessibilityLabel={`Delete ${exercise.name}`}
                  accessibilityRole="button"
                  style={styles.microButton}
                  testID={`plan-delete-${index}`}
                  onPress={() => onDelete(index)}
                >
                  <Icon name="trash-outline" size={16} color={palette.muted} />
                </Pressable>
              </Animated.View>
            );
          })}
          <View style={styles.addExerciseRow}>
            <TextInput
              value={newExerciseName}
              onChangeText={onNewExerciseNameChange}
              placeholder="exercise name"
              placeholderTextColor={palette.muted}
              style={styles.exerciseInput}
              autoCapitalize="words"
            />
            <Pressable
              accessibilityLabel={`Add ${newExerciseName || "exercise"}`}
              accessibilityRole="button"
              style={styles.addButton}
              testID="plan-add-exercise"
              onPress={() => onAddExercise()}
              disabled={addingExercise}
            >
              <Text style={styles.iconButtonTextSmall}>
                {addingExercise ? "..." : "+"}
              </Text>
            </Pressable>
          </View>
          {trimmedExerciseName ? (
            <View style={styles.exerciseSuggestions}>
              {matchingExerciseSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  accessibilityLabel={`Add ${suggestion.name}`}
                  accessibilityRole="button"
                  style={styles.exerciseSuggestion}
                  testID={`plan-suggestion-${suggestion.id}`}
                  onPress={() => onAddExercise(suggestion.name)}
                >
                  <Text style={styles.exerciseSuggestionText}>
                    {suggestion.name}
                  </Text>
                </Pressable>
              ))}
              {exerciseSuggestionsLoaded && !hasExactExerciseSuggestion ? (
                <Pressable
                  accessibilityLabel={`Create ${trimmedExerciseName}`}
                  accessibilityRole="button"
                  style={styles.exerciseSuggestion}
                  testID="plan-create-exercise"
                  onPress={() => onAddExercise(trimmedExerciseName)}
                >
                  <Text style={styles.exerciseSuggestionMutedText}>
                    create {trimmedExerciseName}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

type PlanDragState = {
  exerciseIndex: number;
  targetIndex: number;
};

const PLAN_ROW_DRAG_DISTANCE = 37;

function getPlanRowShift(rowIndex: number, dragState: PlanDragState | null) {
  if (!dragState || rowIndex === dragState.exerciseIndex) {
    return 0;
  }

  if (
    dragState.targetIndex > dragState.exerciseIndex &&
    rowIndex > dragState.exerciseIndex &&
    rowIndex <= dragState.targetIndex
  ) {
    return -PLAN_ROW_DRAG_DISTANCE;
  }

  if (
    dragState.targetIndex < dragState.exerciseIndex &&
    rowIndex >= dragState.targetIndex &&
    rowIndex < dragState.exerciseIndex
  ) {
    return PLAN_ROW_DRAG_DISTANCE;
  }

  return 0;
}

function ExerciseDragHandle({
  exerciseName,
  exerciseIndex,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  exerciseName: string;
  exerciseIndex: number;
  dragging: boolean;
  onDragStart: (exerciseIndex: number) => void;
  onDragMove: (exerciseIndex: number, dy: number) => void;
  onDragEnd: (exerciseIndex: number, dy: number) => void;
  onDragCancel: () => void;
}) {
  const lastDyRef = useRef(0);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dy) > 4,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          lastDyRef.current = 0;
          onDragStart(exerciseIndex);
        },
        onPanResponderMove: (_event, gestureState) => {
          lastDyRef.current = gestureState.dy;
          onDragMove(exerciseIndex, gestureState.dy);
        },
        onPanResponderRelease: (_event, gestureState) =>
          onDragEnd(exerciseIndex, gestureState.dy || lastDyRef.current),
        onPanResponderTerminate: onDragCancel,
        onPanResponderTerminationRequest: () => false,
      }),
    [exerciseIndex, onDragCancel, onDragEnd, onDragMove, onDragStart],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityLabel={`Drag ${exerciseName} to reorder`}
      accessibilityRole="button"
      collapsable={false}
      style={[styles.dragHandle, dragging ? styles.dragHandleActive : null]}
      testID={`plan-drag-${exerciseIndex}`}
    >
      <Icon
        name="reorder-three-outline"
        size={19}
        color={dragging ? palette.ink : palette.muted}
      />
    </View>
  );
}

function clampIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, index));
}

function ExerciseSection({
  exercise,
  exerciseIndex,
  onDispatch,
  onOpenSetEditor,
  onOpenNoteEditor,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  onDispatch: (action: Action) => void;
  onOpenSetEditor: (setId: string, field?: SetEditField) => void;
  onOpenNoteEditor: (target: NoteEditTarget) => void;
  onDeleteExercise: (exerciseIndex: number) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { warmups, working } = splitSets(exercise);

  return (
    <View style={styles.exerciseBlock}>
      <View style={styles.exerciseTitleRow}>
        <Pressable
          accessibilityLabel={`${exercise.name} pinned exercise note`}
          accessibilityRole="button"
          style={styles.flexColumn}
          testID={`exercise-title-${exerciseIndex}`}
          onPress={() => onOpenNoteEditor({ kind: "exercise", exerciseIndex })}
        >
          <Text style={styles.exerciseTitle}>{exercise.name}</Text>
        </Pressable>
        <View style={styles.exerciseTitleActions}>
          <Pressable
            accessibilityLabel={`${exercise.name} note for this workout`}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.iconButtonSmall}
            testID={`exercise-workout-note-${exerciseIndex}`}
            onPress={() =>
              onOpenNoteEditor({ kind: "workout-exercise", exerciseIndex })
            }
          >
            <Icon name="pencil-outline" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel={`${historyOpen ? "Hide" : "Show"} ${exercise.name} history`}
            accessibilityRole="button"
            hitSlop={8}
            style={[
              styles.iconButtonSmall,
              styles.historyIconButton,
              historyOpen ? styles.iconButtonActive : null,
            ]}
            testID={`exercise-history-${exerciseIndex}`}
            onPress={() => setHistoryOpen((open) => !open)}
          >
            <Icon
              name={historyOpen ? "chevron-up-outline" : "time-outline"}
              size={20}
              color={historyOpen ? palette.ink : palette.muted}
            />
          </Pressable>
        </View>
      </View>

      {exercise.exerciseNotes ? (
        <Pressable
          accessibilityLabel={`Edit ${exercise.name} pinned exercise note`}
          accessibilityRole="button"
          style={styles.noteBadgeSelf}
          testID={`exercise-pinned-note-${exerciseIndex}`}
          onPress={() => onOpenNoteEditor({ kind: "exercise", exerciseIndex })}
        >
          <View style={styles.noteBadgeRow}>
            <Icon name="pin-outline" size={13} color={palette.muted} />
            <Text style={styles.noteBadgeTextInline}>
              {exercise.exerciseNotes}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {exercise.notes[0]?.text ? (
        <Pressable
          accessibilityLabel={`Edit ${exercise.name} note for this workout`}
          accessibilityRole="button"
          style={styles.noteBadgeSelf}
          testID={`exercise-workout-note-badge-${exerciseIndex}`}
          onPress={() =>
            onOpenNoteEditor({ kind: "workout-exercise", exerciseIndex })
          }
        >
          <Text style={styles.noteBadgeText}>{exercise.notes[0].text}</Text>
        </Pressable>
      ) : null}

      {historyOpen ? <ExerciseHistory exercise={exercise} /> : null}

      {warmups.length > 0 ? (
        <SetGroup
          title="warm-up"
          exercise={exercise}
          sets={warmups}
          selectedSetId={null}
          onOpenSet={onOpenSetEditor}
          onToggleRest={(setIndex) =>
            toggleRest(onDispatch, exerciseIndex, exercise, setIndex)
          }
        />
      ) : null}

      <View style={styles.currentSetHeaderRow}>
        <Text style={styles.subtleTitle}>working sets</Text>
        <Pressable
          accessibilityLabel={`Add set to ${exercise.name}`}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.iconButtonTiny}
          testID={`exercise-add-set-${exerciseIndex}`}
          onPress={() => {
            const nextSetIndex = exercise.sets.length;
            const nextSet: WorkoutSet = {
              clientId: makeClientId(),
              weight: null,
              reps: null,
              completed: false,
              weightExplicit: false,
              repsExplicit: false,
              prevWeight: null,
              prevReps: null,
              weightModifier:
                exercise.sets[exercise.sets.length - 1]?.weightModifier,
            };
            onDispatch({
              type: "REPLACE_EXERCISE_SETS",
              exerciseIndex,
              sets: [...exercise.sets, nextSet],
            });
            onOpenSetEditor(makeSetTargetId(nextSetIndex), "weight");
          }}
        >
          <Icon name="add-outline" size={24} color={palette.muted} />
        </Pressable>
      </View>
      <SetGroup
        exercise={exercise}
        sets={working}
        selectedSetId={null}
        onOpenSet={onOpenSetEditor}
        onToggleRest={(setIndex) =>
          toggleRest(onDispatch, exerciseIndex, exercise, setIndex)
        }
      />
    </View>
  );
}

function ExerciseHistory({ exercise }: { exercise: WorkoutExercise }) {
  const entries = exercise.history ?? [];
  const { width: windowWidth } = useWindowDimensions();
  const historyWidth = Math.max(260, windowWidth - 28);
  const stats = buildHistoryStats(entries);
  const pages = [
    ...(stats ? [{ kind: "stats" as const, stats }] : []),
    ...entries.map((entry) => ({ kind: "entry" as const, entry })),
  ];

  if (entries.length === 0) {
    return (
      <View style={styles.historyBox}>
        <Text style={styles.metaText}>no history yet</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      contentOffset={stats ? { x: historyWidth, y: 0 } : undefined}
      decelerationRate="fast"
      snapToInterval={historyWidth}
      snapToStart
      showsHorizontalScrollIndicator={false}
      style={styles.historyScroller}
      contentContainerStyle={styles.historyScrollerContent}
    >
      {pages.map((page) => {
        if (page.kind === "stats") {
          return (
            <View
              key="history-stats"
              style={[styles.historyBox, { width: historyWidth }]}
            >
              <Text style={styles.metaText}>
                stats . last {page.stats.chartCount}{" "}
                {page.stats.chartCount === 1 ? "workout" : "workouts"}
              </Text>
              <HistoryTinyChart
                title="expected 1rm"
                points={page.stats.e1rmPoints}
              />
              <HistoryTinyChart
                title="volume"
                points={page.stats.volumePoints}
              />
              <View style={styles.statLine}>
                <Text style={styles.statLabel}>best set</Text>
                <Text style={styles.statValue}>{page.stats.bestSet}</Text>
              </View>
            </View>
          );
        }

        const entry = page.entry;
        const historicalExercise: WorkoutExercise = {
          ...exercise,
          sets: entry.sets.map((set, index) => ({
            weight: set.weight,
            reps: set.reps,
            completed: true,
            weightExplicit: true,
            repsExplicit: true,
            prevWeight: null,
            prevReps: null,
            modifier: set.modifier,
            weightModifier: set.weightModifier,
            restBefore: set.restBefore,
            notes: set.notes ?? undefined,
            clientId: `history-${entry.relation}-${entry.date}-${index}`,
          })),
          previousSets: [],
        };
        const groups = splitSets(historicalExercise);

        return (
          <View
            key={`${entry.relation}-${entry.date}`}
            style={[styles.historyBox, { width: historyWidth }]}
          >
            <Text style={styles.metaText}>
              {entry.relation} . {entry.relativeDate} . {entry.date}
            </Text>
            {entry.workoutNote ? (
              <Text style={styles.noteBadge}>{entry.workoutNote}</Text>
            ) : null}
            {entry.workoutExerciseNote ? (
              <Text style={styles.noteBadge}>{entry.workoutExerciseNote}</Text>
            ) : null}
            {groups.warmups.length > 0 ? (
              <SetGroup
                title="warm-up"
                exercise={historicalExercise}
                sets={groups.warmups}
                selectedSetId={null}
                readonly
              />
            ) : null}
            <SetGroup
              title="working sets"
              exercise={historicalExercise}
              sets={groups.working}
              selectedSetId={null}
              readonly
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

type HistoryStats = {
  chartCount: number;
  e1rmPoints: HistoryChartPoint[];
  volumePoints: HistoryChartPoint[];
  bestSet: string;
};

type HistoryChartPoint = {
  xValue: number;
  value: number;
  displayValue: string;
};

type ParsedHistoryStats = {
  e1rm: number | null;
  volume: number | null;
  bestSet: string | null;
  bestSetScore: number;
};

function HistoryTinyChart({
  title,
  points,
}: {
  title: string;
  points: HistoryChartPoint[];
}) {
  const chartWidth = 300;
  const chartHeight = 82;
  const positions = getChartPositions(points, chartWidth, chartHeight);
  const labelOffsets = [12, 28, 44];

  return (
    <View style={styles.historyChartBlock}>
      <Text style={styles.subtleTitle}>{title}</Text>
      {points.length > 0 ? (
        <View
          accessibilityLabel={`${title}: ${points
            .map((point) => point.displayValue)
            .join(", ")}`}
          style={[styles.historyChart, { height: chartHeight }]}
        >
          {positions.slice(1).map((position, index) => {
            const previous = positions[index];
            const dx = position.x - previous.x;
            const dy = position.y - previous.y;
            const length = Math.hypot(dx, dy);
            const angle = `${Math.atan2(dy, dx)}rad`;

            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.historyChartLine,
                  {
                    left: previous.x,
                    top: previous.y,
                    transform: [{ rotateZ: angle }],
                    width: length,
                  },
                ]}
              />
            );
          })}
          {positions.map((position, index) => (
            <React.Fragment key={`${points[index].displayValue}-${index}`}>
              <Text
                style={[
                  styles.historyChartValue,
                  {
                    left: Math.max(
                      0,
                      Math.min(chartWidth - 56, position.x - 22),
                    ),
                    top: Math.max(
                      0,
                      position.y - labelOffsets[index % labelOffsets.length],
                    ),
                  },
                ]}
              >
                {points[index].displayValue}
              </Text>
              <View
                style={[
                  styles.historyChartDot,
                  { left: position.x - 2.5, top: position.y - 2.5 },
                ]}
              />
            </React.Fragment>
          ))}
        </View>
      ) : (
        <Text style={styles.metaText}>more data soon</Text>
      )}
    </View>
  );
}

function getChartPositions(
  points: HistoryChartPoint[],
  width: number,
  height: number,
) {
  if (points.length === 0) return [];
  const xValues = points.map((point) => point.xValue);
  const yValues = points.map((point) => point.value);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;
  const xPadding = 20;
  const yPadding = 44;

  return points.map((point) => ({
    x: xPadding + ((point.xValue - minX) / xSpan) * (width - xPadding * 2),
    y: yPadding + (1 - (point.value - minY) / ySpan) * (height - yPadding - 8),
  }));
}

function buildHistoryStats(
  history: WorkoutExercise["history"],
): HistoryStats | null {
  if (!history || history.length === 0) return null;

  const recentChronological = history
    .slice(0, 5)
    .map((entry) => ({ entry, stats: getHistoryWorkoutStats(entry) }))
    .reverse();
  const xValues = getHistoryChartXValues(
    recentChronological.map(({ entry }) => entry),
  );
  const allChronological = history
    .map((entry) => ({ entry, stats: getHistoryWorkoutStats(entry) }))
    .reverse();
  const e1rmPoints = recentChronological.flatMap(({ stats }, index) =>
    stats.e1rm == null
      ? []
      : [toHistoryChartPoint(stats.e1rm, xValues[index] ?? index)],
  );
  const volumePoints = recentChronological.flatMap(({ stats }, index) =>
    stats.volume == null
      ? []
      : [toHistoryChartPoint(stats.volume, xValues[index] ?? index)],
  );
  const bestEntry = allChronological.reduce<ParsedHistoryStats | null>(
    (best, entry) =>
      !best || entry.stats.bestSetScore > best.bestSetScore
        ? entry.stats
        : best,
    null,
  );

  return {
    chartCount: recentChronological.length,
    e1rmPoints,
    volumePoints,
    bestSet: bestEntry?.bestSet ?? "n/a",
  };
}

function toHistoryChartPoint(value: number, xValue: number): HistoryChartPoint {
  return {
    xValue,
    value,
    displayValue: `${formatNumber(value)}lb`,
  };
}

function getHistoryChartXValues(
  history: NonNullable<WorkoutExercise["history"]>,
) {
  const daysAgoValues = history.map((item) =>
    parseHistoryRelativeDaysAgo(item.relativeDate),
  );

  if (
    daysAgoValues.every((value): value is number => value != null) &&
    new Set(daysAgoValues).size > 1
  ) {
    const oldestDaysAgo = Math.max(...daysAgoValues);
    return daysAgoValues.map((daysAgo) => oldestDaysAgo - daysAgo);
  }

  return history.map((_, index) => index);
}

function parseHistoryRelativeDaysAgo(relativeDate: string) {
  const normalized = relativeDate.trim().toLowerCase();
  if (normalized === "today") return 0;
  if (normalized === "yesterday") return 1;

  const match = /^(\d+)\s+(day|week|month|year)s?\s+ago$/.exec(normalized);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value)) return null;

  if (unit === "day") return value;
  if (unit === "week") return value * 7;
  if (unit === "month") return value * 30;
  if (unit === "year") return value * 365;
  return null;
}

function getHistoryWorkoutStats(
  entry: NonNullable<WorkoutExercise["history"]>[number],
): ParsedHistoryStats {
  let bestSet: string | null = null;
  let bestSetScore = Number.NEGATIVE_INFINITY;
  let bestE1rm: number | null = null;
  let volume = 0;

  for (const set of entry.sets) {
    if (set.modifier === "warmup") continue;

    const weight = getHistorySetLoad(entry, set);
    const reps = Number(set.reps);
    if (weight == null || !Number.isFinite(reps) || reps <= 0) continue;

    if (weight > 0) volume += weight * reps;

    const e1rm = weight > 0 ? estimate1RM(weight, reps) : null;
    const score = e1rm ?? weight;
    if (e1rm != null && (bestE1rm == null || e1rm > bestE1rm)) {
      bestE1rm = e1rm;
    }
    if (score > bestSetScore) {
      bestSetScore = score;
      bestSet = `${formatNumber(weight)}lb×${formatNumber(reps)}`;
    }
  }

  return {
    e1rm: bestE1rm,
    volume: volume > 0 ? volume : null,
    bestSet,
    bestSetScore,
  };
}

function getHistorySetLoad(
  entry: NonNullable<WorkoutExercise["history"]>[number],
  set: NonNullable<WorkoutExercise["history"]>[number]["sets"][number],
) {
  if (set.weightModifier === "bodyweight") {
    const offset = set.weight ?? 0;
    return entry.bodyWeightLb == null ? offset : entry.bodyWeightLb + offset;
  }
  return set.weight;
}

function SetGroup({
  title,
  exercise,
  sets,
  selectedSetId,
  selectedField = null,
  readonly = false,
  onOpenSet,
  onToggleRest,
}: {
  title?: string;
  exercise: WorkoutExercise;
  sets: IndexedWorkoutSet[];
  selectedSetId: string | null;
  selectedField?: SetEditField | null;
  readonly?: boolean;
  onOpenSet?: (setId: string, field?: SetEditField) => void;
  onToggleRest?: (setIndex: number) => void;
}) {
  const noteEntries = sets
    .filter(({ set }) => Boolean(set.notes?.trim()))
    .map(({ set, index }, noteIndex) => ({
      letter: String.fromCharCode(97 + noteIndex),
      note: set.notes!.trim(),
      setId: makeSetTargetId(index),
    }));
  const noteBySetId = new Map(
    noteEntries.map((entry) => [entry.setId, entry.letter]),
  );

  return (
    <View style={styles.setGroup}>
      {title ? <Text style={styles.subtleTitle}>{title}</Text> : null}
      <View style={styles.setLine}>
        {sets.length === 0 ? <Text style={styles.metaText}>none</Text> : null}
        {sets.map((indexedSet, index) => {
          const setId = makeSetTargetId(indexedSet.index);
          const token = getSetLineToken(exercise, indexedSet, sets[index - 1]);
          const fullLabel = formatSetInline(exercise, indexedSet) || "set";
          const setAccessibilityName = setLabel(exercise, indexedSet.index);
          const noteLetter = noteBySetId.get(setId);
          return (
            <React.Fragment key={setId}>
              {index > 0 ? (
                <Pressable
                  accessibilityLabel={`Toggle rest before ${setAccessibilityName}`}
                  accessibilityRole="button"
                  disabled={readonly || !onToggleRest}
                  hitSlop={10}
                  style={styles.separatorChip}
                  onPress={() => onToggleRest?.(indexedSet.index)}
                >
                  <Text style={styles.separatorText}>
                    {indexedSet.set.restBefore === "short" ? "+" : ","}
                  </Text>
                </Pressable>
              ) : null}
              {indexedSet.set.modifier === "warmup" ? (
                <Text style={styles.warmupInlinePrefix}>w</Text>
              ) : null}
              {token.kind === "reps-only" ? (
                <SetValueChip
                  accessibilityLabel={`Edit ${setAccessibilityName} reps ${fullLabel}`}
                  active={selectedSetId === setId && selectedField === "reps"}
                  disabled={readonly || !onOpenSet}
                  label={token.repsLabel}
                  noteLetter={noteLetter}
                  onPress={() => onOpenSet?.(setId, "reps")}
                />
              ) : (
                <>
                  <SetValueChip
                    accessibilityLabel={`Edit ${setAccessibilityName} weight ${fullLabel}`}
                    active={
                      selectedSetId === setId && selectedField === "weight"
                    }
                    disabled={readonly || !onOpenSet}
                    label={token.weightLabel}
                    onPress={() => onOpenSet?.(setId, "weight")}
                  />
                  <Text style={styles.inlineSetText}>x</Text>
                  <SetValueChip
                    accessibilityLabel={`Edit ${setAccessibilityName} reps ${fullLabel}`}
                    active={selectedSetId === setId && selectedField === "reps"}
                    disabled={readonly || !onOpenSet}
                    label={token.repsLabel}
                    noteLetter={noteLetter}
                    onPress={() => onOpenSet?.(setId, "reps")}
                  />
                </>
              )}
            </React.Fragment>
          );
        })}
      </View>
      {noteEntries.length > 0 ? (
        <View style={styles.noteList}>
          {noteEntries.map((entry) => (
            <View key={`${entry.setId}-${entry.letter}`} style={styles.noteRow}>
              <Text style={styles.noteLetter}>{entry.letter}</Text>
              <Text style={styles.noteBadge}>{entry.note}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SetValueChip({
  accessibilityLabel,
  active,
  disabled,
  label,
  noteLetter,
  onPress,
}: {
  accessibilityLabel: string;
  active: boolean;
  disabled: boolean;
  label: string;
  noteLetter?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={[styles.inlineSetChip, active ? styles.inlineSetChipActive : null]}
    >
      <Text style={styles.inlineSetText}>
        {label}
        {noteLetter ? <Text style={styles.supText}>{noteLetter}</Text> : null}
      </Text>
    </Pressable>
  );
}

function getSetLineToken(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
  previousIndexedSet?: IndexedWorkoutSet,
):
  | { kind: "full"; weightLabel: string; repsLabel: string }
  | {
      kind: "reps-only";
      repsLabel: string;
    } {
  const current = getSetDisplayValues(
    exercise,
    indexedSet.set,
    indexedSet.index,
  );
  const repsLabel =
    current.reps == null ? "-" : formatNumber(Number(current.reps));
  const currentWeightLabel = formatSetLineWeightLabel(
    current.weight,
    current.weightModifier,
    indexedSet.set,
  );
  if (!previousIndexedSet) {
    return { kind: "full", weightLabel: currentWeightLabel, repsLabel };
  }

  const previous = getSetDisplayValues(
    exercise,
    previousIndexedSet.set,
    previousIndexedSet.index,
  );
  const sameWeight =
    current.weight === previous.weight &&
    current.weightModifier === previous.weightModifier;

  if (sameWeight && repsLabel && !isExplicitNullWeight(indexedSet.set)) {
    return { kind: "reps-only", repsLabel };
  }
  return { kind: "full", weightLabel: currentWeightLabel, repsLabel };
}

function formatSetLineWeightLabel(
  weight: number | null,
  weightModifier: "bodyweight" | undefined,
  set: WorkoutSet,
) {
  const label = formatWeightLabel(weight, weightModifier);
  if (label) return label;
  return isExplicitNullWeight(set) ? "-lb" : "-lb";
}

function isExplicitNullWeight(set: WorkoutSet) {
  return set.weight === null && set.weightExplicit;
}

function SetEditorModal({
  workout,
  target,
  onClose,
  onRetarget,
  onDispatch,
}: {
  workout: Workout;
  target: SetEditTarget | null;
  onClose: () => void;
  onRetarget: (target: SetEditTarget | null) => void;
  onDispatch: (action: Action, options?: WorkoutDispatchOptions) => void;
}) {
  const insets = useSafeAreaInsets();
  const nativeKeyboard = useNativeKeyboardFrame();
  const [field, setField] = useState<"weight" | "reps">("weight");
  const [entry, setEntry] = useState("");
  const [firstPress, setFirstPress] = useState(true);
  const [helperMode, setHelperMode] = useState<"increase" | "plates" | null>(
    null,
  );
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const exercise = target ? workout.exercises[target.exerciseIndex] : undefined;
  const setIndex =
    exercise && target ? findSetIndex(exercise, target.setId) : null;
  const set = setIndex == null ? undefined : exercise?.sets[setIndex];

  useEffect(() => {
    if (!target?.field) return;
    setField(target.field);
  }, [target?.exerciseIndex, target?.setId, target?.field]);

  useEffect(() => {
    if (!exercise || setIndex == null || !set) return;
    const values = getSetDisplayValues(exercise, set, setIndex);
    setEntry(
      field === "weight"
        ? values.weight == null
          ? ""
          : String(values.weight)
        : values.reps == null
          ? ""
          : String(values.reps),
    );
    setFirstPress(true);
  }, [field, target?.exerciseIndex, target?.setId]);

  useEffect(() => {
    setHelperMode(null);
    setNoteEditing(false);
  }, [target?.exerciseIndex, target?.setId]);

  if (!target || !exercise || setIndex == null || !set) return null;

  const commitValue = (nextEntry: string, nextField = field) => {
    const parsed =
      nextEntry.trim() === "" ? null : parseKeypadEntry(nextEntry, nextField);
    if (parsed === "pending") return;

    onDispatch(
      {
        type: "REPLACE_EXERCISE_SETS",
        exerciseIndex: target.exerciseIndex,
        sets: materializeEditedExerciseSets(exercise, setIndex, {
          [nextField]: parsed,
        }),
      },
      { deferHistory: true },
    );
  };

  const selectField = (nextField: "weight" | "reps") => {
    setField(nextField);
    setFirstPress(true);
  };

  const handleKey = (key: string) => {
    const currentEntry = firstPress ? "" : entry;
    const next =
      key === "." && currentEntry.includes(".")
        ? currentEntry
        : key === "."
          ? currentEntry || "0."
          : currentEntry === "0"
            ? key
            : `${currentEntry}${key}`;
    setEntry(next);
    setFirstPress(false);
    commitValue(next);
  };

  const backspace = () => {
    const next = firstPress ? "" : entry.slice(0, -1);
    setEntry(next);
    setFirstPress(false);
    commitValue(next);
  };

  const stepValue = (sign: 1 | -1) => {
    const current = Number(entry) || 0;
    const next =
      field === "weight"
        ? formatNumber(Math.max(0, current + sign * 5))
        : String(Math.max(0, current + sign));
    setEntry(next);
    setFirstPress(false);
    commitValue(next);
  };

  const toggleSign = () => {
    if (set?.weightModifier !== "bodyweight") return;
    const current = Number(entry) || 0;
    const next = String(current * -1);
    setEntry(next);
    setFirstPress(false);
    commitValue(next);
  };

  const addShortRestSet = () => {
    const nextSet: WorkoutSet = {
      clientId: makeClientId(),
      weight: set.weight,
      reps: null,
      completed: false,
      weightExplicit: set.weight !== null,
      repsExplicit: false,
      prevWeight: null,
      prevReps: null,
      modifier: set.modifier,
      weightModifier: set.weightModifier,
      restBefore: "short",
    };
    const nextSets = [...exercise.sets];
    nextSets.splice(setIndex + 1, 0, nextSet);
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex: target.exerciseIndex,
      sets: nextSets,
    });
    onRetarget({
      exerciseIndex: target.exerciseIndex,
      setId: makeSetTargetId(setIndex + 1),
      field: "reps",
    });
    setField("reps");
  };

  const deleteSet = () => {
    Alert.alert(
      "Delete set?",
      formatSetInline(exercise, { set, index: setIndex }),
      [
        { text: "cancel", style: "cancel" },
        {
          text: "delete",
          style: "destructive",
          onPress: () => {
            const remainingSets = exercise.sets.filter(
              (_candidate, candidateIndex) => candidateIndex !== setIndex,
            );
            const nextSet =
              remainingSets[Math.min(setIndex, remainingSets.length - 1)];
            onDispatch({
              type: "DELETE_SET",
              exerciseIndex: target.exerciseIndex,
              setIndex,
            });
            if (nextSet) {
              onRetarget({
                exerciseIndex: target.exerciseIndex,
                setId: makeSetTargetId(
                  Math.min(setIndex, remainingSets.length - 1),
                ),
                field,
              });
            } else {
              onClose();
            }
          },
        },
      ],
    );
  };

  const openSetNote = () => {
    setHelperMode(null);
    setNoteValue(set.notes ?? "");
    setNoteEditing(true);
  };

  const saveSetNote = (notes: string) => {
    onDispatch({
      type: "UPDATE_SET_NOTE",
      exerciseIndex: target.exerciseIndex,
      setIndex,
      notes,
    });
    setNoteEditing(false);
  };

  const deleteSetNote = () => {
    if (!set.notes?.trim()) {
      saveSetNote("");
      return;
    }

    Alert.alert("Delete note?", `${setLabel(exercise, setIndex)} note`, [
      { text: "cancel", style: "cancel" },
      {
        text: "delete",
        style: "destructive",
        onPress: () => saveSetNote(""),
      },
    ]);
  };

  const values = getSetDisplayValues(exercise, set, setIndex);
  const helperWeight =
    values.weight != null && Number.isFinite(values.weight) && values.weight > 0
      ? values.weight
      : 135;
  const helperReps =
    values.reps != null && Number.isFinite(values.reps) && values.reps > 0
      ? values.reps
      : 8;

  const useWeightSuggestion = (suggestion: WeightSuggestion) => {
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex: target.exerciseIndex,
      sets: materializeEditedExerciseSets(exercise, setIndex, {
        weight: suggestion.weight,
        reps: suggestion.reps,
        weightModifier: undefined,
      }),
    });
    setEntry(
      field === "weight"
        ? formatNumber(suggestion.weight)
        : String(suggestion.reps),
    );
    setFirstPress(true);
    setHelperMode(null);
  };

  const updatePlateSettings = (settings: {
    startingWeight: number | null;
    loadMode: PlateLoadMode;
  }) => {
    onDispatch({
      type: "UPDATE_USER_EXERCISE_PLATE_DEFAULTS",
      exerciseIndex: target.exerciseIndex,
      plateStartingWeight: settings.startingWeight,
      plateLoadMode: settings.loadMode,
    });
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <DismissibleModalShade keyboardAvoiding onDismiss={onClose}>
        <View style={styles.keyboardDock}>
          <View
            style={[
              styles.keyboardSheet,
              {
                paddingBottom:
                  noteEditing && nativeKeyboard.visible
                    ? 6
                    : Math.max(6, insets.bottom + 6),
              },
            ]}
          >
            <View style={styles.keyboardHeader}>
              <View style={styles.flexColumn}>
                <Text style={styles.metaText}>{exercise.name}</Text>
                {splitSets(exercise).warmups.length > 0 ? (
                  <SetGroup
                    exercise={exercise}
                    sets={splitSets(exercise).warmups}
                    selectedSetId={target.setId}
                    selectedField={field}
                    onOpenSet={(setId, nextField) =>
                      onRetarget({
                        exerciseIndex: target.exerciseIndex,
                        setId,
                        field: nextField,
                      })
                    }
                  />
                ) : null}
                <SetGroup
                  exercise={exercise}
                  sets={splitSets(exercise).working}
                  selectedSetId={target.setId}
                  selectedField={field}
                  onOpenSet={(setId, nextField) =>
                    onRetarget({
                      exerciseIndex: target.exerciseIndex,
                      setId,
                      field: nextField,
                    })
                  }
                />
              </View>
              <Pressable
                accessibilityLabel="Close set keyboard"
                accessibilityRole="button"
                style={styles.iconButtonSmall}
                testID="set-keyboard-close"
                onPress={onClose}
              >
                <Icon name="close-outline" size={24} />
              </Pressable>
            </View>

            {noteEditing ? (
              <>
                <Text style={styles.subtleTitle}>
                  {setLabel(exercise, setIndex)} note
                </Text>
                <TextInput
                  accessibilityLabel={`${setLabel(exercise, setIndex)} note`}
                  autoFocus
                  multiline
                  style={styles.noteInput}
                  testID="set-note-input"
                  value={noteValue}
                  onChangeText={setNoteValue}
                />
                <View style={styles.noteActions}>
                  <Pressable
                    accessibilityLabel={`Delete ${setLabel(exercise, setIndex)} note`}
                    accessibilityRole="button"
                    style={styles.iconButton}
                    testID="set-note-delete"
                    onPress={deleteSetNote}
                  >
                    <Icon name="trash-outline" size={24} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Save ${setLabel(exercise, setIndex)} note`}
                    accessibilityRole="button"
                    style={[styles.textButton, styles.sheetActionFill]}
                    testID="set-note-done"
                    onPress={() => saveSetNote(noteValue)}
                  >
                    <Text style={styles.textButtonText}>done</Text>
                  </Pressable>
                </View>
                {nativeKeyboard.visible ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.nativeKeyboardBackgroundFill,
                      {
                        bottom: -nativeKeyboard.height,
                        height: nativeKeyboard.height,
                      },
                    ]}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.subtleTitle}>
                  {setLabel(exercise, setIndex)}
                </Text>
                <View style={styles.editorValueRow}>
                  <Pressable
                    accessibilityLabel={`Toggle ${setLabel(exercise, setIndex)} warm-up`}
                    accessibilityRole="button"
                    style={[
                      styles.keySmall,
                      set.modifier === "warmup" ? styles.keyActive : null,
                    ]}
                    testID="set-keyboard-warmup-toggle"
                    onPress={() =>
                      onDispatch({
                        type: "TOGGLE_WARMUP",
                        exerciseIndex: target.exerciseIndex,
                        setIndex,
                      })
                    }
                  >
                    <Text style={styles.keyText}>w</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Edit ${setLabel(exercise, setIndex)} weight`}
                    accessibilityRole="button"
                    style={[
                      styles.valueChip,
                      field === "weight" ? styles.inlineSetChipActive : null,
                    ]}
                    testID="set-keyboard-weight"
                    onPress={() => selectField("weight")}
                  >
                    <Text style={styles.bigValueText}>
                      {formatKeyboardWeightLabel(
                        values.weight,
                        values.weightModifier,
                      )}
                    </Text>
                  </Pressable>
                  <Text style={styles.bigValueText}>x</Text>
                  <Pressable
                    accessibilityLabel={`Edit ${setLabel(exercise, setIndex)} reps`}
                    accessibilityRole="button"
                    style={[
                      styles.valueChip,
                      field === "reps" ? styles.inlineSetChipActive : null,
                    ]}
                    testID="set-keyboard-reps"
                    onPress={() => selectField("reps")}
                  >
                    <Text style={styles.bigValueText}>
                      {values.reps == null ? "-" : formatNumber(values.reps)}
                    </Text>
                  </Pressable>
                  <View style={styles.flexSpacer} />
                  <Pressable
                    accessibilityLabel={`Edit ${setLabel(exercise, setIndex)} note`}
                    accessibilityRole="button"
                    style={styles.iconButtonSmall}
                    testID="set-keyboard-note"
                    onPress={openSetNote}
                  >
                    <Icon name="pencil-outline" size={20} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete ${setLabel(exercise, setIndex)}`}
                    accessibilityRole="button"
                    style={styles.iconButtonSmall}
                    testID="set-keyboard-delete"
                    onPress={deleteSet}
                  >
                    <Icon name="trash-outline" size={20} />
                  </Pressable>
                </View>

                <View style={styles.keypad}>
                  <View style={styles.keypadRow}>
                    <KeypadButton onPress={() => handleKey("1")}>
                      1
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("2")}>
                      2
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("3")}>
                      3
                    </KeypadButton>
                    {field === "weight" ? (
                      <View style={styles.keypadSplitCell}>
                        <KeypadButton
                          accessibilityLabel="Open increase weight helper"
                          icon="trending-up-outline"
                          onPress={() => setHelperMode("increase")}
                        />
                        <KeypadButton
                          accessibilityLabel="Open plate calculator"
                          icon="barbell-outline"
                          onPress={() => setHelperMode("plates")}
                        />
                      </View>
                    ) : (
                      <KeypadButton
                        accessibilityLabel="Close set keyboard"
                        onPress={onClose}
                      >
                        <View style={styles.keyIconPair}>
                          <Icon
                            name="keypad-outline"
                            size={21}
                            color={palette.ink}
                          />
                          <Icon
                            name="chevron-down-circle-outline"
                            size={16}
                            color={palette.ink}
                          />
                        </View>
                      </KeypadButton>
                    )}
                  </View>
                  <View style={styles.keypadRow}>
                    <KeypadButton onPress={() => handleKey("4")}>
                      4
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("5")}>
                      5
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("6")}>
                      6
                    </KeypadButton>
                    <View style={styles.keypadSplitCell}>
                      <KeypadButton onPress={() => stepValue(-1)}>
                        -
                      </KeypadButton>
                      <KeypadButton onPress={() => stepValue(1)}>
                        +
                      </KeypadButton>
                    </View>
                  </View>
                  <View style={styles.keypadRow}>
                    <KeypadButton onPress={() => handleKey("7")}>
                      7
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("8")}>
                      8
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("9")}>
                      9
                    </KeypadButton>
                    {field === "weight" ? (
                      <View style={styles.keypadSplitCell}>
                        <KeypadButton
                          accessibilityLabel="Toggle body weight"
                          active={set.weightModifier === "bodyweight"}
                          icon="person-outline"
                          onPress={() => {
                            onDispatch({
                              type: "FOCUS_FIELD",
                              exerciseIndex: target.exerciseIndex,
                              setIndex,
                              field: "weight",
                            });
                            onDispatch({ type: "TOGGLE_BODYWEIGHT" });
                            setField("weight");
                          }}
                        />
                        <KeypadButton
                          accessibilityLabel="Toggle body weight sign"
                          disabled={set.weightModifier !== "bodyweight"}
                          onPress={toggleSign}
                        >
                          +/-
                        </KeypadButton>
                      </View>
                    ) : (
                      <KeypadButton
                        accessibilityLabel="Add short-rest reps"
                        onPress={addShortRestSet}
                      >
                        <View style={styles.keyIconPair}>
                          <Icon
                            name="timer-outline"
                            size={20}
                            color={palette.ink}
                          />
                          <Icon
                            name="add-outline"
                            size={15}
                            color={palette.ink}
                          />
                        </View>
                      </KeypadButton>
                    )}
                  </View>
                  <View style={styles.keypadRow}>
                    {field === "weight" ? (
                      <KeypadButton onPress={() => handleKey(".")}>
                        .
                      </KeypadButton>
                    ) : (
                      <View style={styles.keyBlank} />
                    )}
                    <KeypadButton onPress={() => handleKey("0")}>
                      0
                    </KeypadButton>
                    <KeypadButton
                      icon="backspace-outline"
                      onPress={backspace}
                    />
                    <KeypadButton
                      primary
                      onPress={() =>
                        selectField(field === "weight" ? "reps" : "weight")
                      }
                    >
                      Next
                    </KeypadButton>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <IncreaseWeightHelperModal
          visible={helperMode === "increase"}
          defaultWeight={helperWeight}
          defaultReps={helperReps}
          defaultLoadMode={exercise.plateLoadMode}
          onClose={() => setHelperMode(null)}
          onUse={useWeightSuggestion}
        />
        <PlateCalculatorHelperModal
          visible={helperMode === "plates"}
          defaultWeight={helperWeight}
          defaultStartingWeight={exercise.plateStartingWeight}
          defaultLoadMode={exercise.plateLoadMode}
          onClose={() => setHelperMode(null)}
          onSettingsChange={updatePlateSettings}
        />
      </DismissibleModalShade>
    </Modal>
  );
}

function parseKeypadEntry(
  entry: string,
  field: "weight" | "reps",
): number | null | "pending" {
  const trimmed = entry.trim();
  if (trimmed === "" || trimmed === "-") return null;
  if (trimmed === "." || trimmed === "-.") return "pending";

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) return "pending";
  if (field === "reps") return Math.max(0, Math.trunc(numericValue));
  return numericValue;
}

function formatKeyboardWeightLabel(
  weight: number | null,
  weightModifier?: "bodyweight",
) {
  if (weight == null) return weightModifier === "bodyweight" ? "BW" : "-lb";
  return formatWeightLabel(weight, weightModifier);
}

function materializeEditedExerciseSets(
  exercise: WorkoutExercise,
  editedSetIndex: number,
  updates: {
    weight?: number | null;
    reps?: number | null;
    weightModifier?: WorkoutSet["weightModifier"];
  },
) {
  return exercise.sets.map((set, setIndex) => {
    const displayed = getSetDisplayValues(exercise, set, setIndex);
    const isEditedSet = setIndex === editedSetIndex;
    const hasWeightUpdate = isEditedSet && "weight" in updates;
    const hasRepsUpdate = isEditedSet && "reps" in updates;
    const nextWeight = hasWeightUpdate ? updates.weight! : displayed.weight;
    const nextReps = hasRepsUpdate ? updates.reps! : displayed.reps;
    const nextWeightModifier =
      isEditedSet && "weightModifier" in updates
        ? updates.weightModifier
        : displayed.weightModifier;

    return {
      ...set,
      weight: nextWeight,
      reps: nextReps,
      weightModifier: nextWeightModifier,
      weightExplicit:
        set.weightExplicit || nextWeight !== null || hasWeightUpdate,
      repsExplicit: set.repsExplicit || nextReps !== null || hasRepsUpdate,
      completed: nextWeight !== null && nextReps !== null,
    };
  });
}

function KeypadButton({
  children,
  icon,
  accessibilityLabel,
  active,
  primary,
  disabled,
  onPress,
}: {
  children?: React.ReactNode;
  icon?: IconName;
  accessibilityLabel?: string;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={
        accessibilityLabel ??
        (typeof children === "string" ? children : (icon ?? "keypad button"))
      }
      accessibilityRole="button"
      disabled={disabled}
      style={[
        styles.key,
        active ? styles.keyActive : null,
        primary ? styles.keyDark : null,
        disabled ? styles.keyDisabled : null,
      ]}
      onPress={onPress}
    >
      {icon ? (
        <Icon
          name={icon}
          size={24}
          color={primary ? palette.raised : palette.ink}
        />
      ) : typeof children === "string" ? (
        <Text style={primary ? styles.keyDarkText : styles.keyText}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

function IncreaseWeightHelperModal({
  visible,
  defaultWeight,
  defaultReps,
  defaultLoadMode,
  onClose,
  onUse,
}: {
  visible: boolean;
  defaultWeight: number;
  defaultReps: number;
  defaultLoadMode?: PlateLoadMode | null;
  onClose: () => void;
  onUse: (suggestion: WeightSuggestion) => void;
}) {
  const [mode, setMode] = useState<PlateLoadMode>(
    parsePlateMode(defaultLoadMode),
  );
  const [addedWeight, setAddedWeight] = useState(5);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode(parsePlateMode(defaultLoadMode));
    setAddedWeight(5);
    setSelectedKey(null);
  }, [defaultLoadMode, visible]);

  const oneRepMax = estimate1RM(defaultWeight, defaultReps);
  const rows = buildAddedWeightRepRows(
    defaultWeight,
    oneRepMax,
    addedWeight,
    mode,
  );
  const targetWeight =
    defaultWeight + (mode === "equal-sides" ? addedWeight * 2 : addedWeight);

  const adjustAddedWeight = (direction: 1 | -1) => {
    setSelectedKey(null);
    setAddedWeight((current) =>
      Math.max(2.5, roundToHalf(current + direction * 2.5)),
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade onDismiss={onClose} style={styles.helperShade}>
        <View style={styles.helperDialog}>
          <View style={styles.helperHeader}>
            <Text style={styles.helperTitle}>increase weight</Text>
            <Pressable
              accessibilityLabel="Close increase weight helper"
              accessibilityRole="button"
              style={styles.helperDoneButton}
              testID="increase-weight-helper-close"
              onPress={onClose}
            >
              <Text style={styles.helperDoneText}>done</Text>
            </Pressable>
          </View>

          <View style={styles.helperSection}>
            <Text style={styles.subtleTitle}>current</Text>
            <Text style={styles.helperLargeText}>
              {formatSetSummary(defaultWeight, defaultReps)} .{" "}
              {formatOneRepMax(oneRepMax)}
            </Text>
          </View>

          <View style={styles.helperSection}>
            <Text style={styles.subtleTitle}>add weight</Text>
            <View style={styles.segmentedRow}>
              <SegmentedChoice
                active={mode === "equal-sides"}
                accessibilityLabel="Use equal sides for increase weight"
                testID="increase-weight-mode-equal-sides"
                onPress={() => setMode("equal-sides")}
              >
                equal sides
              </SegmentedChoice>
              <SegmentedChoice
                active={mode === "total"}
                accessibilityLabel="Use total load for increase weight"
                testID="increase-weight-mode-total"
                onPress={() => setMode("total")}
              >
                total load
              </SegmentedChoice>
            </View>
            <View style={styles.addWeightRow}>
              <Text style={styles.addWeightValue}>
                +{formatNumber(addedWeight)}lb
              </Text>
              <View style={styles.addWeightButtons}>
                <Pressable
                  accessible
                  accessibilityLabel="Increase added weight"
                  accessibilityRole="button"
                  style={styles.addWeightStepButton}
                  testID="increase-weight-added-weight-increase"
                  onPress={() => adjustAddedWeight(1)}
                >
                  <Text style={styles.addWeightStepText}>+</Text>
                </Pressable>
                <Pressable
                  accessible
                  accessibilityLabel="Decrease added weight"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: addedWeight <= 2.5 }}
                  style={[
                    styles.addWeightStepButton,
                    addedWeight <= 2.5 ? styles.keyDisabled : null,
                  ]}
                  testID="increase-weight-added-weight-decrease"
                  onPress={() => {
                    if (addedWeight > 2.5) {
                      adjustAddedWeight(-1);
                    }
                  }}
                >
                  <Text style={styles.addWeightStepText}>-</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.helperMutedLine}>
              {mode === "equal-sides"
                ? `per side . ${formatSignedCompactPounds(
                    targetWeight - defaultWeight,
                  )} . ${formatNumber(targetWeight)}lb total`
                : `${formatNumber(targetWeight)}lb total`}
            </Text>
          </View>

          <View style={styles.helperSection}>
            {rows.map((row) => (
              <View key={row.key} style={styles.suggestionBlock}>
                <Text style={styles.subtleTitle}>{row.label}</Text>
                <View
                  style={[
                    styles.suggestionRow,
                    selectedKey === row.key ? styles.suggestionRowActive : null,
                  ]}
                >
                  <Text style={styles.suggestionText}>
                    {formatSetSummary(row.targetWeight, row.targetReps)} .{" "}
                    {formatOneRepMax(row.targetOneRepMax)} .{" "}
                    {formatPercentChangeNarrative(row.percentChange)}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Use ${row.label} increase weight suggestion`}
                    accessibilityRole="button"
                    style={styles.useButton}
                    testID={`increase-weight-use-${row.label}`}
                    onPress={() => {
                      setSelectedKey(row.key);
                      onUse({
                        weight: row.targetWeight,
                        reps: row.targetReps,
                      });
                    }}
                  >
                    <Icon name="checkmark-outline" size={18} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityLabel="Close increase weight helper"
            accessibilityRole="button"
            style={styles.helperDoneFooter}
            testID="increase-weight-helper-done"
            onPress={onClose}
          >
            <Text style={styles.helperDoneFooterText}>done</Text>
          </Pressable>
        </View>
      </DismissibleModalShade>
    </Modal>
  );
}

function PlateCalculatorHelperModal({
  visible,
  defaultWeight,
  defaultStartingWeight,
  defaultLoadMode,
  onClose,
  onSettingsChange,
}: {
  visible: boolean;
  defaultWeight: number;
  defaultStartingWeight?: number | null;
  defaultLoadMode?: PlateLoadMode | null;
  onClose: () => void;
  onSettingsChange: (settings: {
    startingWeight: number | null;
    loadMode: PlateLoadMode;
  }) => void;
}) {
  const [startingWeight, setStartingWeight] = useState(
    defaultStartingWeight ?? 45,
  );
  const [mode, setMode] = useState<PlateLoadMode>(
    parsePlateMode(defaultLoadMode),
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStartingWeight(defaultStartingWeight ?? 45);
    setMode(parsePlateMode(defaultLoadMode));
    setMenuOpen(false);
  }, [defaultLoadMode, defaultStartingWeight, visible]);

  const platePlan = calculatePlatePlan(defaultWeight, startingWeight, mode);

  const updateStartingWeight = (nextStartingWeight: number) => {
    setStartingWeight(nextStartingWeight);
    setMenuOpen(false);
    onSettingsChange({
      startingWeight: nextStartingWeight,
      loadMode: mode,
    });
  };

  const updateMode = (nextMode: PlateLoadMode) => {
    setMode(nextMode);
    onSettingsChange({
      startingWeight,
      loadMode: nextMode,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade onDismiss={onClose} style={styles.helperShade}>
        <View style={styles.helperDialog}>
          <View style={styles.helperHeader}>
            <Text style={styles.helperTitle}>plates</Text>
            <Pressable
              accessibilityLabel="Close plate calculator"
              accessibilityRole="button"
              style={styles.helperDoneButton}
              testID="plate-calculator-close"
              onPress={onClose}
            >
              <Text style={styles.helperDoneText}>done</Text>
            </Pressable>
          </View>

          <View style={styles.plateTopRow}>
            <View>
              <Text style={styles.subtleTitle}>total weight</Text>
              <Text style={styles.helperLargeText}>
                {formatNumber(defaultWeight)}
                <Text style={styles.helperUnit}>lb</Text>
              </Text>
            </View>
            <View>
              <Text style={styles.subtleTitle}>starting weight</Text>
              <Pressable
                accessibilityLabel="Choose plate starting weight"
                accessibilityRole="button"
                style={styles.helperSelect}
                testID="plate-starting-weight-select"
                onPress={() => setMenuOpen((open) => !open)}
              >
                <Text style={styles.helperSelectText}>
                  {getStartingWeightLabel(startingWeight)}
                </Text>
                <Icon name="chevron-down-outline" size={18} />
              </Pressable>
            </View>
          </View>

          {menuOpen ? (
            <View style={styles.helperMenu}>
              {STARTING_WEIGHTS.map((choice) => (
                <Pressable
                  key={choice.weight}
                  accessibilityLabel={`Use ${choice.label} starting weight`}
                  accessibilityRole="button"
                  style={styles.helperMenuItem}
                  testID={`plate-starting-weight-${choice.weight}`}
                  onPress={() => updateStartingWeight(choice.weight)}
                >
                  <Text style={styles.helperMenuItemText}>{choice.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.segmentedRow}>
            <SegmentedChoice
              active={mode === "equal-sides"}
              accessibilityLabel="Use equal sides for plate calculator"
              testID="plate-mode-equal-sides"
              onPress={() => updateMode("equal-sides")}
            >
              equal sides
            </SegmentedChoice>
            <SegmentedChoice
              active={mode === "total"}
              accessibilityLabel="Use total load for plate calculator"
              testID="plate-mode-total"
              onPress={() => updateMode("total")}
            >
              total load
            </SegmentedChoice>
          </View>

          <View style={styles.helperSection}>
            {platePlan.error ? (
              <>
                <HelperLine
                  left="start"
                  right={
                    startingWeight > 0
                      ? `${formatNumber(startingWeight)}lb`
                      : "none"
                  }
                />
                <HelperLine
                  left={mode === "equal-sides" ? "each" : "load"}
                  right={platePlan.title}
                />
                <HelperLine left="-" right={platePlan.error} />
              </>
            ) : (
              <PlatePlanDisplay plan={platePlan} />
            )}
          </View>

          <Pressable
            accessibilityLabel="Close plate calculator"
            accessibilityRole="button"
            style={styles.helperDoneFooter}
            testID="plate-calculator-done"
            onPress={onClose}
          >
            <Text style={styles.helperDoneFooterText}>done</Text>
          </Pressable>
        </View>
      </DismissibleModalShade>
    </Modal>
  );
}

function SegmentedChoice({
  active,
  accessibilityLabel,
  children,
  onPress,
  testID,
}: {
  active: boolean;
  accessibilityLabel?: string;
  children: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      style={[
        styles.segmentedButton,
        active ? styles.segmentedButtonActive : null,
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Text
        style={[
          styles.segmentedButtonText,
          active ? styles.segmentedButtonTextActive : null,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function PlatePlanDisplay({
  plan,
}: {
  plan: ReturnType<typeof calculatePlatePlan>;
}) {
  const plateBlocks = plan.plates.flatMap((plate) =>
    Array.from({ length: plate.count }, (_, index) => ({
      key: `${plate.weight}-${index}`,
      weight: plate.weight,
    })),
  );

  return (
    <View style={styles.platePlan}>
      <View style={styles.plateVisualRow}>
        <BarVisual weight={plan.startingWeight} />
        <View style={styles.plateBlockRow}>
          {plateBlocks.length ? (
            plateBlocks.map((plate) => (
              <PlateBlock key={plate.key} weight={plate.weight} />
            ))
          ) : (
            <Text style={styles.helperMutedLine}>no plates</Text>
          )}
        </View>
      </View>
      <Text style={styles.helperMutedLine}>{formatPlateSummary(plan)}</Text>
      <View style={styles.plateLegendRow}>
        {PLATES.map((plate) => {
          const count =
            plan.plates.find((candidate) => candidate.weight === plate)
              ?.count ?? 0;
          return (
            <View key={plate} style={styles.plateLegendItem}>
              <PlateChip weight={plate} active={count > 0} />
              <Text style={styles.plateCountText}>
                {count > 0 ? `x${count}` : " "}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BarVisual({ weight }: { weight: number }) {
  return (
    <View style={styles.barVisual}>
      <Text style={styles.barVisualText}>
        {weight > 0 ? `${formatNumber(weight)}lb` : ""}
      </Text>
    </View>
  );
}

function PlateBlock({ weight }: { weight: PlateWeight }) {
  const colors = getPlateColor(weight);
  return (
    <View
      style={[
        styles.plateBlock,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          height: getPlateHeight(weight),
        },
      ]}
    >
      <Text style={[styles.plateBlockText, { color: colors.text }]}>
        {formatNumber(weight)}
      </Text>
    </View>
  );
}

function PlateChip({
  weight,
  active,
}: {
  weight: PlateWeight;
  active: boolean;
}) {
  const colors = getPlateColor(weight);
  return (
    <View
      style={[
        styles.plateChip,
        {
          backgroundColor: active ? colors.background : palette.raised,
          borderColor: active ? colors.border : palette.line,
        },
      ]}
    >
      <Text
        style={[
          styles.plateChipText,
          { color: active ? colors.text : palette.muted },
        ]}
      >
        {formatNumber(weight)}
      </Text>
    </View>
  );
}

function HelperLine({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.helperLine}>
      <Text style={styles.helperLineLeft}>{left}</Text>
      <Text style={styles.helperLineRight}>{right}</Text>
    </View>
  );
}

const STARTING_WEIGHTS = [
  { label: "none", weight: 0 },
  { label: "45lb bar", weight: 45 },
  { label: "25lb bar", weight: 25 },
  { label: "15lb bar", weight: 15 },
] as const;

function parsePlateMode(
  value: PlateLoadMode | null | undefined,
): PlateLoadMode {
  return value === "total" ? "total" : "equal-sides";
}

function getStartingWeightLabel(weight: number) {
  return (
    STARTING_WEIGHTS.find((choice) => choice.weight === weight)?.label ??
    `${formatNumber(weight)}lb`
  );
}

function formatSetSummary(weight: number, reps: number) {
  return `${formatNumber(weight)}lb×${formatNumber(reps)}`;
}

function formatOneRepMax(oneRepMax: number) {
  return `${formatNumber(oneRepMax)}lb 1rm`;
}

function formatSignedCompactPounds(value: number) {
  if (value > 0) return `+${formatNumber(value)}lb`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}lb`;
  return "0lb";
}

function formatPercentChangeNarrative(value: number) {
  const rounded = Number(value.toFixed(1));
  const absolute = formatNumber(Math.abs(rounded));
  if (rounded > 0) return `+${absolute}% increase`;
  if (rounded < 0) return `-${absolute}% decrease`;
  return "same";
}

function formatPlateSummary(plan: ReturnType<typeof calculatePlatePlan>) {
  return `${formatPlateWeight(plan.startingWeight)}lb start . ${formatPlateWeight(
    plan.loadWeight,
  )}lb ${plan.mode === "equal-sides" ? "per side" : "total"}`;
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function getPlateHeight(weight: PlateWeight) {
  if (weight === 45) return 64;
  if (weight === 35) return 56;
  if (weight === 25) return 52;
  if (weight === 10) return 44;
  if (weight === 5) return 40;
  return 34;
}

function getPlateColor(weight: PlateWeight) {
  if (weight === 45) {
    return { background: "#ff3347", border: "#4b5563", text: "#fffefa" };
  }
  if (weight === 35) {
    return { background: "#eef1f6", border: "#c8ced8", text: "#7a7468" };
  }
  if (weight === 25) {
    return { background: "#dbe4f1", border: "#9aa7b8", text: "#383225" };
  }
  if (weight === 10) {
    return { background: "#f7b91e", border: "#4b5563", text: "#1f1c17" };
  }
  if (weight === 5) {
    return { background: "#a855f7", border: "#4b5563", text: "#fffefa" };
  }
  return { background: "#e8dfce", border: "#a99f8e", text: "#383225" };
}

function NoteEditorModal({
  workout,
  target,
  onClose,
  onSave,
}: {
  workout: Workout;
  target: NoteEditTarget | null;
  onClose: () => void;
  onSave: (target: NoteEditTarget, text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const nativeKeyboard = useNativeKeyboardFrame();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!target) return;
    setValue(getNoteValue(workout, target));
  }, [target, workout]);

  if (!target) return null;

  const title = getNoteTitle(workout, target);
  const hasExisting = getNoteValue(workout, target).trim().length > 0;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <DismissibleModalShade keyboardAvoiding onDismiss={onClose}>
        <View style={styles.sheetDock}>
          <View
            style={[
              styles.noteSheet,
              {
                paddingBottom: nativeKeyboard.visible
                  ? 8
                  : Math.max(12, insets.bottom + 8),
              },
            ]}
          >
            <View style={styles.keyboardHeader}>
              <Text style={styles.metaText}>{title}</Text>
              <Pressable
                accessibilityLabel="Close note editor"
                accessibilityRole="button"
                style={styles.iconButtonSmall}
                testID="note-editor-close"
                onPress={onClose}
              >
                <Icon name="close-outline" size={24} />
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel={title}
              value={value}
              onChangeText={setValue}
              multiline
              autoFocus
              style={styles.noteInput}
            />
            <View style={styles.noteActions}>
              <Pressable
                accessibilityLabel="Delete note"
                accessibilityRole="button"
                style={styles.iconButton}
                testID="note-editor-delete"
                onPress={() => {
                  if (hasExisting) {
                    Alert.alert("Delete note?", title, [
                      { text: "cancel", style: "cancel" },
                      {
                        text: "delete",
                        style: "destructive",
                        onPress: () => {
                          onSave(target, "");
                          onClose();
                        },
                      },
                    ]);
                  } else {
                    onSave(target, "");
                    onClose();
                  }
                }}
              >
                <Icon name="trash-outline" size={24} />
              </Pressable>
              <Pressable
                accessibilityLabel="Save note"
                accessibilityRole="button"
                style={[styles.textButton, styles.sheetActionFill]}
                testID="note-editor-save"
                onPress={() => {
                  onSave(target, value);
                  onClose();
                }}
              >
                <Text style={styles.textButtonText}>done</Text>
              </Pressable>
            </View>
            {nativeKeyboard.visible ? (
              <View
                pointerEvents="none"
                style={[
                  styles.nativeKeyboardBackgroundFill,
                  {
                    bottom: -nativeKeyboard.height,
                    height: nativeKeyboard.height,
                  },
                ]}
              />
            ) : null}
          </View>
        </View>
      </DismissibleModalShade>
    </Modal>
  );
}

function WorkoutStartTimeEditor({
  target,
  startTime,
  completedAt,
  onClose,
  onSaveStartTime,
  onSaveCompletedAt,
}: {
  target: TimeEditTarget | null;
  startTime: number;
  completedAt: Date | null;
  onClose: () => void;
  onSaveStartTime: (startTime: number) => void;
  onSaveCompletedAt: (completedTime: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const startDate = new Date(startTime);
  const fallbackEndDate = completedAt ?? new Date(startTime + 60_000);
  const baseDate =
    target === "start-date" || target === "start-time"
      ? startDate
      : fallbackEndDate;
  const [value, setValue] = useState(() => baseDate);

  useEffect(() => {
    if (!target) return;
    setValue(baseDate);
  }, [baseDate.getTime(), target]);

  if (!target) return null;

  const isDateTarget = target.endsWith("date");
  const isStartTarget = target.startsWith("start");
  const label = `${isStartTarget ? "start" : "end"} ${isDateTarget ? "date" : "time"}`;

  const save = () => {
    if (isStartTarget) {
      onSaveStartTime(value.getTime());
    } else {
      onSaveCompletedAt(value.getTime());
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <DismissibleModalShade onDismiss={onClose}>
        <View style={styles.sheetDock}>
          <View
            style={[
              styles.noteSheet,
              { paddingBottom: Math.max(12, insets.bottom + 8) },
            ]}
          >
            <View style={styles.keyboardHeader}>
              <Text style={styles.metaText}>{label}</Text>
              <View style={styles.flexSpacer} />
              <Pressable
                accessibilityLabel="Close time editor"
                accessibilityRole="button"
                style={styles.iconButtonSmall}
                testID="time-editor-close"
                onPress={onClose}
              >
                <Icon name="close-outline" size={24} />
              </Pressable>
            </View>
            <DateTimePicker
              accessibilityLabel={label}
              display={isDateTarget ? "inline" : "spinner"}
              mode={isDateTarget ? "date" : "time"}
              style={styles.dateTimePicker}
              testID={`workout-${target}-picker`}
              value={value}
              onChange={(_event, selectedDate) => {
                if (!selectedDate) return;
                setValue(
                  isDateTarget
                    ? mergeDatePart(baseDate, selectedDate)
                    : mergeTimePart(baseDate, selectedDate),
                );
              }}
            />
            <View style={styles.sheetActionsEnd}>
              <Pressable
                accessibilityLabel={`Save ${label}`}
                accessibilityRole="button"
                style={styles.textButton}
                testID="time-editor-done"
                onPress={save}
              >
                <Text style={styles.textButtonText}>done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </DismissibleModalShade>
    </Modal>
  );
}

function FinishPreviewModal({
  workout,
  saving,
  open,
  onEditEndDate,
  onEditEndTime,
  onBack,
  onSave,
}: {
  workout: CompletedWorkout | null;
  saving: boolean;
  open: boolean;
  onEditEndDate: () => void;
  onEditEndTime: () => void;
  onBack: () => void;
  onSave: () => void;
}) {
  if (!workout) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onBack}
    >
      <DismissibleModalShade onDismiss={onBack}>
        <View style={styles.previewBox}>
          <Text style={styles.exerciseTitle}>{workout.name}</Text>
          <Text style={styles.metaText}>
            {workout.exercises.length} exercises .{" "}
            {countWorkoutWorkingSets(workout)} sets
          </Text>
          <View style={styles.timeInlineRow}>
            <Text style={styles.metaText}>
              {formatDateTime(workout.startedAt)} -{" "}
            </Text>
            <Pressable
              accessibilityLabel="Edit finish end date"
              accessibilityRole="button"
              style={styles.timeTextButton}
              testID="finish-preview-end-date"
              onPress={onEditEndDate}
            >
              <Text style={styles.timeTextButtonText}>
                {formatWorkoutStartDate(workout.completedAt)}
              </Text>
            </Pressable>
            <Text style={styles.metaText}> </Text>
            <Pressable
              accessibilityLabel="Edit finish end time"
              accessibilityRole="button"
              style={styles.timeTextButton}
              testID="finish-preview-end-time"
              onPress={onEditEndTime}
            >
              <Text style={styles.timeTextButtonText}>
                {formatTime(workout.completedAt)}
              </Text>
            </Pressable>
            <Text style={styles.metaText}>
              {" "}
              ({formatDuration(workout.startedAt, workout.completedAt)})
            </Text>
          </View>
          <ScrollView style={styles.previewScroll}>
            {workout.exercises.map((exercise) => (
              <View
                key={`${exercise.name}-${exercise.order}`}
                style={styles.previewExercise}
              >
                <Text style={styles.previewExerciseTitle}>
                  {exercise.name} .{" "}
                  {countCompletedExerciseWorkingSets(exercise)} sets
                </Text>
                <Text style={styles.historySummary}>
                  {summarizeCompletedExerciseSetGroup(
                    exercise.sets.filter((set) => set.modifier === "warmup"),
                  ) ?? ""}
                </Text>
                <Text style={styles.historySummary}>
                  {summarizeCompletedExerciseSetGroup(
                    exercise.sets.filter((set) => set.modifier !== "warmup"),
                  ) ?? ""}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.noteActions}>
            <Pressable
              accessibilityLabel="Go back to workout"
              accessibilityRole="button"
              style={styles.iconButton}
              testID="finish-preview-back"
              onPress={onBack}
            >
              <Icon name="arrow-back-outline" size={24} />
            </Pressable>
            <Pressable
              accessibilityLabel="Save workout"
              accessibilityRole="button"
              style={[styles.textButton, styles.primaryWideButton]}
              testID="finish-preview-save"
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.primaryWideButtonText}>
                {saving ? "saving" : "save workout"}
              </Text>
            </Pressable>
          </View>
        </View>
      </DismissibleModalShade>
    </Modal>
  );
}

function toggleRest(
  dispatch: (action: Action) => void,
  exerciseIndex: number,
  exercise: WorkoutExercise,
  setIndex: number,
) {
  const set = exercise.sets[setIndex];
  if (!set) return;
  const nextRest: SetRestType | undefined =
    set.restBefore === "short" ? "standard" : "short";
  dispatch({
    type: "SET_REST_BEFORE",
    exerciseIndex,
    setIndex,
    restBefore: nextRest,
  });
}

function findSetIndex(exercise: WorkoutExercise | undefined, setId: string) {
  if (!exercise) return null;
  const indexTarget = parseSetTargetId(setId);
  if (indexTarget != null) {
    return exercise.sets[indexTarget] ? indexTarget : null;
  }
  const index = exercise.sets.findIndex((set) => set.clientId === setId);
  return index >= 0 ? index : null;
}

function makeSetTargetId(setIndex: number) {
  return `index:${setIndex}`;
}

function parseSetTargetId(setId: string) {
  if (!setId.startsWith("index:")) return null;
  const index = Number(setId.slice("index:".length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function formatWorkoutStartDate(date: Date) {
  return date
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

function defaultCompletedAtForStartTime(startTime: number) {
  const startDate = new Date(startTime);
  const now = new Date();
  const completedAt = mergeTimePart(startDate, now);
  const minimumCompletedAt = startTime + 60_000;
  return new Date(Math.max(minimumCompletedAt, completedAt.getTime()));
}

function mergeDatePart(startDate: Date, selectedDate: Date) {
  const nextDate = new Date(startDate);
  nextDate.setFullYear(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
  return nextDate;
}

function mergeTimePart(startDate: Date, selectedDate: Date) {
  const nextDate = new Date(startDate);
  nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return nextDate;
}

function getNoteValue(workout: Workout, target: NoteEditTarget) {
  if (target.kind === "workout") return workout.notes[0]?.text ?? "";
  const exercise = workout.exercises[target.exerciseIndex];
  if (!exercise) return "";
  if (target.kind === "exercise") return exercise.exerciseNotes ?? "";
  if (target.kind === "workout-exercise") return exercise.notes[0]?.text ?? "";
  const setIndex = findSetIndex(exercise, target.setId);
  return setIndex == null ? "" : (exercise.sets[setIndex]?.notes ?? "");
}

function getNoteTitle(workout: Workout, target: NoteEditTarget) {
  if (target.kind === "workout") return "workout note";
  const exercise = workout.exercises[target.exerciseIndex];
  if (!exercise) return "note";
  if (target.kind === "exercise")
    return `${exercise.name}\npinned exercise note`;
  if (target.kind === "workout-exercise")
    return `${exercise.name}\nthis workout note`;
  const setIndex = findSetIndex(exercise, target.setId);
  return `${exercise.name}\n${setIndex == null ? "set" : setLabel(exercise, setIndex)} note`;
}

function setLabel(exercise: WorkoutExercise, setIndex: number) {
  const set = exercise.sets[setIndex];
  if (!set) return "set";
  const sameKind = exercise.sets
    .slice(0, setIndex + 1)
    .filter((candidate) =>
      set.modifier === "warmup"
        ? candidate.modifier === "warmup"
        : candidate.modifier !== "warmup" && candidate.restBefore !== "short",
    );
  if (set.modifier === "warmup") return `warm-up set ${sameKind.length}`;
  if (set.restBefore === "short") {
    const workingBefore = exercise.sets
      .slice(0, setIndex)
      .filter(
        (candidate) =>
          candidate.modifier !== "warmup" && candidate.restBefore !== "short",
      );
    return `set ${Math.max(1, workingBefore.length)}`;
  }
  return `set ${sameKind.length}`;
}
