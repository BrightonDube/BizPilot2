'use client';

/**
 * Team Management page - Manage business users and roles.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  MoreVertical,
  Edit,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Search,
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
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BusinessUser | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invite form state
  const [inviteData, setInviteData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role_id: '',
  });
  const [isInviting, setIsInviting] = useState(false);

  // Edit form state
  const [editData, setEditData] = useState({
    role_id: '',
    status: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiClient.get('/business/users'),
        apiClient.get('/roles'),
      ]);
      setUsers(usersRes.data.items || []);
      setRoles(rolesRes.data.items || []);
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
      await apiClient.post('/business/users/invite', inviteData);
      setSuccessMessage('User invited successfully');
      setShowInviteModal(false);
      setInviteData({ email: '', first_name: '', last_name: '', role_id: '' });
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
    setEditData({
      role_id: user.role_id || '',
      status: user.status,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      await apiClient.put(`/business/users/${selectedUser.user_id}`, editData);
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

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.first_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.last_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

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
