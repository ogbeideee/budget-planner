import { readFileSync } from "node:fs";
import { rowsFromPdfItems } from "./lib/statementImport.ts";

const d = JSON.parse(readFileSync("./tests/fixtures/statements/Opay/opay.extracted.json", "utf8"));

for (let pi = 0; pi < Math.min(d.pages.length, 2); pi++) {
  const page = d.pages[pi];
  const rows = rowsFromPdfItems(page.items);
  console.log(`\n=== Page ${pi + 1}: ${rows.length} rows ===`);
  rows.slice(0, 12).forEach((r, idx) => {
    console.log(`  Row ${idx}: ${JSON.stringify(r.cells)}`);
  });
  if (rows.length > 12) {
    console.log(`  ... (${rows.length - 12} more rows)`);
    rows.slice(12, 16).forEach((r, idx) => {
      console.log(`  Row ${idx + 12}: ${JSON.stringify(r.cells)}`);
    });
  }
}

let totalRows = 0;
d.pages.forEach((page) => {
  totalRows += rowsFromPdfItems(page.items).length;
});
console.log(`\nTotal rows across all ${d.pages.length} pages: ${totalRows}`);

