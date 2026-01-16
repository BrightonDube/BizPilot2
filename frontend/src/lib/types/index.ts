/**
 * Central export for all TypeScript types.
 * 
 * Import types from this file for cleaner imports:
 * import { Department, TeamMember } from '@/lib/types';
 */

// Department types
export type {
  Department,
  DepartmentCreate,
  DepartmentUpdate,
  DepartmentListResponse,
  DepartmentApiError,
  DepartmentValidationError,
  DepartmentSummary,
  DepartmentAssignment,
  DepartmentErrorCode,
} from './department';

export { DepartmentErrorCodes } from './department';

// Team member types
export type {
  TeamMember,
  TeamMemberStatus,
  TeamMemberInvite,
  TeamMemberUpdate,
  TeamMemberListResponse,
  TeamMemberQueryParams,
  TeamMemberWithUser,
  BulkDepartmentAssignment,
} from './team-member';
