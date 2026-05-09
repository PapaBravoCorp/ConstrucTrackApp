import React from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth';
import { useProjects } from '../../projectsContext';
import { MapPin, Clock, ChevronRight, CheckCircle, Navigation, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function AgentDashboard() {
  const { user } = useAuth();
  const { projects, loading } = useProjects();
  
  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>;
  }

  return (
    <div className="p-4 pb-24 md:p-6 min-h-screen bg-gray-50">
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xl">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{getGreeting()},</h1>
            <p className="text-sm font-medium text-gray-600">{user?.name}</p>
          </div>
        </div>
        <div className="bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
          <p className="text-xs font-semibold text-orange-700">{projects.length} Sites</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Assigned Projects</h2>
      </div>

      <div className="space-y-4">
        {projects.map((project, idx) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Link
              to={`/agent/projects/${project.id}`}
              className="block bg-white rounded-2xl p-5 border border-gray-200 shadow-sm active:scale-95 transition-transform"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="pr-4">
                  <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{project.name}</h3>
                  <div className="flex items-start gap-1.5 text-sm text-gray-500">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                    <span className="line-clamp-2">{project.address}</span>
                  </div>
                </div>
                {project.status === 'Completed' ? (
                  <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-4 border-gray-100 flex items-center justify-center relative shrink-0">
                    <svg className="w-12 h-12 absolute -top-1 -left-1" viewBox="0 0 36 36">
                      <path
                        className={`${project.status === 'Delayed' ? 'text-orange-500' : 'text-blue-600'}`}
                        strokeDasharray={`${project.percent_done}, 100`}
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                    </svg>
                    <span className="text-xs font-bold text-gray-700 relative z-10">{project.percent_done}%</span>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Due {new Date(project.end_date).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                  Update <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
        
        {projects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No sites assigned</h3>
            <p className="text-gray-500 text-sm mt-1">You currently have no active sites.</p>
          </div>
        )}
      </div>
    </div>
  );
}
