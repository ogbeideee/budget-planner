import type { Metadata } from "next";
import { QuickAddPanel } from "@/components/quickadd/QuickAddPanel";

export const metadata: Metadata = {
  title: "Quick add",
};

/**
 * The tray quick-add window (FR-26). Rendered chromeless: `AppShell`
 * special-cases this route so the sidebar, header, bottom nav and the shell's
 * write-at-mount hooks never mount in this second renderer process.
 */
export default function QuickAddPage() {
  return <QuickAddPanel />;
}
