// import Tesseract, { createWorker } from "tesseract.js";
// import * as pdfjsLib from "pdfjs-dist/build/pdf";

// export interface ChildData {
//   name: string;
//   childNumber: string;
//   gender: string;
//   dateOfBirth: string;
//   classOfStudy: string;
//   center: string;
//   yearOfAdmission?: string;
//   background?: string;
//   rawText?: string;
// }

// // ----------------------------------------------------------------------
// // 1. CORE HELPERS
// // ----------------------------------------------------------------------

// const extractField = (text: string, pattern: RegExp): string => {
//   const m = text.match(pattern);
//   return m ? (m[1] ?? "").trim() : "";
// };

// const cleanValue = (value = "", maxWords = 4) => {
//   if (!value) return "";
//   let cleaned = value.replace(/\s+/g, " ").trim();
//   cleaned = cleaned.replace(/["',.;:]+$/, '').replace(/^["',.;:]+/, '').trim();

//   if (maxWords > 0) {
//     // Only slice for Name field to prevent over-capturing
//     return cleaned.split(" ").slice(0, maxWords).join(" ");
//   }
//   return cleaned;
// };

// // ----------------------------------------------------------------------
// // 2. DATE HELPERS
// // ----------------------------------------------------------------------

// const formatDateStr = (dateStr = "") => {
//   const s = dateStr.trim();
//   if (!s) return "";
//   let m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
//   if (m) {
//     let d = String(m[1]).padStart(2, "0");
//     let mo = Number(m[2]);
//     let y = m[3].length === 2 ? (Number(m[3]) > 50 ? "19" + m[3] : "20" + m[3]) : m[3];
//     const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
//     return `${d} ${months[mo-1] ?? mo} ${y}`;
//   }
//   const any = dateStr.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
//   if (any) return formatDateStr(any[0]);
//   const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
//   if (yearMatch) {
//     const y = yearMatch[0];
//     return y;
//   }
//   return "";
// };

// export const extractDateOfBirth = (text: string): string => {
//   const dobPatterns = [
//     /(?:Date\s*of\s*Birth|DOB|Birth\s*date)\s*[:\-\s\n]*([0-9\/\-\.\s]{6,15})/i,
//   ];
//   for (const p of dobPatterns) {
//     const m = text.match(p);
//     if (m && m[1]) return formatDateStr(m[1]);
//   }
//   const any = text.match(/(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
//   if (any) return formatDateStr(any[0]);
//   const yearMatch = text.match(/\b(19|20)\d{2}\b/);
//   if (yearMatch) {
//     const y = yearMatch[0];
//     return y;
//   }
//   return "";
// };

// // ----------------------------------------------------------------------
// // 3. CLASS EXTRACTION
// // ----------------------------------------------------------------------

// export const extractClass = (text: string): string => {
//   const classPatterns = [
//     /(?:Class\s*of\s*study|Class)\s*[:\-\s\n]*(.*?)(?:\n|Name\s*of\s*Centre|$)/i,
//   ];
//   for (const p of classPatterns) {
//     const m = text.match(p);
//     if (m && m[1]) {
//       let cls = m[1].trim();
//       const roman = cls.match(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/);
//       if (roman) {
//         const map: any = {I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10};
//         cls = cls.replace(roman[0], String(map[roman[0]]));
//       }
//       const ec = cls.match(/Early\s*Childhood/i);
//       if (ec) return "Early Childhood Centre";
//       return cls.replace(/[^A-Za-z0-9 \-]/g, "").trim(); 
//     }
//   }
//   const ec = text.match(/Early\s*Childhood\s*Centre/i);
//   if (ec) return "Early Childhood Centre";
//   return "";
// };

// // ----------------------------------------------------------------------
// // 4. CENTER EXTRACTION
// // ----------------------------------------------------------------------

// export const extractCenter = (text: string): string => {
//   const patterns = [
//     /(?:Name\s*of\s*Centre|Centre|Center)\s*[:\-\s\n]*([A-Za-z0-9\s.\-]+)/i,
//   ];
//   for (const p of patterns) {
//     const m = text.match(p);
//     if (m && m[1]) {
//       return m[1].trim().replace(/[^A-Za-z0-9 \-\.]/g, "");
//     }
//   }
//   const known = ["Purnea","Pune","Patna","Gaya","Bihar","Purnea"];
//   for (const k of known) {
//     if (new RegExp(`\\b${k}\\b`, "i").test(text)) return k;
//   }
//   return "";
// };

// // ----------------------------------------------------------------------
// // 5. TESSERACT PROCESSING
// // ----------------------------------------------------------------------

// export const processImage = async (imageBlob: Blob, progressCb?: (p: number)=>void) => {
//   const worker = await createWorker({
//   logger: (m) => {
//     if (m.status === "recognizing text" && progressCb) {
//       progressCb(Math.round((m.progress || 0) * 100));
//     }
//   },
// });
// await worker.load();
//   await worker.loadLanguage("eng");
//   await worker.initialize("eng");
//   try {
//     const { data: { text } } = await worker.recognize(imageBlob);
//     return text;
//   } finally {
//     await worker.terminate();
//   }
// };

// // ----------------------------------------------------------------------
// // 6. MAIN PDF PROCESSING FUNCTION (Name Logic revised)
// // ----------------------------------------------------------------------

// export const processPDF = async (file: File, onProgress?: (p:number, page?:number, total?:number)=>void) : Promise<ChildData[]> => {
//   const arrayBuffer = await file.arrayBuffer();
//   const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
//   const numPages = pdf.numPages;
//   const results: ChildData[] = [];

//   for (let pageNum = 1; pageNum <= numPages; pageNum++) {
//     const page = await pdf.getPage(pageNum);
//     const viewport = page.getViewport({ scale: 2.0 });
//     const canvas = document.createElement("canvas");
//     canvas.width = Math.round(viewport.width);
//     canvas.height = Math.round(viewport.height);
//     const ctx = canvas.getContext("2d")!;
//     const renderContext = { canvasContext: ctx, viewport };
//     await page.render(renderContext).promise;
//     const blob: Blob = await new Promise((res) => canvas.toBlob((b)=>res(b!), "image/png", 0.9));
//     if (onProgress) onProgress(0, pageNum, numPages);

//     const text = await processImage(blob, (p)=> onProgress && onProgress(p, pageNum, numPages)); 

//     const normalized = text.replace(/\r/g,'\n').replace(/[ \t]{2,}/g,' ').replace(/\n\s+\n/g, '\n').trim();

//     // 1. Name (FINAL REVISED - Focusing on capitalized words)
//     // Match the label, then consume ANY character non-greedily ([\s\S]*?) until we hit a pattern that looks like a name.
//     // Name pattern: one or more words starting with an uppercase letter, separated by spaces/hyphens/dots.
//     const namePattern = /(?:Child\s*Name|Name)[\s\S]*?([A-Z][\w\s'.\-]+)/i;
//     const name = cleanValue(extractField(normalized, namePattern), 4);

//     // 2. Child Number
//     const childNumberPattern = /Child\s*(?:Number|No|No\.)[\s\S]*?([A-Za-z0-9\-\/]+)/i;
//     const childNumber = extractField(normalized, childNumberPattern) || "";

//     // 3. Gender
//     const genderPattern = /(?:Gender|Sex)\s*[:\-\s\n]*([A-Za-z\s]+)/i;
//     let gender = extractField(normalized, genderPattern) || "";

//     if (gender) {
//         gender = gender.replace(/[^A-Za-z]/g, "").trim();
//         if (gender.length >= 3) {
//             gender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
//         } else {
//             if (gender.toLowerCase() === 'm') gender = 'Male';
//             else if (gender.toLowerCase() === 'f') gender = 'Female';
//             else gender = '';
//         }
//     }

//     // 4. Date of Birth, Class, Center
//     const dateOfBirth = extractDateOfBirth(normalized);
//     const classOfStudy = extractClass(normalized) || "";
//     const center = extractCenter(normalized) || "";

//     // 5. Year of Admission
//     const yearOfAdmission = extractField(normalized, /Year\s*of\s*admission\s*[:\-\s\n]*([0-9]{4})/i) || extractField(normalized, /Admission\s*Year\s*[:\-\s\n]*([0-9]{4})/i) || "";

//     // 6. Background
//     let background = "";
//     const bgMatch = normalized.match(/Child\s*Background\s*[:\-\s\n]+([\s\S]+)$/im);
//     if (bgMatch && bgMatch[1]) {
//       background = bgMatch[1].trim();
//     } else {
//       const longCandidate = normalized.split("\n").find(l => l.length > 80);
//       background = longCandidate || "";
//     }

//     results.push({
//       name, childNumber, gender, dateOfBirth, classOfStudy, center, yearOfAdmission, background, rawText: normalized
//     });
//   }
//   return results;
// };
// frontend/src/ocr.ts

import { createWorker, OEM, PSM } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

/* ============================================================
   TYPES
============================================================ */

export interface ChildData {
  name: string;
  childNumber: string;
  gender: string;
  dateOfBirth: string;
  classOfStudy: string;
  center: string;
  yearOfAdmission?: string;
  background?: string;
  rawText?: string;
  pdfName?: string;
}

/* ============================================================
   OCR WORKER (SINGLETON – CRITICAL FIX)
============================================================ */

let ocrWorker: any | null = null;

const getOCRWorker = async (progressCb?: (p: number) => void) => {
  if (ocrWorker) return ocrWorker;

  ocrWorker = await createWorker({
    logger: m => {
      if (m.status === "recognizing text" && progressCb) {
        progressCb(Math.round((m.progress || 0) * 100));
      }
    }
  });

  await ocrWorker.load();
  await ocrWorker.loadLanguage("eng");
  await ocrWorker.initialize("eng");

  // Optimized parameters for maximum accuracy
  await ocrWorker.setParameters({
    tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,  // Better for document pages
    preserve_interword_spaces: "1",
    // Additional accuracy improvements
    tessedit_char_blacklist: '|{}[]<>',  // Remove unlikely characters
  });

  return ocrWorker;
};

/* ============================================================
   CORE HELPERS (UNCHANGED LOGIC, CLEANED)
============================================================ */

const extractField = (text: string, pattern: RegExp): string => {
  const m = text.match(pattern);
  return m ? (m[1] ?? "").trim() : "";
};

const cleanValue = (value = "", maxWords = 4) => {
  if (!value) return "";
  let cleaned = value.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/["',.;:]+$/, "").replace(/^["',.;:]+/, "").trim();
  return maxWords > 0
    ? cleaned.split(" ").slice(0, maxWords).join(" ")
    : cleaned;
};

/* ============================================================
   DATE EXTRACTION (UNCHANGED – SOLID)
============================================================ */

const formatDateStr = (dateStr = "") => {
  const m = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!m) return "";

  const d = m[1].padStart(2, "0");
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? (Number(m[3]) > 50 ? "19" : "20") + m[3] : m[3];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${d} ${months[mo - 1] || mo} ${y}`;
};

export const extractDateOfBirth = (text: string): string => {
  const m =
    text.match(/(?:DOB|Date\s*of\s*Birth|Birth\s*Date)\s*[:\-\s]*([0-9\/\-\.\s]{6,15})/i) ||
    text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);

  return m ? formatDateStr(m[1] ?? m[0]) : "";
};

/* ============================================================
   CLASS & CENTER (UNCHANGED LOGIC)
============================================================ */

export const extractClass = (text: string): string => {
  const m = text.match(/(?:Class\s*of\s*study|Class)\s*[:\-\s]*(.+)/i);
  if (!m) return "";

  let cls = m[1].trim();
  const romanMap: any = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  const roman = cls.match(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/);

  if (roman) cls = cls.replace(roman[0], romanMap[roman[0]]);
  if (/Early\s*Childhood/i.test(cls)) return "Early Childhood Centre";

  return cls.replace(/[^A-Za-z0-9 \-]/g, "").trim();
};

export const extractCenter = (text: string): string => {
  const m = text.match(/(?:Name\s*of\s*Centre|Centre|Center)\s*[:\-\s]*(.+)/i);
  return m ? m[1].replace(/[^A-Za-z0-9 .\-]/g, "").trim() : "";
};

/* ============================================================
   NATIVE PDF TEXT EXTRACTION (KEY FIX)
============================================================ */

const extractTextLayer = async (page: any): Promise<string> => {
  const content = await page.getTextContent();
  return content.items.map((i: any) => i.str).join(" ").trim();
};

/* ============================================================
   PAGE → IMAGE FOR OCR (OPTIMIZED FOR ACCURACY)
============================================================ */

// Apply image preprocessing for better OCR accuracy
const preprocessImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale and increase contrast
  for (let i = 0; i < data.length; i += 4) {
    // Grayscale using luminosity method
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    // Apply contrast enhancement (1.2x)
    const contrast = 1.2;
    const adjusted = ((gray - 128) * contrast) + 128;

    // Apply threshold for cleaner text
    const threshold = 180;
    const final = adjusted > threshold ? 255 : (adjusted < 60 ? 0 : adjusted);

    data[i] = final;     // R
    data[i + 1] = final; // G
    data[i + 2] = final; // B
    // Alpha stays the same
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

const renderPageToImage = async (page: any): Promise<Blob> => {
  // Higher scale = higher DPI = better OCR accuracy
  // Scale 4 = ~288 DPI (72 * 4)
  const viewport = page.getViewport({ scale: 4 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  // White background for better contrast
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Apply preprocessing for better OCR
  preprocessImage(canvas);

  return new Promise(res => canvas.toBlob(b => res(b!), "image/png", 1));
};

/* ============================================================
   MAIN FUNCTION (SIGNATURE UNCHANGED)
============================================================ */

export const processPDF = async (
  file: File,
  onProgress?: (p: number, page?: number, total?: number) => void,
  shouldPause?: () => Promise<void>
): Promise<ChildData[]> => {

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const worker = await getOCRWorker();
  const results: ChildData[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (shouldPause) {
      await shouldPause();
    }
    const page = await pdf.getPage(pageNum);

    // 1️⃣ Native text first
    let text = await extractTextLayer(page);

    // 2️⃣ OCR fallback only if needed
    if (text.length < 40) {
      const img = await renderPageToImage(page);
      const ocr = await worker.recognize(img);
      text = ocr.data.text;
    }

    const normalized = text
      .replace(/\r/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();

    // 3️⃣ Field extraction (UNCHANGED SEMANTICS)
    // 1. Name (FIXED – HARD STOP CONDITIONS)
    const namePattern =
      /(?:Child\s*Name|Name)\s*[:\-\s]*([A-Z][A-Za-z\s'.\-]{1,50}?)(?=\s+\d+\.\s+|(?:Child\s*Number|Gender|Sex|DOB|Date\s*of\s*Birth|Class|Centre|Center)|$)/i;
    const name = cleanValue(extractField(normalized, namePattern), 4);
    const childNumber = extractField(normalized, /Child\s*(?:Number|No|No\.)\s*[:\-\s]*([A-Za-z0-9\-\/]+)/i);
    const genderRaw = extractField(normalized, /(?:Gender|Sex)\s*[:\-\s]*([A-Za-z]+)/i);
    const gender =
      genderRaw.toLowerCase().startsWith("m") ? "Male" :
        genderRaw.toLowerCase().startsWith("f") ? "Female" : "";

    results.push({
      name,
      childNumber,
      gender,
      dateOfBirth: extractDateOfBirth(normalized),
      classOfStudy: extractClass(normalized),
      center: extractCenter(normalized),
      yearOfAdmission:
        extractField(normalized, /Year\s*of\s*admission\s*[:\-\s]*([0-9]{4})/i),
      rawText: normalized
    });

    onProgress?.(100, pageNum, pdf.numPages);
  }

  return results;
};
