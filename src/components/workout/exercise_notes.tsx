"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Plus, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ExerciseNotes({
  notes,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  title = "Notes",
  addSignal,
}: {
  notes: { text: string }[];
  onAdd: (text: string) => void;
  onUpdate: (index: number, text: string) => void;
  onDelete: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  title?: string;
  addSignal?: number;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [open, setOpen] = useState(notes.length > 0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, notes.length);
  }, [notes.length]);

  const addInline = () => {
    onAdd("");
    setOpen(true);
    setEditingIndex(notes.length);
    setTimeout(() => {
      const el = inputRefs.current[notes.length];
      el?.focus();
    }, 0);
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    onReorder(from, to);
  };

  useEffect(() => {
    if (addSignal && addSignal > 0) {
      addInline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  const commitEdit = (index: number) => {
    const value = (notes[index]?.text ?? "").trim();
    if (value === "") {
      onDelete(index);
    }
    setEditingIndex(null);
  };

  return (
    <div className="text-muted-foreground w-full space-y-1 text-[11px]">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex w-full items-center justify-between">
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px]">
            <span>{title}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Add note"
            onClick={addInline}
            className="h-6 gap-1 rounded-full px-2 py-0 text-[10px] leading-none"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <CollapsibleContent>
          <div className="space-y-1 pt-1">
            {notes.map((n, i) => (
              <div
                key={`note-${i}`}
                className="group relative w-full rounded-md p-1"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  move(from, i);
                }}
              >
                <div className="flex w-full items-center gap-2">
                  {editingIndex === i ? (
                    <Input
                      ref={(el) => (inputRefs.current[i] = el)}
                      className="border-input bg-background placeholder:text-muted-foreground/70 h-7 w-full flex-1 rounded border px-2 text-[11px] italic shadow-none focus-visible:ring-1"
                      value={n.text}
                      onChange={(e) => onUpdate(i, e.target.value)}
                      onBlur={() => commitEdit(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape")
                          commitEdit(i);
                      }}
                      placeholder="type a note"
                    />
                  ) : (
                    <button
                      type="button"
                      className="w-full flex-1 text-left text-[11px]"
                      onClick={() => setEditingIndex(i)}
                    >
                      <code className="bg-muted rounded px-1 py-0.5">
                        {n.text || "(empty)"}
                      </code>
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete note"
                    onClick={() => onDelete(i)}
                    className="h-6 w-6"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
