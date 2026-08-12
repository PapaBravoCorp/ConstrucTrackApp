/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import {
  Building2, LayoutTemplate, Users, History, ChevronRight,
  CheckCircle2, BarChart3, ShieldCheck, Zap, ArrowRight,
  Menu, X, Star, TrendingUp, Clock, AlertTriangle,
  HardHat, Layers, Bell, FileText, Globe, Lock,
  ChevronDown, Play, Check
} from 'lucide-react';
import { motion, useInView, AnimatePresence } from 'motion/react';

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ end, suffix = '', duration = 2 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Fade-In Section ─────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-white/10 shadow-2xl' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Construc<span className="text-orange-400">Track</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {['Features', 'How It Works', 'Pricing', 'Testimonials'].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login" className="text-slate-300 hover:text-white text-sm font-medium transition-colors px-4 py-2">
              Sign In
            </Link>
            <a
              href="#pricing"
              className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all hover:scale-105 active:scale-95"
            >
              Start Free Trial
            </a>
          </div>

          {/* Mobile burger */}
          <button onClick={() => setOpen(!open)} className="lg:hidden text-white p-2">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-slate-950/95 backdrop-blur-xl border-t border-white/10"
          >
            <div className="px-5 py-4 flex flex-col gap-3">
              {['Features', 'How It Works', 'Pricing', 'Testimonials'].map(item => (
                <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setOpen(false)}
                  className="text-slate-300 hover:text-white text-sm font-medium py-2 border-b border-white/5">
                  {item}
                </a>
              ))}
              <Link to="/login" className="text-slate-300 hover:text-white text-sm font-medium py-2">Sign In</Link>
              <a href="#pricing" className="mt-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-semibold px-5 py-3 rounded-xl text-center">
                Start Free Trial
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden bg-slate-950">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 pt-32 pb-20 lg:pt-40 lg:pb-32 w-full">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 mb-6"
          >
            <span className="w-2 h-2 bg-orange-400 rounded-full animate-ping" />
            <span className="text-orange-300 text-xs font-semibold uppercase tracking-widest">New · Now with AI-Powered Delay Alerts</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight"
          >
            Construction Projects,{' '}
            <span className="relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
                Delivered On Time.
              </span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 400 12" fill="none">
                <path d="M2 9C50 3 150 1 200 5C250 9 350 11 398 7" stroke="url(#underline-grad)" strokeWidth="3" strokeLinecap="round" />
                <defs>
                  <linearGradient id="underline-grad" x1="0" y1="0" x2="400" y2="0">
                    <stop stopColor="#f97316" />
                    <stop offset="1" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            ConstrucTrack gives Admins, Managers, and Field Agents one unified platform to track milestones, catch delays early, and keep every stakeholder informed — in real time.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto"
          >
            <a
              href="#pricing"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-bold px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
            >
              Start Free — No Credit Card
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl transition-all hover:scale-105 text-sm sm:text-base backdrop-blur-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              See How It Works
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 sm:mt-12 flex items-center justify-center gap-x-4 gap-y-2 sm:gap-6 flex-wrap"
          >
            {[
              { icon: <ShieldCheck className="w-4 h-4 text-green-400" />, label: 'SOC 2 Type II' },
              { icon: <Lock className="w-4 h-4 text-blue-400" />, label: 'Enterprise Security' },
              { icon: <Globe className="w-4 h-4 text-purple-400" />, label: '99.9% Uptime SLA' },
              { icon: <CheckCircle2 className="w-4 h-4 text-orange-400" />, label: 'GDPR Compliant' },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                {b.icon}
                {b.label}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 relative"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-amber-400/10 to-orange-500/20 rounded-3xl blur-2xl" />
          <div className="relative bg-slate-800/60 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/80 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <div className="flex-1 mx-4 bg-slate-800 rounded-md px-3 py-1 text-xs text-slate-400 text-center">app.constructrack.com/admin</div>
            </div>
            {/* Dashboard simulation */}
            <div className="flex min-h-[220px] sm:min-h-[380px]">
              {/* Sidebar */}
              <div className="hidden sm:flex w-16 lg:w-52 bg-slate-900 border-r border-white/5 flex-col gap-1 p-3">
                <div className="p-2 lg:px-3 lg:py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center gap-3 mb-2">
                  <HardHat className="w-5 h-5 text-orange-400 shrink-0" />
                  <span className="hidden lg:block text-orange-300 text-xs font-bold">ConstrucTrack</span>
                </div>
                {[
                  { icon: <Building2 className="w-4 h-4" />, label: 'Projects', active: true },
                  { icon: <LayoutTemplate className="w-4 h-4" />, label: 'Templates', active: false },
                  { icon: <Users className="w-4 h-4" />, label: 'Users', active: false },
                  { icon: <History className="w-4 h-4" />, label: 'Activity', active: false },
                ].map(item => (
                  <div key={item.label}
                    className={`p-2 lg:px-3 lg:py-2.5 rounded-xl flex items-center gap-3 ${item.active ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'} cursor-pointer transition-colors`}>
                    <span className="shrink-0">{item.icon}</span>
                    <span className="hidden lg:block text-xs font-medium">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Main */}
              <div className="flex-1 p-3 sm:p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-white font-bold text-base">Active Projects</h2>
                    <p className="text-slate-400 text-xs">12 construction sites tracked</p>
                  </div>
                  <button className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">+ New Project</button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Active', val: '12', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                    { label: 'Completed', val: '8', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                    { label: 'Delayed', val: '2', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                    { label: 'Total', val: '22', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Project rows */}
                <div className="space-y-2">
                  {[
                    { name: 'Tower A – Phase 2', progress: 78, status: 'On Track', statusColor: 'text-green-400 bg-green-500/10' },
                    { name: 'Riverside Mall Complex', progress: 45, status: 'Delayed', statusColor: 'text-orange-400 bg-orange-500/10' },
                    { name: 'Highway Bridge R4', progress: 92, status: 'On Track', statusColor: 'text-green-400 bg-green-500/10' },
                  ].map(p => (
                    <div key={p.name} className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                          <span className="text-slate-400 text-xs shrink-0">{p.progress}%</span>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0 ${p.statusColor}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Social Proof / Stats ─────────────────────────────────────────────────────
function SocialProof() {
  return (
    <section className="py-16 bg-slate-950 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <FadeIn className="text-center mb-10">
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Trusted by construction teams worldwide</p>
        </FadeIn>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 text-center">
          {[
            { val: 15, suffix: '+', label: 'Projects Tracked' },
            { val: 98, suffix: '%', label: 'On-Time Delivery Rate' },
            { val: 12, suffix: '+', label: 'Milestones Completed' },
            { val: 10, suffix: '%', label: 'Less Delay Incidents' },
          ].map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.1}>
              <div className="relative">
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                  <AnimatedCounter end={stat.val} suffix={stat.suffix} />
                </p>
                <p className="text-slate-400 text-sm mt-2">{stat.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  {
    icon: <Building2 className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-400',
    shadow: 'shadow-blue-500/20',
    title: 'Project Command Centre',
    desc: 'Manage every construction site from a single dashboard. Create projects, assign milestones, set weights, and monitor real-time progress at a glance.',
    bullets: ['Multi-site overview', 'Milestone weighting', 'Status tracking (Active / Delayed / Completed)'],
  },
  {
    icon: <LayoutTemplate className="w-6 h-6" />,
    color: 'from-orange-500 to-amber-400',
    shadow: 'shadow-orange-500/20',
    title: 'Reusable Template Library',
    desc: 'Stop re-inventing the wheel. Build milestone templates once and apply them to every new project — with pre-configured weights and checklists.',
    bullets: ['Clone & customise templates', 'Pre-set milestone weights', 'Instant project spin-up'],
  },
  {
    icon: <Users className="w-6 h-6" />,
    color: 'from-purple-500 to-violet-400',
    shadow: 'shadow-purple-500/20',
    title: 'Role-Based Access Control',
    desc: 'Admin, Manager, Agent — each role sees exactly what they need. Granular access control keeps sensitive data safe and workflows streamlined.',
    bullets: ['Admin · Manager · Agent roles', 'Invite & deactivate users', 'Scoped project visibility'],
  },
  {
    icon: <History className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-400',
    shadow: 'shadow-green-500/20',
    title: 'Complete Audit Trail',
    desc: 'Every action is logged. From milestone updates to user changes — you always know who did what and when. Compliance made effortless.',
    bullets: ['Tamper-proof activity log', 'Timestamped actions', 'Exportable audit reports'],
  },
  {
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'from-red-500 to-rose-400',
    shadow: 'shadow-red-500/20',
    title: 'Delay Detection & Alerts',
    desc: 'Catch delays before they cascade. Automated status rules flag at-risk milestones and notify the right people instantly.',
    bullets: ['Automated delay flags', 'Instant stakeholder notifications', 'Risk trend analysis'],
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'from-indigo-500 to-blue-400',
    shadow: 'shadow-indigo-500/20',
    title: 'Live Analytics & Reports',
    desc: 'Beautiful, real-time dashboards give management a 360° view of portfolio health. Export board-ready reports in one click.',
    bullets: ['Portfolio-level KPIs', 'Progress bar visualisations', 'One-click PDF reports'],
  },
];

function Features() {
  return (
    <section id="features" className="py-20 lg:py-32 bg-slate-900 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <FadeIn className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-300 text-xs font-semibold uppercase tracking-widest">Everything You Need</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mt-3">
            Purpose-Built for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">Construction</span>
          </h2>
          <p className="text-slate-400 text-lg mt-4 max-w-2xl mx-auto">
            Every feature was designed with boots-on-the-ground reality in mind. No fluff, just the tools that move projects forward.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.08}>
              <div className="group h-full bg-slate-800/40 border border-white/5 rounded-2xl p-6 hover:border-white/15 hover:bg-slate-800/70 transition-all duration-300 hover:-translate-y-1">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} ${f.shadow} shadow-lg flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">{f.desc}</p>
                <ul className="space-y-1.5">
                  {f.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-slate-300 text-xs">
                      <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Video Configuration & Hooks ────────────────────────────────────────────────

const STORAGE_BUCKET_URL = import.meta.env.VITE_SUPABASE_STORAGE_URL || '';
const VIDEO_URL = STORAGE_BUCKET_URL ? `${STORAGE_BUCKET_URL}/assets/demo-track.mp4` : '/assets/demo-track.mp4';
const POSTER_URL = STORAGE_BUCKET_URL ? `${STORAGE_BUCKET_URL}/assets/demo-poster.webp` : '/assets/demo-poster.webp';

function useVideoIntersectionObserver(options: IntersectionObserverInit = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, { rootMargin: '0px', threshold: 0.5, ...options });

    observer.observe(element);

    return () => observer.disconnect();
  }, [options.root, options.rootMargin, options.threshold]);

  return { isIntersecting, elementRef };
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  return prefersReducedMotion;
}

function LandingVideo() {
  const { isIntersecting, elementRef } = useVideoIntersectionObserver();
  const prefersReducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!videoRef.current || prefersReducedMotion) return;

    if (isIntersecting) {
      if (!hasLoaded) {
        videoRef.current.load();
        setHasLoaded(true);
      }

      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Auto-play was prevented by browser policy
        });
      }
    } else {
      videoRef.current.pause();
      if (hasLoaded) {
        videoRef.current.currentTime = 0; // Reset video to start
      }
    }
  }, [isIntersecting, prefersReducedMotion, hasLoaded]);

  return (
    <div ref={elementRef} className="aspect-video w-full h-full bg-slate-900 relative">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        controls={true}
        muted={true}
        loop={true}
        playsInline={true}
        preload="metadata"
        poster={POSTER_URL}
        aria-label="ConstrucTrack platform demonstration video"
        tabIndex={0}
      >
        {(isIntersecting || hasLoaded) && (
          <source src={VIDEO_URL} type="video/mp4" />
        )}
        <p className="text-white p-4 text-center">
          Your browser does not support the video tag. You can{' '}
          <a href={VIDEO_URL} className="text-orange-400 hover:underline focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
            download the video here
          </a>.
        </p>
      </video>
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Admin sets up the platform',
      desc: 'Create your organisation, build milestone templates, and invite your team. Takes less than 10 minutes to have your first project live.',
      icon: <HardHat className="w-6 h-6" />,
      color: 'from-orange-500 to-amber-400',
      glowColor: 'rgba(249, 115, 22, 0.15)',
      borderColor: 'border-orange-500/20',
      bgColor: 'bg-orange-500/5',
      textColor: 'text-orange-400',
      numGradient: 'from-orange-400 to-amber-300',
    },
    {
      step: '02',
      title: 'Managers run site operations',
      desc: 'Site managers get a focused view of their assigned projects, track milestone completion, and receive real-time delay alerts to act fast.',
      icon: <Layers className="w-6 h-6" />,
      color: 'from-blue-500 to-cyan-400',
      glowColor: 'rgba(59, 130, 246, 0.15)',
      borderColor: 'border-blue-500/20',
      bgColor: 'bg-blue-500/5',
      textColor: 'text-blue-400',
      numGradient: 'from-blue-400 to-cyan-300',
    },
    {
      step: '03',
      title: 'Agents update from the field',
      desc: 'Field agents log milestone updates from their phone or tablet. Photo evidence, notes, and timestamps captured automatically.',
      icon: <FileText className="w-6 h-6" />,
      color: 'from-green-500 to-emerald-400',
      glowColor: 'rgba(34, 197, 94, 0.15)',
      borderColor: 'border-green-500/20',
      bgColor: 'bg-green-500/5',
      textColor: 'text-green-400',
      numGradient: 'from-green-400 to-emerald-300',
    },
    {
      step: '04',
      title: 'Everyone stays informed',
      desc: 'Stakeholders get live dashboards and automated notifications — no more chasing status updates over WhatsApp or email.',
      icon: <Bell className="w-6 h-6" />,
      color: 'from-purple-500 to-violet-400',
      glowColor: 'rgba(168, 85, 247, 0.15)',
      borderColor: 'border-purple-500/20',
      bgColor: 'bg-purple-500/5',
      textColor: 'text-purple-400',
      numGradient: 'from-purple-400 to-violet-300',
    },
  ];

  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 lg:py-36 bg-slate-950 overflow-hidden scroll-mt-20">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-3xl" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px'
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        {/* Section header */}
        <FadeIn className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Simple by Design</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mt-3 tracking-tight">
            How ConstrucTrack{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Works</span>
          </h2>
          <p className="text-slate-400 text-lg lg:text-xl mt-5 max-w-2xl mx-auto leading-relaxed">
            One platform, three roles, zero confusion. Onboard your entire team in a single afternoon.
          </p>
        </FadeIn>

        {/* Video showcase */}
        <FadeIn className="mb-16 sm:mb-24">
          <div className="relative max-w-5xl mx-auto group">
            {/* Outer glow ring */}
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-700" />
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900/80 backdrop-blur-sm" style={{ boxShadow: '0 25px 60px -15px rgba(249, 115, 22, 0.2), 0 0 40px -10px rgba(59, 130, 246, 0.1)' }}>
              {/* Browser chrome bar */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/90 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 mx-3 sm:mx-8 bg-slate-800/80 rounded-lg px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs text-slate-500 text-center font-mono truncate">
                  app.constructrack.com/dashboard
                </div>
              </div>
              {/* Video */}
              <div className="aspect-video w-full h-full">
                <LandingVideo />
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Steps */}
        <div className="relative">
          {/* Horizontal timeline connector (desktop) */}
          <div className="hidden lg:block absolute top-[52px] left-[10%] right-[10%] h-[2px]">
            <div className="w-full h-full bg-gradient-to-r from-orange-500/30 via-blue-500/30 via-green-500/30 to-purple-500/30 rounded-full" />
            {/* Animated pulse on the line */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/40 via-blue-500/40 via-green-500/40 to-purple-500/40 rounded-full blur-sm animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5">
            {steps.map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.12}>
                <div className="relative group h-full">
                  {/* Vertical connector for tablet only */}
                  {i < steps.length - 1 && (
                    <div className="hidden md:block lg:hidden absolute left-[52px] bottom-0 translate-y-full w-[2px] h-6 bg-gradient-to-b from-white/10 to-transparent" />
                  )}

                  {/* Card */}
                  <div
                    className={`relative h-full rounded-2xl border ${s.borderColor} ${s.bgColor} backdrop-blur-sm p-6 transition-all duration-500 hover:border-opacity-40 hover:-translate-y-1`}
                    style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 20px 40px -15px ${s.glowColor}` }}
                  >
                    {/* Step number + icon row */}
                    <div className="flex items-center gap-4 mb-5">
                      {/* Large gradient step number */}
                      <div className="relative">
                        <span className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br ${s.numGradient} opacity-90`}>
                          {s.step}
                        </span>
                      </div>
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        {s.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-white font-bold text-lg mb-2.5 tracking-tight">{s.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>

                    {/* Bottom accent line */}
                    <div className={`absolute bottom-0 left-6 right-6 h-[2px] bg-gradient-to-r ${s.color} rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-500`} />
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Roles ────────────────────────────────────────────────────────────────────
function Roles() {
  const [active, setActive] = useState(0);

  const roles = [
    {
      name: 'Admin',
      icon: <ShieldCheck className="w-5 h-5" />,
      color: 'orange',
      tagline: 'Total platform command',
      desc: 'Admins own the entire ConstrucTrack instance. They configure templates, manage users, create projects, and have an unobstructed view of every site in the portfolio.',
      capabilities: [
        'Create & archive projects',
        'Build & manage milestone templates',
        'Invite, assign & deactivate users',
        'Full audit trail access',
        'Portfolio-level analytics',
        'Role assignment & access control',
      ],
    },
    {
      name: 'Manager',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'blue',
      tagline: 'Focused site oversight',
      desc: 'Managers see their assigned projects with full milestone detail. They receive delay alerts, can view agent updates, and generate site-level progress reports.',
      capabilities: [
        'View assigned project dashboards',
        'Track milestone completion %',
        'Receive delay & risk alerts',
        'Access field agent updates',
        'Export site progress reports',
        'Comment & annotate milestones',
      ],
    },
    {
      name: 'Agent',
      icon: <HardHat className="w-5 h-5" />,
      color: 'green',
      tagline: 'Effortless field updates',
      desc: "Field agents use ConstrucTrack's mobile-first interface to log milestone progress from the site. Simple, fast, and works on any device.",
      capabilities: [
        'View assigned project milestones',
        'Log progress updates with notes',
        'Upload photo evidence',
        'View milestone dependencies',
        'Receive task notifications',
        'Works offline, syncs on connection',
      ],
    },
  ];

  const colorMap: Record<string, { tab: string; badge: string; dot: string }> = {
    orange: {
      tab: 'border-orange-500 text-orange-400 bg-orange-500/10',
      badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
      dot: 'bg-orange-500',
    },
    blue: {
      tab: 'border-blue-500 text-blue-400 bg-blue-500/10',
      badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      dot: 'bg-blue-500',
    },
    green: {
      tab: 'border-green-500 text-green-400 bg-green-500/10',
      badge: 'bg-green-500/15 text-green-300 border-green-500/30',
      dot: 'bg-green-500',
    },
  };

  const role = roles[active];
  const colors = colorMap[role.color];

  return (
    <section id="roles" className="py-20 lg:py-32 bg-slate-900 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
            Built for Every{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">Team Member</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg mt-4 max-w-xl mx-auto">
            Three distinct roles. One unified platform. Everyone sees exactly what they need.
          </p>
        </FadeIn>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {roles.map((r, i) => (
            <button
              key={r.name}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all ${active === i ? colors.tab + ' border-current' : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              {r.icon}
              {r.name}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-slate-800/40 border border-white/8 rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-12 flex flex-col lg:flex-row gap-8 lg:gap-10">
              <div className="lg:w-1/2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${colors.badge} mb-4`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  {role.tagline}
                </span>
                <h3 className="text-white text-2xl sm:text-3xl font-bold mb-4">The {role.name} Experience</h3>
                <p className="text-slate-400 leading-relaxed">{role.desc}</p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Sign in as {role.name} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {role.capabilities.map(cap => (
                  <div key={cap} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const testimonials = [
  {
    quote: "ConstrucTrack cut our delay incidents by nearly half in the first quarter. The milestone templates alone saved us weeks of setup time.",
    name: "Rajesh Mehta",
    role: "VP Operations, Skyline Builders",
    rating: 5,
  },
  {
    quote: "Finally, a platform our field agents actually want to use. The mobile interface is dead simple and the real-time sync keeps everyone on the same page.",
    name: "Priya Sharma",
    role: "Project Director, GreenBuild Co.",
    rating: 5,
  },
  {
    quote: "The audit trail has been invaluable for compliance. We can pull a full activity history for any project in seconds. Our auditors love it.",
    name: "Arun Nair",
    role: "Head of Compliance, BuildRight Group",
    rating: 5,
  },
];

function Testimonials() {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track active card on scroll (mobile carousel)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const cardWidth = el.offsetWidth;
      const idx = Math.round(scrollLeft / cardWidth);
      setActiveIdx(Math.min(idx, testimonials.length - 1));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="testimonials" className="py-20 lg:py-32 bg-slate-950 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <FadeIn className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-4">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-amber-300 text-xs font-semibold uppercase tracking-widest">Customer Stories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mt-3">
            Teams That{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Love ConstrucTrack</span>
          </h2>
        </FadeIn>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.1}>
              <div className="h-full bg-slate-800/40 border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-all hover:-translate-y-1">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3 mt-auto">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Mobile swipeable carousel */}
        <div className="md:hidden">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-5 px-5 scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="snap-center shrink-0 w-[85vw] max-w-[340px] bg-slate-800/40 border border-white/8 rounded-2xl p-5 flex flex-col"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5 flex-1">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  scrollRef.current?.scrollTo({ left: i * scrollRef.current.offsetWidth, behavior: 'smooth' });
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeIdx ? 'bg-amber-400 w-6' : 'bg-white/20'}`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: 'Starter',
      monthly: 49,
      annual: 39,
      desc: 'Perfect for small contractors managing a handful of sites.',
      features: ['Up to 5 active projects', '10 users (any role)', 'Milestone templates', 'Activity log (30 days)', 'Email support'],
      cta: 'Start Free Trial',
      popular: false,
      color: 'border-white/8',
    },
    {
      name: 'Professional',
      monthly: 149,
      annual: 119,
      desc: 'For growing teams managing multiple sites simultaneously.',
      features: ['Up to 30 active projects', 'Unlimited users', 'Advanced analytics', 'Activity log (1 year)', 'Delay alerting & automation', 'Priority support', 'Custom branding'],
      cta: 'Start Free Trial',
      popular: true,
      color: 'border-orange-500/50',
    },
    {
      name: 'Enterprise',
      monthly: null,
      annual: null,
      desc: 'For large firms with complex multi-portfolio needs.',
      features: ['Unlimited projects', 'Unlimited users', 'Dedicated account manager', 'Custom integrations (API)', 'SLA guarantee', 'On-premise option', 'SSO / SAML'],
      cta: 'Contact Sales',
      popular: false,
      color: 'border-white/8',
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-32 bg-slate-900 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <FadeIn className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-4">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-300 text-xs font-semibold uppercase tracking-widest">Simple Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mt-3">
            Plans for Every{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">Team Size</span>
          </h2>
          <p className="text-slate-400 mt-4 text-base sm:text-lg">Start free. No credit card required. Cancel anytime.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 mt-6 bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Annual
              <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-md font-semibold">-20%</span>
            </button>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.1}>
              <div className={`relative h-full flex flex-col bg-slate-800/40 border-2 rounded-2xl p-5 sm:p-7 transition-all ${plan.popular ? 'border-orange-500/50 shadow-2xl shadow-orange-500/10 mt-6 md:mt-0 md:-translate-y-2' : 'border-white/8'}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-orange-500 to-amber-400 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-orange-500/30">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-white text-xl font-bold">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mt-1">{plan.desc}</p>
                </div>

                <div className="mb-6">
                  {plan.monthly !== null ? (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl sm:text-5xl font-bold text-white">${annual ? plan.annual : plan.monthly}</span>
                      <span className="text-slate-400 text-sm mb-2">/mo</span>
                    </div>
                  ) : (
                    <div className="text-3xl sm:text-4xl font-bold text-white">Custom</div>
                  )}
                  {plan.monthly !== null && annual && (
                    <p className="text-slate-500 text-xs mt-1 line-through">${plan.monthly}/mo billed monthly</p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.cta === 'Contact Sales' ? 'mailto:sales@constructrack.com' : '#'}
                  className={`w-full text-center font-bold py-3 rounded-xl text-sm transition-all hover:scale-105 active:scale-95 ${plan.popular
                    ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    }`}
                >
                  {plan.cta}
                </a>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn className="text-center mt-8">
          <p className="text-slate-500 text-sm">All plans include a 14-day free trial · No credit card required · Cancel anytime</p>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-20 lg:py-32 bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-4xl mx-auto px-5 lg:px-8 text-center">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white leading-tight">
            Your Next Project Starts{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">On Time.</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg mt-6 max-w-xl mx-auto">
            Join hundreds of construction teams that use ConstrucTrack to deliver projects faster, with fewer delays and zero spreadsheet chaos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 sm:mt-10">
            <a
              href="#pricing"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-bold px-6 py-3.5 sm:px-10 sm:py-4 rounded-2xl shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all hover:scale-105 text-sm sm:text-base"
            >
              Start Your Free Trial
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              Already have an account? Sign in <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center">
              <HardHat className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">Construc<span className="text-orange-400">Track</span></span>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {['Privacy Policy', 'Terms of Service', 'Security', 'Contact Us'].map(l => (
              <a key={l} href="#" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} ConstrucTrack. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans scroll-smooth">
      <Navbar />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <Roles />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
