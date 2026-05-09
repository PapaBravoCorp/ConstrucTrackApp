import React, { useState } from 'react';
import { Link } from 'react-router';
import { Search, Clock, AlertTriangle, CheckCircle, BarChart3, ChevronRight, Loader2 } from 'lucide-react';
import { useProjects } from '../../projectsContext';
import { motion } from 'motion/react';

export function ManagerDashboard() {
  const { projects, loading } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  
  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'On Track': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'Delayed': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of all assigned projects.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Projects</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{projects.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">On Track</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {projects.filter(p => p.status === 'On Track').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Delayed</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">
            {projects.filter(p => p.status === 'Delayed').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Avg Completion</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {Math.round(projects.reduce((acc, p) => acc + p.percent_done, 0) / (projects.length || 1))}%
          </p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search assigned projects..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
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
            transition={{ delay: idx * 0.1 }}
          >
            <Link
              to={`/manager/projects/${project.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 transition-all shadow-sm group"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                  <p className="text-sm text-gray-500">{project.address}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-full text-sm font-medium">
                  {getStatusIcon(project.status)}
                  <span className={
                    project.status === 'On Track' ? 'text-green-700' :
                    project.status === 'Delayed' ? 'text-orange-700' : 'text-gray-700'
                  }>{project.status}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>Due {new Date(project.end_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                  <span>{project.milestones?.length || 0} Milestones</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700">Completion</span>
                    <span className="font-bold text-gray-900">{project.percent_done}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${project.status === 'Delayed' ? 'bg-orange-500' : 'bg-blue-600'}`}
                      style={{ width: `${project.percent_done}%` }}
                    />
                  </div>
                </div>
                <div className="bg-blue-50 p-2 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
            <p className="text-gray-500 mt-1 text-sm">You haven't been assigned to any projects yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
