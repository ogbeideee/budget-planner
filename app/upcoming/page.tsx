import type { Metadata } from "next";
import { Suspense } from "react";
import { UpcomingView } from "@/components/upcoming/UpcomingView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = {
  title: "Upcoming expenses",
};

export default function UpcomingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UpcomingView />
    </Suspense>
  );
}
