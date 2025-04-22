"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Timer, Plus, Minus, SkipForward } from "lucide-react";

interface RestTimerProps {
  className?: string;
}

type TimerMode = "select" | "running";

const presetTimers = [
  { label: "0:30", seconds: 30 },
  { label: "1:00", seconds: 60 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
];

export function RestTimer({ className }: RestTimerProps) {
  // Dialog state
  const [open, setOpen] = useState(false);

  // Timer state
  const [mode, setMode] = useState<TimerMode>("select");
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "default"
  >("default");

  // Reference for the timer interval
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio notification ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on client-side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/sounds/timer-complete.mp3");
    }
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        return permission;
      } catch (err) {
        console.error("Error requesting notification permission:", err);
        return "denied";
      }
    }
    return "denied";
  };

  // Show browser notification
  const showNotification = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (notificationPermission === "granted") {
      try {
        new Notification("Rest Timer Complete", {
          body: "Your rest period has ended!",
          icon: "/favicon.ico",
        });
      } catch (err) {
        console.error("Error showing notification:", err);
      }
    } else if (notificationPermission === "default") {
      void requestNotificationPermission().then((permission) => {
        if (permission === "granted") {
          showNotification();
        }
      });
    }
  };

  // Play sound function
  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.error("Failed to play audio:", err);
      });
    }
  };

  // Play sound and vibrate function
  const notifyTimerComplete = () => {
    playSound();
    showNotification();

    // Vibrate on mobile devices if supported
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (err) {
        console.error("Vibration API error:", err);
      }
    }
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Get progress percentage
  const getProgress = (): number => {
    if (totalSeconds === 0) return 0;
    return ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  };

  // Start the timer with the selected duration
  const startTimer = (seconds: number) => {
    clearTimerInterval();

    // Request notification permission when starting a timer
    if (notificationPermission === "default") {
      void requestNotificationPermission().catch((err) => {
        console.error("Failed to request notification permission:", err);
      });
    }

    setTotalSeconds(seconds);
    setSecondsLeft(seconds);
    setTimerRunning(true);
    setTimerCompleted(false);
    setMode("running");

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Timer finished
          clearTimerInterval();
          setTimerRunning(false);
          setTimerCompleted(true);
          notifyTimerComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Add or subtract time
  const adjustTime = (seconds: number) => {
    setSecondsLeft((prev) => Math.max(1, prev + seconds));
  };

  // Skip the timer
  const skipTimer = () => {
    clearTimerInterval();
    setTimerRunning(false);
    setTimerCompleted(false);
    setSecondsLeft(0);
    setMode("select");
    setOpen(false);
  };

  // Clean up interval on unmount
  const clearTimerInterval = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => clearTimerInterval();
  }, []);

  // When the dialog closes, don't reset the timer if it's running
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);

    // If we're reopening the dialog and the timer is running, go to the running view
    if (isOpen && timerRunning) {
      setMode("running");
    }

    // If we're closing the dialog and no timer is running, reset to selection mode
    if (!isOpen && !timerRunning) {
      setMode("select");
    }
  };

  return (
    <>
      <Button
        variant={
          timerRunning ? "default" : timerCompleted ? "destructive" : "outline"
        }
        size="sm"
        onClick={() => {
          if (timerCompleted) {
            // Just reset the timer state without opening the dialog
            setTimerCompleted(false);
          } else {
            // Only open the dialog if timer isn't completed
            setOpen(true);
          }
        }}
        className={cn(
          "relative overflow-hidden",
          timerRunning && "pr-9",
          timerCompleted && "animate-pulse",
          className,
        )}
        title={
          timerRunning
            ? `Rest timer: ${formatTime(secondsLeft)} remaining`
            : timerCompleted
              ? "Rest timer complete! Click to reset"
              : "Start rest timer"
        }
      >
        <Timer className="h-4 w-4" />
        {timerRunning ? (
          <>
            <span>{formatTime(secondsLeft)}</span>
            <div
              className="bg-primary-foreground/30 absolute bottom-0 left-0 h-1"
              style={{ width: `${getProgress()}%` }}
            />
          </>
        ) : timerCompleted ? (
          <span>Done!</span>
        ) : null}
        {timerCompleted && (
          <span className="absolute top-0 right-0 m-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {mode === "select" ? "Select Rest Duration" : "Rest Timer"}
            </DialogTitle>
          </DialogHeader>

          {mode === "select" ? (
            <div className="grid grid-cols-2 gap-4 pt-4">
              {presetTimers.map((timer) => (
                <Button
                  key={timer.seconds}
                  variant="outline"
                  size="lg"
                  className="h-20 text-xl"
                  onClick={() => startTimer(timer.seconds)}
                >
                  {timer.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-6 pt-4">
              {/* Timer display */}
              <div className="flex flex-col items-center space-y-2">
                <div className="text-4xl font-bold">
                  {formatTime(secondsLeft)}
                </div>
                <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all duration-1000"
                    style={{ width: `${getProgress()}%` }}
                  />
                </div>
              </div>

              {/* Timer controls */}
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => adjustTime(-15)}
                  disabled={secondsLeft <= 15}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => adjustTime(15)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <Button variant="destructive" size="icon" onClick={skipTimer}>
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
