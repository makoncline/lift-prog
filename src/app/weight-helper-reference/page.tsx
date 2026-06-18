import {
  OneRepMaxAddedWeightRepsCalculator,
  PlateLoadCalculator,
} from "@/components/workout-reference/weight_helper_dialog";
import type { CurrentExerciseSet } from "@/components/workout-reference/workout_reference_types";

const sampleSet: CurrentExerciseSet = {
  id: "sample-working-set",
  kind: "working",
  weightMode: "standard",
  weightAmount: "100",
  weightSign: 1,
  reps: "12",
  note: "sample set note",
  completed: true,
};

export default function WeightHelperReferencePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[#fdfcf8] px-3 py-5 font-mono text-[#17150f]">
      <div className="mb-3">
        <h1 className="text-[28px] leading-tight font-semibold tracking-normal">
          Weight helper
        </h1>
        <div className="mt-1 text-[13px] leading-5 text-[#716b5d]">
          sample set · 100lb x 12
        </div>
      </div>

      <div className="space-y-2">
        <OneRepMaxAddedWeightRepsCalculator set={sampleSet} />
        <PlateLoadCalculator set={sampleSet} />
      </div>
    </main>
  );
}
