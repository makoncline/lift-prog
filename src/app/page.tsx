import { HydrateClient } from "@/trpc/server";
import Workout from "../components/Workout";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="p-4">
        <Workout />
      </main>
    </HydrateClient>
  );
}
