import mongoose from 'mongoose';
import Product from '../models/Product.js';
import logger from '../utils/logger.js';

const tenantObjectId = (req) => new mongoose.Types.ObjectId(req.user.tenantId);

/**
 * GET /api/products/duplicates
 * Ritorna gruppi di prodotti potenzialmente duplicati basati su descriptionStandard.
 */
export const getDuplicateGroups = async (req, res) => {
  try {
    const { tenantId } = req.user;
    logger.info('Recupero gruppi duplicati', { tenantId });
    
    // Raggruppa per descriptionStd e include solo gruppi con più di un elemento e non ignorati
    const rawGroups = await Product.aggregate([
      { $match: { tenantId: tenantObjectId(req), ignoredDuplicate: { $ne: true } } },
      {
        $group: {
          _id: '$descriptionStd',
          count: { $sum: 1 },
          products: { $push: '$$ROOT' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).exec();

    const groups = rawGroups.map(g => ({
      groupId: g._id,
      products: g.products
    }));

    logger.info('Gruppi duplicati recuperati', { 
      tenantId, 
      groupsCount: groups.length,
      totalDuplicates: groups.reduce((sum, g) => sum + g.products.length, 0)
    });
    return res.json({ groups });
  } catch (err) {
    logger.error('getDuplicateGroups error', {
      tenantId: req.user?.tenantId,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Errore nel recupero dei gruppi duplicati' });
  }
};

/**
 * POST /api/products/duplicates/:groupId/merge
 * Unisce un gruppo selezionando un prodotto primario e rimuovendo gli altri.
 */
export const mergeGroup = async (req, res) => {
  const { groupId } = req.params;
  const { primaryProductId } = req.body;
  const { tenantId } = req.user;
  
  if (!mongoose.Types.ObjectId.isValid(primaryProductId)) {
    return res.status(400).json({ error: 'primaryProductId non valido' });
  }
  
  try {
    logger.info('Inizio merge gruppo duplicati', { 
      tenantId, 
      groupId, 
      primaryProductId 
    });
    
    // Recupera tutti i prodotti con la stessa descriptionStd
    const duplicates = await Product.find({ tenantId: req.user.tenantId, descriptionStd: groupId });
    if (duplicates.length < 2) {
      return res.status(400).json({ error: 'Nessun duplicato da unire' });
    }
    
    // Elimina tutti tranne quello primario
    const toRemove = duplicates.filter(p => p._id.toString() !== primaryProductId);
    await Product.deleteMany({ tenantId: req.user.tenantId, _id: { $in: toRemove.map(p => p._id) } });
    
    logger.info('Merge gruppo completato', {
      tenantId,
      groupId,
      primaryProductId,
      removedCount: toRemove.length
    });
    return res.json({ message: 'Prodotti duplicati uniti correttamente' });
  } catch (err) {
    logger.error('mergeGroup error', {
      tenantId,
      groupId,
      primaryProductId,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Errore durante l\'unione dei prodotti duplicati' });
  }
};

/**
 * POST /api/products/duplicates/:groupId/ignore
 * Ignora un gruppo di duplicati in futuro.
 */
export const ignoreGroup = async (req, res) => {
  const { groupId } = req.params;
  const { tenantId } = req.user;
  
  try {
    logger.info('Inizio ignore gruppo duplicati', { tenantId, groupId });
    
    // Marca tutti i prodotti di questo gruppo come ignorati
    const result = await Product.updateMany(
      { tenantId: req.user.tenantId, descriptionStd: groupId },
      { $set: { ignoredDuplicate: true } }
    );
    
    logger.info('Gruppo duplicati ignorato', {
      tenantId,
      groupId,
      modifiedCount: result.modifiedCount
    });
    return res.json({ message: 'Gruppo duplicati ignorato correttamente' });
  } catch (err) {
    logger.error('ignoreGroup error', {
      tenantId,
      groupId,
      error: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Errore durante l\'ignoramento del gruppo duplicati' });
  }
};
