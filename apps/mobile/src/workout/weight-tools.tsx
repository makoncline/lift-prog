import { Ionicons } from "@expo/vector-icons";
import { estimate1RM, type PlateLoadMode } from "@lift-prog/workout-core";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { formatNumber } from "./format";
import { AppModal, DismissibleModalShade } from "./modal-primitives";
import { styles } from "./styles";
import { palette } from "./theme";
import type { MobileWorkoutInitialState } from "./initial-state";
import {
  buildAddedWeightRepRows,
  calculatePlatePlan,
  formatPlateWeight,
  PLATES,
  type PlateWeight,
  type WeightSuggestion,
} from "./weight_helper";

const COMPACT_HIT_SLOP = { bottom: 7, left: 7, right: 7, top: 7 };

function Icon({
  name,
  size = 22,
  color = palette.muted,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function IncreaseWeightHelperModal({
  initialState,
  visible,
  defaultWeight,
  defaultReps,
  defaultLoadMode,
  onClose,
  onUse,
}: {
  initialState?: MobileWorkoutInitialState;
  visible: boolean;
  defaultWeight: number;
  defaultReps: number;
  defaultLoadMode?: PlateLoadMode | null;
  onClose: () => void;
  onUse: (suggestion: WeightSuggestion) => void;
}) {
  const initialHelper = initialState?.workout?.helper;
  const [mode, setMode] = useState<PlateLoadMode>(
    initialHelper?.kind === "increase" && initialHelper.mode
      ? initialHelper.mode
      : parsePlateMode(defaultLoadMode),
  );
  const [addedWeight, setAddedWeight] = useState(
    initialHelper?.kind === "increase" ? (initialHelper.addedWeight ?? 5) : 5,
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode(
      initialHelper?.kind === "increase" && initialHelper.mode
        ? initialHelper.mode
        : parsePlateMode(defaultLoadMode),
    );
    setAddedWeight(
      initialHelper?.kind === "increase" ? (initialHelper.addedWeight ?? 5) : 5,
    );
    setSelectedKey(null);
  }, [initialHelper, defaultLoadMode, visible]);

  const oneRepMax = estimate1RM(defaultWeight, defaultReps);
  const rows = buildAddedWeightRepRows(
    defaultWeight,
    oneRepMax,
    addedWeight,
    mode,
  );
  const targetWeight =
    defaultWeight + (mode === "equal-sides" ? addedWeight * 2 : addedWeight);
  const canDecreaseAddedWeight =
    targetWeight - (mode === "equal-sides" ? 5 : 2.5) > 0;

  const adjustAddedWeight = (direction: 1 | -1) => {
    setSelectedKey(null);
    setAddedWeight((current) => roundToHalf(current + direction * 2.5));
  };

  const updateMode = (nextMode: PlateLoadMode) => {
    setMode(nextMode);
    setSelectedKey(null);
    setAddedWeight((current) => {
      const multiplier = nextMode === "equal-sides" ? 2 : 1;
      return defaultWeight + current * multiplier > 0 ? current : 0;
    });
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade
        contentStyle={styles.centeredModalContent}
        onDismiss={onClose}
        style={styles.helperShade}
      >
        <View style={styles.helperDialog}>
          <View style={styles.helperHeader}>
            <Text style={styles.helperTitle}>increase weight</Text>
            <Pressable
              accessibilityLabel="Close increase weight helper"
              accessibilityRole="button"
              hitSlop={COMPACT_HIT_SLOP}
              style={styles.helperDoneButton}
              testID="increase-weight-helper-close"
              onPress={onClose}
            >
              <Icon name="close-outline" size={20} color={palette.muted} />
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
            <Text style={styles.subtleTitle}>change weight</Text>
            <View style={styles.segmentedRow}>
              <SegmentedChoice
                active={mode === "equal-sides"}
                accessibilityLabel="Use equal sides for increase weight"
                testID="increase-weight-mode-equal-sides"
                onPress={() => updateMode("equal-sides")}
              >
                equal sides
              </SegmentedChoice>
              <SegmentedChoice
                active={mode === "total"}
                accessibilityLabel="Use total load for increase weight"
                testID="increase-weight-mode-total"
                onPress={() => updateMode("total")}
              >
                total load
              </SegmentedChoice>
            </View>
            <View style={styles.addWeightRow}>
              <Text style={styles.addWeightValue}>
                {formatSignedCompactPounds(addedWeight)}
              </Text>
              <View style={styles.addWeightButtons}>
                <Pressable
                  accessibilityLabel="Decrease added weight"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canDecreaseAddedWeight }}
                  style={[
                    styles.addWeightStepButton,
                    !canDecreaseAddedWeight ? styles.keyDisabled : null,
                  ]}
                  testID="increase-weight-added-weight-decrease"
                  onPress={() => {
                    if (canDecreaseAddedWeight) {
                      adjustAddedWeight(-1);
                    }
                  }}
                >
                  <Text style={styles.addWeightStepText}>-</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Increase added weight"
                  accessibilityRole="button"
                  style={styles.addWeightStepButton}
                  testID="increase-weight-added-weight-increase"
                  onPress={() => adjustAddedWeight(1)}
                >
                  <Text style={styles.addWeightStepText}>+</Text>
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
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionText}>
                      {formatSetSummary(row.targetWeight, row.targetReps)}
                    </Text>
                    <Text style={styles.suggestionMeta}>
                      {formatOneRepMax(row.targetOneRepMax)} .{" "}
                      {formatPercentChangeNarrative(row.percentChange)}
                    </Text>
                  </View>
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
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

export function PlateCalculatorHelperModal({
  initialState,
  visible,
  defaultWeight,
  defaultStartingWeight,
  defaultLoadMode,
  onClose,
  onSettingsChange,
}: {
  initialState?: MobileWorkoutInitialState;
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
  const initialHelper = initialState?.workout?.helper;
  const [startingWeight, setStartingWeight] = useState(
    initialHelper?.kind === "plates"
      ? (initialHelper.startingWeight ?? defaultStartingWeight ?? 45)
      : (defaultStartingWeight ?? 45),
  );
  const [mode, setMode] = useState<PlateLoadMode>(
    initialHelper?.kind === "plates" && initialHelper.mode
      ? initialHelper.mode
      : parsePlateMode(defaultLoadMode),
  );
  const [targetWeight, setTargetWeight] = useState(
    initialHelper?.kind === "plates"
      ? (initialHelper.targetWeight ??
          defaultWeight + (initialHelper.targetWeightOffset ?? 0))
      : defaultWeight,
  );
  const [menuOpen, setMenuOpen] = useState(
    initialHelper?.kind === "plates" &&
      initialHelper.startingWeightPicker === true,
  );

  useEffect(() => {
    if (!visible) return;
    setStartingWeight(
      initialHelper?.kind === "plates"
        ? (initialHelper.startingWeight ?? defaultStartingWeight ?? 45)
        : (defaultStartingWeight ?? 45),
    );
    setMode(
      initialHelper?.kind === "plates" && initialHelper.mode
        ? initialHelper.mode
        : parsePlateMode(defaultLoadMode),
    );
    setTargetWeight(
      initialHelper?.kind === "plates"
        ? (initialHelper.targetWeight ??
            defaultWeight + (initialHelper.targetWeightOffset ?? 0))
        : defaultWeight,
    );
    setMenuOpen(
      initialHelper?.kind === "plates" &&
        initialHelper.startingWeightPicker === true,
    );
  }, [
    initialHelper,
    defaultLoadMode,
    defaultStartingWeight,
    defaultWeight,
    visible,
  ]);

  const platePlan = calculatePlatePlan(targetWeight, startingWeight, mode);
  const targetWeightStep = mode === "equal-sides" ? 5 : 2.5;

  const adjustTargetWeight = (direction: 1 | -1) => {
    setTargetWeight((current) =>
      Math.max(0, roundToHalf(current + direction * targetWeightStep)),
    );
  };

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
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade
        contentStyle={styles.centeredModalContent}
        onDismiss={onClose}
        style={styles.helperShade}
      >
        <View style={styles.helperDialog}>
          <View style={styles.helperHeader}>
            <Text style={styles.helperTitle}>plates</Text>
            <Pressable
              accessibilityLabel="Close plate calculator"
              accessibilityRole="button"
              hitSlop={COMPACT_HIT_SLOP}
              style={styles.helperDoneButton}
              testID="plate-calculator-close"
              onPress={onClose}
            >
              <Icon name="close-outline" size={20} color={palette.muted} />
            </Pressable>
          </View>

          <View style={styles.plateTopRow}>
            <View>
              <Text style={styles.subtleTitle}>total weight</Text>
              <View style={styles.plateTargetWeightRow}>
                <Text style={styles.helperLargeText}>
                  {formatNumber(targetWeight)}
                  <Text style={styles.helperUnit}>lb</Text>
                </Text>
                <View style={styles.plateTargetWeightActions}>
                  <Pressable
                    accessibilityLabel={`Decrease plate calculator weight by ${formatNumber(targetWeightStep)} pounds`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: targetWeight <= 0 }}
                    style={[
                      styles.plateTargetWeightButton,
                      targetWeight <= 0 ? styles.keyDisabled : null,
                    ]}
                    testID="plate-target-weight-decrease"
                    onPress={() => adjustTargetWeight(-1)}
                  >
                    <Text style={styles.addWeightStepText}>-</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Increase plate calculator weight by ${formatNumber(targetWeightStep)} pounds`}
                    accessibilityRole="button"
                    style={styles.plateTargetWeightButton}
                    testID="plate-target-weight-increase"
                    onPress={() => adjustTargetWeight(1)}
                  >
                    <Text style={styles.addWeightStepText}>+</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Reset plate calculator weight"
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: targetWeight === defaultWeight,
                    }}
                    style={[
                      styles.plateTargetWeightReset,
                      targetWeight === defaultWeight
                        ? styles.keyDisabled
                        : null,
                    ]}
                    testID="plate-target-weight-reset"
                    onPress={() => setTargetWeight(defaultWeight)}
                  >
                    <Text style={styles.plateTargetWeightResetText}>reset</Text>
                  </Pressable>
                </View>
              </View>
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
              <View style={styles.plateError}>
                <Text style={styles.helperLargeText}>{platePlan.title}</Text>
                <Text style={styles.helperMutedLine}>{platePlan.error}</Text>
                <Text style={styles.helperMutedLine}>
                  {startingWeight > 0
                    ? `${formatNumber(startingWeight)}lb starting weight`
                    : "no starting weight"}
                </Text>
              </View>
            ) : (
              <PlatePlanDisplay plan={platePlan} />
            )}
          </View>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

export function SegmentedChoice({
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

export const STARTING_WEIGHTS = [
  { label: "none", weight: 0 },
  { label: "45lb bar", weight: 45 },
  { label: "25lb bar", weight: 25 },
  { label: "15lb bar", weight: 15 },
] as const;

export function parsePlateMode(
  value: PlateLoadMode | null | undefined,
): PlateLoadMode {
  return value === "total" ? "total" : "equal-sides";
}

export function getStartingWeightLabel(weight: number) {
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
