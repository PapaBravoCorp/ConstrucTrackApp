import React from 'react';
import { LayoutTemplate, Plus, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';

export function TemplatesLibrary() {
  const templates = [
    { id: 't1', name: 'Standard Residential', phases: 6, createdBy: 'Alice Admin', date: '2025-11-20' },
    { id: 't2', name: 'Commercial High-rise', phases: 12, createdBy: 'Alice Admin', date: '2026-01-10' },
    { id: 't3', name: 'Villa Extension', phases: 4, createdBy: 'Alice Admin', date: '2026-03-05' }
  ];

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Template Library</h1>
          <p className="text-sm text-gray-500 mt-1">Manage standard milestone lists for easy project creation.</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-5 h-5" />
          <span>New Template</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl, idx) => (
          <motion.div
            key={tpl.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-all shadow-sm group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                <LayoutTemplate className="w-6 h-6" />
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{tpl.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{tpl.phases} Default Phases</p>
            
            <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
              <span>By {tpl.createdBy}</span>
              <span>{tpl.date}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
