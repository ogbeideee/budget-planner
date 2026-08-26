import type { Metadata } from "next";
import { Suspense } from "react";
import { DebtPayoffView } from "@/components/debt/DebtPayoffView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Debt payoff",
};

export default function DebtPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DebtPayoffView />
    </Suspense>
  );
}
