import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Scale, Plus, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PlateCalculatorProps {
  className?: string;
  defaultWeight?: number;
}

interface PlateBreakdown {
  plates: Array<{ weight: number; count: number }>;
  isValid: boolean;
  error?: string;
}

const AVAILABLE_PLATES = [45, 35, 25, 10, 5, 2.5];

const BAR_OPTIONS = [
  { weight: 45, kg: 20, label: "Standard Bar (20kg / 45 lbs)" },
  { weight: 33, kg: 15, label: "Women's Bar (15kg / 33 lbs)" },
];

const DEFAULT_BAR = BAR_OPTIONS[0]!;

// Plate colors and sizes for visualization
const PLATE_CONFIG = {
  45: { color: "bg-red-500", barbellHeight: 70, circleSize: 30, label: "45" },
  35: { color: "bg-blue-500", barbellHeight: 62, circleSize: 27, label: "35" },
  25: { color: "bg-green-500", barbellHeight: 54, circleSize: 24, label: "25" },
  10: {
    color: "bg-yellow-500",
    barbellHeight: 46,
    circleSize: 21,
    label: "10",
  },
  5: { color: "bg-purple-500", barbellHeight: 38, circleSize: 20, label: "5" },
  2.5: {
    color: "bg-pink-500",
    barbellHeight: 32,
    circleSize: 18,
    label: "2.5",
  },
};

interface BarbellVisualizationProps {
  plates: Array<{ weight: number; count: number }>;
  totalWeight: number;
  barWeight: number;
  barLabel: string;
}

function BarbellVisualization({
  plates,
  totalWeight: _totalWeight,
  barWeight,
  barLabel: _barLabel,
}: BarbellVisualizationProps) {
  // Create array of individual plates for right side only
  const rightPlates: number[] = [];

  plates.forEach((plateGroup) => {
    for (let i = 0; i < plateGroup.count; i++) {
      rightPlates.push(plateGroup.weight);
    }
  });

  return (
    <div className="py-4">
      <div className="flex items-center justify-center">
        {/* Barbell */}
        <div className="relative flex items-center">
          {/* Bar */}
          <div className="flex h-3 w-32 items-center justify-center rounded-sm border border-gray-500 bg-gray-400">
            <span className="text-[10px] font-bold text-gray-800">
              {barWeight}lbs
            </span>
          </div>
        </div>

        {/* Right side plates */}
        <div className="flex items-center">
          {rightPlates.map((weight, index) => {
            const config = PLATE_CONFIG[weight as keyof typeof PLATE_CONFIG];
            return (
              <div
                key={`right-${index}`}
                className={cn(
                  "flex items-center justify-center rounded-sm border-2 border-gray-600 text-xs font-bold text-white",
                  config.color,
                )}
                style={{
                  width: "18px",
                  height: `${config.barbellHeight}px`,
                  marginLeft: index === 0 ? "8px" : "2px",
                }}
              >
                {config.barbellHeight >= 32 && (
                  <span className="rotate-90 transform text-[10px]">
                    {config.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PlateCalculator({
  className,
  defaultWeight,
}: PlateCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [selectedBar, setSelectedBar] =
    useState<typeof DEFAULT_BAR>(DEFAULT_BAR);
  const [targetWeight, setTargetWeight] = useState(defaultWeight ?? 135);
  const [inputValue, setInputValue] = useState(
    (defaultWeight ?? 135).toString(),
  );

  // Calculate plate breakdown
  const calculatePlates = (weight: number): PlateBreakdown => {
    const barWeight = selectedBar?.weight ?? DEFAULT_BAR.weight;
    if (weight < barWeight) {
      return {
        plates: [],
        isValid: false,
        error: `Weight must be at least ${barWeight} lbs (bar weight)`,
      };
    }

    const weightPerSide = (weight - barWeight) / 2;

    if (weightPerSide < 0) {
      return {
        plates: [],
        isValid: false,
        error: `Weight must be at least ${selectedBar.weight} lbs (bar weight)`,
      };
    }

    const plates: Array<{ weight: number; count: number }> = [];
    let remaining = weightPerSide;

    // Greedy algorithm to find plate combination
    for (const plate of AVAILABLE_PLATES) {
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        plates.push({ weight: plate, count });
        remaining = Math.round((remaining - count * plate) * 100) / 100;
      }
    }

    // Check if we can make the exact weight
    if (remaining > 0.01) {
      return {
        plates: [],
        isValid: false,
        error: `Cannot make ${weight} lbs with available plates. Try ${getNextValidWeight(weight, "down")} or ${getNextValidWeight(weight, "up")} lbs.`,
      };
    }

    return {
      plates,
      isValid: true,
    };
  };

  // Get all possible weights we can make
  const getAllPossibleWeights = (): number[] => {
    const weights = new Set<number>();

    const generateCombinations = (
      plateIndex: number,
      currentWeight: number,
    ): void => {
      if (plateIndex >= AVAILABLE_PLATES.length) {
        const totalWeight = selectedBar.weight + currentWeight * 2;
        weights.add(Math.round(totalWeight * 100) / 100);
        return;
      }

      const plate = AVAILABLE_PLATES[plateIndex];
      if (plate !== undefined) {
        for (let count = 0; count <= 10; count++) {
          generateCombinations(plateIndex + 1, currentWeight + count * plate);
        }
      }
    };

    generateCombinations(0, 0);
    return Array.from(weights).sort((a, b) => a - b);
  };

  const getNextValidWeight = (
    current: number,
    direction: "up" | "down",
  ): number => {
    const possibleWeights = getAllPossibleWeights();

    if (direction === "up") {
      return possibleWeights.find((w) => w > current) ?? current;
    } else {
      return possibleWeights.reverse().find((w) => w < current) ?? current;
    }
  };

  const handleIncrement = () => {
    const nextWeight = getNextValidWeight(targetWeight, "up");
    setTargetWeight(nextWeight);
    setInputValue(nextWeight.toString());
  };

  const handleDecrement = () => {
    const nextWeight = getNextValidWeight(targetWeight, "down");
    setTargetWeight(nextWeight);
    setInputValue(nextWeight.toString());
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setTargetWeight(numValue);
    }
  };

  const handleBarChange = (value: string) => {
    const bar = BAR_OPTIONS.find((b) => b.weight.toString() === value);
    if (bar) {
      setSelectedBar(bar);
    }
  };

  const breakdown = calculatePlates(targetWeight);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn("h-8 w-8", className)}
        title="Plate Calculator"
      >
        <Scale className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Plate Calculator</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Bar Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Bar Selection</label>
              <Select
                value={selectedBar.weight.toString()}
                onValueChange={handleBarChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BAR_OPTIONS.map((bar) => (
                    <SelectItem key={bar.weight} value={bar.weight.toString()}>
                      {bar.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Weight Input</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDecrement}
                  disabled={targetWeight <= selectedBar.weight}
                >
                  <Minus className="h-4 w-4" />
                </Button>

                <div className="flex-1">
                  <Input
                    type="number"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className={cn(
                      "text-center text-lg font-semibold",
                      !breakdown.isValid && "border-red-500 text-red-600",
                    )}
                    placeholder="Weight (lbs)"
                    step="2.5"
                    min={selectedBar.weight}
                  />
                </div>

                <Button variant="outline" size="icon" onClick={handleIncrement}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Error Message */}
            {!breakdown.isValid && breakdown.error && (
              <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
                {breakdown.error}
              </div>
            )}

            {/* Visual Barbell Representation */}
            {breakdown.isValid && (
              <BarbellVisualization
                plates={breakdown.plates}
                totalWeight={targetWeight}
                barWeight={selectedBar.weight}
                barLabel={`${selectedBar.kg}kg`}
              />
            )}

            {/* Plate Summary */}
            {breakdown.isValid && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="grid grid-cols-[auto_1fr] items-start gap-4 text-sm">
                    <div className="flex h-16 flex-col text-left">
                      <div className="font-medium">Bar</div>
                      <div className="flex flex-1 items-center">
                        {selectedBar?.weight ?? DEFAULT_BAR.weight}lb
                      </div>
                    </div>

                    <div className="flex h-16 flex-col text-left">
                      <div className="font-medium">
                        Plates -{" "}
                        {breakdown.plates.length > 0
                          ? `${(targetWeight - (selectedBar?.weight ?? DEFAULT_BAR.weight)) / 2}lb per side`
                          : "No plates needed"}
                      </div>
                      <div className="flex flex-1 items-center">
                        <div className="flex items-end gap-2">
                          {AVAILABLE_PLATES.map((plateWeight) => {
                            const plateInUse = breakdown.plates.find(
                              (p) => p.weight === plateWeight,
                            );
                            const config =
                              PLATE_CONFIG[
                                plateWeight as keyof typeof PLATE_CONFIG
                              ];
                            return (
                              <div
                                key={plateWeight}
                                className="flex flex-col items-center"
                                style={{
                                  height: "50px",
                                  justifyContent: "flex-end",
                                  gap: "2px",
                                }}
                              >
                                <div
                                  className={cn(
                                    "flex items-center justify-center rounded-full border text-[8px] font-medium",
                                    plateInUse
                                      ? `${config.color} border-gray-600 text-white`
                                      : "border-gray-300 bg-gray-100 text-gray-500",
                                  )}
                                  style={{
                                    width: `${config.circleSize}px`,
                                    height: `${config.circleSize}px`,
                                    minWidth: `${config.circleSize}px`,
                                    minHeight: `${config.circleSize}px`,
                                    flexShrink: 0,
                                  }}
                                >
                                  <span className="leading-none whitespace-nowrap">
                                    {plateWeight}
                                  </span>
                                </div>
                                <div
                                  className="text-[10px]"
                                  style={{ height: "12px" }}
                                >
                                  {plateInUse ? `×${plateInUse.count}` : ""}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
