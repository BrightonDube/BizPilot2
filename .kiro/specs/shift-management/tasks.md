# Implementation Tasks: Shift Management

## Task 1: PIN Service
- [x] 1.1 Create PinService class
- [x] 1.2 Implement PIN hashing (bcrypt)
- [x] 1.3 Implement PIN verification
- [x] 1.4 Add lockout after failed attempts
- [x] 1.5 Implement manager unlock
- [x] 1.6 Write PBT for PIN security (Property 3)

**Validates: Requirement 1**

## Task 2: Shift Database Schema
- [x] 2.1 Add shifts table to WatermelonDB
- [x] 2.2 Add cash_movements table
- [x] 2.3 Create Shift model
- [x] 2.4 Create CashMovement model
- [x] 2.5 Write database migration

**Validates: Requirements 2, 3**

## Task 3: Shift Service
- [x] 3.1 Create ShiftService class
- [x] 3.2 Implement openShift method
- [x] 3.3 Implement closeShift method
- [x] 3.4 Implement getActiveShift
- [x] 3.5 Write PBT for single active shift (Property 2)

**Validates: Requirements 2, 4**

## Task 4: Cash Movement Operations
- [x] 4.1 Implement recordCashDrop
- [x] 4.2 Implement recordPaidOut
- [x] 4.3 Implement recordPayIn
- [x] 4.4 Create cash movement UI

**Validates: Requirement 3**

## Task 5: Expected Cash Calculation
- [x] 5.1 Implement calculateExpectedCash
- [x] 5.2 Track cash sales in shift
- [x] 5.3 Track cash refunds in shift
- [x] 5.4 Write PBT for expected cash (Property 1)

**Validates: Requirement 4**

## Task 6: Shift UI Components
- [x] 6.1 Create PIN entry screen
- [x] 6.2 Create shift open modal
- [x] 6.3 Create shift close modal
- [x] 6.4 Create cash count entry
- [x] 6.5 Create variance display

**Validates: Requirements 1, 2, 4**

## Task 7: Cash Drawer Integration
- [x] 7.1 Implement drawer kick command
- [x] 7.2 Log drawer opens
- [x] 7.3 Add manual drawer open button

**Validates: Requirement 5**

## Task 8: Float Management
- [x] 8.1 Configure standard float amount
- [x] 8.2 Implement float carry-over option
- [x] 8.3 Add float alerts

**Validates: Requirement 6**

## Task 9: End of Day
- [x] 9.1 Create EOD summary view
- [x] 9.2 Aggregate all shifts for day
- [x] 9.3 Calculate total variance
- [x] 9.4 Generate EOD report

**Validates: Requirement 7**

## Task 10: Shift Reports
- [x] 10.1 Create shift summary report
- [x] 10.2 Report by operator
- [x] 10.3 Report variances
- [x] 10.4 Add export functionality

**Validates: Requirement 8**

## Task 11: Multi-User Support
- [x] 11.1 Implement user switching
- [x] 11.2 Track sales per user
- [ ] 11.3 Maintain shift continuity

**Validates: Requirement 9**

## Task 12: Permissions
- [ ] 12.1 Add shift permissions to roles
- [ ] 12.2 Enforce permission checks
- [ ] 12.3 Log permission overrides

**Validates: Requirement 10**
