import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreviousWorkoutExercise } from "@/components/workout-reference/previous-workout-exercise";

describe("PreviousWorkoutExercise", () => {
  const renderPullups = () =>
    render(
      <PreviousWorkoutExercise
        exerciseName="Pull-ups"
        exerciseNote="Hold dumbbell in thighs"
        history={[
          {
            relation: "last time",
            relativeDate: "5 days ago",
            date: "6/10",
            workoutNote: "Pull day felt low energy",
            workoutExerciseNote: "Feeling weak today",
            warmups: [{ weight: "BW", reps: [15], note: "Foot assist" }],
            workingSets: [
              { weight: "20 lb", reps: [13], note: "solid first set" },
              { weight: "20 lb", reps: [8], note: "failed clean" },
            ],
          },
          {
            relation: "2 times ago",
            relativeDate: "11 days ago",
            date: "6/4",
            warmups: [],
            workingSets: [
              { weight: "20 lb", reps: [6] },
              { weight: "20 lb", reps: [3], restBefore: "short" },
              { weight: "15 lb", reps: [4], restBefore: "short" },
            ],
          },
        ]}
      />,
    );

  it("keeps history hidden until the history button is toggled", () => {
    renderPullups();

    expect(screen.getByRole("heading", { name: "Pull-ups" })).toBeVisible();
    expect(screen.getByText("Hold dumbbell in thighs")).toBeVisible();
    expect(screen.queryByText("last time · 5 days ago · 6/10")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Show exercise history" }),
    );

    expect(screen.getByText("last time · 5 days ago · 6/10")).toBeVisible();
    expect(screen.getByText("Pull day felt low energy")).toBeVisible();
    expect(screen.getByText("Feeling weak today")).toBeVisible();
    expect(screen.getAllByText("warm-up").length).toBeGreaterThan(0);
    expect(screen.getAllByText("working sets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Foot assist").length).toBeGreaterThan(0);
    expect(screen.getAllByText("solid first set").length).toBeGreaterThan(0);
    expect(screen.getByText("stats · 2 workouts")).toBeVisible();
    expect(screen.getByText("23.2lb -> 30lb · +29%")).toBeVisible();
    expect(screen.getByText("240lb -> 420lb · +75%")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Hide exercise history" }),
    );
    expect(screen.queryByText("last time · 5 days ago · 6/10")).toBeNull();
  });

  it("initializes current sets from the latest history and edits set values", () => {
    renderPullups();

    expect(
      screen.getByRole("button", { name: "Edit warmup set 1 weight" }),
    ).toHaveTextContent("BW");
    expect(
      screen.getByRole("button", { name: "Edit warmup set 1 reps" }),
    ).toHaveTextContent("15");
    expect(
      screen.getByRole("button", { name: "Edit set 1 weight" }),
    ).toHaveTextContent("20lb");
    expect(
      screen.getByRole("button", { name: "Edit set 1 reps" }),
    ).toHaveTextContent("13");

    fireEvent.click(
      screen.getByRole("button", { name: "Edit warmup set 1 weight" }),
    );
    expect(
      screen.getByRole("group", { name: "Swipe between sets" }),
    ).toBeVisible();
    expect(screen.getByText("warm-up set 1")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "BW" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    expect(screen.getAllByText("BW+20 lb")[0]).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
  });

  it("edits rest type, adds set notes, and confirms set deletion", async () => {
    renderPullups();

    fireEvent.click(
      screen.getByRole("button", { name: "Change rest before set 2" }),
    );
    expect(
      screen.getAllByRole("button", { name: "Edit set 1 reps" }),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit set 1 reps" })[0]!,
    );
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /Add set 1 note/ })
        .find((button) => !button.hasAttribute("disabled"))!,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Set note" }), {
      target: { value: "keep elbows tight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "done" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByText("keep elbows tight")).toBeVisible();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit set 1 reps" })[0]!,
    );
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Delete set 1" })
        .find((button) => !button.hasAttribute("disabled"))!,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Confirm Delete / }));

    expect(screen.queryByText("keep elbows tight")).toBeNull();
  });

  it("opens the new set editor immediately after adding a working set", () => {
    renderPullups();

    fireEvent.click(screen.getByRole("button", { name: "Add set" }));

    expect(
      screen.getByRole("group", { name: "Swipe between sets" }),
    ).toBeVisible();
    expect(screen.getByText("set 3")).toBeVisible();
  });
});
