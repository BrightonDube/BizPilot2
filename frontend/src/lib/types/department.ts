/**
 * Department TypeScript types and interfaces.
 * 
 * These types match the backend Pydantic schemas in backend/app/schemas/department.py
 * and are used throughout the frontend for department management.
 * 
 * Requirements: 1.2, 3.3, 4.2
 */

/**
 * Department entity representing an organizational unit within a business.
 * Matches backend DepartmentResponse schema.
 * 
 * Requirement 4.2: Display department name, color, and icon for each team member
 */
export interface Department {
  /** Unique identifier (UUID) */
  id: string;
  /** Business this department belongs to (UUID) */
  business_id: string;
  /** Department name (1-100 characters, unique within business) */
  name: string;
  /** Optional description of the department */
  description: string | null;
  /** Optional hex color code (e.g., #FF5733) */
  color: string | null;
  /** Optional icon identifier (e.g., 'users', 'chart-bar') */
  icon: string | null;
  /** Number of team members assigned to this department */
  team_member_count: number;
  /** ISO timestamp of creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
}

/**
 * Data required to create a new department.
 * Matches backend DepartmentCreate schema.
 * 
 * Requirement 1.2: Require department name, allow optional description, color, and icon
 */
export interface DepartmentCreate {
  /** Department name (required, 1-100 characters) */
  name: string;
  /** Optional description */
  description?: string | null;
  /** Optional hex color code (e.g., #FF5733) */
  color?: string | null;
  /** Optional icon identifier */
  icon?: string | null;
}

/**
 * Data for updating an existing department.
 * All fields are optional - only provided fields will be updated.
 * Matches backend DepartmentUpdate schema.
 */
export interface DepartmentUpdate {
  /** Updated department name (1-100 characters) */
  name?: string;
  /** Updated description */
  description?: string | null;
  /** Updated hex color code (e.g., #FF5733) */
  color?: string | null;
  /** Updated icon identifier */
  icon?: string | null;
}

/**
 * Response structure for department list endpoint.
 */
export interface DepartmentListResponse {
  departments: Department[];
}

/**
 * Error response structure from the department API.
 */
export interface DepartmentApiError {
  /** Human-readable error message */
  detail: string;
  /** Optional error code for programmatic handling */
  code?: string;
  /** Optional field-specific validation errors */
  field_errors?: Record<string, string[]>;
}

/**
 * Validation error response for department operations.
 * Used when field validation fails (e.g., invalid color format, name too long).
 */
export interface DepartmentValidationError {
  /** HTTP status code (typically 400 or 422) */
  status: number;
  /** Error message */
  message: string;
  /** Field-specific errors */
  errors: {
    field: string;
    message: string;
  }[];
}

/**
 * Error codes for department operations.
 * These match the backend error codes for consistent error handling.
 */
export const DepartmentErrorCodes = {
  /** Department name already exists in this business */
  DUPLICATE_NAME: 'DUPLICATE_DEPARTMENT_NAME',
  /** Department not found */
  NOT_FOUND: 'DEPARTMENT_NOT_FOUND',
  /** Cannot delete department with assigned team members */
  IN_USE: 'DEPARTMENT_IN_USE',
  /** User not authorized to manage departments */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Invalid field value */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type DepartmentErrorCode = typeof DepartmentErrorCodes[keyof typeof DepartmentErrorCodes];

/**
 * Summary of a department for display in dropdowns and badges.
 * Lighter weight than full Department for list views.
 */
export interface DepartmentSummary {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

/**
 * Department assignment for a team member.
 * Used when displaying department info alongside team member data.
 * 
 * Requirement 3.3: Link team member to department during invitation
 */
export interface DepartmentAssignment {
  /** Department ID (UUID) or null if no department assigned */
  department_id: string | null;
  /** Full department details when joined, null if no department */
  department: DepartmentSummary | null;
}
