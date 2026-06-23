import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkoutComponent } from "@/components/workout/workout";

const trpcMocks = vi.hoisted(() => ({
  exerciseListData: [] as Array<{
    id: number;
    name: string;
    notes: string | null;
    exerciseId: number | null;
  }>,
  exerciseListInvalidate: vi.fn(),
  listRecentInvalidate: vi.fn(),
  prepareInitialWorkoutFetch: vi.fn(),
  addExerciseMutate: vi.fn(),
  saveWorkoutMutate: vi.fn(),
  updateWorkoutMutate: vi.fn(),
  deleteWorkoutMutate: vi.fn(),
  updateNoteMutate: vi.fn(),
  updatePlateDefaultsMutate: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "auth_user_1", email: "makon@hey.com" } },
      isPending: false,
    }),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/components/RestTimer", () => ({
  RestTimer: () => <div data-testid="rest-timer" />,
}));

vi.mock("@/components/plate-calculator", () => ({
  PlateCalculator: () => <div data-testid="plate-calc" />,
}));

vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({
      workout: {
        prepareInitialWorkout: {
          fetch: trpcMocks.prepareInitialWorkoutFetch,
        },
        listRecent: { invalidate: trpcMocks.listRecentInvalidate },
      },
      exercise: {
        list: { invalidate: trpcMocks.exerciseListInvalidate },
      },
    }),
    workout: {
      saveWorkout: {
        useMutation: (opts?: any) => ({
          isPending: false,
          mutate: (payload: any) => {
            trpcMocks.saveWorkoutMutate(payload);
            opts?.onSuccess?.(null, payload, null);
          },
        }),
      },
      updateWorkout: {
        useMutation: (opts?: any) => ({
          isPending: false,
          mutate: (payload: any) => {
            trpcMocks.updateWorkoutMutate(payload);
            opts?.onSuccess?.(null, payload, null);
          },
        }),
      },
      deleteWorkout: {
        useMutation: (opts?: any) => ({
          isPending: false,
          mutate: (payload: any) => {
            trpcMocks.deleteWorkoutMutate(payload);
            opts?.onSuccess?.(null, payload, null);
          },
        }),
      },
    },
    exercise: {
      list: {
        useQuery: () => ({
          data: trpcMocks.exerciseListData,
          isLoading: false,
          isError: false,
        }),
      },
      add: {
        useMutation: (opts?: any) => ({
          isPending: false,
          mutate: (payload: any) => {
            trpcMocks.addExerciseMutate(payload);
            void opts?.onSuccess?.(null, payload, null);
          },
        }),
      },
      updateNote: {
        useMutation: (opts?: any) => ({
          isPending: false,
          mutate: (payload: any) => {
            trpcMocks.updateNoteMutate(payload);
            void opts?.onSuccess?.(null, payload, null);
          },
        }),
      },
      updatePlateDefaults: {
        useMutation: (opts?: any) => ({
          isPending: false,
          mutate: (payload: any) => {
            trpcMocks.updatePlateDefaultsMutate(payload);
            void opts?.onSuccess?.(null, payload, null);
          },
        }),
      },
    },
  },
}));

describe("WorkoutComponent", () => {
  beforeEach(() => {
    localStorage.clear();
    trpcMocks.exerciseListData = [];
    trpcMocks.exerciseListInvalidate.mockReset();
    trpcMocks.listRecentInvalidate.mockReset();
    trpcMocks.addExerciseMutate.mockReset();
    trpcMocks.saveWorkoutMutate.mockReset();
    trpcMocks.updateWorkoutMutate.mockReset();
    trpcMocks.deleteWorkoutMutate.mockReset();
    trpcMocks.updateNoteMutate.mockReset();
    trpcMocks.updatePlateDefaultsMutate.mockReset();
    trpcMocks.prepareInitialWorkoutFetch.mockReset();
    trpcMocks.prepareInitialWorkoutFetch.mockImplementation(
      async ({ exerciseNames }) => ({
        workoutName: "Test Workout",
        exercises: exerciseNames.map((name: string) => ({
          name,
          sets: [{ weight: null, reps: 8 }],
        })),
      }),
    );
  });

  it("supports the current workout entry flow", async () => {
    render(
      <WorkoutComponent
        workoutName="Test Workout"
        exercises={[
          {
            name: "Bench Press",
            exerciseNotes: "Touch low on chest",
            sets: [
              { weight: 45, reps: 5, modifier: "warmup" },
              { weight: 95, reps: 5 },
              { weight: 95, reps: 5 },
            ],
          },
        ]}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Test Workout" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Workout exercises" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Bench Press" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test Workout" }));
    fireEvent.change(await screen.findByPlaceholderText("Workout name"), {
      target: { value: "Renamed Workout" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(
      await screen.findByRole("button", { name: "Renamed Workout" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add workout note" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Workout note" }),
      {
        target: { value: "Felt good today" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "done" }));
    expect(await screen.findByText("Felt good today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit set 1 reps" }));
    expect(
      await screen.findByRole("group", { name: "Swipe between sets" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Bench Press").length).toBeGreaterThan(0);
    expect(screen.getByText("set 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "done" }));

    fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));
    const finishDialog = await screen.findByRole("dialog");
    expect(finishDialog).toHaveTextContent("save workout");
    expect(finishDialog).toHaveTextContent("1 exercise");
    fireEvent.click(screen.getByRole("button", { name: "go back" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds an existing exercise with its stored capitalization", async () => {
    trpcMocks.exerciseListData = [
      { id: 1, name: "Pull-ups", notes: null, exerciseId: null },
    ];

    render(<WorkoutComponent workoutName="Test Workout" exercises={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "exercises" }));
    fireEvent.change(
      await screen.findByPlaceholderText("exercise name"),
      {
        target: { value: "pull-ups" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(
      await screen.findByRole("heading", { name: "Pull-ups" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(trpcMocks.prepareInitialWorkoutFetch).toHaveBeenCalledWith({
        mode: "exerciseList",
        workoutName: "Test Workout",
        exerciseNames: ["Pull-ups"],
      }),
    );
    expect(screen.queryByRole("heading", { name: "pull-ups" })).toBeNull();
    expect(trpcMocks.addExerciseMutate).not.toHaveBeenCalled();
  });

  it("sets approximate body weight for bodyweight workouts", async () => {
    render(
      <WorkoutComponent
        workoutName="Pull day"
        exercises={[
          {
            name: "Pull-ups",
            sets: [
              {
                weight: 0,
                reps: 15,
                modifier: "warmup",
                weightModifier: "bodyweight",
              },
              { weight: 20, reps: 8, weightModifier: "bodyweight" },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit body weight" }));
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Body weight" }), {
      target: { value: "195.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "done" }));

    expect(await screen.findByText("195.5lb")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));
    fireEvent.click(await screen.findByRole("button", { name: "save workout" }));

    await waitFor(() =>
      expect(trpcMocks.saveWorkoutMutate).toHaveBeenCalledWith(
        expect.objectContaining({ bodyWeightLb: 195.5 }),
      ),
    );
  });
});
