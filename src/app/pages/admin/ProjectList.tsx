import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Search, MapPin, Calendar, Building, Edit, Trash2, Loader2 } from 'lucide-react';
import { useProjects } from '../../projectsContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import type { ProjectStatus } from '../../api';

export function ProjectList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { projects, loading, deleteProject } = useProjects();
  const navigate = useNavigate();

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteProject(id);
      toast.success('Project deleted');
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and monitor all construction sites.</p>
        </div>
        <Link
          to="/admin/projects/new"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Create Project</span>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by project name or location..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['All', 'On Track', 'Delayed', 'Completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredProjects.map((project, idx) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-all shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    project.status === 'On Track' ? 'bg-green-100 text-green-700' :
                    project.status === 'Delayed' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-500 gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>{project.address}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                  title="Edit project"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(project.id)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{project.start_date} to {project.end_date}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md">
                <span className="font-medium text-gray-900">Client:</span> {project.client}
              </div>
              {project.manager && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-blue-50 px-3 py-1.5 rounded-md">
                  <span className="font-medium text-blue-700">Manager:</span> {project.manager.name}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-700">Overall Progress</span>
                <span className="font-bold text-blue-600">{project.percent_done}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${project.percent_done}%` }}
                />
              </div>
            </div>
          </motion.div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
            <p className="text-gray-500 mt-1">
              {projects.length === 0 ? 'Get started by creating your first project.' : 'Try adjusting your search terms.'}
            </p>
            {projects.length === 0 && (
              <Link to="/admin/projects/new" className="inline-flex items-center gap-2 mt-4 text-blue-600 font-medium hover:text-blue-700">
                <Plus className="w-4 h-4" /> Create Project
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Project?</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                This action cannot be undone. All milestones, updates, and photos will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
