import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Search, Clock, AlertTriangle, CheckCircle, BarChart3,
  ChevronRight, RotateCcw, Inbox, Calendar, AlertOctagon, CheckCircle2
} from 'lucide-react';
import { useProjects } from '../../projectsContext';
import { fetchManagerDashboard, approveMilestoneUpdate, requestChanges, requestRework } from '../../api';
import type { ManagerDashboardProject, Milestone } from '../../api';
import { supabase } from '../../supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { ReviewModal } from '../../components/ReviewModal';

type DashboardTab = 'projects' | 'reviewQueue';

interface ReviewItem {
  updateId: string;
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  projectName: string;
  agentName: string;
  percentDone: number;
  note: string | null;
  photoUrls: string[];
  submittedAt: string;
  versionNumber: number;
}

// Heuristic matching for stall thresholds. Eventually moving to DB enum `stage_type`
const STALL_THRESHOLD_BY_STAGE: Record<string, number> = {
  'excavation': 2,
  'foundation': 3,
  'superstructure': 5,
  'structure': 5,
  'finishing': 7,
  'approvals': 10,
  'default': 5
};

function getStallThreshold(milestoneName: string): number {
  const name = milestoneName.toLowerCase();
  for (const [key, value] of Object.entries(STALL_THRESHOLD_BY_STAGE)) {
    if (name.includes(key)) return value;
  }
  return STALL_THRESHOLD_BY_STAGE['default'];
}

export function ManagerDashboard() {
  const { projects, loading } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('projects');
  const [projectDetails, setProjectDetails] = useState<ManagerDashboardProject[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  
  // Review Queue state
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ updateId: string; type: 'changes_requested' | 'rework_required'; projectId: string; title: string } | null>(null);

  // Enriched Projects & Operational Alerts
  const [enrichedProjects, setEnrichedProjects] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ critical: any[], review: any[], monitoring: any[] }>({ critical: [], review: [], monitoring: [] });

  useEffect(() => {
    if (projects.length > 0) {
      loadAllDetails();
      loadReviewQueue();
    } else if (!loading) {
      setDetailsLoading(false);
      setQueueLoading(false);
    }
  }, [projects]);

  const loadAllDetails = async () => {
    try {
      setIsStale(false);
      const dashboard = await fetchManagerDashboard(50);
      setProjectDetails(dashboard.items);
    } catch (err) {
      console.error('Failed to load project details:', err);
      setIsStale(true);
    } finally {
      setDetailsLoading(false);
    }
  };

  const loadReviewQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('milestone_updates')
        .select(`
          id, percent_done, note, photo_urls, created_at, review_status,
          agent:profiles!agent_id(name),
          milestone:milestones!inner(id, name, version_number, project:projects!inner(id, name, manager_id))
        `)
        .eq('review_status', 'pending');
        
      if (error) throw error;
      
      let currentUserId = null;
      if (supabase.auth.getSession) {
        const session = await supabase.auth.getSession();
        currentUserId = session.data.session?.user?.id;
      }
      const filtered = (data || []).filter((d: any) => d.milestone?.project?.manager_id === currentUserId || true);

      const queue: ReviewItem[] = filtered.map((d: any) => ({
        updateId: d.id,
        milestoneId: d.milestone.id,
        milestoneName: d.milestone.name,
        projectId: d.milestone.project.id,
        projectName: d.milestone.project.name,
        agentName: d.agent?.name || 'Agent',
        percentDone: d.percent_done,
        note: d.note,
        photoUrls: d.photo_urls || [],
        submittedAt: d.created_at,
        versionNumber: d.milestone.version_number
      }));
      
      queue.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
      setReviewQueue(queue);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  // Compute Enriched Projects and Operational Feed Alerts
  useEffect(() => {
    if (projects.length > 0 && projectDetails.length > 0) {
      let crit: any[] = [];
      let mon: any[] = [];
      
      const enriched = projects.map(p => {
        const pd = projectDetails.find(d => d.id === p.id);
        
        let oldestDelayDays = 0;
        let delayedMilestonesCount = 0;
        let activeMilestone: Milestone | null = null;
        let activeIndex = -1;
        
        p.milestones?.forEach((m, idx) => {
           if (m.percent_done < 100 && !activeMilestone) {
             activeMilestone = m;
             activeIndex = idx;
           }
           if (m.due_date && m.percent_done < 100) {
              const diff = differenceInDays(new Date(), new Date(m.due_date));
              if (diff > 0) {
                delayedMilestonesCount++;
                if (diff > oldestDelayDays) oldestDelayDays = diff;
              }
           }
        });

        if (!activeMilestone && p.milestones?.length > 0) {
          activeMilestone = p.milestones[0];
          activeIndex = 0;
        }

        let daysSinceLastUpdate = 0;
        let isStalled = false;
        
        let lastActivityDate = pd?.latestActivityAt || p.updated_at;
        if (p.milestones) {
            const updates = p.milestones.map(m => m.last_update).filter(Boolean);
            if (updates.length > 0) {
                updates.sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());
                if (new Date(updates[0]!) > new Date(lastActivityDate)) {
                  lastActivityDate = updates[0]!;
                }
            }
        }
        
        if (lastActivityDate) {
          daysSinceLastUpdate = differenceInDays(new Date(), new Date(lastActivityDate));
        }

        if (activeMilestone) {
          const threshold = getStallThreshold(activeMilestone.name);
          isStalled = daysSinceLastUpdate > threshold;
        }

        const pendingApprovalsCount = pd?.pendingApprovals || 0;
        
        let status = 'On Track';
        let statusColor = 'bg-green-100 text-green-700 border-green-200';
        
        const isDelayed = oldestDelayDays > 0 || (pd?.overdueMilestones && pd.overdueMilestones > 0);
        
        // Priority generation for alerts
        if (isStalled) {
          status = 'Stalled';
          statusColor = 'bg-orange-100 text-orange-700 border-orange-200';
          crit.push({ type: 'stall', project: p, days: daysSinceLastUpdate, message: `${p.name} — No updates in ${daysSinceLastUpdate}d` });
        } else if (isDelayed && oldestDelayDays > 7) {
          status = 'Delayed';
          statusColor = 'bg-red-100 text-red-700 border-red-200';
          crit.push({ type: 'delay', project: p, days: oldestDelayDays, message: `${p.name} — ${activeMilestone?.name || 'Phase'} overdue by ${oldestDelayDays}d` });
        } else if (isDelayed) {
          status = 'Delayed';
          statusColor = 'bg-red-100 text-red-700 border-red-200';
          mon.push({ type: 'delay', project: p, days: oldestDelayDays, message: `${p.name} — ${activeMilestone?.name || 'Phase'} delayed${oldestDelayDays ? ` ${oldestDelayDays}d` : ''}` });
        }

        return {
          ...p,
          dashboardStats: {
            oldestDelayDays,
            delayedMilestonesCount,
            activeMilestone,
            activeIndex,
            daysSinceLastUpdate,
            isStalled,
            pendingApprovalsCount,
            status,
            statusColor,
            lastActivityDate
          }
        };
      });

      setEnrichedProjects(enriched);
      
      // Compute Review Alerts based on Review Queue
      let reviewAlerts: any[] = [];
      if (reviewQueue.length > 0) {
         const projMap = new Map();
         reviewQueue.forEach(rq => projMap.set(rq.projectId, true));
         reviewAlerts.push({
           type: 'review',
           message: `${reviewQueue.length} approvals pending across ${projMap.size} project${projMap.size > 1 ? 's' : ''}`
         });
      }

      setAlerts({ critical: crit, review: reviewAlerts, monitoring: mon });
    }
  }, [projects, projectDetails, reviewQueue]);

  const handleApprove = async (updateId: string, versionNumber: number) => {
    try {
      await approveMilestoneUpdate(updateId, 'Approved by manager.', versionNumber);
      toast.success('Update approved');
      loadAllDetails();
      loadReviewQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
      if (err.message?.includes('Concurrency') || err.message?.includes('conflict')) {
        loadAllDetails();
        loadReviewQueue();
      }
    }
  };

  const handleReviewAction = async (text: string, category?: string) => {
    if (!reviewModal) return;
    
    // Optimistic UI Removal
    const previousQueue = [...reviewQueue];
    const previousProjects = [...projectDetails];
    
    setReviewQueue(q => q.filter(r => r.updateId !== reviewModal.updateId));
    
    try {
      if (reviewModal.type === 'changes_requested') {
        await requestChanges(reviewModal.updateId, text, category);
        toast.success('Changes requested');
      } else {
        await requestRework(reviewModal.updateId, text, category);
        toast.success('Rework required sent');
      }
      setReviewModal(null);
      
      // Background revalidation
      loadAllDetails();
      loadReviewQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
      setReviewQueue(previousQueue);
      setProjectDetails(previousProjects);
    }
  };

  const filteredProjects = enrichedProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || detailsLoading) {
    return (
      <div className="p-4 md:p-6 pb-20 space-y-4">
        <div className="h-40 bg-gray-200 animate-pulse rounded-xl mb-5"></div>
        <div className="h-10 bg-gray-200 animate-pulse rounded-xl mb-5"></div>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-6 pb-20 max-w-4xl mx-auto">
      {isStale && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg flex items-center gap-2 border border-red-200">
          <AlertTriangle className="w-4 h-4" />
          Dashboard data may be stale. <button onClick={loadAllDetails} className="underline text-red-800">Retry</button>
        </div>
      )}

      {/* Operational Status: Priority Feed */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Operational Status</h2>
        
        <div className="space-y-3">
          {/* Critical */}
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-red-900 uppercase tracking-wide">Critical</h3>
            </div>
            {alerts.critical.length > 0 ? (
              <ul className="space-y-2">
                {alerts.critical.map((alert, i) => (
                  <li key={i} className="text-sm text-red-800 flex items-start gap-2 font-medium">
                    <span className="mt-0.5 opacity-60">•</span>
                    <Link to={`/manager/projects/${alert.project.id}`} className="hover:underline">{alert.message}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-red-700/60 font-medium">No critical delays or stalls.</p>
            )}
          </div>

          {/* Needs Review */}
          <div className="bg-yellow-50/50 border border-yellow-200/60 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Inbox className="w-4 h-4 text-yellow-600" />
              <h3 className="text-sm font-bold text-yellow-900 uppercase tracking-wide">Needs Review</h3>
            </div>
            {alerts.review.length > 0 ? (
              <ul className="space-y-2">
                {alerts.review.map((alert, i) => (
                  <li key={i} className="text-sm text-yellow-800 flex items-start gap-2 font-medium cursor-pointer hover:underline" onClick={() => setActiveTab('reviewQueue')}>
                    <span className="mt-0.5 opacity-60">•</span>
                    <span>{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-yellow-700/60 font-medium">No pending approvals.</p>
            )}
          </div>

          {/* Monitoring */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Monitoring</h3>
            </div>
            {alerts.monitoring.length > 0 ? (
              <ul className="space-y-2">
                {alerts.monitoring.map((alert, i) => (
                  <li key={i} className="text-sm text-blue-800 flex items-start gap-2 font-medium">
                    <span className="mt-0.5 opacity-60">•</span>
                    <Link to={`/manager/projects/${alert.project.id}`} className="hover:underline">{alert.message}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-blue-700/60 font-medium">No minor delays to monitor.</p>
            )}
          </div>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 text-center py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'projects' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Operational Feed
        </button>
        <button
          onClick={() => setActiveTab('reviewQueue')}
          className={`flex-1 text-center py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'reviewQueue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Review Queue {reviewQueue.length > 0 && <span className="ml-1.5 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{reviewQueue.length}</span>}
        </button>
      </div>

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            {filteredProjects.map((project, idx) => {
              const stats = project.dashboardStats;
              const { activeMilestone, activeIndex, isStalled, status, statusColor, pendingApprovalsCount, oldestDelayDays, lastActivityDate, daysSinceLastUpdate } = stats;
              
              const totalMilestones = project.milestones?.length || 0;
              const prevMilestone = activeIndex > 0 ? project.milestones[activeIndex - 1] : null;
              const nextMilestone = activeIndex < totalMilestones - 1 && activeIndex !== -1 ? project.milestones[activeIndex + 1] : null;
              const remainingCount = Math.max(0, totalMilestones - (activeIndex + 2));

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link
                    to={`/manager/projects/${project.id}`}
                    className="block bg-white border border-gray-200 rounded-2xl hover:border-blue-400 transition-all shadow-sm group overflow-hidden"
                  >
                    {/* Header */}
                    <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${statusColor}`}>
                        {status}
                      </span>
                    </div>

                    {/* Primary Operational Context */}
                    <div className="px-5 py-4 space-y-2.5">
                      <div className="text-sm flex items-center">
                        <span className="text-gray-500 font-medium w-28 shrink-0">Current Phase:</span>
                        <span className="font-bold text-gray-900">{activeMilestone?.name || 'Complete'}</span>
                      </div>
                      
                      {isStalled && (
                        <div className="text-sm flex items-center gap-1.5 text-orange-700 font-bold bg-orange-50/80 p-2 rounded-lg border border-orange-100">
                          <AlertTriangle className="w-4 h-4" />
                          No site updates in {daysSinceLastUpdate}d
                        </div>
                      )}
                      
                      {pendingApprovalsCount > 0 && (
                        <div className="text-sm flex items-center gap-1.5 text-yellow-700 font-bold">
                          <Inbox className="w-4 h-4" />
                          {pendingApprovalsCount} approval{pendingApprovalsCount > 1 ? 's' : ''} pending
                        </div>
                      )}
                    </div>

                    {/* Secondary Metadata */}
                    <div className="px-5 py-3 bg-gray-50/80 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 text-xs font-medium">
                      <div className="text-gray-500">
                        Overall Completion: <span className="font-bold text-gray-900">{project.percent_done}%</span>
                      </div>
                      {oldestDelayDays > 0 && (
                        <div className="text-gray-500">
                          Oldest delay: <span className="font-bold text-red-600">{oldestDelayDays}d</span>
                        </div>
                      )}
                      <div className="text-gray-500">
                        Last verified update: <span className="font-bold text-gray-900">{lastActivityDate ? new Date(lastActivityDate).toLocaleDateString() : 'None'}</span>
                      </div>
                    </div>

                    {/* Compact Phase Strip */}
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center text-xs overflow-hidden whitespace-nowrap bg-white">
                      {prevMilestone && (
                        <>
                          <span className="flex items-center gap-1.5 text-green-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 
                            <span className="truncate max-w-[100px]">{prevMilestone.name}</span>
                          </span>
                          <ChevronRight className="w-3 h-3 text-gray-300 mx-2 shrink-0" />
                        </>
                      )}
                      {activeMilestone ? (
                        <>
                          <span className="flex items-center gap-1.5 text-blue-700 font-bold">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100" /> 
                            <span className="truncate max-w-[120px]">{activeMilestone.name}</span> ({activeMilestone.percent_done}%)
                          </span>
                          {nextMilestone && <ChevronRight className="w-3 h-3 text-gray-300 mx-2 shrink-0" />}
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5 text-green-700 font-bold">
                          <CheckCircle2 className="w-4 h-4" /> All Phases Complete
                        </span>
                      )}
                      {nextMilestone && (
                        <>
                          <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                            <div className="w-2 h-2 rounded-sm border border-gray-300 bg-gray-50" /> 
                            <span className="truncate max-w-[100px]">{nextMilestone.name}</span>
                          </span>
                        </>
                      )}
                      {remainingCount > 0 && (
                        <span className="text-gray-400 ml-2 font-medium">(+{remainingCount} more)</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })}

            {filteredProjects.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900">No projects found</h3>
                <p className="text-gray-500 mt-1 text-sm font-medium">You haven't been assigned to any projects yet.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Review Queue Tab */}
      {activeTab === 'reviewQueue' && (
        <div className="space-y-4">
          {reviewQueue.length > 0 ? (
            reviewQueue.map((item, idx) => (
              <motion.div
                key={item.updateId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{item.milestoneName}</h3>
                      <p className="text-xs font-medium text-gray-500 mt-0.5 truncate">{item.projectName}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 border border-yellow-200">Pending</span>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold ring-2 ring-white shadow-sm">
                      {item.agentName.charAt(0)}
                    </div>
                    <span className="text-xs text-gray-600 font-medium">
                      <span className="font-bold text-gray-900">{item.agentName}</span> → <span className="font-bold text-blue-600">{item.percentDone}%</span>
                    </span>
                    <span className="text-[10px] font-medium text-gray-400 ml-auto bg-gray-50 px-2 py-1 rounded-lg">
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {item.note && (
                    <p className="text-sm text-gray-700 italic mb-4 bg-yellow-50/50 p-3 rounded-xl border-l-2 border-yellow-400">"{item.note}"</p>
                  )}

                  {item.photoUrls.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {item.photoUrls.map((url, pi) => (
                        <div key={pi} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 p-0.5">
                          <img src={url} alt="Update" className="h-16 w-16 object-cover rounded-lg" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleApprove(item.updateId, item.versionNumber)}
                      className="bg-blue-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-blue-700 active:scale-95 transition-all flex-1"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setReviewModal({ updateId: item.updateId, type: 'changes_requested', projectId: item.projectId, title: `Changes Requested: ${item.milestoneName}` }); }}
                      className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-orange-50 active:scale-95 transition-all"
                    >
                      Changes
                    </button>
                    <button
                      onClick={() => { setReviewModal({ updateId: item.updateId, type: 'rework_required', projectId: item.projectId, title: `Rework Required: ${item.milestoneName}` }); }}
                      className="bg-white border border-red-200 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-50 active:scale-95 transition-all"
                    >
                      Rework
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900">All caught up!</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">No updates pending your review.</p>
            </div>
          )}
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
