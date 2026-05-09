import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Shield, Briefcase, HardHat, MoreVertical, UserPlus, X, Loader2, Check, Ban } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deactivateUser } from '../../api';
import type { Profile, Role } from '../../api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Agent');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName || !invitePassword) {
      toast.error('All fields are required');
      return;
    }
    if (invitePassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setInviting(true);
    try {
      await createUser({ email: inviteEmail, password: invitePassword, name: inviteName, role: inviteRole });
      toast.success(`User ${inviteName} created successfully`);
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setInviteRole('Agent');
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateUser(userId, { role: newRole });
      toast.success('Role updated');
      await loadUsers();
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleToggleActive = async (user: Profile) => {
    try {
      if (user.is_active) {
        await deactivateUser(user.id);
        toast.success(`${user.name} has been deactivated`);
      } else {
        await updateUser(user.id, { isActive: true });
        toast.success(`${user.name} has been reactivated`);
      }
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'Admin': return <Shield className="w-4 h-4" />;
      case 'Manager': return <Briefcase className="w-4 h-4" />;
      case 'Agent': return <HardHat className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'Admin': return 'bg-purple-100 text-purple-700';
      case 'Manager': return 'bg-blue-100 text-blue-700';
      case 'Agent': return 'bg-orange-100 text-orange-700';
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Roles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage team members and access control.</p>
        </div>
        <button
          onClick={() => setShowInviteDialog(true)}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <UserPlus className="w-5 h-5" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['All', 'Admin', 'Manager', 'Agent'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                roleFilter === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Admins</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{users.filter(u => u.role === 'Admin').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Managers</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{users.filter(u => u.role === 'Manager').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Agents</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{users.filter(u => u.role === 'Agent').length}</p>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Joined</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, idx) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-medium text-sm shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role as Role)}`}>
                      {getRoleIcon(u.role as Role)}
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500 hidden md:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <div className="relative group">
                        <button className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                          <div className="py-1">
                            <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">Change Role</p>
                            {(['Admin', 'Manager', 'Agent'] as Role[]).map((r) => (
                              <button
                                key={r}
                                onClick={() => handleRoleChange(u.id, r)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${u.role === r ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                              >
                                {getRoleIcon(r)}
                                {r}
                                {u.role === r && <Check className="w-3 h-3 ml-auto" />}
                              </button>
                            ))}
                            <div className="border-t border-gray-100 my-1"></div>
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                            >
                              <Ban className="w-4 h-4" />
                              {u.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No users found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or filter.</p>
          </div>
        )}
      </div>

      {/* Invite User Dialog */}
      <AnimatePresence>
        {showInviteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowInviteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Invite New User</h2>
                <button onClick={() => setShowInviteDialog(false)} className="p-1 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900"
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Admin', 'Manager', 'Agent'] as Role[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={`flex flex-col items-center justify-center py-3 px-2 border rounded-lg text-xs font-medium transition-colors ${
                          inviteRole === r
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {getRoleIcon(r)}
                        <span className="mt-1">{r}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteDialog(false)}
                    className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Create User
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
