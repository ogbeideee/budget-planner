import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseDetailsView } from "@/components/history/ExpenseDetailsView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Expense Details",
};

export default function ExpenseDetailsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExpenseDetailsView />
    </Suspense>
  );
}