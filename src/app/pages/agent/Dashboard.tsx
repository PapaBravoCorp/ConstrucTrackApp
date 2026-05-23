import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth';
import { useProjects } from '../../projectsContext';
import { fetchProject } from '../../api';
import type { ProjectDetail, MilestoneWithUpdates, MilestoneUpdate } from '../../api';
import {
  MapPin, Clock, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle, Navigation, Loader2, AlertCircle, RotateCcw,
  CalendarClock, Camera, RefreshCw, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  isToday, isThisWeek, isThisMonth, isBefore, startOfDay,
  addWeeks, startOfWeek, endOfWeek, differenceInDays, differenceInHours, formatDistanceToNowStrict
} from 'date-fns';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

type DueFilter = 'all' | 'overdue' | 'today' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'rework' | 'inReview';

interface TaskItem {
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  projectName: string;
  percentDone: number;
  dueDate: string | null;
  lastUpdate: string | null;
  status: string;
  scheduleStatus: string;
  latestUpdate: MilestoneUpdate | null;
  urgencyScore: number;
  ctaLabel: string;
  ctaColor: string;
  managerComment: string | null;
  thumbnailUrl: string | null;
}

function computeUrgencyScore(task: {
  latestReviewStatus: string | null;
  scheduleStatus: string;
  dueDate: string | null;
  lastUpdate: string | null;
  percentDone: number;
  status: string;
}): number {
  let score = 0;
  const now = new Date();

  // Rework/Changes = highest priority
  if (task.latestReviewStatus === 'rework_required') score += 1000;
  if (task.latestReviewStatus === 'changes_requested') score += 900;

  // Overdue milestones
  if (task.dueDate && isBefore(new Date(task.dueDate), startOfDay(now))) {
    const daysOverdue = differenceInDays(now, new Date(task.dueDate));
    score += 700 + Math.min(daysOverdue * 10, 200); // cap at +200
  }

  // At risk (due within 48h)
  if (task.scheduleStatus === 'AT_RISK') score += 500;

  // Stale (no update in 5+ days, not completed)
  if (task.lastUpdate && !['Completed', 'Archived'].includes(task.status)) {
    const staleDays = differenceInDays(now, new Date(task.lastUpdate));
    if (staleDays >= 5) score += 300 + Math.min(staleDays * 5, 100);
  }

  // Pending review = lowest operational priority (waiting)
  if (task.latestReviewStatus === 'pending') score += 50;

  // On track with no issues
  if (score === 0) score = 10;

  return score;
}

function getCtaInfo(latestReviewStatus: string | null, scheduleStatus: string, dueDate: string | null, percentDone: number): { label: string; color: string } {
  if (latestReviewStatus === 'rework_required') return { label: 'Fix & Resubmit', color: 'bg-red-600 hover:bg-red-700' };
  if (latestReviewStatus === 'changes_requested') return { label: 'Update Submission', color: 'bg-orange-600 hover:bg-orange-700' };
  if (latestReviewStatus === 'pending') return { label: 'Pending Review', color: 'bg-gray-200 text-gray-600 cursor-default' };
  if (dueDate && isBefore(new Date(dueDate), startOfDay(new Date()))) return { label: 'Submit Progress', color: 'bg-red-600 hover:bg-red-700' };
  if (scheduleStatus === 'AT_RISK') return { label: 'Update Now', color: 'bg-orange-600 hover:bg-orange-700' };
  if (percentDone === 100) return { label: 'Completed', color: 'bg-green-100 text-green-700 cursor-default' };
  return { label: 'Update', color: 'bg-blue-600 hover:bg-blue-700' };
}

function isNextWeek(date: Date): boolean {
  const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
  return date >= nextWeekStart && date <= nextWeekEnd;
}

function DueCountdownBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span className="text-[10px] text-gray-400">No due date</span>;
  const due = new Date(dueDate);
  const now = new Date();
  const overdue = isBefore(due, startOfDay(now));
  const days = Math.abs(differenceInDays(due, now));

  if (overdue) {
    return <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">{days}d overdue</span>;
  }
  const hours = differenceInHours(due, now);
  if (hours <= 48) {
    return <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">Due in {hours}h</span>;
  }
  return <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full">Due in {days}d</span>;
}

const FILTER_LABELS: { key: DueFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'nextWeek', label: 'Next Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'rework', label: 'Rework' },
  { key: 'inReview', label: 'In Review' },
];

export function AgentDashboard() {
  const { user } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const [projectDetails, setProjectDetails] = useState<ProjectDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<DueFilter>('all');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch full project details to get milestone-level data
  useEffect(() => {
    if (projects.length > 0) loadAllProjectDetails();
    else if (!projectsLoading) setLoading(false);
  }, [projects]);

  const loadAllProjectDetails = async () => {
    try {
      const details = await Promise.all(
        projects.map(p => fetchProject(p.id).catch(() => null))
      );
      setProjectDetails(details.filter(Boolean) as ProjectDetail[]);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllProjectDetails();
  };

  // Build flat task list from all projects/milestones
  const allTasks: TaskItem[] = useMemo(() => {
    const tasks: TaskItem[] = [];

    for (const project of projectDetails) {
      for (const milestone of (project.milestones || [])) {
        const m = milestone as MilestoneWithUpdates;
        if (m.status === 'Completed' || m.status === 'Archived' || m.status === 'Cancelled') continue;

        const updates = m.updates || [];
        const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
        const latestReviewStatus = latestUpdate?.review_status || null;

        const cta = getCtaInfo(latestReviewStatus, m.schedule_status || 'ON_TRACK', m.due_date || null, m.percent_done);

        tasks.push({
          milestoneId: m.id,
          milestoneName: m.name,
          projectId: project.id,
          projectName: project.name,
          percentDone: m.percent_done,
          dueDate: m.due_date || null,
          lastUpdate: m.last_update,
          status: m.status || 'Pending',
          scheduleStatus: m.schedule_status || 'ON_TRACK',
          latestUpdate,
          urgencyScore: computeUrgencyScore({
            latestReviewStatus,
            scheduleStatus: m.schedule_status || 'ON_TRACK',
            dueDate: m.due_date || null,
            lastUpdate: m.last_update,
            percentDone: m.percent_done,
            status: m.status || 'Pending',
          }),
          ctaLabel: cta.label,
          ctaColor: cta.color,
          managerComment: latestReviewStatus && ['changes_requested', 'rework_required'].includes(latestReviewStatus)
            ? latestUpdate?.rejection_reason || null
            : null,
          thumbnailUrl: m.thumbnail_url,
        });
      }
    }

    // Sort by urgency (highest first)
    tasks.sort((a, b) => b.urgencyScore - a.urgencyScore);
    return tasks;
  }, [projectDetails]);

  // Apply filters
  const filteredTasks = useMemo(() => {
    const now = new Date();

    return allTasks.filter(task => {
      switch (activeFilter) {
        case 'overdue':
          return task.dueDate && isBefore(new Date(task.dueDate), startOfDay(now));
        case 'today':
          return task.dueDate && isToday(new Date(task.dueDate));
        case 'thisWeek':
          return task.dueDate && isThisWeek(new Date(task.dueDate), { weekStartsOn: 1 });
        case 'nextWeek':
          return task.dueDate && isNextWeek(new Date(task.dueDate));
        case 'thisMonth':
          return task.dueDate && isThisMonth(new Date(task.dueDate));
        case 'rework':
          return task.latestUpdate && ['changes_requested', 'rework_required'].includes(task.latestUpdate.review_status);
        case 'inReview':
          return task.latestUpdate?.review_status === 'pending';
        default:
          return true;
      }
    });
  }, [allTasks, activeFilter]);

  // Compute summary counters
  const counters = useMemo(() => {
    const now = new Date();
    let needsUpdate = 0, rework = 0, pendingReview = 0, overdue = 0;

    for (const t of allTasks) {
      const rs = t.latestUpdate?.review_status;
      if (rs === 'pending') { pendingReview++; continue; }
      if (rs && ['changes_requested', 'rework_required'].includes(rs)) { rework++; continue; }
      if (t.dueDate && isBefore(new Date(t.dueDate), startOfDay(now))) { overdue++; continue; }
      if (!['Completed', 'Archived'].includes(t.status)) { needsUpdate++; }
    }

    return { needsUpdate, rework, pendingReview, overdue };
  }, [allTasks]);

  if (loading || projectsLoading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>;
  }

  return (
    <div className="p-4 pb-24 md:p-6 min-h-screen bg-gray-50">
      {/* Greeting */}
      <div className="mb-5 flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xl">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{getGreeting()},</h1>
            <p className="text-sm font-medium text-gray-600">{user?.name}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Section A: Today's Focus Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <button onClick={() => setActiveFilter('rework')} className={`bg-white p-3.5 rounded-xl border shadow-sm text-left transition-all ${activeFilter === 'rework' ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200 hover:border-red-300'}`}>
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className="w-4 h-4 text-red-500" />
            <p className="text-xs font-medium text-gray-500">Rework</p>
          </div>
          <p className={`text-2xl font-bold ${counters.rework > 0 ? 'text-red-600' : 'text-gray-400'}`}>{counters.rework}</p>
        </button>
        <button onClick={() => setActiveFilter('overdue')} className={`bg-white p-3.5 rounded-xl border shadow-sm text-left transition-all ${activeFilter === 'overdue' ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200 hover:border-orange-300'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-medium text-gray-500">Overdue</p>
          </div>
          <p className={`text-2xl font-bold ${counters.overdue > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{counters.overdue}</p>
        </button>
        <button onClick={() => setActiveFilter('all')} className={`bg-white p-3.5 rounded-xl border shadow-sm text-left transition-all ${activeFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Camera className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-gray-500">Needs Update</p>
          </div>
          <p className={`text-2xl font-bold ${counters.needsUpdate > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{counters.needsUpdate}</p>
        </button>
        <button onClick={() => setActiveFilter('inReview')} className={`bg-white p-3.5 rounded-xl border shadow-sm text-left transition-all ${activeFilter === 'inReview' ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-200 hover:border-green-300'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-green-500" />
            <p className="text-xs font-medium text-gray-500">In Review</p>
          </div>
          <p className={`text-2xl font-bold ${counters.pendingReview > 0 ? 'text-green-600' : 'text-gray-400'}`}>{counters.pendingReview}</p>
        </button>
      </div>

      {/* Section B: Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        {FILTER_LABELS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              activeFilter === f.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}
          >
            {f.label}
            {f.key === 'rework' && counters.rework > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{counters.rework}</span>
            )}
            {f.key === 'overdue' && counters.overdue > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{counters.overdue}</span>
            )}
            {f.key === 'inReview' && counters.pendingReview > 0 && (
              <span className="ml-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{counters.pendingReview}</span>
            )}
          </button>
        ))}
      </div>

      {/* Section C: Priority Task Queue */}
      <div className="space-y-3 mb-6">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task, idx) => {
            const isRework = task.latestUpdate && ['changes_requested', 'rework_required'].includes(task.latestUpdate.review_status);
            const isPending = task.latestUpdate?.review_status === 'pending';
            const isOverdue = task.dueDate && isBefore(new Date(task.dueDate), startOfDay(new Date()));

            return (
              <motion.div
                key={`${task.projectId}-${task.milestoneId}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  isRework ? 'border-red-300 ring-1 ring-red-100' :
                  isOverdue ? 'border-orange-300 ring-1 ring-orange-100' :
                  isPending ? 'border-green-200' :
                  'border-gray-200'
                }`}>
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0 w-full">
                        <h3 className="text-base sm:text-sm font-bold text-gray-900 break-words leading-tight">{task.milestoneName}</h3>
                        <p className="text-xs text-gray-500 mt-1 truncate">{task.projectName}</p>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-2.5 sm:mt-2">
                          <DueCountdownBadge dueDate={task.dueDate} />
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            task.percentDone === 100 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {task.percentDone}%
                          </span>
                          {task.lastUpdate && (
                            <span className="text-[10px] text-gray-400">
                              Updated {formatDistanceToNowStrict(new Date(task.lastUpdate), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CTA Button */}
                      <div className="w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
                        {!isPending && task.percentDone < 100 ? (
                          <Link
                            to={`/agent/projects/${task.projectId}/update/${task.milestoneId}`}
                            className={`block w-full text-center sm:inline-block text-xs font-bold px-4 py-2.5 sm:py-2 rounded-lg text-white shadow-sm active:scale-95 transition-all ${task.ctaColor}`}
                          >
                            {task.ctaLabel}
                          </Link>
                        ) : (
                          <div className={`text-center text-xs font-bold px-4 py-2.5 sm:py-2 rounded-lg ${task.ctaColor}`}>
                            {task.ctaLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Manager comment for rework items */}
                    {task.managerComment && (
                      <div className={`mt-3 p-2.5 rounded-lg border text-sm ${
                        task.latestUpdate?.review_status === 'rework_required'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-orange-50 border-orange-200 text-orange-800'
                      }`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70">
                          {task.latestUpdate?.review_status === 'rework_required' ? 'Rework Required' : 'Changes Requested'}
                        </p>
                        <p className="text-xs leading-relaxed">"{task.managerComment}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
            <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-gray-900">All clear!</h3>
            <p className="text-sm text-gray-500 mt-1">
              {activeFilter === 'all' ? 'No active milestones right now.' : `No tasks matching "${FILTER_LABELS.find(f => f.key === activeFilter)?.label}" filter.`}
            </p>
          </div>
        )}
      </div>

      {/* Section D: All Projects Accordion */}
      <button
        onClick={() => setShowAllProjects(!showAllProjects)}
        className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm mb-3"
      >
        <span className="text-sm font-semibold text-gray-700">All Projects ({projects.length})</span>
        {showAllProjects ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence>
        {showAllProjects && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {projects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  to={`/agent/projects/${project.id}`}
                  className="block bg-white rounded-2xl p-4 border border-gray-200 shadow-sm active:scale-95 transition-transform"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="pr-4">
                      <h3 className="text-sm font-bold text-gray-900 leading-tight">{project.name}</h3>
                      <div className="flex items-start gap-1.5 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                        <span className="line-clamp-1">{project.address}</span>
                      </div>
                      {project.end_date && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <CalendarClock className="w-3 h-3 text-gray-400" /> Ends {new Date(project.end_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-bold ${project.percent_done === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                      {project.percent_done}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${project.status === 'Delayed' ? 'bg-orange-500' : 'bg-blue-600'}`}
                      style={{ width: `${project.percent_done}%` }}
                    />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {projects.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No sites assigned</h3>
          <p className="text-gray-500 text-sm mt-1">You currently have no active sites.</p>
        </div>
      )}
    </div>
  );
}
