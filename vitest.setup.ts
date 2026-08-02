import "@testing-library/jest-dom/vitest";
import { randomUUID } from "node:crypto";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const cryptoObj = globalThis.crypto as Crypto | undefined;
if (!cryptoObj || typeof cryptoObj.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    value: { ...(cryptoObj ?? {}), randomUUID },
    configurable: true,
  });
}
