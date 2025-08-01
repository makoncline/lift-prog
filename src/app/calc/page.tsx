import ProgressionForm from "./_components/progression-form";
import { H1 } from "@/components/ui/typography";

export default function ProgressionCalculatorPage() {
  return (
    <div className="container mx-auto max-w-2xl overflow-y-auto py-8 pb-32">
      <H1 className="mb-6 text-2xl">Weight Progression Calculator</H1>
      <ProgressionForm />
    </div>
  );
}
