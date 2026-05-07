import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { motion } from 'motion/react';

export function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate save
    navigate('/admin/projects');
  };

  return (
    <div className="p-4 md:p-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 hidden md:block">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-sm text-gray-500">Setup a new site and assign roles.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <div className={`flex-1 py-3 text-center text-sm font-medium ${step === 1 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            1. Details
          </div>
          <div className={`flex-1 py-3 text-center text-sm font-medium ${step === 2 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            2. Milestones
          </div>
          <div className={`flex-1 py-3 text-center text-sm font-medium ${step === 3 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            3. Roles
          </div>
        </div>

        <form onSubmit={handleSave} className="p-5 md:p-6">
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input type="text" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Sunset Heights Villa" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location/Address</label>
                <input type="text" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Enter full address" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                    <option>Residential</option>
                    <option>Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                  <input type="text" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Client company or person" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end">
                <button type="button" onClick={() => setStep(2)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Next Step
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Template</label>
                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  <option>Standard Residential Template</option>
                  <option>Commercial Tower Template</option>
                  <option>Custom (Blank)</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">This will pre-populate the milestone phases with default weights.</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Preview Milestones</h4>
                {['Mobilisation', 'Foundation', 'Structure', 'Roofing', 'Finishing'].map((m, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 text-sm text-gray-700">
                    <span>{m}</span>
                    <span className="text-gray-400 font-medium">20%</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="px-6 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  Back
                </button>
                <button type="button" onClick={() => setStep(3)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  Next Step
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Project Manager</label>
                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  <option value="">Select a Manager</option>
                  <option>Bob Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Site Agents</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm font-medium text-gray-800">Charlie Agent</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm font-medium text-gray-800">Dave Agent</span>
                  </label>
                </div>
              </div>

              <div className="pt-6 flex justify-between">
                <button type="button" onClick={() => setStep(2)} className="px-6 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  Back
                </button>
                <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">
                  <Save className="w-4 h-4" />
                  Create Project
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </div>
    </div>
  );
}
