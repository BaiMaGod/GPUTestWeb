import { motion } from 'framer-motion';
import { Cpu, Activity } from 'lucide-react';
import { useTestStore } from '@/store/testStore';

export function Navbar() {
  const { status, gpuInfo, rating } = useTestStore();

  const getRatingColor = () => {
    switch (rating) {
      case 'flagship': return 'bg-perf-green';
      case 'mainstream': return 'bg-perf-amber';
      case 'entry': return 'bg-perf-red';
      default: return 'bg-text-secondary';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return '系统就绪';
      case 'running': return '测试中...';
      case 'completed': return '测试完成';
    }
  };

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-deep-black/80 backdrop-blur-md border-b border-space-gray"
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Cpu className="w-8 h-8 text-tech-blue" />
            <svg
              className="absolute inset-0 w-8 h-8 text-electric-purple opacity-50"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path d="M8 16h16M16 8v16M10 10l12 12M22 10L10 22" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-tech-blue to-electric-purple bg-clip-text text-transparent">
            GPUBench
          </span>
        </div>

        <div className="flex items-center gap-2">
          <motion.div
            animate={{
              opacity: status === 'running' ? [0.5, 1, 0.5] : 1,
              scale: status === 'running' ? [0.95, 1.05, 0.95] : 1,
            }}
            transition={{ duration: 1.5, repeat: status === 'running' ? Infinity : 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-space-gray"
          >
            <Activity className={`w-4 h-4 ${status === 'running' ? 'text-perf-green' : 'text-tech-blue'}`} />
            <span className="text-sm text-text-secondary">{getStatusText()}</span>
          </motion.div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-text-primary">{gpuInfo.name}</div>
            <div className="text-xs text-text-secondary">{gpuInfo.memory !== 'Unknown' ? gpuInfo.memory : gpuInfo.vendor}</div>
          </div>
          <div className={`w-3 h-3 rounded-full ${getRatingColor()} ${rating ? 'animate-pulse' : ''}`} />
        </div>
      </div>
    </motion.nav>
  );
}
