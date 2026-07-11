import { ExportCurrentUserDataResultSchema } from "@lift-prog/workout-sdk";

export async function readProductionExportFile(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not read local production export (${response.status}).`,
    );
  }
  return ExportCurrentUserDataResultSchema.parse(await response.json());
}
