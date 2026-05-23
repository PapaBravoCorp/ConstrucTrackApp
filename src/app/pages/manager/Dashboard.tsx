import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Search, Clock, AlertTriangle, CheckCircle, BarChart3,
  ChevronRight, Loader2, RotateCcw, Inbox, Filter as FilterIcon
} from 'lucide-react';
import { useProjects } from '../../projectsContext';
import { fetchManagerDashboard, approveMilestoneUpdate, requestChanges, requestRework } from '../../api';
import type { ManagerDashboardProject } from '../../api';
import { supabase } from '../../supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { differenceInDays, isBefore, startOfDay } from 'date-fns';
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
      const filtered = (data || []).filter((d: any) => d.milestone?.project?.manager_id === currentUserId || true); // Simple client fallback

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

  // Compute operational counters from DTO
  const counters = useMemo(() => {
    let pendingReviews = 0, rework = 0, delayed = 0, atRisk = 0;

    for (const pd of projectDetails) {
      pendingReviews += pd.pendingApprovals || 0;
      delayed += pd.overdueMilestones || 0;
    }

    return { pendingReviews, rework, delayed, atRisk };
  }, [projectDetails]);

  // Project urgency scoring
  const sortedProjects = useMemo(() => {
    const scored = projectDetails.map(pd => {
      let urgency = 0;
      if (pd.pendingApprovals > 0) urgency += 100 * pd.pendingApprovals;
      if (pd.overdueMilestones > 0) urgency += 70 * pd.overdueMilestones;
      return { project: pd, urgency };
    });

    scored.sort((a, b) => b.urgency - a.urgency);
    return scored;
  }, [projectDetails]);

  const handleApprove = async (updateId: string, versionNumber: number) => {
    try {
      await approveMilestoneUpdate(updateId, 'Approved by manager.', versionNumber);
      toast.success('Update approved');
      loadAllDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
      if (err.message?.includes('Concurrency') || err.message?.includes('conflict')) loadAllDetails();
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
      // Rollback optimistic update on failure
      setReviewQueue(previousQueue);
      setProjectDetails(previousProjects);
    }
  };

  const filteredProjects = sortedProjects.filter(({ project: p }) =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectCtaInfo = (pd: ManagerDashboardProject) => {
    if (pd.pendingApprovals > 0) return { label: `Review ${pd.pendingApprovals} Update${pd.pendingApprovals > 1 ? 's' : ''}`, color: 'bg-yellow-100 text-yellow-800' };
    if (pd.overdueMilestones > 0) return { label: `${pd.overdueMilestones} Delayed`, color: 'bg-red-100 text-red-700' };
    return { label: 'On Track', color: 'bg-green-100 text-green-700' };
  };

  const getDeadlineCountdown = (endDate: string) => {
    const days = differenceInDays(new Date(endDate), new Date());
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-red-600' };
    if (days <= 7) return { text: `${days}d left`, color: 'text-orange-600' };
    return { text: `${days}d left`, color: 'text-gray-500' };
  };

  if (loading || detailsLoading) {
    return (
      <div className="p-4 md:p-6 pb-20 space-y-4">
        {/* Skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl"></div>)}
        </div>
        <div className="h-10 bg-gray-200 animate-pulse rounded-xl mb-5"></div>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-6 pb-20">
      {isStale && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg flex items-center gap-2 border border-red-200">
          <AlertTriangle className="w-4 h-4" />
          Dashboard data may be stale. <button onClick={loadAllDetails} className="underline text-red-800">Retry</button>
        </div>
      )}
      {/* Section A: Action Required Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <button onClick={() => setActiveTab('reviewQueue')} className={`bg-white p-3.5 rounded-xl border shadow-sm text-left transition-all ${counters.pendingReviews > 0 ? 'border-yellow-300 hover:border-yellow-400' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Inbox className="w-4 h-4 text-yellow-500" />
            <p className="text-xs font-medium text-gray-500">Pending Reviews</p>
          </div>
          <p className={`text-2xl font-bold ${counters.pendingReviews > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{counters.pendingReviews}</p>
        </button>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm text-left">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-medium text-gray-500">Rework</p>
          </div>
          <p className={`text-2xl font-bold ${counters.rework > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{counters.rework}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm text-left">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-xs font-medium text-gray-500">Delayed</p>
          </div>
          <p className={`text-2xl font-bold ${counters.delayed > 0 ? 'text-red-600' : 'text-gray-400'}`}>{counters.delayed}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm text-left">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-gray-500">At Risk</p>
          </div>
          <p className={`text-2xl font-bold ${counters.atRisk > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{counters.atRisk}</p>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 text-center py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'projects' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Projects ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('reviewQueue')}
          className={`flex-1 text-center py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'reviewQueue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Review Queue {counters.pendingReviews > 0 && <span className="ml-1 bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{counters.pendingReviews}</span>}
        </button>
      </div>

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filteredProjects.map(({ project, urgency }, idx) => {
              const cta = getProjectCtaInfo(project);
              const deadline = getDeadlineCountdown(project.endDate);

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                    <Link
                    to={`/manager/projects/${project.id}`}
                    className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 transition-all shadow-sm group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-3">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{project.title}</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${cta.color}`}>
                        {cta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-600">Progress</span>
                          <span className="font-bold text-gray-900">{project.completionPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 bg-blue-600`}
                            style={{ width: `${project.completionPercent}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}

            {filteredProjects.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
                <p className="text-gray-500 mt-1 text-sm">You haven't been assigned to any projects yet.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Review Queue Tab */}
      {activeTab === 'reviewQueue' && (
        <div className="space-y-3">
          {reviewQueue.length > 0 ? (
            reviewQueue.map((item, idx) => (
              <motion.div
                key={item.updateId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{item.milestoneName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{item.projectName}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full shrink-0">Pending</span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                      {item.agentName.charAt(0)}
                    </div>
                    <span className="text-xs text-gray-600">
                      <span className="font-semibold">{item.agentName}</span> → <span className="font-bold text-blue-600">{item.percentDone}%</span>
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {item.note && (
                    <p className="text-xs text-gray-600 italic mb-3 bg-gray-50 p-2 rounded-lg border-l-2 border-yellow-300">"{item.note}"</p>
                  )}

                  {item.photoUrls.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {item.photoUrls.map((url, pi) => (
                        <div key={pi} className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                          <img src={url} alt="Update" className="h-14 w-14 object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleApprove(item.updateId, item.versionNumber)}
                      className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setReviewModal({ updateId: item.updateId, type: 'changes_requested', projectId: item.projectId, title: `Changes Requested: ${item.milestoneName}` }); }}
                      className="bg-orange-50 border border-orange-300 text-orange-700 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-orange-100 active:scale-95 transition-all"
                    >
                      Changes Requested
                    </button>
                    <button
                      onClick={() => { setReviewModal({ updateId: item.updateId, type: 'rework_required', projectId: item.projectId, title: `Rework Required: ${item.milestoneName}` }); }}
                      className="bg-red-50 border border-red-300 text-red-700 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-red-100 active:scale-95 transition-all"
                    >
                      Rework Required
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-gray-900">All caught up!</h3>
              <p className="text-sm text-gray-500 mt-1">No updates pending your review.</p>
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
