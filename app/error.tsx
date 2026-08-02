"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CorruptedStateError } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const isCorrupt = error instanceof CorruptedStateError;

  useEffect(() => {
    console.error(error);
  }, [error]);

  const handleResetData = () => {
    useAppStore.getState().resetAll();
    reset();
  };

  const handleImportBackup = () => {
    router.push("/settings?action=import");
  };

  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen w-full max-w-[1152px] flex-col items-center justify-center gap-4 px-6"
    >
      <h1 className="text-2xl font-bold">
        {isCorrupt ? "Saved data is corrupted" : "Something went wrong"}
      </h1>
      <p className="max-w-md text-center text-sm text-muted">
        {isCorrupt
          ? "The data stored in this browser could not be read. You can import a backup or reset all data."
          : "An unexpected error occurred. Please try again."}
      </p>
      {isCorrupt ? (
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleImportBackup}>
            Import backup
          </Button>
          <Button variant="danger" onClick={handleResetData}>
            Reset data
          </Button>
        </div>
      ) : (
        <Button onClick={() => reset()}>Try again</Button>
      )}
    </main>
  );
}
