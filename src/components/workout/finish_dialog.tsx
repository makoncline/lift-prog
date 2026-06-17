"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Clipboard, Loader2, RotateCcw, CheckCircle } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export function FinishDialog({
  open,
  isSaving,
  finishedWorkout,
  date,
  startTime,
  endTime,
  duration,
  setDate,
  setStartTime,
  setEndTime,
  setDuration,
  onOpenChange,
  onCopy,
  onSetEndToNow,
  onSave,
  onDone,
}: {
  open: boolean;
  isSaving: boolean;
  finishedWorkout: null | {
    name: string;
    startedAt: Date;
    completedAt: Date;
    exercises: Array<{ sets: Array<Record<string, unknown>> }>;
  };
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  setDate: (v: string) => void;
  setStartTime: (v: string) => void;
  setEndTime: (v: string) => void;
  setDuration: (v: string) => void;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void | Promise<void>;
  onSetEndToNow: () => void;
  onSave: () => void;
  onDone?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="finish-workout-dialog"
      >
        <DialogHeader>
          <DialogTitle>Finish Workout</DialogTitle>
          <DialogDescription>
            {finishedWorkout
              ? "Workout Saved!"
              : "Review and save your completed workout."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {finishedWorkout && (
            <div className="space-y-4">
              <div className="bg-muted rounded-md p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Workout Saved!</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCopy}
                    className="h-8 gap-1"
                  >
                    <Clipboard className="h-4 w-4" />
                    <span>Copy</span>
                  </Button>
                </div>

                <div className="mt-2 text-sm">
                  <p>
                    <span className="font-medium">Duration:</span>{" "}
                    {formatDuration(
                      (finishedWorkout.completedAt.getTime() -
                        finishedWorkout.startedAt.getTime()) /
                        1000,
                    )}
                  </p>
                  <p>
                    <span className="font-medium">Start:</span>{" "}
                    {finishedWorkout.startedAt.toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium">Finish:</span>{" "}
                    {finishedWorkout.completedAt.toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium">Exercises:</span>{" "}
                    {finishedWorkout.exercises.length}
                  </p>
                  <p>
                    <span className="font-medium">Total Sets:</span>{" "}
                    {finishedWorkout.exercises.reduce(
                      (acc, ex) => acc + ex.sets.length,
                      0,
                    )}
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <CheckCircle className="text-success h-12 w-12" />
              </div>
            </div>
          )}
          {!finishedWorkout && (
            <div className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Workout Details</h3>
                <div className="space-y-1">
                  <label htmlFor="finish-date" className="text-xs font-medium">
                    Date
                  </label>
                  <Input
                    id="finish-date"
                    type="text"
                    inputMode="numeric"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9"
                    placeholder="YYYY-MM-DD"
                    data-testid="finish-date"
                  />
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="finish-start-time"
                      className="text-xs font-medium"
                    >
                      Start Time
                    </label>
                    <Input
                      id="finish-start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-9"
                      data-testid="finish-start-time"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="finish-end-time"
                      className="text-xs font-medium"
                    >
                      End Time
                    </label>
                    <div className="flex gap-1">
                      <Input
                        id="finish-end-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-9 flex-1"
                        data-testid="finish-end-time"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onSetEndToNow}
                        className="h-9 w-9 p-0"
                        title="Set to now"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="finish-duration"
                    className="text-xs font-medium"
                  >
                    Duration (minutes)
                  </label>
                  <Input
                    id="finish-duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="h-9"
                    min="1"
                    step="1"
                    data-testid="finish-duration"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {finishedWorkout ? (
            <Button
              onClick={() => (onDone ? onDone() : onOpenChange(false))}
              className="w-full"
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                data-testid="cancel-finish-workout"
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={isSaving}
                data-testid="save-finished-workout"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Workout
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
