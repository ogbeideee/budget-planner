// Official Next.js App Router pattern for inline bootstrap scripts
// (see node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md):
// a real executable <script> on the server (runs synchronously during HTML
// parsing, before first paint) that React treats as a data block on the
// client (type="text/plain"), so React never creates/executes it in the
// client tree and the development warning stays away. suppressHydrationWarning
// accepts the type difference between the SSR'd DOM and the client tree.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}