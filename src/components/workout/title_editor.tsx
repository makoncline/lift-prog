"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { H4 } from "@/components/ui/typography";
import { Edit2 } from "lucide-react";

export function TitleEditor({
  name,
  editableName,
  isEditing,
  onChange,
  onStartEditing,
  onCancel,
  onSave,
}: {
  name: string;
  editableName: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onStartEditing: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && nameInputRef.current) nameInputRef.current.focus();
  }, [isEditing]);

  return (
    <div className="mb-2 flex items-center justify-between">
      {isEditing ? (
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between">
            <Input
              ref={nameInputRef}
              value={editableName}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
              }}
              className="h-9"
              placeholder="Workout name"
            />
            <Button variant="ghost" size="sm" className="ml-2" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onSave}>
              Save Name
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex cursor-pointer items-center gap-1.5" onClick={onStartEditing}>
          <H4>{name}</H4>
          <Edit2 className="text-muted-foreground h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}


