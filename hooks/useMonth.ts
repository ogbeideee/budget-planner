"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentMonthKey, isMonth } from "@/lib/date";
import type { Month } from "@/lib/types";

export interface UseMonthResult {
  month: Month;
  setMonth: (month: Month) => void;
  clearMonth: () => void;
}

export function useMonth(): UseMonthResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("month");
  const month = param !== null && isMonth(param) ? param : currentMonthKey();

  const setMonth = (next: Month) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const clearMonth = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return { month, setMonth, clearMonth };
}
