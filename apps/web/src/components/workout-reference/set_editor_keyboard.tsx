"use client";

import {
  forwardRef,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  CircleChevronDown,
  Delete,
  Disc3,
  KeyboardIcon,
  Minus,
  Plus,
  TimerReset,
  TrendingUp,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IncreaseWeightDialog,
  PlateCalculatorDialog,
  type PlateSettings,
  type WeightSuggestion,
} from "@/components/workout-reference/weight_helper_dialog";
import type { PlateMode } from "@/lib/weight-helper";
import type { CurrentExerciseSet } from "@/components/workout-reference/workout_reference_types";

export function SetEditorKeyboard({
  field,
  set,
  onDone,
  onAddShortRest,
  onNext,
  onUpdate,
  plateStartingWeight,
  plateLoadMode,
  onPlateSettingsChange,
}: {
  field: "weight" | "reps";
  set: CurrentExerciseSet;
  onDone: () => void;
  onAddShortRest?: () => void;
  onNext: () => void;
  onUpdate: (set: CurrentExerciseSet) => void;
  plateStartingWeight?: number | null;
  plateLoadMode?: PlateMode | null;
  onPlateSettingsChange?: (settings: PlateSettings) => void;
}) {
  const [draftSet, setDraftSet] = useState(set);
  const draftSetRef = useRef(set);

  function updateDraftSet(
    nextSet: (currentSet: CurrentExerciseSet) => CurrentExerciseSet,
  ) {
    const nextDraftSet = nextSet(draftSetRef.current);
    draftSetRef.current = nextDraftSet;
    setDraftSet(nextDraftSet);
    onUpdate(nextDraftSet);
  }

  function handleKeyPress(value: string) {
    if (value === "done") {
      onDone();
      return;
    }

    if (value === "next") {
      onNext();
      return;
    }

    if (value === "short-rest") {
      onAddShortRest?.();
      return;
    }

    if (field === "weight") {
      updateDraftSet((currentSet) => applyWeightKey(currentSet, value));
      return;
    }

    updateDraftSet((currentSet) => applyRepsKey(currentSet, value));
  }

  function applyWeightSuggestion(suggestion: WeightSuggestion) {
    updateDraftSet((currentSet) => ({
      ...currentSet,
      weightMode: "standard",
      weightAmount: formatEditorNumber(suggestion.weight),
      weightSign: 1,
      reps: String(suggestion.reps),
    }));
  }

  return (
    <KeypadShell>
      <DigitKeypad onKeyPress={handleKeyPress} />
      {field === "weight" ? (
        <KeypadButton value="." area="decimal" onKeyPress={handleKeyPress}>
          .
        </KeypadButton>
      ) : (
        <div style={{ gridArea: "decimal" }} />
      )}
      <KeypadButton
        value="backspace"
        area="backspace"
        onKeyPress={handleKeyPress}
      >
        <Delete className="size-4" aria-hidden="true" />
      </KeypadButton>
      {field === "weight" ? (
        <div
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[7px]"
          style={{ gridArea: "action1" }}
        >
          <IncreaseWeightDialog
            set={draftSet}
            defaultLoadMode={plateLoadMode}
            onUse={applyWeightSuggestion}
          >
            <KeypadTriggerButton label="increase weight helper">
              <TrendingUp className="size-4" aria-hidden="true" />
            </KeypadTriggerButton>
          </IncreaseWeightDialog>
          <PlateCalculatorDialog
            set={draftSet}
            defaultStartingWeight={plateStartingWeight}
            defaultLoadMode={plateLoadMode}
            onSettingsChange={onPlateSettingsChange}
          >
            <KeypadTriggerButton label="plate calculator">
              <Disc3 className="size-4" aria-hidden="true" />
            </KeypadTriggerButton>
          </PlateCalculatorDialog>
        </div>
      ) : (
        <KeypadButton value="done" area="action1" onKeyPress={handleKeyPress}>
          <div className="flex items-center gap-1">
            <KeyboardIcon className="size-4" aria-hidden="true" />
            <CircleChevronDown className="size-3" aria-hidden="true" />
          </div>
        </KeypadButton>
      )}
      <div
        className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[7px]"
        style={{ gridArea: "action2" }}
      >
        <KeypadButton value="minus" onKeyPress={handleKeyPress}>
          <Minus className="size-4" aria-hidden="true" />
        </KeypadButton>
        <KeypadButton value="plus" onKeyPress={handleKeyPress}>
          <Plus className="size-4" aria-hidden="true" />
        </KeypadButton>
      </div>
      {field === "weight" ? (
        <div
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[7px]"
          style={{ gridArea: "action3" }}
        >
          <KeypadButton
            value="bw"
            label="bodyweight"
            active={draftSet.weightMode === "bodyweight"}
            onKeyPress={handleKeyPress}
          >
            <User className="size-4" aria-hidden="true" />
          </KeypadButton>
          <KeypadButton
            value="toggle-sign"
            label="toggle sign"
            disabled={draftSet.weightMode !== "bodyweight"}
            onKeyPress={handleKeyPress}
          >
            +/-
          </KeypadButton>
        </div>
      ) : (
        <KeypadButton
          value="short-rest"
          label="short rest add reps"
          area="action3"
          disabled={!onAddShortRest}
          onKeyPress={handleKeyPress}
        >
          <div className="flex items-center gap-1">
            <TimerReset className="size-4" aria-hidden="true" />
            <Plus className="size-3" aria-hidden="true" />
          </div>
        </KeypadButton>
      )}
      <KeypadButton
        value="next"
        area="action4"
        primary
        onKeyPress={handleKeyPress}
      >
        Next
      </KeypadButton>
    </KeypadShell>
  );
}

function KeypadShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid h-[265px] w-full min-w-0 gap-[7px]"
      style={{
        gridTemplateColumns: "repeat(4,minmax(0,1fr))",
        gridTemplateRows: "repeat(4,1fr)",
        gridTemplateAreas: `
          "btn1  btn2  btn3  action1"
          "btn4  btn5  btn6  action2"
          "btn7  btn8  btn9  action3"
          "decimal btn0 backspace action4"
        `,
        touchAction: "manipulation",
      }}
    >
      {children}
    </div>
  );
}

function DigitKeypad({ onKeyPress }: { onKeyPress: (value: string) => void }) {
  const cells = [
    "btn1",
    "btn2",
    "btn3",
    "btn4",
    "btn5",
    "btn6",
    "btn7",
    "btn8",
    "btn9",
    "btn0",
  ] as const;

  return (
    <>
      {cells.map((area, index) => {
        const value = String(index === 9 ? 0 : index + 1);
        return (
          <KeypadButton
            key={area}
            value={value}
            area={area}
            onKeyPress={onKeyPress}
          >
            {value}
          </KeypadButton>
        );
      })}
    </>
  );
}

function KeypadButton({
  value,
  area,
  label,
  active,
  primary,
  disabled,
  children,
  onKeyPress,
}: {
  value: string;
  area?: string;
  label?: string;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onKeyPress: (value: string) => void;
}) {
  return (
    <Button
      type="button"
      aria-label={label ?? value}
      variant="outline"
      disabled={disabled}
      className={cn(
        "h-full w-full min-w-0 rounded-[7px] border-[#d7cab8] bg-[#fffefa] px-1 py-1 font-mono text-[22px] font-normal text-[#1f1c17] shadow-none hover:bg-[#eee9df]",
        active && "bg-[#eee9df] ring-1 ring-[#383225]",
        primary && "bg-[#383225] text-[#fffefa] hover:bg-[#383225]/90",
      )}
      style={area ? { gridArea: area } : undefined}
      onClick={(event) => {
        event.preventDefault();
        if (!disabled) onKeyPress(value);
      }}
    >
      {children}
    </Button>
  );
}

const KeypadTriggerButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Button> & { label: string }
>(function KeypadTriggerButton({ label, children, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      aria-label={label}
      variant="outline"
      className={cn(
        "h-full w-full min-w-0 rounded-[7px] border-[#d7cab8] bg-[#fffefa] px-1 py-1 font-mono text-[22px] font-normal text-[#1f1c17] shadow-none hover:bg-[#eee9df]",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
});

function applyWeightKey(
  set: CurrentExerciseSet,
  value: string,
): CurrentExerciseSet {
  if (value === "bw") {
    return {
      ...set,
      weightMode: set.weightMode === "bodyweight" ? "standard" : "bodyweight",
    };
  }

  if (value === "toggle-sign") {
    if (set.weightMode !== "bodyweight") return set;
    return { ...set, weightSign: set.weightSign === 1 ? -1 : 1 };
  }

  if (value === "plus" || value === "minus") {
    const step = value === "plus" ? 5 : -5;
    return {
      ...set,
      weightAmount: incrementNumericText(set.weightAmount, step),
    };
  }

  if (value === "backspace") {
    return { ...set, weightAmount: set.weightAmount.slice(0, -1) };
  }

  if (value === "." && set.weightAmount.includes(".")) return set;
  if (value === "." && set.weightAmount === "")
    return { ...set, weightAmount: "0." };
  if (/^\d$/.test(value) || value === ".") {
    return { ...set, weightAmount: appendNumericText(set.weightAmount, value) };
  }

  return set;
}

function applyRepsKey(
  set: CurrentExerciseSet,
  value: string,
): CurrentExerciseSet {
  if (value === "plus" || value === "minus") {
    const step = value === "plus" ? 1 : -1;
    return { ...set, reps: incrementNumericText(set.reps, step, false) };
  }

  if (value === "backspace") return { ...set, reps: set.reps.slice(0, -1) };

  if (/^\d$/.test(value)) {
    return { ...set, reps: appendNumericText(set.reps, value, false) };
  }

  return set;
}

function appendNumericText(
  currentValue: string,
  nextDigit: string,
  allowDecimal = true,
) {
  if (!allowDecimal && nextDigit === ".") return currentValue;
  if (currentValue === "0" && nextDigit !== ".") return nextDigit;
  if (currentValue.length >= 5) return currentValue;
  return `${currentValue}${nextDigit}`;
}

function incrementNumericText(
  currentValue: string,
  step: number,
  allowDecimal = true,
) {
  const currentNumber = Number.parseFloat(currentValue || "0");
  const nextNumber = Math.max(0, currentNumber + step);
  if (!allowDecimal) return String(Math.round(nextNumber));
  return formatEditorNumber(nextNumber);
}

export function formatEditorNumber(value: number) {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
