import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryView } from "@/components/history/HistoryView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HistoryView />
    </Suspense>
  );
}
