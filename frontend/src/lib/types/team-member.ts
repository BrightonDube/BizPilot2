/**
 * Team Member TypeScript types and interfaces.
 * 
 * These types represent team members (business users) and include
 * department assignment fields for the department-based team roles feature.
 * 
 * Requirements: 3.3, 4.2
 */

import type { DepartmentSummary } from './department';

/**
 * Team member status values.
 * Note: Must match backend BusinessUserStatus enum (active, invited, inactive)
 */
export type TeamMemberStatus = 'active' | 'invited' | 'inactive';

/**
 * Team member entity representing a user assigned to a business.
 * Updated to include department assignment per Requirement 3.3.
 * 
 * Requirement 4.2: Display department information for each team member
 */
export interface TeamMember {
  /** Unique identifier for the business-user relationship */
  id: string;
  /** User ID (UUID) */
  user_id: string;
  /** Business ID (UUID) */
  business_id: string;
  /** User's email address */
  email: string;
  /** User's first name */
  first_name?: string;
  /** User's last name */
  last_name?: string;
  /** Role ID (UUID) */
  role_id?: string;
  /** Role name for display */
  role_name?: string;
  /** Member status */
  status: TeamMemberStatus;
  /** Whether this is the primary owner */
  is_primary: boolean;
  /** ISO timestamp of when the member joined */
  created_at?: string;
  /** ISO timestamp of last update */
  updated_at?: string;
  
  // Department fields - Requirement 3.3
  /** Department ID (UUID) or null if no department assigned */
  department_id: string | null;
  /** Department details when joined, null if no department */
  department: DepartmentSummary | null;
}

/**
 * Data required to invite a new team member.
 * Updated to include optional department assignment.
 * 
 * Requirement 3.3: Link team member to department during invitation
 * Requirement 3.4: Department selection required for new invitations
 */
export interface TeamMemberInvite {
  /** Email address to invite */
  email: string;
  /** First name (optional) */
  first_name?: string;
  /** Last name (optional) */
  last_name?: string;
  /** Role ID to assign */
  role_id: string;
  /** Department ID to assign (optional, but recommended) */
  department_id?: string | null;
}

/**
 * Data for updating an existing team member.
 * 
 * Requirement 3.5: Allow changing department assignment
 * Requirement 3.6: Update assignment immediately
 */
export interface TeamMemberUpdate {
  /** Updated role ID */
  role_id?: string;
  /** Updated status */
  status?: TeamMemberStatus;
  /** Updated department ID (null to remove assignment) */
  department_id?: string | null;
}

/**
 * Response structure for team member list endpoint.
 */
export interface TeamMemberListResponse {
  items: TeamMember[];
  total?: number;
  page?: number;
  per_page?: number;
}

/**
 * Query parameters for filtering team members.
 * 
 * Requirement 4.4: Filter to show team members from specific departments
 * Requirement 4.5: Search function that includes department names
 */
export interface TeamMemberQueryParams {
  /** Filter by department ID */
  department_id?: string;
  /** Search term (searches name, email, department name) */
  search?: string;
  /** Filter by status */
  status?: TeamMemberStatus;
  /** Page number for pagination */
  page?: number;
  /** Items per page */
  per_page?: number;
  /** Sort field */
  sort_by?: 'name' | 'email' | 'department' | 'created_at';
  /** Sort direction */
  sort_order?: 'asc' | 'desc';
}

/**
 * Team member with full user details.
 * Used when displaying detailed team member information.
 */
export interface TeamMemberWithUser extends TeamMember {
  /** Full user object when joined */
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

/**
 * Bulk department assignment request.
 * Used for assigning multiple team members to a department at once.
 * 
 * Requirement 8.4: Bulk assignment interface for members without departments
 */
export interface BulkDepartmentAssignment {
  /** Team member IDs to update */
  team_member_ids: string[];
  /** Department ID to assign (null to remove assignment) */
  department_id: string | null;
}
