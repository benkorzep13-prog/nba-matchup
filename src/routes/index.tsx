import { createFileRoute } from "@tanstack/react-router";
import { Board } from "@/components/nba/board";
import { readLatestSnapshot } from "@/lib/nba/snapshot.server";

export const Route = createFileRoute("/")({
  loader: () => readLatestSnapshot(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData() as Parameters<typeof Board>[0]["initial"];
  return <Board initial={initial} />;
}
