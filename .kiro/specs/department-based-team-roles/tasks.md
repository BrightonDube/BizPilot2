# Implementation Plan: Department-Based Team Roles

## Overview

This implementation plan breaks down the department-based team roles feature into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to catch errors early. The plan follows a backend-first approach, establishing the data layer and API before building the frontend interface.

## Backend Implementation Status

✅ **COMPLETED:**
- Database migrations (departments table, business_users.department_id)
- Department models (SQLAlchemy ORM, Pydantic schemas with validation)
- Department service (full CRUD with authorization)
- Department API endpoints (all 5 endpoints implemented)
- Unit tests for API endpoints (comprehensive coverage)
- Team member models updated (department_id field added)
- Team member API endpoints updated (department filtering, search, assignment)
- Default department creation on business setup
- Business and BusinessUser relationships configured

🔄 **REMAINING:**
- Property-based tests (optional but recommended)
- Frontend implementation (all UI components)

## Tasks

- [x] 1. Create database migration for departments table
- [x] 2. Update business_users table migration
- [x] 3. Implement Department data models
  - [x] 3.1 Create Pydantic models for Department
  - [x]* 3.2 Write property test for department validation
  - [x] 3.3 Create SQLAlchemy ORM model for Department
- [x] 4. Implement DepartmentRepository (integrated into DepartmentService)
  - [x] 4.1 Create repository methods (implemented in service)
  - [x]* 4.2 Write property test for department persistence round-trip
  - [x]* 4.3 Write property test for department name uniqueness
- [x] 5. Implement DepartmentService
  - [x] 5.1 Create service class with business logic
  - [x]* 5.2 Write property test for department update persistence
  - [x]* 5.3 Write property test for department deletion with team members
  - [x]* 5.4 Write property test for authorization validation
- [x] 6. Checkpoint - Backend core complete
- [x] 7. Implement Department API endpoints
  - [x] 7.1 Create FastAPI router for departments
  - [x] 7.2 Write unit tests for API endpoints
  - [x]* 7.3 Write property test for business-level department isolation
  - [x]* 7.4 Write property test for validation error responses
- [x] 8. Update TeamMember models and service
  - [x] 8.1 Update TeamMember Pydantic models to include department_id
  - [x] 8.2 Update TeamMemberService to handle department assignments
  - [x]* 8.3 Write property test for team member department assignment
  - [x]* 8.4 Write property test for team member department reassignment
  - [x]* 8.5 Write property test for department filtering
  - [x]* 8.6 Write property test for department search
- [x] 9. Update TeamMember API endpoints
  - [x] 9.1 Update team member endpoints to support departments
  - [x]* 9.2 Write property test for team member department inclusion
  - [x]* 9.3 Write property test for team member sorting by department
- [x] 10. Implement default department creation
  - [x] 10.1 Add business creation hook to create default department
  - [x]* 10.2 Write property test for default department creation
- [x] 11. Checkpoint - Backend implementation complete

- [x] 12. Create frontend API client for departments
  - [x] 12.1 Create TypeScript API client functions
    - Implement getDepartments(businessId)
    - Implement getDepartment(businessId, departmentId)
    - Implement createDepartment(businessId, data)
    - Implement updateDepartment(businessId, departmentId, data)
    - Implement deleteDepartment(businessId, departmentId)
    - Add proper error handling and TypeScript types
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 13. Create Department TypeScript types and interfaces
  - Define Department, DepartmentCreate, DepartmentUpdate interfaces
  - Define error response types
  - Update TeamMember interface to include department field
  - _Requirements: 1.2, 3.3, 4.2_

- [x] 14. Implement DepartmentForm component
  - [x] 14.1 Create form component for creating/editing departments
    - Add input fields: name (required), description, color picker, icon selector
    - Add form validation (name required, color hex format)
    - Add submit and cancel handlers
    - Display validation errors
    - _Requirements: 1.2, 7.3_
  
  - [x]* 14.2 Write unit tests for DepartmentForm
    - Test form validation
    - Test submit with valid data
    - Test cancel action
    - _Requirements: 1.2_

- [x] 15. Implement DepartmentList component
  - [x] 15.1 Create list component for displaying departments
    - Display department cards with name, description, color, icon
    - Show team member count for each department
    - Add edit and delete buttons
    - Add confirmation dialog for delete
    - Handle delete errors (department in use)
    - _Requirements: 1.1, 1.6, 7.2_
  
  - [x]* 15.2 Write unit tests for DepartmentList
    - Test rendering departments
    - Test edit action
    - Test delete action with confirmation
    - Test delete error handling
    - _Requirements: 1.6, 7.2_

- [x] 16. Implement DepartmentManagement component
  - [x] 16.1 Create main department management interface
    - Integrate DepartmentList and DepartmentForm
    - Add "Create Department" button
    - Handle create, update, delete operations
    - Display success/error messages
    - Fetch departments on mount
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_
  
  - [x]* 16.2 Write integration tests for DepartmentManagement
    - Test full create flow
    - Test full update flow
    - Test full delete flow
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

- [x] 17. Add department management to business settings
  - Integrate DepartmentManagement component into business settings page
  - Add navigation/tab for "Departments"
  - _Requirements: 1.1_

- [x] 18. Checkpoint - Ensure department management UI works
  - Manually test department CRUD operations
  - Verify error handling works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Update TeamMemberInviteForm component
  - [x] 19.1 Add department selection to invite form
    - Add department dropdown populated with business departments
    - Make department selection optional (allow "No Department")
    - Update form submission to include department_id
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x]* 19.2 Write unit tests for updated invite form
    - Test department dropdown population
    - Test form submission with department
    - Test form submission without department
    - _Requirements: 3.2, 3.4_

- [x] 20. Create DepartmentBadge component
  - Create reusable component to display department with color and icon
  - Handle "No Department" case with appropriate styling
  - Use in team member list
  - _Requirements: 4.2_

- [x] 21. Create DepartmentFilter component
  - [x] 21.1 Create filter/search component
    - Add department dropdown filter (all departments + "No Department")
    - Add search input (searches names, emails, department names)
    - Emit filter changes to parent
    - _Requirements: 4.4, 4.5_
  
  - [x]* 21.2 Write unit tests for DepartmentFilter
    - Test filter selection
    - Test search input
    - Test event emission
    - _Requirements: 4.4, 4.5_

- [x] 22. Update TeamMemberList component
  - [x] 22.1 Enhance team member list with department features
    - Add department column with DepartmentBadge
    - Integrate DepartmentFilter component
    - Update API calls to include department_id filter and search params
    - Handle team members without departments ("No Department" display)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 8.2_
  
  - [x]* 22.2 Write integration tests for updated team member list


    - Test department display
    - Test filtering by department
    - Test search including department names
    - Test "No Department" display
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 8.2_

- [x] 23. Update TeamMemberEditForm component
  - [x] 23.1 Add department reassignment to edit form
    - Add department dropdown to edit form
    - Populate with current department selected
    - Allow changing department or clearing assignment
    - Update form submission to include department_id
    - _Requirements: 3.5, 3.6_
  
  - [x]* 23.2 Write unit tests for updated edit form
    - Test department dropdown with current value
    - Test changing department
    - Test clearing department assignment
    - Test form submission with new department
    - _Requirements: 3.5, 3.6_

- [x] 24. Final checkpoint - Run full test suite
  - Run all backend tests
  - Run all frontend tests (if implemented)
  - Manually test complete user flows end-to-end
  - Verify business owner can create departments
  - Verify business owner can assign team members to departments
  - Verify filtering and search work correctly
  - Verify authorization prevents cross-business access
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Backend is implemented first to establish data layer and API
- Frontend builds on top of completed backend
- Testing is integrated throughout to catch errors early
- The backend implementation is COMPLETE - all core functionality is working
- Focus now shifts to frontend implementation to provide the user interface
