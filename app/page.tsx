import type { Metadata } from "next";
import { Suspense } from "react";
import { PlannerView } from "@/components/planner/PlannerView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Budget Planner",
};

export default function PlannerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlannerView />
    </Suspense>
  );
}
