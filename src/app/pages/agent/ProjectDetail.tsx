import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { fetchProject } from '../../api';
import type { ProjectDetail, MilestoneWithUpdates } from '../../api';
import { Camera, ChevronRight, CheckCircle2, History, Loader2, AlertCircle, Clock, Eye, XCircle, RefreshCw, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

export function AgentProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProject();
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!project) return <div className="p-6 text-center">Project not found</div>;

  return (
    <div className="p-4 md:p-6 pb-24 min-h-screen bg-gray-50 max-w-2xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6">
        <h1 className="text-xl font-bold text-gray-900 leading-tight mb-2">{project.name}</h1>
        <div className="text-sm text-gray-500 mb-4 flex items-center gap-2 flex-wrap">
          <span>{project.address}</span>
          {project.end_date && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Ends {new Date(project.end_date).toLocaleDateString()}</span>
            </>
          )}
        </div>
        
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

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Milestones</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      <div className="space-y-3">
        {(project.milestones || []).map((milestone, idx) => {
          const updates = (milestone as MilestoneWithUpdates).updates || [];
          const hasPendingUpdate = updates.some(u => u.review_status === 'pending');
          const latestRejected = updates.slice().reverse().find(u => ['rejected', 'changes_requested', 'rework_required'].includes(u.review_status));
          const isCompleted = milestone.percent_done === 100 && milestone.status === 'Completed';
          const isPending = hasPendingUpdate;

          // Card content — shared between Link and div
          const cardContent = (
            <>
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : isPending ? (
                    <div className="w-5 h-5 rounded-full border-2 border-yellow-400 shrink-0 bg-yellow-50" />
                  ) : latestRejected && !hasPendingUpdate ? (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                  )}
                  <h3 className="font-semibold text-sm text-gray-900">
                    {milestone.name}
                  </h3>
                </div>
                
                <div className="pl-7">
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {hasPendingUpdate && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 animate-pulse flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending Approval
                      </span>
                    )}
                    {latestRejected && !hasPendingUpdate && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        latestRejected.review_status === 'rework_required'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-orange-100 text-orange-700 border-orange-200'
                      }`}>
                        <AlertCircle className="w-3 h-3" />
                        {latestRejected.review_status === 'rework_required' ? 'Rework Required' : 'Changes Requested'} — Resubmit
                      </span>
                    )}
                    {milestone.schedule_status && milestone.schedule_status !== 'ON_TRACK' && (
                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full font-bold ${milestone.schedule_status === 'DELAYED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {milestone.schedule_status.replace('_', ' ')}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {milestone.status || 'Pending'}
                    </span>
                    <span className={`text-xs font-bold ${milestone.percent_done === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                      {milestone.percent_done}% Done
                    </span>
                    {milestone.due_date && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due {new Date(milestone.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {milestone.last_update && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <History className="w-3 h-3" />
                        {new Date(milestone.last_update).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Rejection reason banner */}
                  {latestRejected && !hasPendingUpdate && latestRejected.rejection_reason && (
                    <div className={`mt-3 rounded-xl p-3 border ${
                      latestRejected.review_status === 'rework_required'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${
                        latestRejected.review_status === 'rework_required' ? 'text-red-800' : 'text-orange-800'
                      }`}>
                        {latestRejected.review_status === 'rework_required' ? 'Rework Required' : 'Changes Requested'}
                      </p>
                      <p className={`text-sm leading-relaxed ${
                        latestRejected.review_status === 'rework_required' ? 'text-red-700' : 'text-orange-700'
                      }`}>"{latestRejected.rejection_reason}"</p>
                      <p className={`text-[10px] mt-1.5 ${
                        latestRejected.review_status === 'rework_required' ? 'text-red-500' : 'text-orange-500'
                      }`}>
                        {new Date(latestRejected.created_at).toLocaleDateString()} • Tap to resubmit
                      </p>
                    </div>
                  )}

                  {/* Pending review info */}
                  {hasPendingUpdate && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <p className="text-[11px] font-bold text-yellow-800 uppercase tracking-wider mb-1">Awaiting Review</p>
                      <p className="text-sm text-yellow-700">
                        Your update to {updates.find(u => u.review_status === 'pending')?.percent_done}% is being reviewed by your manager.
                      </p>
                    </div>
                  )}
                  
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
                <div className={`p-2.5 rounded-full ${
                  isCompleted ? 'bg-green-50 text-green-600' 
                    : isPending ? 'bg-yellow-100 text-yellow-600' 
                    : latestRejected && !hasPendingUpdate ? 'bg-red-50 text-red-500'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  {isCompleted ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </div>
              </div>
            </>
          );

          return (
          <motion.div
            key={milestone.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            {isCompleted ? (
              // Completed milestones — read-only, no link to update form
              <div
                className="flex items-center justify-between p-4 bg-white rounded-2xl border border-green-200 shadow-sm opacity-75"
              >
                {cardContent}
              </div>
            ) : (
              // Active milestones — link to update form
              <Link
                to={`/agent/projects/${project.id}/update/${milestone.id}`}
                className={`flex items-center justify-between p-4 bg-white rounded-2xl border ${
                  isPending ? 'border-yellow-300 ring-2 ring-yellow-100' 
                  : latestRejected && !hasPendingUpdate ? 'border-red-300 ring-2 ring-red-100'
                  : 'border-gray-200'
                } shadow-sm active:scale-95 transition-transform`}
              >
                {cardContent}
              </Link>
            )}
          </motion.div>
          )
        })}
      </div>
    </div>
  );
}
