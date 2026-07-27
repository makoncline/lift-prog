import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import { Keyboard, Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthScreen, type AuthDraft } from "../auth/AuthScreen";
import { StartupErrorScreen, StartupLoadingScreen } from "../StartupState";
import type { LocalSyncStatus } from "../local-first/sync-coordinator";
import { MobileErrorBoundary } from "../workout/MobileErrorBoundary";
import {
  LiftMobileAppReady,
  type AppScreen,
} from "../workout/MobileWorkoutApp";
import type { PendingWorkoutDraft } from "../workout/workout-draft";
import {
  ATLAS_NOW_MS,
  atlasPastWorkoutDetails,
  atlasPreparedWorkout,
  atlasRecentWorkouts,
  createAtlasDraftWorkout,
  createAtlasWorkoutClient,
  type AtlasClientMode,
} from "./fixtures";
import { getMobileWorkoutInitialState } from "./scenario";

function atlasStateFromUrl(url: string | null) {
  if (!url) return null;
  const match = url.match(/ui-atlas\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function UiAtlasDevGate({ app }: { app: React.ReactNode }) {
  const [stateId, setStateId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void Linking.getInitialURL().then((url) => {
      const state = atlasStateFromUrl(url);
      if (mounted && state) {
        Keyboard.dismiss();
        setStateId(state);
      }
    });
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const state = atlasStateFromUrl(url);
      if (state) {
        Keyboard.dismiss();
        setStateId(state);
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  if (!stateId) return app;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <MobileErrorBoundary
        key={stateId}
        scope="mobile-root"
        screen={`ui-atlas-${stateId}`}
        title="app crashed"
        initialErrorMessage={
          Number.parseInt(stateId, 10) === 8
            ? "Intentional UI atlas root error."
            : undefined
        }
      >
        <UiAtlasRoot stateId={stateId} />
      </MobileErrorBoundary>
    </SafeAreaProvider>
  );
}

export function UiAtlasRoot({ stateId }: { stateId: string }) {
  const stateNumber = Number.parseInt(stateId, 10);
  if (stateNumber === 1) {
    return <StartupLoadingScreen message="starting Lift Prog..." />;
  }
  if (stateNumber === 2) {
    return <StartupLoadingScreen message="opening local workout log..." />;
  }
  if (stateNumber === 3) {
    return (
      <StartupErrorScreen
        message="The fixture database could not be opened."
        reference="local-data-open"
        onRetry={() => undefined}
        onSupport={() => undefined}
      />
    );
  }
  if (
    (stateNumber >= 4 && stateNumber <= 7) ||
    (stateNumber >= 82 && stateNumber <= 84) ||
    stateNumber === 135 ||
    stateNumber === 136
  ) {
    const codeScreen =
      stateNumber === 6 ||
      stateNumber === 7 ||
      stateNumber === 83 ||
      stateNumber === 84 ||
      stateNumber === 136;
    const draft: AuthDraft = {
      email: "alex@example.com",
      otp: stateNumber === 7 || stateNumber === 83 ? "123456" : "",
      sentTo: codeScreen ? "alex@example.com" : "",
      screen: codeScreen ? "code" : "email",
    };
    return (
      <AuthScreen
        draft={draft}
        setDraft={() => undefined}
        onCancel={() => undefined}
        initialState={{
          error:
            stateNumber === 5
              ? "Could not send a code. Try again."
              : stateNumber === 7
                ? "That code is not valid."
                : undefined,
          isSending: stateNumber === 82 || stateNumber === 84,
          isVerifying: stateNumber === 83,
          autoFocus: stateNumber === 135 || stateNumber === 136,
        }}
      />
    );
  }
  if (stateNumber === 8) return null;
  return <MobileUiAtlasApp key={stateId} stateId={stateId} />;
}

function isAtlasHomeState(stateNumber: number) {
  return (
    (stateNumber >= 9 && stateNumber <= 20) ||
    (stateNumber >= 82 && stateNumber <= 88)
  );
}

function MobileUiAtlasApp({ stateId }: { stateId: string }) {
  const stateNumber = Number.parseInt(stateId, 10);
  const clientMode: AtlasClientMode =
    stateNumber === 10
      ? "empty"
      : stateNumber === 11
        ? "loading"
        : stateNumber === 12
          ? "error"
          : stateNumber === 13
            ? "slow"
            : "normal";
  const api = useMemo(() => createAtlasWorkoutClient(clientMode), [clientMode]);
  const homeState = isAtlasHomeState(stateNumber);
  const pastReview = stateNumber === 23;
  const pastEdit =
    stateNumber === 24 || stateNumber === 91 || stateNumber === 116;
  const emptyWorkout = [21, 94, 95].includes(stateNumber);
  let draftWorkout = createAtlasDraftWorkout({
    completed: pastReview || pastEdit,
    empty: emptyWorkout,
  });
  if (!pastReview && !pastEdit) {
    draftWorkout = {
      ...draftWorkout,
      startTime: ATLAS_NOW_MS - 48 * 60_000,
    };
  }
  if (stateNumber === 103 && draftWorkout.exercises[0]) {
    draftWorkout = {
      ...draftWorkout,
      exercises: draftWorkout.exercises.map((exercise, index) =>
        index === 0
          ? {
              ...exercise,
              notes: [{ text: "Stay tight through the final rep." }],
            }
          : exercise,
      ),
    };
  }
  if (stateNumber === 104 && draftWorkout.exercises[0]?.sets[1]) {
    draftWorkout = {
      ...draftWorkout,
      exercises: draftWorkout.exercises.map((exercise, exerciseIndex) =>
        exerciseIndex === 0
          ? {
              ...exercise,
              sets: exercise.sets.map((set, setIndex) =>
                setIndex === 1 ? { ...set, notes: "Smooth final rep." } : set,
              ),
            }
          : exercise,
      ),
    };
  }
  if (stateNumber >= 117 && stateNumber <= 120 && draftWorkout.exercises[0]) {
    draftWorkout = {
      ...draftWorkout,
      exercises: draftWorkout.exercises.map((exercise, index) =>
        index === 0
          ? {
              ...exercise,
              exerciseNotes: null,
              history: [],
              notes: [],
            }
          : exercise,
      ),
    };
  }
  const needsFixedCompletion =
    pastReview ||
    pastEdit ||
    [34, 36, 52, 53, 54, 55, 98, 99, 115, 116].includes(stateNumber);
  const fixedCompletedAt = new Date(draftWorkout.startTime + 48 * 60_000);
  const pendingDraft: PendingWorkoutDraft | null =
    stateNumber === 14
      ? {
          workout: {
            ...createAtlasDraftWorkout(),
            startTime: ATLAS_NOW_MS - 48 * 60_000,
          },
          completedAt: null,
          savedAt: Date.parse("2026-07-24T18:42:00-06:00"),
        }
      : null;
  const initialScreen: AppScreen = homeState
    ? { name: "home", refreshKey: 0 }
    : {
        name: "workout",
        key: 1,
        viewMode: pastReview
          ? "past-review"
          : pastEdit
            ? "past-edit"
            : "active",
        prepared:
          pastReview || pastEdit
            ? atlasPastWorkoutDetails
            : atlasPreparedWorkout,
        draftWorkout,
        workoutId: pastReview || pastEdit ? "atlas-workout-1" : undefined,
        startedAt:
          pastReview || pastEdit
            ? atlasPastWorkoutDetails.startedAt
            : new Date(draftWorkout.startTime),
        completedAt:
          pastReview || pastEdit
            ? atlasPastWorkoutDetails.completedAt
            : needsFixedCompletion
              ? fixedCompletedAt
              : null,
        notes:
          pastReview || pastEdit ? atlasPastWorkoutDetails.notes : undefined,
        contextLabel: pastReview
          ? "completed workout"
          : pastEdit
            ? "editing past workout #atlas-workout-1"
            : undefined,
      };
  const syncStatus: LocalSyncStatus | "local" =
    stateNumber === 15
      ? "local"
      : stateNumber === 17
        ? "syncing"
        : stateNumber === 18
          ? "pending"
          : "synced";

  return (
    <LiftMobileAppReady
      api={api}
      syncRefreshKey={0}
      syncStatus={syncStatus}
      debugInitialState={getMobileWorkoutInitialState(stateId)}
      debugInitialNowMs={ATLAS_NOW_MS}
      debugInitialPendingDraft={pendingDraft}
      debugInitialHomeWorkouts={stateNumber === 13 ? atlasRecentWorkouts : []}
      debugInitialScreen={initialScreen}
      onAccountDeleted={() => undefined}
      onBackUpNow={stateNumber === 15 ? undefined : () => undefined}
      onConnectCloud={stateNumber === 15 ? () => undefined : undefined}
      onSignOut={stateNumber === 15 ? undefined : () => undefined}
    />
  );
}
