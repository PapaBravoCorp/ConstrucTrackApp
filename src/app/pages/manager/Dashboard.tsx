import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Search, Clock, AlertTriangle, CheckCircle, BarChart3,
  ChevronRight, Loader2, RotateCcw, Inbox, Filter as FilterIcon
} from 'lucide-react';
import { useProjects } from '../../projectsContext';
import { fetchProject, approveMilestoneUpdate, requestChanges, requestRework } from '../../api';
import type { ProjectDetail, MilestoneWithUpdates, MilestoneUpdate } from '../../api';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { differenceInDays, isBefore, startOfDay } from 'date-fns';

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
  const [projectDetails, setProjectDetails] = useState<ProjectDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ updateId: string; type: 'changes_requested' | 'rework_required' } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewCategory, setReviewCategory] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (projects.length > 0) loadAllDetails();
    else if (!loading) setDetailsLoading(false);
  }, [projects]);

  const loadAllDetails = async () => {
    try {
      const details = await Promise.all(
        projects.map(p => fetchProject(p.id).catch(() => null))
      );
      setProjectDetails(details.filter(Boolean) as ProjectDetail[]);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Compute operational counters from milestone-level data
  const counters = useMemo(() => {
    let pendingReviews = 0, rework = 0, delayed = 0, atRisk = 0;

    for (const pd of projectDetails) {
      for (const m of (pd.milestones || [])) {
        const milestone = m as MilestoneWithUpdates;
        if (['Completed', 'Archived', 'Cancelled'].includes(milestone.status || '')) continue;

        // Check pending updates
        const updates = milestone.updates || [];
        const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
        if (latestUpdate?.review_status === 'pending') pendingReviews++;
        if (latestUpdate && ['changes_requested', 'rework_required'].includes(latestUpdate.review_status)) rework++;

        // Check schedule
        if (milestone.due_date) {
          const due = new Date(milestone.due_date);
          const now = new Date();
          if (isBefore(due, startOfDay(now)) && !['Completed', 'Archived'].includes(milestone.status || '')) {
            delayed++;
          } else {
            const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursUntil > 0 && hoursUntil <= 48) atRisk++;
          }
        }
      }
    }

    return { pendingReviews, rework, delayed, atRisk };
  }, [projectDetails]);

  // Build review queue
  const reviewQueue: ReviewItem[] = useMemo(() => {
    const queue: ReviewItem[] = [];

    for (const pd of projectDetails) {
      for (const m of (pd.milestones || [])) {
        const milestone = m as MilestoneWithUpdates;
        const updates = milestone.updates || [];
        const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null;

        if (latestUpdate?.review_status === 'pending') {
          queue.push({
            updateId: latestUpdate.id,
            milestoneId: milestone.id,
            milestoneName: milestone.name,
            projectId: pd.id,
            projectName: pd.name,
            agentName: latestUpdate.agent?.name || 'Agent',
            percentDone: latestUpdate.percent_done,
            note: latestUpdate.note,
            photoUrls: latestUpdate.photo_urls || [],
            submittedAt: latestUpdate.created_at,
            versionNumber: milestone.version_number,
          });
        }
      }
    }

    // Sort by submission time (oldest first for FIFO processing)
    queue.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    return queue;
  }, [projectDetails]);

  // Project urgency scoring
  const sortedProjects = useMemo(() => {
    const scored = projectDetails.map(pd => {
      let urgency = 0;

      for (const m of (pd.milestones || [])) {
        const milestone = m as MilestoneWithUpdates;
        if (['Completed', 'Archived', 'Cancelled'].includes(milestone.status || '')) continue;

        const updates = milestone.updates || [];
        const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
        const rs = latestUpdate?.review_status;

        if (rs === 'pending') urgency += 100;
        if (rs && ['changes_requested', 'rework_required'].includes(rs)) urgency += 90;

        if (milestone.due_date) {
          const due = new Date(milestone.due_date);
          if (isBefore(due, startOfDay(new Date()))) {
            urgency += 70 + Math.min(differenceInDays(new Date(), due) * 5, 50);
          } else {
            const hoursUntil = (due.getTime() - new Date().getTime()) / (1000 * 60 * 60);
            if (hoursUntil <= 48) urgency += 40;
          }
        }
      }

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

  const handleReviewAction = async () => {
    if (!reviewModal || !reviewReason.trim()) return;
    setReviewSubmitting(true);
    try {
      if (reviewModal.type === 'changes_requested') {
        await requestChanges(reviewModal.updateId, reviewReason, reviewCategory || undefined);
        toast.success('Changes requested');
      } else {
        await requestRework(reviewModal.updateId, reviewReason, reviewCategory || undefined);
        toast.success('Rework required sent');
      }
      setReviewModal(null);
      setReviewReason('');
      setReviewCategory('');
      loadAllDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const filteredProjects = sortedProjects.filter(({ project: p }) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectCtaInfo = (pd: ProjectDetail) => {
    let pending = 0, rw = 0, del = 0;
    for (const m of (pd.milestones || [])) {
      const milestone = m as MilestoneWithUpdates;
      if (['Completed', 'Archived', 'Cancelled'].includes(milestone.status || '')) continue;
      const updates = milestone.updates || [];
      const latest = updates.length > 0 ? updates[updates.length - 1] : null;
      if (latest?.review_status === 'pending') pending++;
      if (latest && ['changes_requested', 'rework_required'].includes(latest.review_status)) rw++;
      if (milestone.due_date && isBefore(new Date(milestone.due_date), startOfDay(new Date()))) del++;
    }
    if (pending > 0) return { label: `Review ${pending} Update${pending > 1 ? 's' : ''}`, color: 'bg-yellow-100 text-yellow-800' };
    if (del > 0) return { label: `${del} Delayed`, color: 'bg-red-100 text-red-700' };
    if (rw > 0) return { label: `${rw} Rework`, color: 'bg-orange-100 text-orange-700' };
    return { label: 'On Track', color: 'bg-green-100 text-green-700' };
  };

  const getDeadlineCountdown = (endDate: string) => {
    const days = differenceInDays(new Date(endDate), new Date());
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-red-600' };
    if (days <= 7) return { text: `${days}d left`, color: 'text-orange-600' };
    return { text: `${days}d left`, color: 'text-gray-500' };
  };

  if (loading || detailsLoading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <>
    <div className="p-4 md:p-6 pb-20">
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
              const deadline = getDeadlineCountdown(project.end_date);

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
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{project.address}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${cta.color}`}>
                        {cta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className={`font-medium ${deadline.color}`}>{deadline.text}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        <span>{project.milestones?.length || 0} milestones</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-600">Progress</span>
                          <span className="font-bold text-gray-900">{project.percent_done}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${project.status === 'Delayed' ? 'bg-orange-500' : 'bg-blue-600'}`}
                            style={{ width: `${project.percent_done}%` }}
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
                      onClick={() => { setReviewModal({ updateId: item.updateId, type: 'changes_requested' }); setReviewReason(''); setReviewCategory(''); }}
                      className="bg-orange-50 border border-orange-300 text-orange-700 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-orange-100 active:scale-95 transition-all"
                    >
                      Changes Requested
                    </button>
                    <button
                      onClick={() => { setReviewModal({ updateId: item.updateId, type: 'rework_required' }); setReviewReason(''); setReviewCategory(''); }}
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

    {/* Review Action Modal */}
    {reviewModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReviewModal(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className={`px-5 py-4 ${reviewModal.type === 'rework_required' ? 'bg-red-50 border-b border-red-100' : 'bg-orange-50 border-b border-orange-100'}`}>
            <h3 className="text-lg font-bold text-gray-900">
              {reviewModal.type === 'rework_required' ? '🔁 Rework Required' : '✏️ Changes Requested'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {reviewModal.type === 'rework_required'
                ? 'The agent will need to redo and resubmit this work.'
                : 'The agent should address your feedback and resubmit.'}
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="Explain what needs to be changed or redone..."
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm resize-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category <span className="text-gray-400">(optional)</span></label>
              <select
                value={reviewCategory}
                onChange={(e) => setReviewCategory(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              >
                <option value="">Select a category...</option>
                <option value="work_incomplete">Work Incomplete</option>
                <option value="incorrect_photo">Incorrect Photo</option>
                <option value="quantity_mismatch">Quantity Mismatch</option>
                <option value="safety_concern">Safety Concern</option>
                <option value="clarification_needed">Clarification Needed</option>
                <option value="scope_deviation">Scope Deviation</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setReviewModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-xl font-semibold hover:bg-gray-200 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAction}
                disabled={!reviewReason.trim() || reviewSubmitting}
                className={`flex-1 text-white p-3 rounded-xl font-semibold shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  reviewModal.type === 'rework_required' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {reviewSubmitting ? 'Submitting...' : reviewModal.type === 'rework_required' ? 'Require Rework' : 'Request Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
