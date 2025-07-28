import path from 'path';
import logger from '../../utils/logger.js';
import { parseXmlInvoice } from './importazione_xml.js';
import { extractXmlFromP7M } from './importazione_p7m.js';
import { parsePdfInvoice } from './importazione_pdf.js';
import { extractZipFiles } from './estrattore_zip.js';

const getFileType = (filename, mimetype) => {
  const ext = path.extname(filename).toLowerCase();
  
  if (ext === '.p7m' || mimetype === 'application/pkcs7-mime') return 'p7m';
  if (ext === '.xml' || mimetype === 'application/xml' || mimetype === 'text/xml') return 'xml';
  if (ext === '.pdf' || mimetype === 'application/pdf') return 'pdf';
  if (ext === '.zip' || mimetype === 'application/zip') return 'zip';
  
  return 'unknown';
};

export const processFiles = async (files) => {
  const results = [];
  
  for (const file of files) {
    const result = await processFile(file);
    results.push(result);
  }
  
  return results;
};

export const processFile = async (file) => {
  const { originalname: filename, buffer, mimetype } = file;
  const fileType = getFileType(filename, mimetype);
  
  logger.info('Processamento file', { filename, fileType, size: buffer.length });
  
  const baseResult = {
    filename,
    type: fileType,
    success: false,
    error: null,
    result: null
  };
  
  try {
    switch (fileType) {
      case 'xml':
        const xmlResult = await parseXmlInvoice(buffer.toString('utf8'));
        return {
          ...baseResult,
          success: xmlResult.success,
          error: xmlResult.error,
          result: xmlResult.data
        };
        
      case 'p7m':
        const p7mResult = await extractXmlFromP7M(buffer);
        return {
          ...baseResult,
          success: p7mResult.success,
          error: p7mResult.error,
          result: p7mResult.data
        };
        
      case 'pdf':
        const pdfResult = await parsePdfInvoice(buffer);
        return {
          ...baseResult,
          success: pdfResult.success,
          error: pdfResult.error,
          result: pdfResult  // ✅ Rimuovi .data - parsePdfInvoice restituisce già l'oggetto completo
        };
        
      case 'zip':
        const zipResult = await extractZipFiles(buffer);
        if (zipResult.success) {
          // Processo ricorsivo sui file estratti
          const extractedResults = await processFiles(zipResult.files);
          return {
            ...baseResult,
            type: 'zip',
            success: true,
            result: {
              extractedFiles: extractedResults,
              totalFiles: zipResult.files.length
            }
          };
        } else {
          return {
            ...baseResult,
            error: zipResult.error
          };
        };
        
      default:
        return {
          ...baseResult,
          error: `Tipo file non supportato: ${fileType}`
        };
    }
  } catch (error) {
    logger.error('Errore processamento file', { filename, error: error.message });
    return {
      ...baseResult,
      error: error.message
    };
  }
};