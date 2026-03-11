/**
 * DOCX parser using mammoth.js to extract raw text.
 */
import mammoth from 'mammoth';

/**
 * Parse a .docx File object into raw text.
 * @param {File} file - The uploaded .docx file
 * @returns {Promise<string>} raw text content
 */
export async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}
