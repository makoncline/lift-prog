"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { H4 } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";

type PlateType = {
  weight: number;
  color: string;
  count: number;
};

type PlateCalculatorProps = {
  initialWeight: number;
  onClose: () => void;
  onSave: (weight: number) => void;
};

export default function PlateCalculator({
  initialWeight,
  onClose,
  onSave,
}: PlateCalculatorProps) {
  const [barWeight, setBarWeight] = useState(45); // Standard 45lb Olympic bar
  const [isCustomBar, setIsCustomBar] = useState(false);
  const [customBarWeight, setCustomBarWeight] = useState("45");

  // Available plates (per side)
  const [plates, setPlates] = useState<PlateType[]>([
    { weight: 45, color: "bg-blue-500", count: 0 },
    { weight: 35, color: "bg-yellow-500", count: 0 },
    { weight: 25, color: "bg-gray-300", count: 0 },
    { weight: 10, color: "bg-green-500", count: 0 },
    { weight: 5, color: "bg-red-500", count: 0 },
    { weight: 2.5, color: "bg-purple-500", count: 0 },
  ]);

  // Calculate total weight
  const totalWeight =
    barWeight +
    plates.reduce((sum, plate) => sum + plate.weight * plate.count * 2, 0);

  // Auto-calculate plate configuration based on initial weight
  useEffect(() => {
    if (initialWeight <= barWeight) return;

    // Start with fresh plates
    const newPlates = plates.map((plate) => ({ ...plate, count: 0 }));

    // Calculate how much weight needs to be added with plates
    let remainingWeight = (initialWeight - barWeight) / 2; // Divide by 2 because plates are per side

    // Add plates starting from the heaviest
    newPlates.forEach((plate) => {
      while (remainingWeight >= plate.weight) {
        plate.count++;
        remainingWeight -= plate.weight;
      }
    });

    setPlates(newPlates);
  }, [initialWeight, barWeight]);

  // Handle custom bar weight change
  const handleCustomBarChange = (value: string) => {
    setCustomBarWeight(value);
    const numValue = parseFloat(value) || 0;
    setBarWeight(numValue);
  };

  // Add or remove plates
  const updatePlateCount = (weight: number, increment: boolean) => {
    setPlates(
      plates.map((plate) =>
        plate.weight === weight
          ? {
              ...plate,
              count: increment ? plate.count + 1 : Math.max(0, plate.count - 1),
            }
          : plate,
      ),
    );
  };

  // Set bar weight and update custom state
  const selectBarWeight = (weight: number | "custom") => {
    if (weight === "custom") {
      setIsCustomBar(true);
    } else {
      setIsCustomBar(false);
      setBarWeight(weight);
      setCustomBarWeight(weight.toString());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </Button>
          <H4>Plate Calculator</H4>
          <Button variant="ghost" size="sm">
            LB
          </Button>
        </div>

        {/* Bar selection */}
        <div className="border-b p-4">
          <h3 className="mb-2 text-lg font-medium">Bar</h3>
          <div className="mb-3 grid grid-cols-4 gap-2">
            <Button
              variant={barWeight === 25 && !isCustomBar ? "default" : "outline"}
              onClick={() => selectBarWeight(25)}
              className="py-2"
            >
              25lb
            </Button>
            <Button
              variant={barWeight === 33 && !isCustomBar ? "default" : "outline"}
              onClick={() => selectBarWeight(33)}
              className="py-2"
            >
              33lb
            </Button>
            <Button
              variant={barWeight === 45 && !isCustomBar ? "default" : "outline"}
              onClick={() => selectBarWeight(45)}
              className="py-2"
            >
              45lb
            </Button>
            <Button
              variant={isCustomBar ? "default" : "outline"}
              onClick={() => selectBarWeight("custom")}
              className="py-2"
            >
              Custom
            </Button>
          </div>

          {isCustomBar && (
            <div className="mt-2">
              <Input
                type="number"
                value={customBarWeight}
                onChange={(e) => handleCustomBarChange(e.target.value)}
                className="text-center"
                placeholder="Enter custom weight"
              />
            </div>
          )}

          <div className="mt-3 text-center">
            <div className="rounded-md bg-black py-4 text-white">
              <div className="flex flex-col items-center">
                <span className="text-3xl">{barWeight}</span>
                <span className="text-sm">
                  {isCustomBar
                    ? "Custom"
                    : barWeight === 45
                      ? "Standard"
                      : barWeight + "lb"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Plates selection */}
        <div className="border-b p-4">
          <h3 className="mb-4 text-lg font-medium">Plates (per side)</h3>

          <div className="mb-8 grid grid-cols-3 gap-4">
            {/* First row: 45, 35, 25 */}
            <div className="flex flex-col items-center">
              <div
                className={`mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-blue-500 text-2xl font-bold text-white`}
              >
                45
              </div>
              <div className="grid w-full grid-cols-3">
                <Button
                  variant="outline"
                  className="rounded-r-none"
                  onClick={() => updatePlateCount(45, false)}
                >
                  -
                </Button>
                <div className="flex items-center justify-center border-x-0 border-y">
                  {plates.find((p) => p.weight === 45)?.count ?? 0}
                </div>
                <Button
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => updatePlateCount(45, true)}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className={`mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-yellow-500 text-2xl font-bold text-white`}
              >
                35
              </div>
              <div className="grid w-full grid-cols-3">
                <Button
                  variant="outline"
                  className="rounded-r-none"
                  onClick={() => updatePlateCount(35, false)}
                >
                  -
                </Button>
                <div className="flex items-center justify-center border-x-0 border-y">
                  {plates.find((p) => p.weight === 35)?.count ?? 0}
                </div>
                <Button
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => updatePlateCount(35, true)}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className={`mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-gray-300 text-2xl font-bold text-white`}
              >
                25
              </div>
              <div className="grid w-full grid-cols-3">
                <Button
                  variant="outline"
                  className="rounded-r-none"
                  onClick={() => updatePlateCount(25, false)}
                >
                  -
                </Button>
                <div className="flex items-center justify-center border-x-0 border-y">
                  {plates.find((p) => p.weight === 25)?.count ?? 0}
                </div>
                <Button
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => updatePlateCount(25, true)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Second row: 10, 5, 2.5 */}
            <div className="flex flex-col items-center">
              <div
                className={`mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-green-500 text-2xl font-bold text-white`}
              >
                10
              </div>
              <div className="grid w-full grid-cols-3">
                <Button
                  variant="outline"
                  className="rounded-r-none"
                  onClick={() => updatePlateCount(10, false)}
                >
                  -
                </Button>
                <div className="flex items-center justify-center border-x-0 border-y">
                  {plates.find((p) => p.weight === 10)?.count ?? 0}
                </div>
                <Button
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => updatePlateCount(10, true)}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className={`mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-red-500 text-2xl font-bold text-white`}
              >
                5
              </div>
              <div className="grid w-full grid-cols-3">
                <Button
                  variant="outline"
                  className="rounded-r-none"
                  onClick={() => updatePlateCount(5, false)}
                >
                  -
                </Button>
                <div className="flex items-center justify-center border-x-0 border-y">
                  {plates.find((p) => p.weight === 5)?.count ?? 0}
                </div>
                <Button
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => updatePlateCount(5, true)}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className={`mb-2 flex h-24 w-24 items-center justify-center rounded-full bg-purple-500 text-2xl font-bold text-white`}
              >
                2.5
              </div>
              <div className="grid w-full grid-cols-3">
                <Button
                  variant="outline"
                  className="rounded-r-none"
                  onClick={() => updatePlateCount(2.5, false)}
                >
                  -
                </Button>
                <div className="flex items-center justify-center border-x-0 border-y">
                  {plates.find((p) => p.weight === 2.5)?.count ?? 0}
                </div>
                <Button
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => updatePlateCount(2.5, true)}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <span className="mr-2 text-lg text-gray-600">Total Weight:</span>
            <span className="text-4xl font-bold">{totalWeight} lb</span>
          </div>
          <Button
            onClick={() => onSave(totalWeight)}
            className="bg-black px-8 py-4 text-lg"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
