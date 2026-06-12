import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { WorkoutComponent } from "@/components/workout/workout";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { id: "user_1" }, isLoaded: true }),
}));

vi.mock("@/components/RestTimer", () => ({
  RestTimer: () => <div data-testid="rest-timer" />,
}));
vi.mock("@/components/plate-calculator", () => ({
  PlateCalculator: () => <div data-testid="plate-calc" />,
}));

vi.mock("@/trpc/react", () => {
  return {
    api: {
      workout: {
        saveWorkout: {
          useMutation: (opts?: any) => ({
            isPending: false,
            mutate: (payload: any) => {
              opts?.onSuccess?.(null, payload, null);
            },
          }),
        },
      },
    },
  };
});

describe("WorkoutComponent happy path", () => {
  it("covers template start, rename, notes, warmups, working sets, finish flow", async () => {
    render(
      <WorkoutComponent
        workoutName="Test Workout"
        exercises={[
          {
            name: "Bench Press",
            sets: [
              { weight: 45, reps: 5, modifier: "warmup" },
              { weight: 95, reps: 5 },
              { weight: 95, reps: 5 },
              { weight: 95, reps: 5 },
            ],
          },
        ]}
      />,
    );

    expect(await screen.findByText("Test Workout")).toBeInTheDocument();

    // 2) Edit title
    fireEvent.click(screen.getByText("Test Workout"));
    const titleInput = await screen.findByPlaceholderText("Workout name");
    fireEvent.change(titleInput, { target: { value: "Renamed Workout" } });
    fireEvent.click(screen.getByText("Save Name"));
    expect(await screen.findByText("Renamed Workout")).toBeInTheDocument();

    // 3) Add a workout note (open menu then toggle)
    const workoutMenuBtn = screen.getByTestId("workout-menu");
    fireEvent.keyDown(workoutMenuBtn, { key: "Enter" });
    const workoutNoteToggle = await screen.findByRole("menuitem", {
      name: /Add a note|Hide note/i,
    });
    fireEvent.click(workoutNoteToggle);
    // Add a workout note via the new compact notes UI
    fireEvent.click((await screen.findAllByLabelText("Add note"))[0]!);
    // After adding, the last note is rendered as a code element until clicked -> click to edit
    const inlineNoteButtons = screen.getAllByRole("button", {
      name: /(empty)|.+/,
    });
    fireEvent.click(inlineNoteButtons[inlineNoteButtons.length - 1]!);
    const workoutNoteInputs = screen.getAllByRole("textbox");
    const lastWorkoutInput = workoutNoteInputs[workoutNoteInputs.length - 1]!;
    fireEvent.change(lastWorkoutInput, {
      target: { value: "Felt good today" },
    });

    const weightCell = screen.getByTestId("weight-cell-0-0");
    fireEvent.click(weightCell);

    // 4) Set warmup weight to 50
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // 5) Set warmup reps to 6 and complete
    fireEvent.click(screen.getByTestId("reps-cell-0-0"));
    fireEvent.click(screen.getByRole("button", { name: "6" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // 6) Set working set 1 weight to 100, expect subsequent estimates to cascade
    fireEvent.click(screen.getByTestId("weight-cell-0-1"));
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    // blur by moving to reps
    fireEvent.click(screen.getByTestId("reps-cell-0-1"));
    // Assert cascade to next working set
    expect(screen.getByTestId("weight-cell-0-2").textContent).toMatch(
      /100|\b100\b/,
    );

    // 7) Set working set 1 reps to 8
    fireEvent.click(screen.getByRole("button", { name: "8" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // 8) Complete first working set already done by Next; ensure Complete button toggled
    expect(screen.getByTestId("complete-btn-0-1")).toHaveClass("bg-success", {
      exact: false,
    });
    // Reps cascade to next working set
    expect(screen.getByTestId("reps-cell-0-2").textContent).toMatch(/8/);

    // 9) Add exercise note inline via the notes UI (no three-dots menu anymore)
    const addNoteIconButtons = await screen.findAllByLabelText("Add note");
    const addExerciseNoteBtn = addNoteIconButtons[1] ?? addNoteIconButtons[0];
    fireEvent.click(addExerciseNoteBtn);
    const inlineExerciseButtons = screen.getAllByRole("button", {
      name: /(empty)|.+/,
    });
    fireEvent.click(inlineExerciseButtons[inlineExerciseButtons.length - 1]!);
    const exerciseNoteInputs = screen.getAllByRole("textbox");
    const lastExerciseInput =
      exerciseNoteInputs[exerciseNoteInputs.length - 1]!;
    fireEvent.change(lastExerciseInput, { target: { value: "Paused reps" } });

    // 10) Delete a set via trash button and confirm
    fireEvent.click(screen.getByTestId("delete-btn-0-2"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    // 11) Open Finish dialog and check default times
    fireEvent.click(screen.getByText("Finish"));

    // 12) Edit date and duration -> start time should update accordingly via component logic
    const dateInput = await screen.findByLabelText("Date");
    const startInput = await screen.findByLabelText("Start Time");
    const endInput = await screen.findByLabelText("End Time");
    const durationInput = await screen.findByLabelText("Duration (minutes)");

    fireEvent.change(dateInput, { target: { value: "2025-05-05" } });
    fireEvent.change(endInput, { target: { value: "12:30" } });
    fireEvent.change(durationInput, { target: { value: "60" } });
    // start should become 11:30
    expect((startInput as HTMLInputElement).value).toBe("11:30");

    // 13) Reset end time to now (just triggers handler; not asserting specific value)
    fireEvent.click(screen.getByTitle("Set to now"));

    // 14) Save workout
    fireEvent.click(
      await screen.findByRole("button", { name: "Save Workout" }),
    );

    // There are two instances of the same text in the success UI; assert one of them by role/heading
    expect(
      await screen.findByRole("heading", { name: "Workout Saved!" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Done"));

    expect(screen.queryByText("Workout Saved!")).not.toBeInTheDocument();
  });
});
