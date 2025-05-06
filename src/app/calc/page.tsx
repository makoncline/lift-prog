import ProgressionForm from "./_components/progression-form";
import { H1 } from "@/components/ui/typography";

export default function ProgressionCalculatorPage() {
  return (
    <div className="container mx-auto max-w-2xl py-8">
      <H1 className="mb-6 text-2xl">Weight Progression Calculator</H1>
      <ProgressionForm />
    </div>
  );
}
