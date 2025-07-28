import AdmZip from 'adm-zip';
import logger from '../../utils/logger.js';

export const extractZipFiles = async (zipBuffer) => {
  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    
    const extractedFiles = [];
    
    entries.forEach(entry => {
      if (!entry.isDirectory) {
        extractedFiles.push({
          filename: entry.entryName,
          buffer: entry.getData(),
          size: entry.header.size
        });
      }
    });
    
    return {
      success: true,
      files: extractedFiles
    };
  } catch (error) {
    logger.error('Errore estrazione ZIP', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
};