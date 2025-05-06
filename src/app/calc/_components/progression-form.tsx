"use client";

import React, { useState, useEffect } from "react";
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

// Simplified schema - just what we need
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
  // Form setup with schema
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

  // Watch for form value changes
  const currentWeight = form.watch("currentWeight");
  const currentReps = form.watch("currentReps");
  const nextReps = form.watch("nextReps");

  // Calculate results whenever inputs change
  useEffect(() => {
    if (
      currentWeight !== undefined &&
      currentWeight !== null &&
      currentReps !== undefined &&
      currentReps !== null &&
      nextReps !== undefined &&
      nextReps !== null
    ) {
      // Calculate current 1RM
      const current1RM = estimate1RM(currentWeight, currentReps);

      // Calculate equivalent weight for the target reps
      // This already uses roundToStep to ensure it's in 2.5 lb increments
      const equivalentWeight = current1RM
        ? calculateEquivalentWeight(current1RM, nextReps)
        : null;

      // Always update the adjusted weight when inputs change
      // This ensures it resets on any input change
      if (equivalentWeight !== null) {
        setAdjustedWeight(equivalentWeight);
      }

      // Calculate new 1RM and percent change based on adjusted weight
      const newResult = {
        current1RM,
        equivalentWeight, // Use the properly stepped value
        new1RM: adjustedWeight ? estimate1RM(adjustedWeight, nextReps) : null,
        percentChange: calculatePercentChange(
          current1RM,
          adjustedWeight,
          nextReps,
        ),
      };

      setCalculationResult(newResult);

      // Generate projection data for the table
      if (adjustedWeight !== null && nextReps && currentReps) {
        const projData: ProjectionRow[] = [];
        const current1RM = estimate1RM(currentWeight, currentReps);

        if (current1RM !== null && current1RM !== undefined) {
          // Generate rows from nextReps to currentReps
          for (let reps = nextReps; reps <= currentReps; reps++) {
            const estimated1RM = estimate1RM(adjustedWeight, reps);

            if (estimated1RM !== null && estimated1RM !== undefined) {
              const percentChange =
                ((estimated1RM - current1RM) / current1RM) * 100;
              const absoluteIncrease = estimated1RM - current1RM;

              projData.push({
                reps,
                estimated1RM,
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
  }, [currentWeight, currentReps, nextReps, adjustedWeight]);

  // Function to calculate the weight needed for a given 1RM and rep count
  const calculateEquivalentWeight = (
    oneRepMax: number,
    reps: number,
  ): number | null => {
    if (reps >= 37) return null; // Brzycki formula limitation
    return roundToStep((oneRepMax * (37 - reps)) / 36, 2.5);
  };

  // Function to calculate percentage change between 1RMs
  const calculatePercentChange = (
    current1RM: number | null,
    adjustedWeight: number | null,
    nextReps: number | null,
  ): number | null => {
    if (!current1RM || !adjustedWeight || !nextReps) return null;

    const new1RM = estimate1RM(adjustedWeight, nextReps);
    return ((new1RM - current1RM) / current1RM) * 100;
  };

  // Handle weight adjustment buttons
  const handleAdjustWeight = (increment: number) => {
    setAdjustedWeight((prev) => {
      if (prev === null) return null;
      const newWeight = Math.max(0, prev + increment);
      return newWeight;
    });
  };

  // Reset adjusted weight to original calculated weight
  const handleResetWeight = () => {
    if (
      calculationResult?.equivalentWeight !== null &&
      calculationResult?.equivalentWeight !== undefined
    ) {
      setAdjustedWeight(calculationResult.equivalentWeight);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-6">
        <Card>
          <CardContent className="space-y-4">
            {/* Current Performance Section */}
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
                            const parsedValue = parseFloat(value);
                            if (!isNaN(parsedValue)) {
                              field.onChange(parsedValue);
                            }
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
                            const parsedValue = parseInt(value);
                            if (!isNaN(parsedValue)) {
                              field.onChange(parsedValue);
                            }
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

            {/* Next Set Target */}
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
                          const parsedValue = parseInt(value);
                          if (!isNaN(parsedValue)) {
                            field.onChange(parsedValue);
                          }
                        }
                      }}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Results Section */}
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

                {/* Adjustable Weight */}
                <div className="space-y-1 border-t pt-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      Target Weight for Next Set:
                    </div>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustWeight(-2.5)}
                        disabled={
                          adjustedWeight === null || adjustedWeight <= 0
                        }
                      >
                        <ChevronLeft className="h-5 w-5" />
                        <span className="sr-only">Decrease weight by 2.5</span>
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
                        <span className="sr-only">Increase weight by 2.5</span>
                      </Button>
                    </div>
                    <div className="ml-4 font-medium">x {nextReps} reps</div>
                  </div>
                </div>

                {/* New 1RM */}
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

        {/* Projection Table */}
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
