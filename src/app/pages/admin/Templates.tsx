import React, { useState, useEffect } from 'react';
import { LayoutTemplate, Plus, MoreVertical, X, Loader2, Save, Edit, Trash2, Copy, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate } from '../../api';
import type { Template } from '../../api';
import { toast } from 'sonner';

interface PhaseItem { name: string; weight: number; }

export function TemplatesLibrary() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'Residential' | 'Commercial'>('Residential');
  const [formPhases, setFormPhases] = useState<PhaseItem[]>([{ name: '', weight: 100 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (err: any) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormType('Residential');
    setFormPhases([{ name: '', weight: 100 }]);
    setShowDialog(true);
  };

  const openEditDialog = (tpl: Template) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormType(tpl.project_type);
    setFormPhases([...tpl.phases]);
    setShowDialog(true);
  };

  const handleDuplicate = (tpl: Template) => {
    setEditingTemplate(null);
    setFormName(`${tpl.name} (Copy)`);
    setFormType(tpl.project_type);
    setFormPhases([...tpl.phases]);
    setShowDialog(true);
  };

  const addPhase = () => setFormPhases([...formPhases, { name: '', weight: 0 }]);
  const removePhase = (i: number) => setFormPhases(formPhases.filter((_, idx) => idx !== i));
  const updatePhase = (i: number, field: 'name' | 'weight', val: string | number) => {
    setFormPhases(formPhases.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  };

  const totalWeight = formPhases.reduce((s, p) => s + Number(p.weight), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { toast.error('Template name is required'); return; }
    if (formPhases.length === 0) { toast.error('Add at least one phase'); return; }
    if (formPhases.some(p => !p.name.trim())) { toast.error('All phases must have a name'); return; }
    if (totalWeight !== 100) { toast.error(`Phase weights must sum to 100% (currently ${totalWeight}%)`); return; }

    setSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, { name: formName, projectType: formType, phases: formPhases });
        toast.success('Template updated');
      } else {
        await createTemplate({ name: formName, projectType: formType, phases: formPhases });
        toast.success('Template created');
      }
      setShowDialog(false);
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      toast.success('Template deleted');
      setDeleteConfirm(null);
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Template Library</h1>
          <p className="text-sm text-gray-500 mt-1">Manage standard milestone lists for easy project creation.</p>
        </div>
        <button onClick={openCreateDialog}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-5 h-5" />
          <span>New Template</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl, idx) => (
          <motion.div
            key={tpl.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-all shadow-sm group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                <LayoutTemplate className="w-6 h-6" />
              </div>
              <div className="relative group/menu">
                <button className="text-gray-400 hover:text-gray-600 p-1">
                  <MoreVertical className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10">
                  <button onClick={() => openEditDialog(tpl)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleDuplicate(tpl)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  <button onClick={() => setDeleteConfirm(tpl.id)}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{tpl.name}</h3>
            <p className="text-sm text-gray-500 mb-2">{tpl.phases.length} Phases • {tpl.project_type}</p>
            
            <div className="space-y-1 mt-3">
              {tpl.phases.slice(0, 4).map((p, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-600">
                  <span className="truncate">{p.name}</span>
                  <span className="text-gray-400 ml-2 font-medium">{p.weight}%</span>
                </div>
              ))}
              {tpl.phases.length > 4 && (
                <p className="text-xs text-gray-400 italic">+{tpl.phases.length - 4} more phases</p>
              )}
            </div>
            
            <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
              <span>By {tpl.creator?.name || 'Unknown'}</span>
              <span>{new Date(tpl.created_at).toLocaleDateString()}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
          <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No templates yet</h3>
          <p className="text-gray-500 mt-1 text-sm">Create your first template to streamline project setup.</p>
          <button onClick={openCreateDialog}
            className="inline-flex items-center gap-2 mt-4 text-blue-600 font-medium hover:text-blue-700">
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <AnimatePresence>
        {showDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDialog(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h2>
                <button onClick={() => setShowDialog(false)} className="p-1 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. Standard Residential" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                    <option>Residential</option>
                    <option>Commercial</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Phases</label>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                        Total: {totalWeight}%
                      </span>
                      <button type="button" onClick={addPhase}
                        className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {formPhases.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="text" value={p.name} onChange={(e) => updatePhase(i, 'name', e.target.value)}
                          placeholder="Phase name" className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                        <input type="number" value={p.weight} onChange={(e) => updatePhase(i, 'weight', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1.5 text-sm text-center border border-gray-200 rounded" min="0" max="100" />
                        <span className="text-xs text-gray-400">%</span>
                        <button type="button" onClick={() => removePhase(i)}
                          className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowDialog(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingTemplate ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Template?</h3>
              <p className="text-sm text-gray-500 text-center mb-6">This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
