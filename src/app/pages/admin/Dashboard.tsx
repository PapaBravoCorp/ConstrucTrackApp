import React from 'react';
import { Link } from 'react-router';
import { Building, LayoutTemplate, Users, ChevronRight, Clock, History } from 'lucide-react';
import { motion } from 'motion/react';
import { useProjects } from '../../projectsContext';

export function AdminDashboard() {
  const { projects } = useProjects();

  const activeCount = projects.filter(p => p.status !== 'Completed').length;
  const delayedCount = projects.filter(p => p.status === 'Delayed').length;
  const completedCount = projects.filter(p => p.status === 'Completed').length;

  const adminActions = [
    {
      title: 'Projects',
      desc: 'Manage sites, assign roles, track status',
      icon: <Building className="w-8 h-8 text-blue-600" />,
      link: '/admin/projects',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Templates',
      desc: 'Configure milestones & default weights',
      icon: <LayoutTemplate className="w-8 h-8 text-orange-600" />,
      link: '/admin/templates',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Users & Roles',
      desc: 'Access control and team mapping',
      icon: <Users className="w-8 h-8 text-purple-600" />,
      link: '/admin/users',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Activity Log',
      desc: 'Audit trail of all platform actions',
      icon: <History className="w-8 h-8 text-green-600" />,
      link: '/admin/activity',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Operations</h1>
        <p className="text-sm text-gray-500 mt-1">Manage platform settings, projects, and users.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {adminActions.map((action, idx) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Link
              to={action.link}
              className="flex items-start p-5 bg-white border border-gray-200 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all group h-full"
            >
              <div className={`p-4 rounded-xl ${action.bgColor} mr-4`}>
                {action.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1 leading-snug">{action.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 self-center group-hover:text-blue-500 transition-colors" />
            </Link>
          </motion.div>
        ))}
      </div>
      
      {/* Live stats */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h2>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-around">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{activeCount}</p>
            <p className="text-sm text-gray-500">Active Projects</p>
          </div>
          <div className="hidden md:block w-px bg-gray-200"></div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{completedCount}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
          <div className="hidden md:block w-px bg-gray-200"></div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{delayedCount}</p>
            <p className="text-sm text-gray-500">Delayed Sites</p>
          </div>
          <div className="hidden md:block w-px bg-gray-200"></div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{projects.length}</p>
            <p className="text-sm text-gray-500">Total Projects</p>
          </div>
        </div>
      </div>
    </div>
  );
}
