import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { fetchProject, approveMilestoneUpdate, requestChanges, requestRework } from '../../api';
import type { ProjectDetail, MilestoneWithUpdates } from '../../api';
import { Clock, Image as ImageIcon, History, ChevronDown, ChevronUp, MapPin, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export function ManagerProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'milestones' | 'gallery'>('milestones');
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{ updateId: string; type: 'changes_requested' | 'rework_required' } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewCategory, setReviewCategory] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

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

  const handleReviewAction = async () => {
    if (!reviewModal || !reviewReason.trim()) return;
    setReviewSubmitting(true);
    try {
      if (reviewModal.type === 'changes_requested') {
        await requestChanges(reviewModal.updateId, reviewReason, reviewCategory || undefined);
        toast.success('Changes requested successfully');
      } else {
        await requestRework(reviewModal.updateId, reviewReason, reviewCategory || undefined);
        toast.success('Rework required sent');
      }
      setReviewModal(null);
      setReviewReason('');
      setReviewCategory('');
      loadProject();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!project) return <div className="p-6 text-center">Project not found</div>;

  // Build progress chart from real milestone update data
  const buildProgressData = () => {
    const allUpdates = project.milestones.flatMap(m => 
      (m.updates || []).map(u => ({
        date: new Date(u.created_at),
        month: new Date(u.created_at).toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      }))
    );
    
    // Group by month and show project percent at each point
    const monthMap = new Map<string, number>();
    const months = [...new Set(allUpdates.map(u => u.month))];
    
    if (months.length === 0) {
      return [{ name: 'Start', actual: 0 }, { name: 'Current', actual: project.percent_done }];
    }

    // Simple: show cumulative progress
    return [
      { name: 'Start', actual: 0 },
      ...months.map((m, i) => ({ name: m, actual: Math.round((project.percent_done / months.length) * (i + 1)) })),
      { name: 'Current', actual: project.percent_done },
    ];
  };

  const progressData = buildProgressData();

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
            <div className="flex items-center text-sm text-gray-500 mt-1 gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>{project.address}</span>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${
            project.status === 'On Track' ? 'bg-green-100 text-green-700' :
            project.status === 'Delayed' ? 'bg-orange-100 text-orange-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {project.status === 'On Track' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {project.status}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-gray-700">Overall Progress</span>
            <span className="font-bold text-gray-900">{project.percent_done}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${project.status === 'Delayed' ? 'bg-orange-500' : 'bg-blue-600'}`}
              style={{ width: `${project.percent_done}%` }}
            />
          </div>
        </div>

        <div className="h-48 mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Progress Trend</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={progressData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Area type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Progress %" />
            </AreaChart>
          </ResponsiveContainer>
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
                    <h3 className="font-semibold text-gray-900">{milestone.name}</h3>
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
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                        {milestone.status || 'Pending'}
                      </span>
                      <span className={`font-bold ${milestone.percent_done === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                        {milestone.percent_done}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${milestone.percent_done === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${milestone.percent_done}%` }}
                    />
                  </div>
                  <div className="flex items-center text-xs text-gray-500 mt-2 gap-4">
                    <span>Weight: {milestone.weight}%</span>
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
                                   <button onClick={() => { setReviewModal({ updateId: pendingUpdate.id, type: 'changes_requested' }); setReviewReason(''); setReviewCategory(''); }} className="bg-orange-50 border border-orange-300 text-orange-700 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-orange-100 active:scale-95 transition-all">Changes Requested</button>
                                   <button onClick={() => { setReviewModal({ updateId: pendingUpdate.id, type: 'rework_required' }); setReviewReason(''); setReviewCategory(''); }} className="bg-red-50 border border-red-300 text-red-700 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-red-100 active:scale-95 transition-all">Rework Required</button>
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
                                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {update.latitude.toFixed(4)}, {update.longitude.toFixed(4)}
                                  </p>
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
      ) : (
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
