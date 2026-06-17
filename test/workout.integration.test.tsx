import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkoutComponent } from "@/components/workout/workout";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { id: "user_1" }, isLoaded: true }),
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
          fetch: vi.fn(async ({ exerciseNames }) => ({
            workoutName: "Test Workout",
            exercises: exerciseNames.map((name: string) => ({
              name,
              sets: [{ weight: null, reps: 8 }],
            })),
          })),
        },
      },
    }),
    workout: {
      saveWorkout: {
        useMutation: (opts?: any) => ({
          isPending: false,
          mutate: (payload: any) => opts?.onSuccess?.(null, payload, null),
        }),
      },
    },
    exercise: {
      list: {
        useQuery: () => ({
          data: [],
          isLoading: false,
          isError: false,
        }),
      },
    },
  },
}));

describe("WorkoutComponent", () => {
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
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Finish Workout",
    );
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Start Time")).toBeInTheDocument();
    expect(screen.getByLabelText("End Time")).toBeInTheDocument();
    expect(screen.getByLabelText("Duration (minutes)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Finish Workout")).not.toBeInTheDocument();
  });
});
