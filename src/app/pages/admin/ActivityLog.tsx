import React, { useState, useEffect } from 'react';
import { fetchActivityLog } from '../../api';
import type { ActivityLogEntry } from '../../api';
import { Clock, Users, Building, LayoutTemplate, Milestone, Filter, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    loadActivity();
  }, [entityFilter, page]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      const result = await fetchActivityLog({
        limit,
        offset: page * limit,
        entityType: entityFilter || undefined,
      });
      setEntries(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'project': return <Building className="w-4 h-4" />;
      case 'milestone': return <Milestone className="w-4 h-4" />;
      case 'user': return <Users className="w-4 h-4" />;
      case 'template': return <LayoutTemplate className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'text-green-700 bg-green-50';
      case 'updated': return 'text-blue-700 bg-blue-50';
      case 'deleted': return 'text-red-700 bg-red-50';
      case 'deactivated': return 'text-orange-700 bg-orange-50';
      case 'progress_update': return 'text-purple-700 bg-purple-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-sm text-gray-500 mt-1">Audit trail of all actions across the platform.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => { setEntityFilter(''); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !entityFilter ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {['project', 'milestone', 'user', 'template'].map((type) => (
          <button
            key={type}
            onClick={() => { setEntityFilter(type); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              entityFilter === type ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {getEntityIcon(type)}
            {type.charAt(0).toUpperCase() + type.slice(1)}s
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {entries.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 shrink-0 mt-0.5">
                    {getEntityIcon(entry.entity_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{entry.user?.name || 'System'}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                      <span className="text-sm text-gray-500">
                        {entry.entity_type}
                      </span>
                    </div>
                    {entry.details && (
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {entry.details.name || entry.details.milestoneName || JSON.stringify(entry.details).substring(0, 100)}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </div>

            {entries.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No activity recorded yet.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
