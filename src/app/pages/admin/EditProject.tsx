import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchProject, updateProject, fetchUsersByRole } from '../../api';
import type { Profile, ProjectStatus } from '../../api';
import { toast } from 'sonner';

export function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<'Residential' | 'Commercial'>('Residential');
  const [client, setClient] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('On Track');
  const [managerId, setManagerId] = useState('');
  const [agentIds, setAgentIds] = useState<string[]>([]);

  const [managers, setManagers] = useState<Profile[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);

  useEffect(() => {
    loadProject();
    loadUsers();
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    try {
      const project = await fetchProject(id);
      setName(project.name);
      setAddress(project.address);
      setType(project.type);
      setClient(project.client);
      setStartDate(project.start_date);
      setEndDate(project.end_date);
      setStatus(project.status);
      setManagerId(project.manager_id || '');
      setAgentIds(project.agents?.map(a => a.agent_id) || []);
    } catch (err: any) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const [m, a] = await Promise.all([
        fetchUsersByRole('Manager'),
        fetchUsersByRole('Agent'),
      ]);
      setManagers(m);
      setAgents(a);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await updateProject(id, {
        name,
        address,
        type,
        client,
        startDate,
        endDate,
        status,
        managerId: managerId || undefined,
        agentIds,
      });
      toast.success('Project updated successfully');
      navigate('/admin/projects');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    setAgentIds(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-4 md:p-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 hidden md:block">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
          <p className="text-sm text-gray-500">Update project details and assignments.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Project Details</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} required
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                <option>Residential</option>
                <option>Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <input type="text" value={client} onChange={(e) => setClient(e.target.value)} required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="On Track">On Track</option>
              <option value="Delayed">Delayed</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Assignments */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Assignments</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Manager</label>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="">Unassigned</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Site Agents</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {agents.map(a => (
                <label key={a.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                  <input
                    type="checkbox"
                    checked={agentIds.includes(a.id)}
                    onChange={() => toggleAgent(a.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">{a.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{a.email}</span>
                  </div>
                </label>
              ))}
              {agents.length === 0 && (
                <p className="text-sm text-gray-500 italic">No agents available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)}
            className="px-6 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
