import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { fetchProject, approveMilestoneUpdate, requestChanges, requestRework } from '../../api';
import type { ProjectDetail, MilestoneWithUpdates } from '../../api';
import { supabase } from '../../supabaseClient';
import { ReviewModal } from '../../components/ReviewModal';
import { Clock, Image as ImageIcon, History, ChevronDown, ChevronUp, MapPin, CheckCircle, AlertTriangle, Loader2, List, Activity, AlertCircle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function ManagerProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'milestones' | 'gallery' | 'audit'>('milestones');
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{ updateId: string; type: 'changes_requested' | 'rework_required'; projectId: string; title: string } | null>(null);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const [data, { data: logs }] = await Promise.all([
        fetchProject(id!),
        supabase.from('milestone_activity').select('*').eq('project_id', id).order('created_at', { ascending: false })
      ]);
      setProject(data);

      if (logs) {
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (updateId: string, versionNumber: number) => {
    try {
      await approveMilestoneUpdate(updateId, 'Approved by manager.', versionNumber);
      toast.success('Update approved successfully');
      loadProject();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve update');
      if (err.message?.includes('Concurrency') || err.message?.includes('conflict')) {
        loadProject(); // refresh to get latest version
      }
    }
  };

  const handleReviewAction = async (text: string, category?: string) => {
    if (!reviewModal) return;
    try {
      if (reviewModal.type === 'changes_requested') {
        await requestChanges(reviewModal.updateId, text, category);
        toast.success('Changes requested successfully');
      } else {
        await requestRework(reviewModal.updateId, text, category);
        toast.success('Rework required sent');
      }
      setReviewModal(null);
      loadProject();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!project) return <div className="p-6 text-center">Project not found</div>;

  // --- Health Insights Calculations ---
  const overdueMilestones = project.milestones.filter(m => {
    if (m.schedule_status === 'DELAYED') return true;
    if (m.due_date && new Date(m.due_date).getTime() < new Date().getTime() && m.percent_done < 100) return true;
    return false;
  });
  
  const computedProjectStatus = overdueMilestones.length > 0 ? 'Delayed' : project.status;
  
  const latestApprovalLog = auditLogs.find(log => log.action_type === 'update_approved' || (log.action_type === 'update_submitted' && log.details?.percent_done === 100)); // Fallback if auto-approved
  let daysSinceProgress = -1;
  if (latestApprovalLog) {
    daysSinceProgress = Math.floor((new Date().getTime() - new Date(latestApprovalLog.created_at).getTime()) / (1000 * 3600 * 24));
  } else if (project.created_at) {
    daysSinceProgress = Math.floor((new Date().getTime() - new Date(project.created_at).getTime()) / (1000 * 3600 * 24));
  }

  const pendingCount = project.milestones.reduce((acc, m) => {
    const hasPending = (m as MilestoneWithUpdates).updates?.some(u => u.review_status === 'pending');
    return acc + (hasPending ? 1 : 0);
  }, 0);



  const allPhotos = project.milestones.flatMap(m => 
    (m.updates || []).flatMap(u => 
      (u.photo_urls || []).map(url => ({
        url,
        date: u.created_at,
        milestone: m.name,
        agent: u.agent?.name || 'Agent',
      }))
    )
  );

  return (
    <>
    <div className="p-4 md:p-6 pb-20 max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex items-center text-sm text-gray-500 mt-1 gap-1.5 flex-wrap">
              <MapPin className="w-4 h-4" />
              <span>{project.address}</span>
              {project.end_date && (
                <>
                  <span className="mx-1">•</span>
                  <Calendar className="w-4 h-4" />
                  <span>Ends {new Date(project.end_date).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${
            computedProjectStatus === 'On Track' ? 'bg-green-100 text-green-700' :
            computedProjectStatus === 'Delayed' ? 'bg-orange-100 text-orange-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {computedProjectStatus === 'On Track' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {computedProjectStatus}
          </span>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-gray-700">Overall Progress</span>
            <span className="font-bold text-gray-900">{project.percent_done}%</span>
          </div>
          {/* Segmented Progress Bar */}
          <div className="w-full flex h-3 gap-0.5 overflow-hidden rounded-full bg-gray-100">
            {project.milestones.map((m, i) => {
              const width = m.weight;
              const completedRatio = m.percent_done / 100;
              return (
                <div key={m.id} className="h-full relative" style={{ width: `${width}%` }}>
                  <div className="absolute inset-0 bg-gray-200" />
                  <div 
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${m.percent_done === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                    style={{ width: `${completedRatio * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>



      {/* Health Insights */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" /> Operational Health
        </h3>
        <div className="space-y-2">
          {overdueMilestones.length > 0 ? (
            overdueMilestones.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-2 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4" /> 
                <span className="font-semibold">{m.name}</span> is overdue
              </div>
            ))
          ) : null}

          {daysSinceProgress > 14 ? (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-2 rounded-lg border border-red-100">
              <AlertCircle className="w-4 h-4" /> Critical: No approved progress in {daysSinceProgress} days
            </div>
          ) : daysSinceProgress > 7 ? (
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-100">
              <AlertTriangle className="w-4 h-4" /> Warning: No approved progress in {daysSinceProgress} days
            </div>
          ) : daysSinceProgress > 3 ? (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <Clock className="w-4 h-4 text-gray-500" /> Info: No approved progress in {daysSinceProgress} days
            </div>
          ) : null}

          {pendingCount > 0 ? (
            <div className="flex items-center gap-2 text-sm text-yellow-800 bg-yellow-50 p-2 rounded-lg border border-yellow-100">
              <AlertTriangle className="w-4 h-4 text-yellow-600" /> {pendingCount} milestone{pendingCount > 1 ? 's' : ''} pending approval
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg border border-green-100">
              <CheckCircle className="w-4 h-4" /> Approval backlog cleared
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 sticky top-16 bg-gray-50 z-10 pt-2">
        <button
          onClick={() => setActiveTab('milestones')}
          className={`flex-1 pb-3 text-center text-sm font-medium transition-colors ${activeTab === 'milestones' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Milestones
        </button>
        <button
          onClick={() => setActiveTab('gallery')}
          className={`flex-1 pb-3 text-center text-sm font-medium transition-colors ${activeTab === 'gallery' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Photo Gallery ({allPhotos.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 pb-3 text-center text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'audit' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <List className="w-4 h-4" />
          Recent Operations
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'milestones' ? (
        <div className="space-y-3">
          {(project.milestones || []).map((milestone, idx) => {
            const pendingUpdate = (milestone as MilestoneWithUpdates).updates?.find(u => u.review_status === 'pending');
            return (
            <motion.div
              key={milestone.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
            >
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                onClick={() => setExpandedMilestone(expandedMilestone === milestone.id ? null : milestone.id)}
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-3 items-center">
                      <div className="text-xl leading-none">
                        {milestone.percent_done === 100 ? '✅' : milestone.percent_done > 0 ? '🟦' : '⬜'}
                      </div>
                      <h3 className="font-semibold text-gray-900">{milestone.name}</h3>
                    </div>
                    <div className="flex gap-2 items-center">
                      {pendingUpdate && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 animate-pulse">
                          Review Required
                        </span>
                      )}
                      {milestone.schedule_status && milestone.schedule_status !== 'ON_TRACK' && (
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-bold ${milestone.schedule_status === 'DELAYED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {milestone.schedule_status.replace('_', ' ')}
                        </span>
                      )}
                      <span className={`font-bold ${milestone.percent_done === 100 ? 'text-green-600' : milestone.percent_done > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {milestone.percent_done > 0 ? `${milestone.percent_done}%` : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${milestone.percent_done === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${milestone.percent_done}%` }}
                    />
                  </div>
                  <div className="flex items-center text-xs text-gray-500 mt-2 gap-4 flex-wrap">
                    <span>Weight: {milestone.weight}%</span>
                    {milestone.due_date && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {new Date(milestone.due_date).toLocaleDateString()}</span>
                    )}
                    {milestone.last_update && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated {new Date(milestone.last_update).toLocaleDateString()}</span>
                    )}
                    <span>{(milestone as MilestoneWithUpdates).updates?.length || 0} updates</span>
                  </div>
                </div>
                <div className="text-gray-400">
                  {expandedMilestone === milestone.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              <AnimatePresence>
                {expandedMilestone === milestone.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100 bg-gray-50"
                  >
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" /> Update History
                      </h4>
                      {pendingUpdate && (
                        <div className="mb-5 bg-gradient-to-r from-yellow-50 to-white rounded-xl border border-yellow-200 p-4 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400"></div>
                          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" /> Pending Approval
                          </h4>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-200 text-yellow-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                                {pendingUpdate.agent?.name?.charAt(0) || 'A'}
                            </div>
                            <div className="flex-1">
                               <p className="text-sm text-gray-800">
                                 <span className="font-semibold">{pendingUpdate.agent?.name}</span> submitted a progress update to <span className="font-bold text-blue-600">{pendingUpdate.percent_done}%</span>.
                               </p>
                               {pendingUpdate.note && <p className="text-sm text-gray-600 mt-2 italic border-l-2 border-yellow-300 pl-2">"{pendingUpdate.note}"</p>}
                               {pendingUpdate.photo_urls && pendingUpdate.photo_urls.length > 0 && (
                                  <div className="mt-3 flex gap-2 flex-wrap">
                                    {pendingUpdate.photo_urls.map((url, pi) => (
                                      <div key={pi} className="rounded-lg overflow-hidden border border-gray-200 inline-block shadow-sm">
                                        <img src={url} alt="Update" className="h-16 w-16 md:h-20 md:w-20 object-cover hover:scale-105 transition-transform" />
                                      </div>
                                    ))}
                                  </div>
                               )}
                               <div className="mt-4 flex flex-wrap gap-2">
                                   <button onClick={() => handleApprove(pendingUpdate.id, milestone.version_number)} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all">Approve</button>
                                   <button onClick={() => { setReviewModal({ updateId: pendingUpdate.id, type: 'changes_requested', projectId: project.id, title: `Changes Requested: ${milestone.name}` }); }} className="bg-orange-50 border border-orange-300 text-orange-700 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-orange-100 active:scale-95 transition-all">Changes Requested</button>
                                   <button onClick={() => { setReviewModal({ updateId: pendingUpdate.id, type: 'rework_required', projectId: project.id, title: `Rework Required: ${milestone.name}` }); }} className="bg-red-50 border border-red-300 text-red-700 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-red-100 active:scale-95 transition-all">Rework Required</button>
                                </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {((milestone as MilestoneWithUpdates).updates || []).length > 0 ? (
                        <div className="space-y-4">
                          {(milestone as MilestoneWithUpdates).updates.map((update, i) => (
                            <div key={update.id || i} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {update.agent?.name?.charAt(0) || 'A'}
                              </div>
                              <div className="flex-1 bg-white p-3 rounded-lg border border-gray-100">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                    {update.agent?.name || 'Agent'}
                                    {update.review_status === 'pending' && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-bold">Pending</span>}
                                    {update.review_status === 'approved' && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">Approved</span>}
                                    {update.review_status === 'changes_requested' && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">Changes Requested</span>}
                                    {update.review_status === 'rework_required' && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">Rework Required</span>}
                                    {update.review_status === 'rejected' && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">Rejected</span>}
                                    {update.review_status === 'superseded' && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold">Superseded</span>}
                                  </span>
                                  <span className="text-xs text-gray-500">{new Date(update.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">Updated progress to <span className="font-semibold">{update.percent_done}%</span></p>
                                {update.note && <p className="text-sm text-gray-500 italic bg-gray-50 p-2 rounded">"{update.note}"</p>}
                                {update.photo_urls && update.photo_urls.length > 0 && (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {update.photo_urls.map((url, pi) => (
                                      <div key={pi} className="rounded-lg overflow-hidden border border-gray-200 inline-block">
                                        <img src={url} alt="Update" className="h-20 w-auto object-cover" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {update.latitude && update.longitude && (
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${update.latitude},${update.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-2 flex items-center gap-1 w-fit bg-blue-50 px-2 py-1 rounded">
                                    <MapPin className="w-3 h-3" />
                                    View Location
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No updates recorded yet.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )})}
        </div>
      ) : activeTab === 'gallery' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {allPhotos.length > 0 ? (
            allPhotos.map((photo, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group"
              >
                <img src={photo.url} alt={`Gallery ${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <p className="text-white text-xs font-medium truncate">{photo.milestone}</p>
                  <p className="text-white/80 text-[10px]">{photo.agent} • {new Date(photo.date).toLocaleDateString()}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-gray-500">
              <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No photos uploaded yet.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Semantic Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" /> Operational Timeline
            </h3>
            {auditLogs.length > 0 ? (
              <div className="space-y-5 pl-2 border-l-2 border-gray-100">
                {auditLogs.filter(log => !log.action_type.includes('photo') && !log.action_type.includes('view')).slice(0, 15).map((log, idx) => {
                  let semanticText = log.action_type.replace(/_/g, ' ');
                  let icon = <div className="w-2 h-2 rounded-full bg-gray-400" />;
                  if (log.action_type === 'update_approved') {
                    semanticText = `Manager approved ${log.details?.milestone_name || 'milestone update'}`;
                    icon = <div className="w-2 h-2 rounded-full bg-green-500" />;
                  } else if (log.action_type === 'update_submitted') {
                    semanticText = `Agent updated ${log.details?.milestone_name || 'milestone'} to ${log.details?.percent_done}%`;
                    icon = <div className="w-2 h-2 rounded-full bg-blue-500" />;
                  } else if (log.action_type === 'changes_requested') {
                    semanticText = `Manager requested changes for ${log.details?.milestone_name || 'milestone'}`;
                    icon = <div className="w-2 h-2 rounded-full bg-orange-500" />;
                  } else if (log.action_type === 'rework_required' || log.action_type === 'update_rejected') {
                    semanticText = `Manager rejected ${log.details?.milestone_name || 'milestone'} (Rework Required)`;
                    icon = <div className="w-2 h-2 rounded-full bg-red-500" />;
                  } else if (log.action_type === 'project_created') {
                    semanticText = `Project was created and initialized`;
                    icon = <div className="w-2 h-2 rounded-full bg-gray-600" />;
                  }

                  return (
                    <div key={log.id} className="relative pl-4">
                      <div className="absolute -left-[21px] top-1.5 ring-8 ring-white">
                        {icon}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{semanticText}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No activity recorded yet.</p>
            )}
          </div>

          {/* Advanced Audit Log */}
          <details className="group bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <summary className="p-4 cursor-pointer text-sm font-semibold text-gray-700 flex items-center justify-between hover:bg-gray-100 transition-colors">
              Advanced Audit (Raw Immutable Records)
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-0 border-t border-gray-200 bg-white">
              {auditLogs.length > 0 ? (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="sticky top-0 bg-gray-50 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Time (UTC)</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">Action</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="text-sm hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}</td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium uppercase">{log.action_type}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-[10px] max-w-xs truncate" title={JSON.stringify(log.details)}>
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center text-gray-500">
                  <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No activity logs found.</p>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>

    <ReviewModal
      isOpen={reviewModal !== null}
      onClose={() => setReviewModal(null)}
      onSubmit={handleReviewAction}
      projectId={reviewModal?.projectId || ''}
      updateId={reviewModal?.updateId || ''}
      reviewType={reviewModal?.type || 'changes_requested'}
      title={reviewModal?.title || ''}
    />
  </>
  );
}
