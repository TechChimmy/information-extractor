// frontend/src/pdfWorker.ts

import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";

// --- FIX: Use Vite's recommended method for worker asset resolution ---
// This uses the native JavaScript URL constructor, which Vite automatically intercepts
// and handles correctly, resolving to the public path of the worker file.
// This resolves the TS2307 error by avoiding the special '?url' import syntax.

// We typically use the minified worker path to ensure we target the build artifact correctly.
GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url,
).toString();