import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useProjects } from '../../projectsContext';
import { Camera, MapPin, UploadCloud, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export function UpdateProgress() {
  const { id, milestoneId } = useParams();
  const navigate = useNavigate();
  const { projects, updateProject } = useProjects();
  
  const project = projects.find(p => p.id === id);
  const milestone = project?.milestones.find(m => m.id === milestoneId);
  
  const [percentDone, setPercentDone] = useState(milestone?.percentDone || 0);
  const [remark, setRemark] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!project || !milestone) return <div className="p-6 text-center">Not found</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Create updated project
    const updatedMilestones = project.milestones.map(m => {
      if (m.id === milestone.id) {
        return {
          ...m,
          percentDone,
          lastUpdate: new Date().toISOString(),
          thumbnail: photos[0] || m.thumbnail,
          history: [
            ...m.history,
            {
              date: new Date().toISOString(),
              percentDone,
              agentName: 'Agent', // Replace with real user name later if needed
              note: remark,
              thumbnail: photos[0],
            }
          ]
        };
      }
      return m;
    });

    const newProjectPercentDone = Math.round(updatedMilestones.reduce((acc, m) => acc + (m.percentDone * (m.weight / 100)), 0));

    const updatedProject = {
      ...project,
      percentDone: newProjectPercentDone,
      milestones: updatedMilestones
    };

    await updateProject(updatedProject);

    setIsSubmitting(false);
    setShowSuccess(true);
    setTimeout(() => {
      navigate(`/agent/projects/${id}`);
    }, 1500);
  };

  const handleSimulatePhoto = () => {
    // Add a random stock photo just to show UI capability
    setPhotos([...photos, `https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80&random=${Math.random()}`]);
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4"
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Update Saved!</h2>
        <p className="text-gray-500">Progress, photos, and location have been synced.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 min-h-screen bg-gray-50 max-w-lg mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Update Milestone</p>
        <h1 className="text-xl font-bold text-gray-900 leading-tight">{milestone.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{project.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Progress Slider */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-end mb-4">
            <label className="block text-sm font-semibold text-gray-900">Completion Level</label>
            <span className="text-2xl font-bold text-blue-600">{percentDone}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="5"
            value={percentDone}
            onChange={(e) => setPercentDone(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-3">Site Photos</label>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative">
                <img src={url} alt="Site capture" className="w-full h-full object-cover" />
              </div>
            ))}
            <button
              type="button"
              onClick={handleSimulatePhoto}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Camera className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Add Photo</span>
            </button>
          </div>
        </div>

        {/* Remarks */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-3">Remarks (Optional)</label>
          <textarea 
            rows={3}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm resize-none"
            placeholder="Any issues or notes about this milestone?"
          />
        </div>

        {/* Location Note */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 rounded-xl text-xs font-medium border border-blue-100">
          <MapPin className="w-4 h-4 shrink-0" />
          <p>GPS coordinates and timestamp will be captured automatically.</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <UploadCloud className="w-5 h-5" />
              Submit Update
            </>
          )}
        </button>
      </form>
    </div>
  );
}
