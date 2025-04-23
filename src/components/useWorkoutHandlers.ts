import { type Workout, workoutReducer, type Action } from "@/lib/workoutLogic";
import { type Dispatch } from "react";

export function useWorkoutHandlers(state: Workout, dispatch: Dispatch<Action>) {
  const onKeyPress = (v: string) => {
    const map: Record<string, Action> = {
      backspace: { type: "BACKSPACE" },
      next: { type: "NEXT" },
      plus: { type: "PLUS_MINUS", sign: 1 },
      minus: { type: "PLUS_MINUS", sign: -1 },
      collapse: { type: "COLLAPSE_KEYBOARD" },
    };
    if (map[v]) return dispatch(map[v]);
    if (v === "bw") return dispatch({ type: "TOGGLE_BODYWEIGHT" });
    if (v === "toggle-sign") return dispatch({ type: "TOGGLE_SIGN" });
    dispatch({ type: "INPUT_DIGIT", value: v });
  };

  const handleFocus = (
    exIdx: number,
    setIdx: number,
    field: "weight" | "reps",
  ) =>
    dispatch({
      type: "FOCUS_FIELD",
      exerciseIndex: exIdx,
      setIndex: setIdx,
      field,
    });

  return { onKeyPress, handleFocus };
}
