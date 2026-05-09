import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save, Plus, X, GripVertical, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { createProject, fetchTemplates, fetchUsersByRole } from '../../api';
import type { Template, Profile } from '../../api';
import { toast } from 'sonner';

interface MilestoneItem {
  name: string;
  weight: number;
}

export function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<'Residential' | 'Commercial'>('Residential');
  const [client, setClient] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Step 2 state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);

  // Step 3 state
  const [managers, setManagers] = useState<Profile[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [managerId, setManagerId] = useState('');
  const [agentIds, setAgentIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, m, a] = await Promise.all([
        fetchTemplates(),
        fetchUsersByRole('Manager'),
        fetchUsersByRole('Agent'),
      ]);
      setTemplates(t);
      setManagers(m);
      setAgents(a);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMilestones(template.phases.map(p => ({ name: p.name, weight: p.weight })));
    }
  };

  const addMilestone = () => {
    setMilestones([...milestones, { name: '', weight: 0 }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: 'name' | 'weight', value: string | number) => {
    setMilestones(milestones.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const totalWeight = milestones.reduce((sum, m) => sum + Number(m.weight), 0);

  const toggleAgent = (id: string) => {
    setAgentIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const validateStep1 = () => {
    if (!name || !address || !client || !startDate || !endDate) {
      toast.error('Please fill in all required fields');
      return false;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      toast.error('End date must be after start date');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (milestones.length === 0) {
      toast.error('Add at least one milestone');
      return false;
    }
    if (milestones.some(m => !m.name.trim())) {
      toast.error('All milestones must have a name');
      return false;
    }
    if (totalWeight !== 100) {
      toast.error(`Milestone weights must sum to 100% (currently ${totalWeight}%)`);
      return false;
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createProject({
        name,
        address,
        type,
        client,
        startDate,
        endDate,
        managerId: managerId || undefined,
        agentIds: agentIds.length > 0 ? agentIds : undefined,
        milestones,
        templateId: selectedTemplateId || undefined,
      });
      toast.success('Project created successfully!');
      navigate('/admin/projects');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 hidden md:block">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-sm text-gray-500">Setup a new site and assign roles.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <div className={`flex-1 py-3 text-center text-sm font-medium ${step === 1 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            1. Details
          </div>
          <div className={`flex-1 py-3 text-center text-sm font-medium ${step === 2 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            2. Milestones
          </div>
          <div className={`flex-1 py-3 text-center text-sm font-medium ${step === 3 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            3. Roles
          </div>
        </div>

        <form onSubmit={handleSave} className="p-5 md:p-6">
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="e.g. Sunset Heights Villa" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location/Address *</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Enter full address" required />
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                  <input type="text" value={client} onChange={(e) => setClient(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Client company or person" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="button" onClick={() => { if (validateStep1()) setStep(2); }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Next Step
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Template</label>
                <select value={selectedTemplateId} onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  <option value="">Custom (Blank)</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.project_type})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Selecting a template will pre-populate the milestone phases.</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-gray-800">Milestones</h4>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                      Total: {totalWeight}% {totalWeight === 100 ? '✓' : '(must be 100%)'}
                    </span>
                    <button type="button" onClick={addMilestone}
                      className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
                
                {milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100">
                    <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMilestone(i, 'name', e.target.value)}
                      placeholder="Milestone name"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="number"
                      value={m.weight}
                      onChange={(e) => updateMilestone(i, 'weight', parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1.5 text-sm text-center border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                      min="0" max="100"
                    />
                    <span className="text-xs text-gray-400">%</span>
                    <button type="button" onClick={() => removeMilestone(i)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {milestones.length === 0 && (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">No milestones. Select a template or add manually.</p>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-between">
                <button type="button" onClick={() => setStep(1)}
                  className="px-6 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  Back
                </button>
                <button type="button" onClick={() => { if (validateStep2()) setStep(3); }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Next Step
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Project Manager</label>
                <select value={managerId} onChange={(e) => setManagerId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  <option value="">Select a Manager</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                  ))}
                </select>
                {managers.length === 0 && <p className="text-xs text-gray-500 mt-1">No managers available. Invite one from User Management.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Site Agents</label>
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
                  {agents.length === 0 && <p className="text-sm text-gray-500 italic">No agents available.</p>}
                </div>
              </div>

              <div className="pt-6 flex justify-between">
                <button type="button" onClick={() => setStep(2)}
                  className="px-6 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  Back
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Create Project
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </div>
    </div>
  );
}
