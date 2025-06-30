# Product Matching System

A comprehensive three-phase product matching system for invoice processing that ensures reliable matching between product descriptions in purchase invoices and an internal catalog.

## Overview

The Product Matching System implements a hybrid automated + manual validation process to minimize false positives when matching products from invoices to existing catalog items.

## Architecture

### Three-Phase Approach

#### Phase 1: Enhanced Product Matching
- **Purpose**: Improve accuracy of product matching with configurable confidence thresholds
- **Features**:
  - Fuzzy matching with confidence scoring
  - Configurable auto-approval thresholds
  - Manual review for low-confidence matches
  - Alternative product descriptions support

#### Phase 2: New Product Creation Control
- **Purpose**: Control when new products are automatically created vs requiring approval
- **Features**:
  - Configurable approval requirements for new products
  - Manual review workflow for unmatched items
  - Bulk approval capabilities

#### Phase 3: ML-Based Matching (Future)
- **Purpose**: Advanced machine learning for improved matching accuracy
- **Features** (Planned):
  - Neural network-based similarity scoring
  - Learning from manual review decisions
  - Continuous model improvement

## Implementation

### Database Schema Extensions

#### Tenant Model (`/models/Tenant.js`)
```javascript
productMatchingConfig: {
  phase1: {
    enabled: Boolean,
    confidenceThreshold: Number,
    autoApproveAbove: Number,
    requireManualReview: Boolean
  },
  phase2: {
    enabled: Boolean,
    requireApprovalForNew: Boolean,
    autoCreateThreshold: Number
  },
  phase3: {
    enabled: Boolean,
    mlModelVersion: String,
    trainingDataSize: Number
  },
  globalSettings: {
    enableAlternativeDescriptions: Boolean,
    maxAlternativeDescriptions: Number,
    confidenceDecayFactor: Number
  }
}
```

#### Product Model (`/models/Product.js`)
```javascript
descriptions: [{
  text: String,
  normalizedText: String,
  source: String,
  frequency: Number,
  lastSeen: Date,
  addedBy: ObjectId,
  confidence: Number
}]
```

#### Invoice Model (`/models/Invoice.js`)
```javascript
lineItems: [{
  // ... existing fields
  productMatchingStatus: String,
  matchConfidence: Number,
  matchedProductId: ObjectId,
  matchingMethod: String,
  reviewedBy: ObjectId,
  reviewedAt: Date,
  reviewNotes: String,
  alternativeMatches: [ObjectId],
  normalizedDescription: String,
  matchingMetadata: Object
}]
```

### Core Components

#### ProductMatchingService (`/services/productMatchingService.js`)
Central service handling:
- Product similarity search with fuzzy matching
- Confidence scoring and method determination
- Status determination based on tenant configuration
- Alternative description management
- Matching statistics

#### Controllers

1. **TenantConfigController** (`/controllers/tenantConfigController.js`)
   - Manage tenant-specific matching configurations
   - Phase toggling with dependency validation
   - Configuration reset and statistics

2. **ManualReviewController** (`/controllers/manualReviewController.js`)
   - Handle manual review workflows
   - Approve/reject product matches
   - Create new products from unmatched items
   - Search similar products for review assistance

3. **InvoiceController** (Modified)
   - Integrated with ProductMatchingService
   - Applies tenant configuration during import
   - Handles different matching statuses

#### Middleware (`/middleware/tenantConfig.js`)
- Load tenant configuration
- Validate phase requirements
- Enforce admin permissions
- Utility functions for configuration access

### API Endpoints

#### Configuration Management
```
GET    /api/product-matching/config
PUT    /api/product-matching/config/phase/:phaseNumber
POST   /api/product-matching/config/phase/:phaseNumber/toggle
GET    /api/product-matching/config/stats
POST   /api/product-matching/config/reset
```

#### Manual Review
```
GET    /api/product-matching/reviews/pending
GET    /api/product-matching/reviews/unmatched
POST   /api/product-matching/reviews/:reviewId/approve
POST   /api/product-matching/reviews/:reviewId/reject
POST   /api/product-matching/reviews/:reviewId/create-product
GET    /api/product-matching/search/similar
GET    /api/product-matching/reviews/stats
```

## Configuration

### Default Settings

tenant.productMatchingConfig = {
        phase1: { enabled: true, confidenceThreshold: 0.7, autoApproveAbove: 0.9, requireManualReview: false },
        phase2: { enabled: true, handleUnmatched: true, createNewProducts: true, requireApprovalForNew: false },
        phase3: { enabled: false, analyticsLevel: 'basic', mlOptimization: false, continuousLearning: false, performanceTracking: true },
        globalSettings: {
          maxPendingReviews: 100,
          notificationThresholds: { pendingReviews: 50, lowConfidenceMatches: 20, unmatchedProducts: 30 },
          autoCleanupDays: 30
        }
      };


### Phase Dependencies

- **Phase 2** requires **Phase 1** to be enabled
- **Phase 3** requires both **Phase 1** and **Phase 2** to be enabled
- Disabling a phase automatically disables dependent phases

## Workflow

### Invoice Processing Flow

1. **Invoice Upload**: XML invoice is processed
2. **Product Matching**: Each line item goes through matching process
3. **Status Determination**: Based on tenant configuration and match confidence
4. **Action Execution**:
   - **Auto-approved**: Product price updated immediately
   - **Pending Review**: Added to manual review queue
   - **Auto-create**: New product created automatically

### Manual Review Flow

1. **Review Queue**: Items requiring manual review are queued
2. **Review Interface**: Admin reviews suggested matches
3. **Decision**: Approve, reject, or create new product
4. **Learning**: System learns from manual decisions (Phase 3)

## Matching Algorithms

### Fuzzy Matching
- Uses `fuzzysort` library for text similarity
- Searches main description and alternative descriptions
- Normalizes text for better matching
- Confidence scoring based on similarity score

### Confidence Levels
- **Exact Match** (0.95+): Identical normalized descriptions
- **High Fuzzy** (0.8-0.94): Very similar descriptions
- **Medium Fuzzy** (0.6-0.79): Moderately similar
- **Low Fuzzy** (0.4-0.59): Somewhat similar
- **Very Low Fuzzy** (<0.4): Poor similarity

## Security & Permissions

### Role-Based Access
- **Tenant Admin**: Full configuration and review access
- **Regular User**: Read-only access to configurations
- **Reviewer**: Manual review capabilities (if assigned)

### Data Protection
- All operations scoped to tenant
- Audit trail for configuration changes
- Review history tracking

## Performance Considerations

### Optimization Strategies
- Text indexing on normalized descriptions
- Caching of frequently matched products
- Batch processing for large invoice imports
- Lazy loading of alternative descriptions

### Scalability
- Horizontal scaling through tenant isolation
- Database indexing on key fields
- Async processing for non-critical operations

## Monitoring & Analytics

### Key Metrics
- Match confidence distribution
- Manual review queue size
- Auto-approval rates
- False positive/negative rates
- Processing time per invoice

### Reporting
- Phase effectiveness reports
- Matching accuracy trends
- User productivity metrics
- System performance dashboards

## Future Enhancements

### Phase 3 Implementation
- Neural network training pipeline
- Feature extraction from product descriptions
- Continuous learning from user feedback
- A/B testing for algorithm improvements

### Additional Features
- Bulk import/export of product mappings
- Integration with external product databases
- Advanced search and filtering
- Mobile-friendly review interface

## Troubleshooting

### Common Issues

1. **Low Match Confidence**
   - Check description normalization
   - Add alternative descriptions
   - Adjust confidence thresholds

2. **Too Many Manual Reviews**
   - Lower confidence threshold
   - Enable auto-approval for higher confidence
   - Train users on description standardization

3. **Performance Issues**
   - Check database indexes
   - Monitor fuzzy search performance
   - Consider caching strategies

### Debug Tools
- Matching confidence analysis
- Description similarity testing
- Configuration validation
- Performance profiling

## Development

### Testing Strategy
- Unit tests for matching algorithms
- Integration tests for workflow
- Performance tests for large datasets
- User acceptance testing for UI

### Code Organization
- Service layer for business logic
- Controller layer for API endpoints
- Middleware for cross-cutting concerns
- Model layer for data persistence

This system provides a robust, configurable solution for product matching that can evolve with business needs while maintaining high accuracy and user control.