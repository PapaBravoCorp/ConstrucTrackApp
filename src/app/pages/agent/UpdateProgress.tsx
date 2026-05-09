import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { fetchProject, submitProgressUpdate, uploadSitePhoto } from '../../api';
import type { ProjectDetail } from '../../api';
import { useAuth } from '../../auth';
import { Camera, MapPin, UploadCloud, CheckCircle2, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export function UpdateProgress() {
  const { id, milestoneId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [percentDone, setPercentDone] = useState(0);
  const [remark, setRemark] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  useEffect(() => {
    if (id) loadProject();
    captureGPS();
  }, [id]);

  const loadProject = async () => {
    try {
      const data = await fetchProject(id!);
      setProject(data);
      const milestone = data.milestones?.find(m => m.id === milestoneId);
      if (milestone) {
        setPercentDone(milestone.percent_done);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  const captureGPS = () => {
    if ('geolocation' in navigator) {
      setGpsStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setGpsStatus('success');
        },
        (error) => {
          console.warn('GPS error:', error.message);
          setGpsStatus('error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsStatus('error');
    }
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files);
    setPhotos(prev => [...prev, ...newFiles]);
    
    // Generate previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneId || !project) return;
    
    setIsSubmitting(true);
    
    try {
      // Upload photos first
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        setUploadProgress('Uploading photos...');
        for (let i = 0; i < photos.length; i++) {
          setUploadProgress(`Uploading photo ${i + 1} of ${photos.length}...`);
          const url = await uploadSitePhoto(photos[i], project.id);
          photoUrls.push(url);
        }
      }

      setUploadProgress('Saving update...');

      await submitProgressUpdate(milestoneId, {
        percentDone,
        note: remark || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      });

      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        navigate(`/agent/projects/${id}`);
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit update');
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const milestone = project?.milestones?.find(m => m.id === milestoneId);

  if (!project || !milestone) return <div className="p-6 text-center">Not found</div>;

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
            {photoPreviews.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative group">
                <img src={url} alt="Site capture" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer">
              <Camera className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Add Photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoAdd}
                className="hidden"
              />
            </label>
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

        {/* GPS Status */}
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium border ${
          gpsStatus === 'success' 
            ? 'bg-green-50 text-green-800 border-green-100' 
            : gpsStatus === 'error'
            ? 'bg-orange-50 text-orange-800 border-orange-100'
            : 'bg-blue-50 text-blue-800 border-blue-100'
        }`}>
          <MapPin className="w-4 h-4 shrink-0" />
          {gpsStatus === 'loading' && <p>Capturing GPS coordinates...</p>}
          {gpsStatus === 'success' && <p>GPS: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}</p>}
          {gpsStatus === 'error' && <p>GPS unavailable. Location will not be recorded.</p>}
          {gpsStatus === 'idle' && <p>GPS coordinates will be captured automatically.</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {uploadProgress || 'Submitting...'}
            </>
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
