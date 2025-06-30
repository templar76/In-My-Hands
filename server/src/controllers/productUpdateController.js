import mongoose from 'mongoose';
import Product from '../models/Product.js';
import alertMonitoringService from '../services/alertMonitoringService.js';

export const updateProductPrice = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { productId, supplierId, price, currency = 'EUR', invoiceId, invoiceDate } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'TenantId is required' });
    }

    // Validate required fields
    if (!productId || !supplierId || !price || !invoiceId || !invoiceDate) {
      return res.status(400).json({ 
        error: 'Missing required fields: productId, supplierId, price, invoiceId, invoiceDate' 
      });
    }

    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ error: 'Invalid productId or supplierId format' });
    }

    // Find the product
    const product = await Product.findOne({
      _id: new mongoose.Types.ObjectId(productId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Find or create price entry for this supplier
    let supplierPriceIndex = product.prices.findIndex(
      p => p.supplierId.toString() === supplierId
    );

    const newPriceEntry = {
      price: parseFloat(price),
      currency,
      invoiceId: new mongoose.Types.ObjectId(invoiceId),
      invoiceDate: new Date(invoiceDate),
      createdAt: new Date()
    };

    if (supplierPriceIndex === -1) {
      // Create new supplier price entry
      product.prices.push({
        supplierId: new mongoose.Types.ObjectId(supplierId),
        priceHistory: [newPriceEntry]
      });
    } else {
      // Add to existing supplier's price history
      product.prices[supplierPriceIndex].priceHistory.push(newPriceEntry);
      
      // Keep only last 100 price entries per supplier
      if (product.prices[supplierPriceIndex].priceHistory.length > 100) {
        product.prices[supplierPriceIndex].priceHistory = 
          product.prices[supplierPriceIndex].priceHistory
            .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate))
            .slice(0, 100);
      }
    }

    // Update product timestamp
    product.updatedAt = new Date();

    // Save the product
    await product.save();

    // Check for price alerts after updating the product
    try {
      await alertMonitoringService.checkProductAlerts(productId, tenantId);
    } catch (alertError) {
      console.error('Error checking alerts after price update:', alertError);
      // Don't fail the price update if alert checking fails
    }

    res.json({
      message: 'Product price updated successfully',
      productId,
      supplierId,
      newPrice: newPriceEntry
    });

  } catch (error) {
    console.error('Error updating product price:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};