import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { fetchProject } from '../../api';
import type { ProjectDetail } from '../../api';
import { Camera, ChevronRight, CheckCircle2, History, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export function AgentProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const data = await fetchProject(id!);
      setProject(data);
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!project) return <div className="p-6 text-center">Project not found</div>;

  return (
    <div className="p-4 md:p-6 pb-24 min-h-screen bg-gray-50 max-w-2xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6">
        <h1 className="text-xl font-bold text-gray-900 leading-tight mb-2">{project.name}</h1>
        <p className="text-sm text-gray-500 mb-4">{project.address}</p>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-gray-600">Overall Progress</span>
              <span className="text-blue-600">{project.percent_done}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${project.percent_done}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-base font-semibold text-gray-900 mb-4">Milestones</h2>
      
      <div className="space-y-3">
        {(project.milestones || []).map((milestone, idx) => (
          <motion.div
            key={milestone.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link
              to={`/agent/projects/${project.id}/update/${milestone.id}`}
              className={`flex items-center justify-between p-4 bg-white rounded-2xl border ${milestone.percent_done === 100 ? 'border-green-200' : 'border-gray-200'} shadow-sm active:scale-95 transition-transform`}
            >
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  {milestone.percent_done === 100 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                  )}
                  <h3 className="font-semibold text-sm text-gray-900">
                    {milestone.name}
                  </h3>
                </div>
                
                <div className="pl-7">
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-bold ${milestone.percent_done === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                      {milestone.percent_done}% Done
                    </span>
                    {milestone.last_update && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <History className="w-3 h-3" />
                        {new Date(milestone.last_update).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  {milestone.thumbnail_url && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                        <img src={milestone.thumbnail_url} alt="Progress" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center gap-2">
                <div className={`p-2.5 rounded-full ${milestone.percent_done === 100 ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Camera className="w-5 h-5" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
