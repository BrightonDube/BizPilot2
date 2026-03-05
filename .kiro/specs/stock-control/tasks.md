# Implementation Tasks: Stock Control

## Task 1: Stock Movement Schema
- [ ] 1.1 Add stock_movements table to WatermelonDB
- [ ] 1.2 Create StockMovement model
- [ ] 1.3 Add stock_quantity to products table
- [ ] 1.4 Write database migration

**Validates: Requirements 1, 4**

## Task 2: Inventory Service
- [ ] 2.1 Create InventoryService class
- [ ] 2.2 Implement getStockLevel
- [ ] 2.3 Implement adjustStock
- [ ] 2.4 Implement recordSale/recordRefund
- [ ] 2.5 Write PBT for stock balance (Property 1)

**Validates: Requirement 1**

## Task 3: SKU Management
- [ ] 3.1 Add SKU field to products
- [ ] 3.2 Implement SKU auto-generation
- [ ] 3.3 Enforce unique SKU constraint
- [ ] 3.4 Add SKU search functionality

**Validates: Requirement 2**

## Task 4: Barcode Scanning
- [ ] 4.1 Install expo-barcode-scanner
- [ ] 4.2 Create BarcodeService class
- [ ] 4.3 Create barcode scanner component
- [ ] 4.4 Implement product lookup by barcode
- [ ] 4.5 Support external scanner input

**Validates: Requirement 3**

## Task 5: Stock Adjustments
- [ ] 5.1 Create adjustment UI
- [ ] 5.2 Implement positive/negative adjustments
- [ ] 5.3 Require adjustment reason
- [ ] 5.4 Add bulk adjustment support
- [ ] 5.5 Write PBT for audit trail (Property 2)

**Validates: Requirement 4**

## Task 6: Stock Receiving
- [ ] 6.1 Create receiving UI
- [ ] 6.2 Implement receive without PO
- [ ] 6.3 Record supplier and cost
- [ ] 6.4 Update stock on receive

**Validates: Requirement 5**

## Task 7: Waste Reporting
- [ ] 7.1 Create waste entry UI
- [ ] 7.2 Implement waste categories
- [ ] 7.3 Deduct stock on waste
- [ ] 7.4 Create waste reports

**Validates: Requirement 6**

## Task 8: Stock Alerts
- [ ] 8.1 Implement reorder point alerts
- [ ] 8.2 Implement zero stock alerts
- [ ] 8.3 Write PBT for negative stock alert (Property 3)
- [ ] 8.4 Add push notifications
- [ ] 8.5 Show alerts on dashboard

**Validates: Requirement 7**

## Task 9: Stock Reports
- [ ] 9.1 Create stock level report
- [ ] 9.2 Create stock value report
- [ ] 9.3 Create movement history report
- [ ] 9.4 Add export functionality

**Validates: Requirement 8**

## Task 10: Stock Take
- [ ] 10.1 Create StockTakeService
- [ ] 10.2 Create stock take UI
- [ ] 10.3 Implement count entry
- [ ] 10.4 Calculate variances
- [ ] 10.5 Implement approval workflow
- [ ] 10.6 Adjust stock after approval

**Validates: Requirement 9**

## Task 11: Inventory Valuation
- [ ] 11.1 Calculate stock value at cost
- [ ] 11.2 Calculate stock value at retail
- [ ] 11.3 Implement average cost tracking
- [ ] 11.4 Create valuation report

**Validates: Requirement 10**

## Task 12: POS Integration
- [x] 12.1 Show stock level on POS
- [x] 12.2 Update stock on sale
- [x] 12.3 Update stock on refund
- [x] 12.4 Warn on low stock

**Validates: Requirement 1**

---

## AI Integration Tasks (Optional - Ship Core First)

### Task 13: Stock Prophet - Local Cache
- [ ] 13.1 Create ReorderPrediction model in WatermelonDB
- [ ] 13.2 Create StockProphet service class
- [ ] 13.3 Implement loadCachedPredictions method
- [ ] 13.4 Implement getPredictions method
- [ ] 13.5 Implement getReorderAlerts method
- [ ] 13.6 Write unit tests for prediction logic

**Validates: Requirement 11 (AI)**

### Task 14: Draft Purchase Order Creation
- [ ] 14.1 Create DraftPurchaseOrder model
- [ ] 14.2 Implement createDraftPO method
- [ ] 14.3 Add requiresApproval flag enforcement
- [ ] 14.4 Create approval workflow UI
- [ ] 14.5 Write PBT for draft-only creation (Property 4)
- [ ] 14.6 Write PBT for no auto-submission (Property 5)

**Validates: Requirement 11.5, 11.6 (AI)**

### Task 15: Reorder Alerts UI
- [ ] 15.1 Create ReorderAlertsScreen
- [ ] 15.2 Display products needing reorder
- [ ] 15.3 Show AI reasoning for each suggestion
- [ ] 15.4 Add "Create Draft PO" action
- [ ] 15.5 Add "Dismiss" action
- [ ] 15.6 Show confidence scores

**Validates: Requirement 11.4 (AI)**

### Task 16: Backend - Prediction Generator
- [ ] 16.1 Create Supabase Edge Function
- [ ] 16.2 Implement fetchSalesHistory query
- [ ] 16.3 Implement calculateSalesVelocity
- [ ] 16.4 Integrate Weather API (optional)
- [ ] 16.5 Integrate GPT-4o-mini API
- [ ] 16.6 Implement storePredictions
- [ ] 16.7 Add error handling and logging

**Validates: Requirement 11.1, 11.2, 11.3 (AI)**

### Task 17: Weekly Prediction Job
- [ ] 17.1 Create scheduled job (once per week)
- [ ] 17.2 Trigger prediction generation for each business
- [ ] 17.3 Sync updated predictions to mobile clients
- [ ] 17.4 Implement updatePredictions in StockProphet
- [ ] 17.5 Write PBT for offline fallback (Property 6)

**Validates: Requirement 11.8, 11.9 (AI)**

### Task 18: AI Guardrails and Safety
- [ ] 18.1 Verify read-only constraint (no auto-submit)
- [ ] 18.2 Implement PII redaction in data pipeline
- [ ] 18.3 Add subscription tier check
- [ ] 18.4 Implement deterministic fallback formula
- [ ] 18.5 Add manager approval enforcement

**Validates: Requirement 11.10, AI Constraints (AI)**

### Task 19: Stockout Learning
- [ ] 19.1 Track stockout events
- [ ] 19.2 Feed stockout data to prediction model
- [ ] 19.3 Adjust safety stock based on history
- [ ] 19.4 Create stockout prevention report

**Validates: Requirement 11.7 (AI)**

### Task 20: Cost Monitoring
- [ ] 20.1 Track AI API usage
- [ ] 20.2 Calculate cost per prediction
- [ ] 20.3 Create cost dashboard
- [ ] 20.4 Add budget alerts

**Validates: AI Cost Control**
