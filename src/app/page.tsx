import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="">hello world</main>
    </HydrateClient>
  );
}
