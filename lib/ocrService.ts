// OCR service abstraction (Prompt 8D).
//
// LOCAL OCR ONLY. Bank statements are sensitive financial documents and are
// never sent anywhere. The default implementation runs Tesseract.js (WASM)
// entirely inside the renderer from assets bundled with the app
// (public/vendor/tesseract/): the API bundle, the worker, the WASM core and
// the English language data are all served by the app itself
// (`/vendor/tesseract/...` — `app://bundle/vendor/...` in the packaged EXE),
// so OCR works fully offline and uploads nothing.
//
// The interface deliberately says nothing about Tesseract: it takes one page
// image and returns its text. That keeps the engine replaceable and lets the
// orchestration layer (lib/statementOcr.ts) be tested with a fake service.
// Nothing here ever logs statement content; no progress logger is passed to
// the engine (privacy: no OCR text leaves this module).

export interface OcrImage {
  width: number;
  height: number;
  /** RGBA pixel data, row-major (ImageData-compatible). */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface OcrService {
  /** Display name — diagnostics only, never shown to the user verbatim. */
  readonly name: string;
  /** Whether OCR can run right now (engine + bundled assets present). Never
   *  throws: a failure here means OCR is unavailable and the caller tells
   *  the user the statement needs OCR support. */
  isAvailable(): Promise<boolean>;
  /** Why the engine could not start, when it could not (asset paths, worker
   *  errors — never statement content). Lets the import surface a concrete
   *  diagnostic instead of only the generic "OCR unavailable" message. */
  readonly lastStartError?: string | null;
  /** OCR one page image → extracted text. MAY throw — the caller isolates
   *  page failures so one bad page never kills the import. */
  recognize(image: OcrImage, page: number): Promise<string>;
}

/** Where the bundled Tesseract assets are served from (public/vendor). */
export const TESSERACT_ASSET_DIR = "/vendor/tesseract";

/** OCR language + recognition mode handed to the Tesseract worker. */
export const TESSERACT_LANG = "eng";
export const TESSERACT_OEM = 1;

/**
 * The worker/core/lang config for the bundled Tesseract engine (Prompt 8K).
 *
 * EVERY path points at the app-served asset dir (`/vendor/tesseract/`) and
 * gzip is off (the vendored traineddata is the plain file). This is what keeps
 * OCR 100% local: the vendored `tesseract.min.js` / `worker.min.js` bundles
 * ship `https://cdn.jsdelivr.net/...` DEFAULTS for workerPath/corePath/langPath
 * that would only be reached if one of these overrides were omitted. Keep this
 * object local-only — a stray CDN path would not upload statement images
 * (Tesseract.js never uploads image data) but would violate the offline
 * requirement. Locked by lib/__tests__/ocrService.test.ts.
 *
 * `workerBlobURL` is deliberately FALSE: with the blob bootstrap the vendored
 * tesseract.min.js wraps the worker code in a `blob:` URL whose contents are
 * `importScripts("/vendor/tesseract/worker.min.js")` — inside a blob worker
 * that leading-slash path cannot resolve against the blob base URL and
 * Chromium rejects it ("URL ... is invalid"), so OCR could not start in the
 * packaged app (app:// origin) NOR over http. A plain `new Worker(workerPath)`
 * resolves the absolute path against the page's own origin — `app://bundle`
 * in the desktop app, the dev server in development — and the worker's own
 * importScripts/fetch calls then resolve against the worker script's URL. This
 * mirrors how the pdfjs worker already loads in the packaged app.
 */
export const TESSERACT_WORKER_OPTIONS: Record<string, unknown> = {
  workerPath: `${TESSERACT_ASSET_DIR}/worker.min.js`,
  corePath: `${TESSERACT_ASSET_DIR}/tesseract-core-simd.wasm.js`,
  langPath: TESSERACT_ASSET_DIR,
  // The vendored language data is the plain (uncompressed) traineddata — tell
  // the worker not to request the .gz variant.
  gzip: false,
  workerBlobURL: false,
  // No logger key: progress callbacks are never needed and never carry text.
};

// ---------------------------------------------------------------------------
// Tesseract.js implementation (browser bundle loaded WITHOUT the bundler —
// the worker/core are classic scripts + WASM that must not be transformed).
// ---------------------------------------------------------------------------

interface TesseractWorker {
  recognize(image: unknown): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

interface TesseractApi {
  createWorker(
    langs?: string,
    oem?: number,
    options?: Record<string, unknown>,
  ): Promise<TesseractWorker>;
}

declare global {
  interface Window {
    Tesseract?: TesseractApi;
  }
}

let scriptPromise: Promise<TesseractApi> | null = null;
let workerPromise: Promise<TesseractWorker> | null = null;

function loadScript(timeoutMs = 30_000): Promise<TesseractApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OCR requires a browser environment"));
  }
  if (window.Tesseract !== undefined) return Promise.resolve(window.Tesseract);
  if (scriptPromise !== null) return scriptPromise;

  scriptPromise = new Promise<TesseractApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${TESSERACT_ASSET_DIR}/tesseract.min.js`;
    script.async = true;
    const timeout = window.setTimeout(
      () => reject(new Error("Tesseract bundle timed out")),
      timeoutMs,
    );
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.Tesseract === undefined) {
        reject(new Error("Tesseract bundle loaded without the API"));
        return;
      }
      resolve(window.Tesseract);
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Tesseract bundle failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function getWorker(api: TesseractApi): Promise<TesseractWorker> {
  if (workerPromise === null) {
    workerPromise = api.createWorker(TESSERACT_LANG, TESSERACT_OEM, TESSERACT_WORKER_OPTIONS);
  }
  return workerPromise;
}

/** Puts the page image into a canvas — the input Tesseract recognizes
 *  reliably in every browser (ImageData support varies by build). */
function imageToCanvas(image: OcrImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas is unavailable");
  context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  return canvas;
}

export function createTesseractOcrService(): OcrService {
  let lastStartError: string | null = null;
  return {
    name: "Tesseract.js (bundled, local)",
    get lastStartError(): string | null {
      return lastStartError;
    },
    async isAvailable(): Promise<boolean> {
      try {
        const api = await loadScript();
        await getWorker(api);
        lastStartError = null;
        return true;
      } catch (error) {
        // The engine failed to start (missing assets, worker error, …).
        // OCR is unavailable — the caller surfaces a useful message, and the
        // engine-level reason is kept for diagnostics (asset/worker errors
        // only — never statement content).
        lastStartError =
          error instanceof Error
            ? error.message.slice(0, 200)
            : String(error).slice(0, 200);
        workerPromise = null;
        return false;
      }
    },
    async recognize(image: OcrImage, _page: number): Promise<string> {
      const api = await loadScript();
      const worker = await getWorker(api);
      const result = await worker.recognize(imageToCanvas(image));
      return result.data.text;
    },
  };
}