/**
 * Department API client for department management.
 * 
 * Provides CRUD operations for departments within a business.
 * All endpoints require authentication and business context.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { apiClient } from './api';
import { AxiosError } from 'axios';
import type {
  Department,
  DepartmentCreate,
  DepartmentUpdate,
  DepartmentListResponse,
  DepartmentApiError,
} from './types';

// Re-export types for backward compatibility
export type {
  Department,
  DepartmentCreate,
  DepartmentUpdate,
  DepartmentListResponse,
  DepartmentApiError,
} from './types';

/**
 * Custom error class for department API errors.
 */
export class DepartmentError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'DepartmentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Extract error message from API error response.
 */
function extractErrorMessage(error: AxiosError<DepartmentApiError>): string {
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Handle API errors and throw appropriate DepartmentError.
 */
function handleApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const statusCode = error.response?.status || 500;
    const message = extractErrorMessage(error as AxiosError<DepartmentApiError>);
    const code = (error.response?.data as DepartmentApiError)?.code;
    throw new DepartmentError(message, statusCode, code);
  }
  if (error instanceof Error) {
    throw new DepartmentError(error.message, 500);
  }
  throw new DepartmentError('An unexpected error occurred', 500);
}

// API Functions

export const departmentApi = {
  /**
   * Get all departments for a business.
   * 
   * Requirement 5.1: GET endpoint to retrieve all departments for a business
   * 
   * @param businessId - The business ID to get departments for
   * @returns List of departments
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getDepartments(_businessId: string): Promise<Department[]> {
    try {
      // Backend gets business_id from user context, not URL
      const { data } = await apiClient.get<DepartmentListResponse>(
        `/departments`
      );
      return data.departments;
    } catch (error) {
      handleApiError(error);
    }
  },

  /**
   * Get a single department by ID.
   * 
   * Requirement 5.5: GET endpoint to retrieve a single department by ID
   * 
   * @param businessId - The business ID
   * @param departmentId - The department ID to retrieve
   * @returns The department
   */
  async getDepartment(businessId: string, departmentId: string): Promise<Department> {
    try {
      const { data } = await apiClient.get<Department>(
        `/departments/${departmentId}`
      );
      return data;
    } catch (error) {
      handleApiError(error);
    }
  },

  /**
   * Create a new department.
   * 
   * Requirement 5.2: POST endpoint to create a new department
   * 
   * @param businessId - The business ID to create the department in
   * @param departmentData - The department data
   * @returns The created department
   */
  async createDepartment(businessId: string, departmentData: DepartmentCreate): Promise<Department> {
    try {
      const { data } = await apiClient.post<Department>(
        `/departments`,
        departmentData
      );
      return data;
    } catch (error) {
      handleApiError(error);
    }
  },

  /**
   * Update an existing department.
   * 
   * Requirement 5.3: PUT endpoint to update an existing department
   * 
   * @param businessId - The business ID
   * @param departmentId - The department ID to update
   * @param departmentData - The updated department data
   * @returns The updated department
   */
  async updateDepartment(
    businessId: string,
    departmentId: string,
    departmentData: DepartmentUpdate
  ): Promise<Department> {
    try {
      const { data } = await apiClient.put<Department>(
        `/departments/${departmentId}`,
        departmentData
      );
      return data;
    } catch (error) {
      handleApiError(error);
    }
  },

  /**
   * Delete a department.
   * 
   * Requirement 5.4: DELETE endpoint to remove a department
   * 
   * Note: Will fail if team members are assigned to the department.
   * 
   * @param businessId - The business ID
   * @param departmentId - The department ID to delete
   */
  async deleteDepartment(businessId: string, departmentId: string): Promise<void> {
    try {
      await apiClient.delete(`/departments/${departmentId}`);
    } catch (error) {
      handleApiError(error);
    }
  },
};

export default departmentApi;
