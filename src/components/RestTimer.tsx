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

const TIMER_END_KEY = "rest_timer_end";
const TIMER_DURATION_KEY = "rest_timer_duration";

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

  // Check notification permission and existing timer on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }

      // Check if there's an active timer from localStorage
      const endTimeStr = localStorage.getItem(TIMER_END_KEY);
      const durationStr = localStorage.getItem(TIMER_DURATION_KEY);

      if (endTimeStr && durationStr) {
        const endTime = parseInt(endTimeStr, 10);
        const duration = parseInt(durationStr, 10);
        const now = Date.now();

        if (endTime > now) {
          // Resume timer
          setTotalSeconds(duration);
          setSecondsLeft(Math.ceil((endTime - now) / 1000));
          setTimerRunning(true);
          setMode("running");
          startTimerInterval();
        } else if (now - endTime < 60000) {
          // If ended less than a minute ago
          // Timer completed while app was closed
          setTimerCompleted(true);
          clearStoredTimer();
        } else {
          // Old timer data, clear it
          clearStoredTimer();
        }
      }
    }

    // Clean up on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Save timer state to localStorage
  const saveTimerState = (endTime: number, duration: number) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TIMER_END_KEY, endTime.toString());
      localStorage.setItem(TIMER_DURATION_KEY, duration.toString());
    }
  };

  // Clear stored timer
  const clearStoredTimer = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TIMER_END_KEY);
      localStorage.removeItem(TIMER_DURATION_KEY);
    }
  };

  // Start timer interval for UI updates
  const startTimerInterval = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Update UI every 500ms
    timerRef.current = setInterval(() => {
      const endTimeStr = localStorage.getItem(TIMER_END_KEY);
      if (!endTimeStr) {
        clearInterval(timerRef.current!);
        return;
      }

      const endTime = parseInt(endTimeStr, 10);
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        // Timer complete
        setSecondsLeft(0);
        setTimerRunning(false);
        setTimerCompleted(true);
        clearStoredTimer();
        clearInterval(timerRef.current!);
        notifyTimerComplete();

        // If dialog is open, reset to select mode
        if (open) {
          setMode("select");
        }
      } else {
        setSecondsLeft(Math.ceil(remaining / 1000));
      }
    }, 500);
  };

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
    // Sound is disabled to prevent interrupting background audio (e.g., Spotify)
    // when timer notifications occur on mobile devices.
    // If sound notification is needed in the future, consider implementing
    // a user toggle or using a less disruptive audio approach.
    return;

    // Original implementation:
    // if (audioRef.current) {
    //   audioRef.current.currentTime = 0;
    //   audioRef.current.play().catch((err) => {
    //     console.error("Failed to play audio:", err);
    //   });
    // }
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
    if (totalSeconds === 0 || !timerRunning) return 0;
    const elapsed = totalSeconds - secondsLeft;
    return (elapsed / totalSeconds) * 100;
  };

  // Start the timer with the selected duration
  const startTimer = (seconds: number) => {
    // Stop any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Request notification permission when starting a timer
    if (notificationPermission === "default") {
      void requestNotificationPermission().catch((err) => {
        console.error("Failed to request notification permission:", err);
      });
    }

    const now = Date.now();
    const endTime = now + seconds * 1000;

    // Save timer in localStorage
    saveTimerState(endTime, seconds);

    // Update component state
    setTotalSeconds(seconds);
    setSecondsLeft(seconds);
    setTimerRunning(true);
    setTimerCompleted(false);
    setMode("running");

    // Start the interval for UI updates
    startTimerInterval();
  };

  // Add or subtract time
  const adjustTime = (seconds: number) => {
    const endTimeStr = localStorage.getItem(TIMER_END_KEY);
    if (!endTimeStr) return; // No active timer

    const endTime = parseInt(endTimeStr, 10);
    const newEndTime = endTime + seconds * 1000;
    const now = Date.now();

    // Ensure we don't go below 1 second
    if (newEndTime <= now + 1000) {
      return;
    }

    // Update stored end time
    saveTimerState(newEndTime, totalSeconds);

    // Update local state with new remaining time
    const newRemaining = Math.ceil((newEndTime - now) / 1000);
    setSecondsLeft(newRemaining);
  };

  // Skip the timer
  const skipTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    clearStoredTimer();
    setTimerRunning(false);
    setTimerCompleted(false);
    setSecondsLeft(0);
    setMode("select");
    setOpen(false);
  };

  // When the dialog closes, don't reset the timer if it's running
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);

    // If we're reopening the dialog and the timer is running, go to the running view
    if (isOpen && timerRunning) {
      setMode("running");
    }

    // If we're closing the dialog and no timer is running or completed, reset to selection mode
    if (!isOpen && !timerRunning) {
      setMode("select");
      if (timerCompleted) {
        setTimerCompleted(false);
      }
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        src="/sounds/timer-complete.mp3"
        preload="auto"
        hidden
      />
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

      <Dialog modal={false} open={open} onOpenChange={handleOpenChange}>
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
