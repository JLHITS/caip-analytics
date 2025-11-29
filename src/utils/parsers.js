import Papa from 'papaparse';
import { getDocument } from 'pdfjs-dist';

// Parse CSV file using PapaP parse library
// Returns promise that resolves to array of row objects
export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err),
    });
  });
};

// Extract text from X-on Surgery Connect PDF telephony reports
// Reads first 3 pages and extracts text using pdfjs-dist
// Returns combined text from all pages for regex extraction
export const extractTextFromPDF = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    if (pdf.numPages === 0) throw new Error("PDF has no pages.");

    const maxPages = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      if (!textContent.items.length) continue;
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += ` --- PAGE ${i} --- \n ${pageText}`;
    }

    if (!fullText.trim()) throw new Error("No text found in PDF (it might be an image scan).");
    return fullText;
  } catch (e) {
    console.error("PDF Parse Error", e);
    throw new Error(`Error reading ${file.name}: ${e.message}`);
  }
};
