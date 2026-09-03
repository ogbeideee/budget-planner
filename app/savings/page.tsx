import type { Metadata } from "next";
import { Suspense } from "react";
import { SavingsView } from "@/components/savings/SavingsView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Savings",
};

export default function SavingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SavingsView />
    </Suspense>
  );
}
