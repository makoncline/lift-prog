"use client";

import { useState, type ReactNode } from "react";
import { Calculator, Check, Minus, Plus, Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { estimate1RM, roundToStep } from "@lift-prog/workout-core";
import {
  PLATES,
  buildAddedWeightRepRows,
  calculatePlatePlan,
  formatPlateWeight,
} from "@/lib/weight-helper";
import type { PlateMode, PlatePlan, PlateWeight } from "@/lib/weight-helper";
import type { CurrentExerciseSet } from "@/components/workout-reference/workout_reference_types";

const BARS = [
  { value: "none", label: "none", weight: 0 },
  { value: "45", label: "45lb bar", weight: 45 },
  { value: "35", label: "35lb bar", weight: 35 },
  { value: "33", label: "33lb bar", weight: 33 },
  { value: "25", label: "25lb bar", weight: 25 },
  { value: "15", label: "15lb bar", weight: 15 },
  { value: "custom", label: "custom", weight: null },
] as const;

type PlateColor = { background: string; border: string; text: string };

const PLATE_COLORS: Record<PlateWeight, PlateColor> = {
  45: { background: "#f04444", border: "#5f6570", text: "#fdfcf8" },
  35: { background: "#e8ebef", border: "#c5cbd4", text: "#373226" },
  25: { background: "#d8dee7", border: "#b5bdc9", text: "#373226" },
  10: { background: "#f0b326", border: "#5f6570", text: "#17150f" },
  5: { background: "#9b5de5", border: "#5f6570", text: "#fdfcf8" },
  2.5: { background: "#d7cfbc", border: "#a79b83", text: "#17150f" },
};
const PLATE_HEIGHTS: Record<PlateWeight, number> = {
  45: 64,
  35: 56,
  25: 49,
  10: 38,
  5: 34,
  2.5: 30,
};

type StartingWeightValue = (typeof BARS)[number]["value"];
export type WeightSuggestion = {
  weight: number;
  reps: number;
};
export type PlateSettings = {
  startingWeight: number | null;
  loadMode: PlateMode;
};

export function WeightHelperDialog({
  set,
  children,
}: {
  set: CurrentExerciseSet;
  children: ReactNode;
}) {
  return (
    <Dialog modal={false}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <WeightHelperDialogContent title="weight helper">
        <WeightHelperPanel set={set} />
      </WeightHelperDialogContent>
    </Dialog>
  );
}

export function IncreaseWeightDialog({
  set,
  children,
  onUse,
  defaultLoadMode,
}: {
  set: CurrentExerciseSet;
  children: ReactNode;
  onUse: (suggestion: WeightSuggestion) => void;
  defaultLoadMode?: PlateMode | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog modal={false} open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <WeightHelperDialogContent title="increase weight" stacked>
        <OneRepMaxAddedWeightRepsCalculator
          set={set}
          withSectionFrame={false}
          defaultLoadMode={defaultLoadMode}
          onUse={(suggestion) => {
            onUse(suggestion);
            setOpen(false);
          }}
        />
      </WeightHelperDialogContent>
    </Dialog>
  );
}

export function PlateCalculatorDialog({
  set,
  children,
  defaultStartingWeight,
  defaultLoadMode,
  onSettingsChange,
}: {
  set: CurrentExerciseSet;
  children: ReactNode;
  defaultStartingWeight?: number | null;
  defaultLoadMode?: PlateMode | null;
  onSettingsChange?: (settings: PlateSettings) => void;
}) {
  return (
    <Dialog modal={false}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <WeightHelperDialogContent title="plates" stacked>
        <PlateLoadCalculator
          set={set}
          withSectionFrame={false}
          defaultStartingWeight={defaultStartingWeight}
          defaultLoadMode={defaultLoadMode}
          onSettingsChange={onSettingsChange}
        />
      </WeightHelperDialogContent>
    </Dialog>
  );
}

function WeightHelperDialogContent({
  title,
  children,
  stacked = false,
}: {
  title: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <>
      {stacked ? (
        <DialogPortal>
          <div
            aria-hidden="true"
            data-weight-helper-backdrop="true"
            className="fixed inset-0 z-[60] bg-[#17150f]/60"
          />
        </DialogPortal>
      ) : null}
      <DialogContent
        className={cn(
          "max-h-[82dvh] w-[calc(100vw-16px)] max-w-[390px] overflow-y-auto rounded-[7px] border-[#d7cab8] bg-[#fbfaf7] p-3 font-mono text-[#1f1c17] shadow-none [&_[data-slot=dialog-close]]:!top-2 [&_[data-slot=dialog-close]]:!right-2 [&_[data-slot=dialog-close]]:!h-10 [&_[data-slot=dialog-close]]:!w-10 [&_[data-slot=dialog-close]]:!p-0 [&_[data-slot=dialog-close]_svg]:!size-5",
          stacked && "!z-[70]",
        )}
      >
        <DialogTitle className="text-[18px] leading-6 font-normal text-[#7a7468]">
          {title}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Estimate equivalent weights and calculate plates.
        </DialogDescription>
        {children}
      </DialogContent>
    </>
  );
}

export function WeightHelperPanel({ set }: { set: CurrentExerciseSet }) {
  return (
    <div className="space-y-2">
      <OneRepMaxAddedWeightRepsCalculator set={set} />
      <PlateLoadCalculator set={set} />
    </div>
  );
}

export function OneRepMaxAddedWeightRepsCalculator({
  set,
  onUse,
  withSectionFrame = true,
  defaultLoadMode,
}: {
  set: CurrentExerciseSet;
  onUse?: (suggestion: WeightSuggestion) => void;
  withSectionFrame?: boolean;
  defaultLoadMode?: PlateMode | null;
}) {
  const defaultWeight = getDefaultWeight(set);
  const defaultReps = getDefaultReps(set);
  const calculator = (
    <AddedWeightRepsHelper
      defaultWeight={defaultWeight}
      defaultReps={defaultReps}
      defaultLoadMode={defaultLoadMode}
      onUse={onUse}
    />
  );

  if (!withSectionFrame) return calculator;

  return (
    <WeightHelperSection title="increase weight">
      {calculator}
    </WeightHelperSection>
  );
}

export function PlateLoadCalculator({
  set,
  withSectionFrame = true,
  defaultStartingWeight,
  defaultLoadMode,
  onSettingsChange,
}: {
  set: CurrentExerciseSet;
  withSectionFrame?: boolean;
  defaultStartingWeight?: number | null;
  defaultLoadMode?: PlateMode | null;
  onSettingsChange?: (settings: PlateSettings) => void;
}) {
  const calculator = (
    <PlateHelper
      defaultWeight={getDefaultWeight(set)}
      defaultStartingWeight={defaultStartingWeight}
      defaultLoadMode={defaultLoadMode}
      onSettingsChange={onSettingsChange}
    />
  );

  if (!withSectionFrame) return calculator;

  return <WeightHelperSection title="plates">{calculator}</WeightHelperSection>;
}

function WeightHelperSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[7px] border border-[#d7cab8] p-3">
      <div className="mb-2 text-[18px] leading-6 text-[#7a7468]">{title}</div>
      {children}
    </section>
  );
}

export function WeightHelperIcon() {
  return (
    <div className="flex items-center gap-1">
      <Calculator className="size-4" aria-hidden="true" />
      <Scale className="size-3" aria-hidden="true" />
    </div>
  );
}

function AddedWeightRepsHelper({
  defaultWeight,
  defaultReps,
  defaultLoadMode,
  onUse,
}: {
  defaultWeight: number;
  defaultReps: number;
  defaultLoadMode?: PlateMode | null;
  onUse?: (suggestion: WeightSuggestion) => void;
}) {
  const [mode, setMode] = useState<PlateMode>(parsePlateMode(defaultLoadMode));
  const [addedWeight, setAddedWeight] = useState(5);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const oneRepMax = estimate1RM(defaultWeight, defaultReps);
  const rows = buildAddedWeightRepRows(
    defaultWeight,
    oneRepMax,
    addedWeight,
    mode,
  );
  const targetWeight =
    defaultWeight + (mode === "equal-sides" ? addedWeight * 2 : addedWeight);

  function adjustAddedWeight(direction: "down" | "up") {
    setSelectedKey(null);
    setAddedWeight((current) => {
      const step = getAddedWeightControlStep();
      const next = current + (direction === "up" ? step : -step);
      return Math.max(step, roundToStep(next, 0.5));
    });
  }

  function switchMode(nextMode: PlateMode) {
    setMode(nextMode);
    setSelectedKey(null);
    setAddedWeight((current) =>
      Math.max(getAddedWeightControlStep(), roundToStep(current, 0.5)),
    );
  }

  return (
    <div className="space-y-3 text-[18px] leading-6">
      <CurrentOneRepMaxLine
        weight={defaultWeight}
        reps={defaultReps}
        oneRepMax={oneRepMax}
      />

      <div className="space-y-1">
        <FieldLabel>add weight</FieldLabel>
        <div className="flex flex-wrap gap-1">
          <SegmentedButton
            active={mode === "equal-sides"}
            onClick={() => switchMode("equal-sides")}
          >
            equal sides
          </SegmentedButton>
          <SegmentedButton
            active={mode === "total"}
            onClick={() => switchMode("total")}
          >
            total load
          </SegmentedButton>
        </div>
        <div className="grid min-w-0 grid-cols-[8rem_2rem_1fr] items-center gap-1 overflow-x-auto pb-0.5 text-[18px] leading-6 whitespace-nowrap">
          <span className="inline-flex h-10 w-[8rem] items-center rounded-[5px] border border-[#eee9df] bg-[#fffefa] px-2 text-[24px] leading-none text-[#1f1c17]">
            +{formatNumber(addedWeight)}lb
          </span>
          <StackedStepper
            decreaseLabel="decrease added weight"
            increaseLabel="increase added weight"
            onDecrease={() => adjustAddedWeight("down")}
            onIncrease={() => adjustAddedWeight("up")}
            decreaseDisabled={addedWeight <= getAddedWeightControlStep()}
          />
          <span className="text-[#7a7468]">
            {mode === "equal-sides" ? (
              <>
                per side ·{" "}
                {formatSignedCompactPounds(targetWeight - defaultWeight)} ·{" "}
                {formatNumber(targetWeight)}lb total
              </>
            ) : (
              <>{formatNumber(targetWeight)}lb total</>
            )}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((row) => (
          <AddedWeightRepRow
            key={row.key}
            row={row}
            selected={selectedKey === row.key}
            onSelect={() => {
              setSelectedKey(row.key);
              onUse?.({ weight: row.targetWeight, reps: row.targetReps });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AddedWeightRepRow({
  row,
  selected,
  onSelect,
}: {
  row: ReturnType<typeof buildAddedWeightRepRows>[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="space-y-px">
      <FieldLabel>{row.label}</FieldLabel>
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 rounded-[7px] border border-transparent py-1",
          selected && "border-[#383225] bg-[#eee9df] px-2",
        )}
      >
        <div className="min-w-0 truncate text-[18px] leading-6">
          {formatSetSummary(row.targetWeight, row.targetReps)} ·{" "}
          {formatOneRepMax(row.targetOneRepMax)} ·{" "}
          {formatPercentChangeNarrative(row.percentChange)}
        </div>
        <Button
          type="button"
          variant="outline"
          aria-label={`Use ${row.label} suggestion`}
          className={cn(
            "flex h-[34px] min-w-[44px] shrink-0 items-center justify-center rounded-[7px] border-[#d7cab8] bg-[#fffefa] p-0 text-[#7a7468] shadow-none hover:bg-[#eee9df]",
            selected && "bg-[#eee9df] text-[#1f1c17]",
          )}
          onClick={onSelect}
        >
          <Check className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function CurrentOneRepMaxLine({
  weight,
  reps,
  oneRepMax,
}: {
  weight: number;
  reps: number;
  oneRepMax: number;
}) {
  return (
    <div className="space-y-0.5">
      <FieldLabel>current</FieldLabel>
      <div className="text-[24px] leading-8">
        {formatSetSummary(weight, reps)} · {formatOneRepMax(oneRepMax)}
      </div>
    </div>
  );
}

function PlateHelper({
  defaultWeight,
  defaultStartingWeight,
  defaultLoadMode,
  onSettingsChange,
}: {
  defaultWeight: number;
  defaultStartingWeight?: number | null;
  defaultLoadMode?: PlateMode | null;
  onSettingsChange?: (settings: PlateSettings) => void;
}) {
  const [settings, setSettings] = useState<PlateSettings>(() => ({
    startingWeight: defaultStartingWeight ?? 45,
    loadMode: parsePlateMode(defaultLoadMode),
  }));
  const startingWeight = settings.startingWeight ?? 0;
  const mode = settings.loadMode;
  const platePlan = calculatePlatePlan(defaultWeight, startingWeight, mode);

  function updateSettings(nextSettings: PlateSettings) {
    setSettings(nextSettings);
    onSettingsChange?.(nextSettings);
  }

  return (
    <div className="space-y-3 text-[18px] leading-6">
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <div className="space-y-1">
          <FieldLabel>total weight</FieldLabel>
          <div className="inline-flex h-5 items-baseline">
            <span className="font-mono text-[30px] leading-none">
              {formatNumber(defaultWeight)}
            </span>
            <span className="text-[18px] leading-none text-[#7a7468]">lb</span>
          </div>
        </div>

        <PlateSettingsControls
          defaultStartingWeight={settings.startingWeight}
          defaultLoadMode={settings.loadMode}
          onSettingsChange={updateSettings}
        />
      </div>

      <div className="space-y-1">
        {!platePlan.error ? <PlatePlanDisplay plan={platePlan} /> : null}
        {platePlan?.error ? (
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
        ) : null}
      </div>
    </div>
  );
}

export function PlateSettingsControls({
  defaultStartingWeight,
  defaultLoadMode,
  onSettingsChange,
}: {
  defaultStartingWeight?: number | null;
  defaultLoadMode?: PlateMode | null;
  onSettingsChange: (settings: PlateSettings) => void;
}) {
  const initialStartingWeight = defaultStartingWeight ?? 45;
  const [startingWeightValue, setStartingWeightValue] =
    useState<StartingWeightValue>(() =>
      getStartingWeightValue(initialStartingWeight),
    );
  const [customStartingWeightText, setCustomStartingWeightText] = useState(() =>
    String(initialStartingWeight),
  );
  const [mode, setMode] = useState<PlateMode>(parsePlateMode(defaultLoadMode));
  const startingWeight = getStartingWeight(
    startingWeightValue,
    customStartingWeightText,
  );

  function saveSettings(nextStartingWeight: number, nextMode: PlateMode) {
    onSettingsChange({
      startingWeight: nextStartingWeight,
      loadMode: nextMode,
    });
  }

  function updateStartingWeightValue(value: StartingWeightValue) {
    const nextStartingWeight = getStartingWeight(
      value,
      customStartingWeightText,
    );
    setStartingWeightValue(value);
    saveSettings(nextStartingWeight, mode);
  }

  function updateCustomStartingWeightText(value: string) {
    const nextStartingWeight = getStartingWeight(startingWeightValue, value);
    setCustomStartingWeightText(value);
    saveSettings(nextStartingWeight, mode);
  }

  function updateMode(nextMode: PlateMode) {
    setMode(nextMode);
    saveSettings(startingWeight, nextMode);
  }

  return (
    <div className="space-y-2 text-[18px] leading-6">
      <div className="min-w-0 space-y-1">
        <FieldLabel>starting weight</FieldLabel>
        <div className="flex flex-wrap items-center gap-1">
          <Select
            value={startingWeightValue}
            onValueChange={(value) =>
              updateStartingWeightValue(value as StartingWeightValue)
            }
          >
            <SelectTrigger
              aria-label="starting weight"
              className="!h-10 min-w-[8rem] !gap-1 rounded-[5px] border-[#d7cab8] bg-[#fffefa] !px-2 !py-0 font-mono text-[20px] leading-none text-[#1f1c17] shadow-none focus:ring-[#383225] [&_svg]:!size-4"
            >
              <span className="min-w-0 truncate">
                {getStartingWeightLabel(startingWeightValue)}
              </span>
            </SelectTrigger>
            <SelectContent className="!z-[80] rounded-[7px] border-[#d7cab8] bg-[#fffefa] font-mono text-[#1f1c17] shadow-none">
              {BARS.map((bar) => (
                <SelectItem
                  key={bar.value}
                  value={bar.value}
                  className="font-mono text-[20px] focus:bg-[#eee9df]"
                >
                  {bar.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {startingWeightValue === "custom" ? (
            <NumericInput
              value={customStartingWeightText}
              onChange={updateCustomStartingWeightText}
              ariaLabel="custom starting weight"
              suffix="lb"
              className="w-[5.25rem]"
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <SegmentedButton
          active={mode === "equal-sides"}
          onClick={() => updateMode("equal-sides")}
        >
          equal sides
        </SegmentedButton>
        <SegmentedButton
          active={mode === "total"}
          onClick={() => updateMode("total")}
        >
          total load
        </SegmentedButton>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[18px] leading-6 text-[#7a7468]">{children}</div>;
}

function PlatePlanDisplay({ plan }: { plan: PlatePlan }) {
  const plateBlocks = plan.plates.flatMap((plate) =>
    Array.from({ length: plate.count }, (_, index) => ({
      key: `${plate.weight}-${index}`,
      weight: plate.weight,
    })),
  );

  return (
    <div className="space-y-1 py-0.5">
      <div className="flex min-h-14 items-center gap-2 overflow-x-auto py-0.5">
        <BarVisual weight={plan.startingWeight} />
        <div className="flex items-center gap-[3px]">
          {plateBlocks.length ? (
            plateBlocks.map((plate) => (
              <PlateBlock key={plate.key} weight={plate.weight} />
            ))
          ) : (
            <span className="text-[18px] text-[#7a7468]">no plates</span>
          )}
        </div>
      </div>

      <div className="grid gap-2 text-[18px] leading-6">
        <div>
          <div className="text-[#7a7468]">{formatPlateSummary(plan)}</div>
          <PlateCountLegend plates={plan.plates} />
        </div>
      </div>
    </div>
  );
}

function BarVisual({ weight }: { weight: number }) {
  return (
    <div className="flex h-4 min-w-32 items-center justify-center rounded-[4px] border border-[#7f8793] bg-[#b9c0cc] text-[12px] leading-none font-semibold text-[#383225]">
      {weight > 0 ? `${formatNumber(weight)}lb` : null}
    </div>
  );
}

function PlateBlock({ weight }: { weight: PlateWeight }) {
  const height = PLATE_HEIGHTS[weight];
  const width = 12;
  const color = getPlateColor(weight);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-[2px] border text-[8px] leading-none"
      style={{
        height,
        width,
        backgroundColor: color.background,
        borderColor: color.border,
        color: color.text,
      }}
      title={`${formatNumber(weight)}lb`}
    >
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap">
        {formatNumber(weight)}
      </span>
    </div>
  );
}

function PlateCountLegend({
  plates,
}: {
  plates: Array<{ weight: PlateWeight; count: number }>;
}) {
  const counts = new Map(plates.map((plate) => [plate.weight, plate.count]));

  return (
    <div className="flex flex-wrap items-start gap-1.5 pt-0.5">
      {PLATES.map((plate) => {
        const count = counts.get(plate) ?? 0;
        const active = count > 0;
        return (
          <div
            key={plate}
            className="flex min-w-6 flex-col items-center gap-0.5"
          >
            <PlateChip weight={plate} active={active} />
            {active ? (
              <div className="text-[14px] leading-none text-[#1f1c17]">
                x{count}
              </div>
            ) : (
              <div className="h-2.5" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlateChip({
  weight,
  active,
}: {
  weight: PlateWeight;
  active: boolean;
}) {
  const color = getPlateColor(weight);

  return (
    <div
      className="flex size-6 items-center justify-center rounded-full border text-[9px] leading-none"
      style={{
        backgroundColor: active ? color.background : "#fffefa",
        borderColor: active ? color.border : "#d7cab8",
        color: active ? color.text : "#7a7468",
      }}
    >
      {formatNumber(weight)}
    </div>
  );
}

function getPlateColor(weight: PlateWeight): PlateColor {
  return PLATE_COLORS[weight];
}

function formatPlateSummary(plan: PlatePlan) {
  return `${formatPlateWeight(plan.startingWeight)}lb start · ${formatPlateWeight(
    plan.loadWeight,
  )}lb ${plan.mode === "equal-sides" ? "per side" : "total"}`;
}

function formatSetSummary(weight: number, reps: number) {
  return `${formatNumber(weight)}lb×${reps}`;
}

function formatOneRepMax(oneRepMax: number) {
  return `${formatNumber(oneRepMax)}lb 1rm`;
}

function formatSignedCompactPounds(value: number) {
  const formatted = formatNumber(Math.abs(value));

  if (value > 0) return `+${formatted}lb`;
  if (value < 0) return `-${formatted}lb`;
  return "0lb";
}

function NumericInput({
  value,
  suffix,
  ariaLabel,
  className,
  onChange,
}: {
  value: string;
  suffix?: string;
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-10 min-w-0 items-center rounded-[5px] border border-[#eee9df] bg-[#fffefa] px-2",
        className,
      )}
    >
      <input
        value={value}
        aria-label={ariaLabel}
        inputMode="decimal"
        className="max-w-full min-w-[1ch] flex-none bg-transparent font-mono text-[24px] leading-none outline-none"
        style={{ width: `${Math.max(value.length, 1)}ch` }}
        onChange={(event) => onChange(event.target.value)}
      />
      {suffix ? (
        <span className="text-[18px] text-[#7a7468]">{suffix}</span>
      ) : null}
    </label>
  );
}

function StackedStepper({
  increaseLabel,
  decreaseLabel,
  decreaseDisabled,
  onIncrease,
  onDecrease,
}: {
  increaseLabel: string;
  decreaseLabel: string;
  decreaseDisabled?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  return (
    <div className="grid h-10 w-8 overflow-hidden rounded-[5px] border border-[#d7cab8] bg-[#fffefa]">
      <button
        type="button"
        aria-label={increaseLabel}
        className="flex items-center justify-center border-b border-[#d7cab8] text-[#1f1c17]"
        onClick={onIncrease}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={decreaseDisabled}
        className="flex items-center justify-center text-[#1f1c17] disabled:text-[#d7cab8]"
        onClick={onDecrease}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function SegmentedButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(
        "h-10 rounded-[7px] border-[#d7cab8] bg-[#fffefa] px-3 font-mono text-[20px] font-normal text-[#7a7468] shadow-none hover:bg-[#eee9df]",
        active && "bg-[#eee9df] text-[#1f1c17] ring-1 ring-[#383225]",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function HelperLine({ left, right }: { left: string; right: string }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] gap-2">
      <span className="text-[#7a7468]">{left}</span>
      <span className="min-w-0">{right}</span>
    </div>
  );
}

function getAddedWeightControlStep() {
  return 2.5;
}

function getStartingWeight(
  value: StartingWeightValue,
  customStartingWeightText: string,
) {
  if (value === "custom") {
    return parseNonNegativeNumber(customStartingWeightText) ?? 0;
  }

  return BARS.find((bar) => bar.value === value)?.weight ?? 0;
}

function getStartingWeightValue(weight: number): StartingWeightValue {
  return (
    BARS.find((bar) => bar.weight === weight)?.value ??
    (weight === 0 ? "none" : "custom")
  );
}

function getStartingWeightLabel(value: StartingWeightValue) {
  return BARS.find((bar) => bar.value === value)?.label ?? "none";
}

function parsePlateMode(value: PlateMode | null | undefined): PlateMode {
  return value === "total" ? "total" : "equal-sides";
}

function getDefaultWeight(set: CurrentExerciseSet) {
  return parsePositiveNumber(set.weightAmount) ?? 135;
}

function getDefaultReps(set: CurrentExerciseSet) {
  return parsePositiveInteger(set.reps) ?? 8;
}

function parsePositiveNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatNumber(value: number) {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatPercentChangeNarrative(value: number) {
  const rounded = Number(value.toFixed(1));
  const absolute = formatNumber(Math.abs(rounded));

  if (rounded > 0) return `+${absolute}%`;
  if (rounded < 0) return `-${absolute}%`;
  return "0%";
}
