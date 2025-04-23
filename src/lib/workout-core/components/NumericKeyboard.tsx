import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Keyboard as KeyboardIcon,
  ChevronDown,
  Plus,
  Minus,
  Delete,
} from "lucide-react";
import { type WeightModifier } from "@/lib/workoutLogic";

// KeyboardContainer component
interface KeyboardContainerProps {
  children: React.ReactNode;
  className?: string;
}

const KeyboardContainer = ({ children, className }: KeyboardContainerProps) => {
  return (
    <div
      className={cn(
        "bg-background border-border fixed right-0 bottom-0 left-0 border-t p-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

// KeyboardButton component
interface KeyboardButtonProps {
  onKeyPress: (value: string) => void;
  value: string;
  children: React.ReactNode;
  className?: string;
  gridArea: string;
  variant?: "default" | "outline" | "primary";
  isActive?: boolean;
  disabled?: boolean;
}

const KeyboardButton = ({
  onKeyPress,
  value,
  children,
  className,
  gridArea,
  variant = "outline",
  isActive = false,
  disabled = false,
}: KeyboardButtonProps) => {
  return (
    <div className="h-full w-full" style={{ gridArea }}>
      <Button
        variant={variant === "primary" ? "default" : "outline"}
        className={cn(
          "h-full w-full",
          variant === "primary" && "bg-primary hover:bg-primary/90",
          isActive &&
            "ring-primary ring-offset-background ring-2 ring-offset-2",
          className,
        )}
        onClick={() => onKeyPress(value)}
        disabled={disabled}
      >
        {children}
      </Button>
    </div>
  );
};

// Main NumericKeyboard component
interface NumericKeyboardProps {
  onKeyPress: (value: string) => void;
  inputType: "weight" | "reps";
  activeSetWeightModifier?: WeightModifier;
}

export function NumericKeyboard({
  onKeyPress,
  inputType,
  activeSetWeightModifier,
}: NumericKeyboardProps) {
  const isBwActive = activeSetWeightModifier === "bodyweight";

  return (
    <KeyboardContainer>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(4, 1fr)",
          gridTemplateAreas: `
            "btn1  btn2  btn3  collapse"
            "btn4  btn5  btn6  minus-plus"
            "btn7  btn8  btn9  bw-sign"
            "decimal btn0 backspace next"
          `,
          height: "300px",
        }}
      >
        {/* Number buttons */}
        <KeyboardButton onKeyPress={onKeyPress} value="1" gridArea="btn1">
          1
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="2" gridArea="btn2">
          2
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="3" gridArea="btn3">
          3
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="4" gridArea="btn4">
          4
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="5" gridArea="btn5">
          5
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="6" gridArea="btn6">
          6
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="7" gridArea="btn7">
          7
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="8" gridArea="btn8">
          8
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="9" gridArea="btn9">
          9
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="0" gridArea="btn0">
          0
        </KeyboardButton>

        {/* Decimal button (conditional) */}
        {inputType === "weight" ? (
          <KeyboardButton onKeyPress={onKeyPress} value="." gridArea="decimal">
            .
          </KeyboardButton>
        ) : (
          <div style={{ gridArea: "decimal" }}></div>
        )}

        {/* Backspace button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="backspace"
          gridArea="backspace"
        >
          <Delete size={24} />
        </KeyboardButton>

        {/* Collapse button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="collapse"
          gridArea="collapse"
        >
          <div className="flex flex-col items-center">
            <KeyboardIcon size={24} />
            <ChevronDown size={16} />
          </div>
        </KeyboardButton>

        {/* Plus/Minus buttons in one grid area */}
        <div
          className="grid grid-cols-2 gap-2"
          style={{ gridArea: "minus-plus" }}
        >
          <KeyboardButton onKeyPress={onKeyPress} value="minus" gridArea="">
            <Minus size={24} />
          </KeyboardButton>
          <KeyboardButton onKeyPress={onKeyPress} value="plus" gridArea="">
            <Plus size={24} />
          </KeyboardButton>
        </div>

        {/* Combined BW and Sign Toggle buttons (conditional) */}
        {inputType === "weight" ? (
          <div
            className="grid grid-cols-2 gap-2"
            style={{ gridArea: "bw-sign" }}
          >
            {/* Bodyweight button */}
            <KeyboardButton
              onKeyPress={onKeyPress}
              value="bw"
              gridArea=""
              isActive={isBwActive}
            >
              BW
            </KeyboardButton>
            {/* Sign toggle button */}
            <KeyboardButton
              onKeyPress={onKeyPress}
              value="toggle-sign"
              gridArea=""
            >
              +/-
            </KeyboardButton>
          </div>
        ) : (
          <div style={{ gridArea: "bw-sign" }}></div>
        )}

        {/* Next button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="next"
          gridArea="next"
          variant="primary"
        >
          Next
        </KeyboardButton>
      </div>
    </KeyboardContainer>
  );
}
