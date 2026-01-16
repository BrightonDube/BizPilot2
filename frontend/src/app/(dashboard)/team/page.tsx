'use client';

/**
 * Team Management page - Manage business users and roles.
 * 
 * Requirements:
 * - 4.1: Display each team member's assigned department
 * - 4.2: Display department name, color, and icon for each team member
 * - 4.4: Provide a filter to show team members from specific departments
 * - 4.5: Provide a search function that includes department names in the search criteria
 * - 8.2: Allow viewing team members without department with "No Department" indicator
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Edit,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import { departmentApi } from '@/lib/department-api';
import { DepartmentBadge } from '@/components/departments/DepartmentBadge';
import { DepartmentFilter, NO_DEPARTMENT_VALUE } from '@/components/departments/DepartmentFilter';
import type { DepartmentFilterState } from '@/components/departments/DepartmentFilter';
import type { Department, DepartmentSummary } from '@/lib/types';

/**
 * BusinessUser interface with department fields.
 * Requirements: 4.1, 4.2 - Display department information for team members
 */
interface BusinessUser {
  id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role_id?: string;
  role_name?: string;
  status: string;
  is_primary: boolean;
  created_at?: string;
  /** Department ID if assigned */
  department_id?: string | null;
  /** Department details when joined */
  department?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_system: boolean;
}

export default function TeamPage() {
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BusinessUser | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state for department filtering and search
  // Requirements: 4.4, 4.5 - Department filter and search functionality
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Invite form state
  const [inviteData, setInviteData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role_id: '',
    department_id: '',
  });
  const [isInviting, setIsInviting] = useState(false);

  // Edit form state
  // Requirements: 3.5, 3.6 - Allow changing department assignment
  const [editData, setEditData] = useState({
    role_id: '',
    status: '',
    department_id: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch users, roles, and business data in parallel
      const [usersRes, rolesRes, businessRes] = await Promise.all([
        apiClient.get('/business/users'),
        apiClient.get('/roles'),
        apiClient.get('/business/current'),
      ]);
      setUsers(usersRes.data.items || []);
      setRoles(rolesRes.data.items || []);
      
      // Fetch departments if we have a business ID
      const businessId = businessRes.data?.id;
      if (businessId) {
        try {
          const departmentsData = await departmentApi.getDepartments(businessId);
          setDepartments(departmentsData);
        } catch {
          // Departments are optional, don't fail if fetch fails
          console.warn('Failed to load departments');
        }
      }
    } catch {
      setErrorMessage('Failed to load team data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleInvite = async () => {
    if (!inviteData.email || !inviteData.role_id) {
      setErrorMessage('Email and role are required');
      return;
    }

    setIsInviting(true);
    try {
      // Prepare invite payload, converting empty department_id to null
      const payload = {
        ...inviteData,
        department_id: inviteData.department_id || null,
      };
      await apiClient.post('/business/users/invite', payload);
      setSuccessMessage('User invited successfully');
      setShowInviteModal(false);
      setInviteData({ email: '', first_name: '', last_name: '', role_id: '', department_id: '' });
      await fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setErrorMessage(error.response?.data?.detail || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  const handleEdit = (user: BusinessUser) => {
    setSelectedUser(user);
    // Initialize edit form with current values including department
    // Requirements: 3.5, 3.6 - Allow changing department assignment
    setEditData({
      role_id: user.role_id || '',
      status: user.status,
      department_id: user.department_id || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      // Prepare update payload, converting empty department_id to null
      // Requirements: 3.5, 3.6 - Allow changing or clearing department assignment
      const payload = {
        ...editData,
        department_id: editData.department_id || null,
      };
      await apiClient.put(`/business/users/${selectedUser.user_id}`, payload);
      setSuccessMessage('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      await fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setErrorMessage(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async (user: BusinessUser) => {
    if (!confirm(`Are you sure you want to remove ${user.email} from the team?`)) {
      return;
    }

    try {
      await apiClient.delete(`/business/users/${user.user_id}`);
      setSuccessMessage('User removed successfully');
      await fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setErrorMessage(error.response?.data?.detail || 'Failed to remove user');
    }
  };

  /**
   * Filter users based on department and search criteria.
   * Requirements:
   * - 4.4: Filter by specific department
   * - 4.5: Search includes department names
   * - 8.2: Handle team members without departments
   */
  const filteredUsers = users.filter((user) => {
    // Department filter
    // - null: show all users
    // - NO_DEPARTMENT_VALUE: show only users without a department
    // - UUID: show only users in that specific department
    if (departmentFilter !== null) {
      if (departmentFilter === NO_DEPARTMENT_VALUE) {
        // Show only users without a department
        if (user.department_id) {
          return false;
        }
      } else {
        // Show only users in the selected department
        if (user.department_id !== departmentFilter) {
          return false;
        }
      }
    }

    // Search filter - search by name, email, and department name
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      const matchesEmail = user.email.toLowerCase().includes(searchLower);
      const matchesFirstName = (user.first_name?.toLowerCase() || '').includes(searchLower);
      const matchesLastName = (user.last_name?.toLowerCase() || '').includes(searchLower);
      const matchesDepartment = (user.department?.name?.toLowerCase() || '').includes(searchLower);
      
      if (!matchesEmail && !matchesFirstName && !matchesLastName && !matchesDepartment) {
        return false;
      }
    }

    return true;
  });

  /**
   * Handle filter changes from DepartmentFilter component.
   * Requirements: 4.4, 4.5
   */
  const handleFilterChange = useCallback((filter: DepartmentFilterState) => {
    setDepartmentFilter(filter.departmentId);
    setSearchFilter(filter.search);
  }, []);

  /**
   * Convert department data to DepartmentSummary format for DepartmentBadge.
   * Requirements: 4.2 - Display department name, color, and icon
   */
  const getDepartmentSummary = (user: BusinessUser): DepartmentSummary | null => {
    if (!user.department) {
      return null;
    }
    return {
      id: user.department.id,
      name: user.department.name,
      color: user.department.color,
      icon: user.department.icon,
    };
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-500/20', text: 'text-green-400' },
      invited: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      inactive: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    };
    const style = styles[status] || styles.inactive;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Manage your team members and their roles"
        actions={
          <Button onClick={() => setShowInviteModal(true)} className="bg-gradient-to-r from-blue-600 to-purple-600">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        }
      />

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Department Filter and Search */}
      {/* Requirements: 4.4, 4.5 - Department filter and search functionality */}
      <DepartmentFilter
        departments={departments}
        onFilterChange={handleFilterChange}
        searchPlaceholder="Search by name, email, or department..."
      />

      {/* Team Members List */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Team Members ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No team members found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Member</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Department</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Role</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Joined</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {user.first_name && user.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : user.email}
                            </p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                          {user.is_primary && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                              Owner
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Department column - Requirements: 4.1, 4.2, 8.2 */}
                      <td className="py-3 px-4">
                        <DepartmentBadge 
                          department={getDepartmentSummary(user)} 
                          size="sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-white">{user.role_name || 'No role'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(user.status)}</td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!user.is_primary && (
                            <button
                              onClick={() => handleRemove(user)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-400 mb-1">
                  Email *
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-400 mb-1">
                    First Name
                  </label>
                  <Input
                    id="invite-first-name"
                    value={inviteData.first_name}
                    onChange={(e) => setInviteData({ ...inviteData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-400 mb-1">
                    Last Name
                  </label>
                  <Input
                    id="invite-last-name"
                    value={inviteData.last_name}
                    onChange={(e) => setInviteData({ ...inviteData, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-gray-400 mb-1">
                  Role *
                </label>
                <Select
                  id="invite-role"
                  value={inviteData.role_id}
                  onChange={(e) => setInviteData({ ...inviteData, role_id: e.target.value })}
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="invite-department" className="block text-sm font-medium text-gray-400 mb-1">
                  Department
                </label>
                <Select
                  id="invite-department"
                  value={inviteData.department_id}
                  onChange={(e) => setInviteData({ ...inviteData, department_id: e.target.value })}
                >
                  <option value="">No Department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={isInviting}>
                  <Mail className="w-4 h-4 mr-2" />
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Edit Team Member</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-white font-medium">{selectedUser.email}</p>
                <p className="text-xs text-gray-400">
                  {selectedUser.first_name} {selectedUser.last_name}
                </p>
              </div>
              <div>
                <label htmlFor="edit-role" className="block text-sm font-medium text-gray-400 mb-1">
                  Role
                </label>
                <Select
                  id="edit-role"
                  value={editData.role_id}
                  onChange={(e) => setEditData({ ...editData, role_id: e.target.value })}
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="edit-status" className="block text-sm font-medium text-gray-400 mb-1">
                  Status
                </label>
                <Select
                  id="edit-status"
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
              {/* Department dropdown - Requirements: 3.5, 3.6 */}
              <div>
                <label htmlFor="edit-department" className="block text-sm font-medium text-gray-400 mb-1">
                  Department
                </label>
                <Select
                  id="edit-department"
                  value={editData.department_id}
                  onChange={(e) => setEditData({ ...editData, department_id: e.target.value })}
                >
                  <option value="">No Department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={isUpdating}>
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
