"use client";
import React from "react";
import {
  ChevronDown,
  Delete,
  KeyboardIcon,
  Minus,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WeightModifier } from "@/lib/workoutLogic";
import { PlateCalculator } from "@/components/plate-calculator";

/* ---------- low-level primitives ---------- */

export function KeyboardContainer({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "bg-background border-border fixed inset-x-0 bottom-0 mx-auto max-w-md border-t p-4",
        "pb-[calc(1rem+env(safe-area-inset-bottom,0))]",
        className,
      )}
      style={{ touchAction: "manipulation" }}
    >
      {children}
    </div>
  );
}

interface KBBtnProps extends React.PropsWithChildren {
  value: string;
  onKeyPress: (v: string) => void;
  gridArea: string;
  variant?: "default" | "outline" | "primary";
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
}
function KBButton({
  value,
  onKeyPress,
  gridArea,
  children,
  variant = "outline",
  isActive,
  disabled,
  className,
}: KBBtnProps) {
  return (
    <div style={{ gridArea }} className="h-full w-full">
      <Button
        variant={variant === "primary" ? "default" : "outline"}
        className={cn(
          "h-full w-full text-sm",
          variant === "primary" && "bg-primary hover:bg-primary/90",
          isActive &&
            "ring-primary ring-offset-background ring-2 ring-offset-1",
          "py-1",
          className,
        )}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onKeyPress(value);
        }}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {children}
      </Button>
    </div>
  );
}

function DoubleCell({
  gridArea,
  children,
}: React.PropsWithChildren<{ gridArea: string }>) {
  return (
    <div className="grid grid-cols-2 gap-2" style={{ gridArea }}>
      {children}
    </div>
  );
}

/* ---------- shared 4×4 shell ---------- */

function KeyboardGrid({ children }: React.PropsWithChildren) {
  return (
    <KeyboardContainer>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "repeat(4,1fr)",
          gridTemplateRows: "repeat(4,1fr)",
          gridTemplateAreas: `
            "btn1  btn2  btn3  action1"
            "btn4  btn5  btn6  action2"
            "btn7  btn8  btn9  action3"
            "decimal btn0 backspace action4"
          `,
          height: "180px",
          touchAction: "manipulation",
        }}
      >
        {children}
      </div>
    </KeyboardContainer>
  );
}

/* ---------- digits helper ---------- */

function DigitKeys({ onKeyPress }: { onKeyPress: (v: string) => void }) {
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
      {cells.map((area, i) => (
        <KBButton
          key={area}
          value={`${i === 9 ? 0 : i + 1}`}
          onKeyPress={onKeyPress}
          gridArea={area}
        >
          {i === 9 ? 0 : i + 1}
        </KBButton>
      ))}
    </>
  );
}

/* ---------- weight keyboard ---------- */

export function WeightKeyboard({
  onKeyPress,
  activeSetWeightModifier,
  currentWeight,
}: {
  onKeyPress: (v: string) => void;
  activeSetWeightModifier?: WeightModifier;
  currentWeight?: number;
}) {
  const isBwActive = activeSetWeightModifier === "bodyweight";

  return (
    <KeyboardGrid>
      <DigitKeys onKeyPress={onKeyPress} />

      {/* Decimal */}
      <KBButton value="." onKeyPress={onKeyPress} gridArea="decimal">
        .
      </KBButton>

      {/* Backspace */}
      <KBButton value="backspace" onKeyPress={onKeyPress} gridArea="backspace">
        <Delete size={16} />
      </KBButton>

      {/* action1 - plate calculator & collapse */}
      <DoubleCell gridArea="action1">
        <div className="h-full w-full">
          <PlateCalculator
            key={String(currentWeight ?? "")}
            className="h-full w-full"
            defaultWeight={currentWeight}
          />
        </div>
        <KBButton value="collapse" onKeyPress={onKeyPress} gridArea="">
          <div className="flex items-center gap-1">
            <KeyboardIcon size={16} />
            <ChevronDown size={12} />
          </div>
        </KBButton>
      </DoubleCell>

      {/* action2 - minus / plus */}
      <DoubleCell gridArea="action2">
        <KBButton value="minus" onKeyPress={onKeyPress} gridArea="">
          <Minus size={16} />
        </KBButton>
        <KBButton value="plus" onKeyPress={onKeyPress} gridArea="">
          <Plus size={16} />
        </KBButton>
      </DoubleCell>

      {/* action3 - body-weight & sign toggle */}
      <DoubleCell gridArea="action3">
        <KBButton
          value="bw"
          onKeyPress={onKeyPress}
          gridArea=""
          isActive={isBwActive}
        >
          <User size={16} />
        </KBButton>
        <KBButton
          value="toggle-sign"
          onKeyPress={onKeyPress}
          gridArea=""
          disabled={!isBwActive}
        >
          +/-
        </KBButton>
      </DoubleCell>

      {/* action4 - next */}
      <KBButton
        value="next"
        onKeyPress={onKeyPress}
        gridArea="action4"
        variant="primary"
        className="text-base"
      >
        Next
      </KBButton>
    </KeyboardGrid>
  );
}

/* ---------- reps keyboard ---------- */

export function RepsKeyboard({
  onKeyPress,
}: {
  onKeyPress: (v: string) => void;
}) {
  return (
    <KeyboardGrid>
      <DigitKeys onKeyPress={onKeyPress} />

      {/* placeholder where decimal would be */}
      <div style={{ gridArea: "decimal" }} />

      {/* Backspace */}
      <KBButton value="backspace" onKeyPress={onKeyPress} gridArea="backspace">
        <Delete size={16} />
      </KBButton>

      {/* action1 - collapse */}
      <KBButton value="collapse" onKeyPress={onKeyPress} gridArea="action1">
        <div className="flex flex-col items-center">
          <KeyboardIcon size={16} />
          <ChevronDown size={12} />
        </div>
      </KBButton>

      {/* action2 - minus / plus */}
      <DoubleCell gridArea="action2">
        <KBButton value="minus" onKeyPress={onKeyPress} gridArea="">
          <Minus size={16} />
        </KBButton>
        <KBButton value="plus" onKeyPress={onKeyPress} gridArea="">
          <Plus size={16} />
        </KBButton>
      </DoubleCell>

      {/* action3 placeholder (no BW/sign for reps) */}
      <div style={{ gridArea: "action3" }} />

      {/* action4 - next */}
      <KBButton
        value="next"
        onKeyPress={onKeyPress}
        gridArea="action4"
        variant="primary"
        className="text-base"
      >
        Next
      </KBButton>
    </KeyboardGrid>
  );
}
