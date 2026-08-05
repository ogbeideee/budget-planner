"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { CorruptedStateError } from "@/lib/storage";
import { RecoveryPanel } from "@/components/recovery/RecoveryPanel";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isCorrupt = error instanceof CorruptedStateError;

  useEffect(() => {
    console.error(error);
  }, [error]);

  if (!isCorrupt) {
    return (
      <main
        id="main"
        className="mx-auto flex min-h-screen w-full max-w-[1152px] flex-col items-center justify-center gap-4 px-6"
      >
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-center text-sm text-muted">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-10">
      <RecoveryPanel />
    </div>
  );
}
