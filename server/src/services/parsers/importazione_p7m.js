import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';
import { parseXmlInvoice } from './importazione_xml.js';

const execAsync = promisify(exec);

export const extractXmlFromP7M = async (p7mBuffer) => {
  const tempDir = '/tmp';
  const tempId = uuidv4();
  const p7mPath = path.join(tempDir, `${tempId}.p7m`);
  const xmlPath = path.join(tempDir, `${tempId}.xml`);
  
  try {
    // Scrivi buffer su file temporaneo
    await fs.writeFile(p7mPath, p7mBuffer);
    
    // Estrai XML con OpenSSL
    const command = `openssl smime -verify -inform DER -in "${p7mPath}" -noverify -out "${xmlPath}"`;
    await execAsync(command);
    
    // Leggi XML estratto
    const xmlContent = await fs.readFile(xmlPath, 'utf8');
    
    // Pulisci file temporanei
    await Promise.all([
      fs.unlink(p7mPath).catch(() => {}),
      fs.unlink(xmlPath).catch(() => {})
    ]);
    
    // Parsa XML estratto
    return await parseXmlInvoice(xmlContent);
    
  } catch (error) {
    // Pulisci file temporanei anche in caso di errore
    await Promise.all([
      fs.unlink(p7mPath).catch(() => {}),
      fs.unlink(xmlPath).catch(() => {})
    ]);
    
    logger.error('Errore estrazione P7M', { error: error.message });
    return {
      success: false,
      error: `Errore estrazione P7M: ${error.message}`,
      type: 'p7m'
    };
  }
};