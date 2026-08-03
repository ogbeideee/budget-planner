import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsView } from "@/components/reports/ReportsView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsView />
    </Suspense>
  );
}
