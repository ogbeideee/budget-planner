import type { Metadata } from "next";
import { Suspense } from "react";
import { TodoView } from "@/components/todo/TodoView";

export const metadata: Metadata = {
  title: "To-Do",
};

export default function TodoPage() {
  return (
    <Suspense fallback={null}>
      <TodoView />
    </Suspense>
  );
}
