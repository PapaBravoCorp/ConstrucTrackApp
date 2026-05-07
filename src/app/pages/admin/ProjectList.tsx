import React, { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, MapPin, Calendar, MoreVertical, Building } from 'lucide-react';
import { useProjects } from '../../projectsContext';
import { motion } from 'motion/react';

export function ProjectList() {
  const [searchTerm, setSearchTerm] = useState('');
  const { projects } = useProjects();

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by project name or location..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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
              <button className="text-gray-400 hover:text-gray-600 p-1">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{project.startDate} to {project.endDate}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md">
                <span className="font-medium text-gray-900">Client:</span> {project.client}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-700">Overall Progress</span>
                <span className="font-bold text-blue-600">{project.percentDone}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${project.percentDone}%` }}
                />
              </div>
            </div>
          </motion.div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
}
