import { PageHeader } from "./PageHeader";

export interface PagePlaceholderProps {
  title: string;
  description?: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <section
        aria-label="Under construction"
        className="rounded-lg border border-dashed border-border bg-surface p-12 text-center"
      >
        <p className="text-sm text-muted">This section is under construction.</p>
      </section>
    </div>
  );
}
