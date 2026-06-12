"use client";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function DebugPanel({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8 rounded-md border border-gray-300 p-2">
      <div className="flex cursor-pointer items-center justify-between p-2" onClick={() => setOpen(!open)}>
        <h3 className="text-sm font-semibold">Debug Data</h3>
        <ChevronDown className={`h-4 w-4 transform transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="mt-2 max-h-[500px] overflow-auto">
          <pre className="text-xs break-words whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}


