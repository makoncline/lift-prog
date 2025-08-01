"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { estimate1RM, roundToStep } from "@/lib/workoutLogic";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Muted } from "@/components/ui/typography";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlateCalculator } from "@/components/plate-calculator";
import { Switch } from "@/components/ui/switch";
import {
  BAR_WEIGHT,
  getClosestValidWeight,
  getNextValidWeight,
} from "@/lib/calc/barbell-utils";

const progressionSchema = z.object({
  currentReps: z
    .number()
    .int("Reps must be a whole number.")
    .positive("Reps must be positive.")
    .nullable(),
  currentWeight: z.number().positive("Weight must be positive.").nullable(),
  nextReps: z
    .number()
    .int("Reps must be a whole number.")
    .positive("Reps must be positive.")
    .nullable(),
});

type ProgressionFormData = z.infer<typeof progressionSchema>;

interface CalculationResult {
  current1RM: number | null;
  equivalentWeight: number | null;
  new1RM: number | null;
  percentChange: number | null;
}

interface ProjectionRow {
  reps: number;
  estimated1RM: number;
  percentChange: number;
  absoluteIncrease: number;
}

export default function ProgressionForm() {
  const form = useForm<ProgressionFormData>({
    resolver: zodResolver(progressionSchema),
    defaultValues: {
      currentReps: 12,
      currentWeight: null,
      nextReps: 8,
    },
    mode: "onChange",
  });

  const [adjustedWeight, setAdjustedWeight] = useState<number | null>(null);
  const [calculationResult, setCalculationResult] =
    useState<CalculationResult | null>(null);
  const [projectionData, setProjectionData] = useState<ProjectionRow[]>([]);
  const [isUserAdjusted, setIsUserAdjusted] = useState(false);
  const [prevEquivalentWeight, setPrevEquivalentWeight] = useState<
    number | null
  >(null);
  const [barbellMode, setBarbellMode] = useState(true);

  const currentWeight = form.watch("currentWeight");
  const currentReps = form.watch("currentReps");
  const nextReps = form.watch("nextReps");

  useEffect(() => {
    if (
      currentWeight !== undefined &&
      currentWeight !== null &&
      currentReps !== undefined &&
      currentReps !== null &&
      nextReps !== undefined &&
      nextReps !== null
    ) {
      const current1RM = estimate1RM(currentWeight, currentReps);

      const rawEquivalentWeight = current1RM
        ? calculateEquivalentWeight(current1RM, nextReps)
        : null;

      const equivalentWeight =
        rawEquivalentWeight !== null && barbellMode
          ? getClosestValidWeight(rawEquivalentWeight)
          : rawEquivalentWeight;

      if (
        equivalentWeight !== null &&
        (adjustedWeight === null || !isUserAdjusted)
      ) {
        setAdjustedWeight(equivalentWeight);
      }

      if (equivalentWeight !== prevEquivalentWeight) {
        setPrevEquivalentWeight(equivalentWeight);
        setIsUserAdjusted(false);
      }

      const newResult: CalculationResult = {
        current1RM,
        equivalentWeight,
        new1RM:
          adjustedWeight !== null && nextReps !== null
            ? estimate1RM(adjustedWeight, nextReps)
            : null,
        percentChange: calculatePercentChange(
          current1RM,
          adjustedWeight,
          nextReps,
        ),
      };

      setCalculationResult(newResult);

      if (
        adjustedWeight !== null &&
        nextReps !== null &&
        currentReps !== null
      ) {
        const projData: ProjectionRow[] = [];
        const curr1RM = estimate1RM(currentWeight, currentReps);

        if (curr1RM !== null && curr1RM !== undefined) {
          for (let reps = nextReps; reps <= currentReps; reps++) {
            const est1RM = estimate1RM(adjustedWeight, reps);
            if (est1RM !== null && est1RM !== undefined) {
              const percentChange = ((est1RM - curr1RM) / curr1RM) * 100;
              const absoluteIncrease = est1RM - curr1RM;
              projData.push({
                reps,
                estimated1RM: est1RM,
                percentChange,
                absoluteIncrease,
              });
            }
          }
        }
        setProjectionData(projData);
      }
    } else {
      setCalculationResult(null);
      setProjectionData([]);
    }
  }, [
    currentWeight,
    currentReps,
    nextReps,
    adjustedWeight,
    prevEquivalentWeight,
    isUserAdjusted,
    barbellMode,
  ]);

  const calculateEquivalentWeight = (
    oneRepMax: number,
    reps: number,
  ): number | null => {
    if (reps >= 37) return null;
    return roundToStep((oneRepMax * (37 - reps)) / 36, 2.5);
  };

  const calculatePercentChange = (
    current1RM: number | null,
    adjWeight: number | null,
    nReps: number | null,
  ): number | null => {
    if (!current1RM || !adjWeight || !nReps) return null;
    const new1RM = estimate1RM(adjWeight, nReps);
    return ((new1RM - current1RM) / current1RM) * 100;
  };

  const handleAdjustWeight = (increment: number) => {
    setAdjustedWeight((prev) => {
      if (prev === null) return null;
      if (barbellMode) {
        const direction = increment > 0 ? "up" : "down";
        return getNextValidWeight(prev, direction);
      }
      const newWeight = Math.max(0, prev + increment);
      return newWeight;
    });
    setIsUserAdjusted(true);
  };

  const handleResetWeight = () => {
    if (
      calculationResult?.equivalentWeight !== null &&
      calculationResult?.equivalentWeight !== undefined
    ) {
      setAdjustedWeight(calculationResult.equivalentWeight);
      setIsUserAdjusted(false);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-6">
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField<ProgressionFormData>
                control={form.control}
                name="currentWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Weight (lbs)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="2.5"
                        placeholder="e.g., 135"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            field.onChange(null);
                          } else {
                            const parsed = parseFloat(value);
                            if (!isNaN(parsed)) field.onChange(parsed);
                          }
                        }}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField<ProgressionFormData>
                control={form.control}
                name="currentReps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Reps</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 12"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            field.onChange(null);
                          } else {
                            const parsed = parseInt(value);
                            if (!isNaN(parsed)) field.onChange(parsed);
                          }
                        }}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField<ProgressionFormData>
              control={form.control}
              name="nextReps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Reps for Next Set</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 8"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          field.onChange(null);
                        } else {
                          const parsed = parseInt(value);
                          if (!isNaN(parsed)) field.onChange(parsed);
                        }
                      }}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {calculationResult?.current1RM && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>Current estimated 1RM:</div>
                  <div className="text-right font-medium">
                    {calculationResult.current1RM.toFixed(1)} lbs
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>Equivalent weight for {nextReps} reps:</div>
                  <div className="text-right font-medium">
                    {calculationResult.equivalentWeight} lbs
                  </div>
                </div>
                <div className="space-y-1 border-t pt-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      Target Weight for Next Set:
                    </div>
                    <div className="flex items-center gap-2">
                      {adjustedWeight !== null && adjustedWeight > 0 && (
                        <PlateCalculator
                          key={adjustedWeight}
                          defaultWeight={adjustedWeight}
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetWeight}
                        disabled={
                          adjustedWeight === null ||
                          adjustedWeight === calculationResult?.equivalentWeight
                        }
                        title="Reset to default weight"
                        className="h-8 px-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="sr-only">Reset to default weight</span>
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustWeight(-2.5)}
                        disabled={
                          adjustedWeight === null ||
                          adjustedWeight <= (barbellMode ? BAR_WEIGHT : 0)
                        }
                      >
                        <ChevronLeft className="h-5 w-5" />
                        <span className="sr-only">Decrease weight</span>
                      </Button>
                      <div className="w-24 text-xl font-bold">
                        {adjustedWeight !== null
                          ? `${adjustedWeight} lbs`
                          : "--"}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustWeight(2.5)}
                        disabled={adjustedWeight === null}
                      >
                        <ChevronRight className="h-5 w-5" />
                        <span className="sr-only">Increase weight</span>
                      </Button>
                    </div>
                    <div className="ml-4 font-medium">x {nextReps} reps</div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      id="barbell-mode"
                      checked={barbellMode}
                      onCheckedChange={setBarbellMode}
                    />
                    <label htmlFor="barbell-mode" className="text-sm">
                      Barbell mode
                    </label>
                  </div>
                </div>
                {calculationResult.new1RM && (
                  <div className="flex items-center justify-between border-t pt-2">
                    <div>New estimated 1RM:</div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {calculationResult.new1RM.toFixed(1)} lbs
                      </div>
                      {calculationResult.percentChange !== null && (
                        <Muted className="text-sm">
                          ({calculationResult.percentChange >= 0 ? "+" : ""}
                          {calculationResult.percentChange.toFixed(1)}% |{" "}
                          {calculationResult.percentChange >= 0 ? "+" : ""}
                          {calculationResult.current1RM !== null &&
                            (
                              calculationResult.new1RM -
                              calculationResult.current1RM
                            ).toFixed(1)}{" "}
                          lbs)
                        </Muted>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        {projectionData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rep Progression Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reps</TableHead>
                    <TableHead>Est. 1RM</TableHead>
                    <TableHead className="text-right">% Change</TableHead>
                    <TableHead className="text-right">Increase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectionData.map((row) => (
                    <TableRow key={row.reps}>
                      <TableCell>{row.reps}</TableCell>
                      <TableCell>
                        {row.estimated1RM !== undefined &&
                        row.estimated1RM !== null
                          ? `${row.estimated1RM.toFixed(1)} lbs`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.percentChange !== undefined &&
                        row.percentChange !== null
                          ? `${row.percentChange >= 0 ? "+" : ""}${row.percentChange.toFixed(1)}%`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.absoluteIncrease !== undefined &&
                        row.absoluteIncrease !== null
                          ? `${row.absoluteIncrease >= 0 ? "+" : ""}${row.absoluteIncrease.toFixed(1)} lbs`
                          : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  );
}
