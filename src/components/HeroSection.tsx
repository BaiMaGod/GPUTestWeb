import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, Cpu, Gauge } from 'lucide-react';
import { SafeCanvas3D } from './SafeCanvas3D';
import { useTestStore, type PerformanceRating } from '@/store/testStore';

export function HeroSection() {
  const {
    status,
    currentFPS,
    gpuUsage,
    remainingTime,
    setStatus,
    setCurrentFPS,
    setGpuUsage,
    addFPSRecord,
    setRemainingTime,
    setTestResult,
    rating,
  } = useTestStore();

  const animationRef = useRef<number | null>(null);
  const fpsHistoryRef = useRef<number[]>([]);
  const hasStartedRef = useRef(false);

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-perf-green';
    if (fps >= 30) return 'text-perf-amber';
    return 'text-perf-red';
  };

  const getRatingInfo = (r: PerformanceRating) => {
    switch (r) {
      case 'flagship':
        return { text: '旗舰级', color: 'text-perf-green', bg: 'bg-perf-green/20', border: 'border-perf-green' };
      case 'mainstream':
        return { text: '主流级', color: 'text-perf-amber', bg: 'bg-perf-amber/20', border: 'border-perf-amber' };
      case 'entry':
        return { text: '入门级', color: 'text-perf-red', bg: 'bg-perf-red/20', border: 'border-perf-red' };
      default:
        return { text: '待测试', color: 'text-text-secondary', bg: 'bg-space-gray', border: 'border-space-gray' };
    }
  };

  useEffect(() => {
    if (status !== 'running') {
      hasStartedRef.current = false;
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    fpsHistoryRef.current = [];

    const totalDuration = 15000;
    const startTime = Date.now();

    const subTests = [
      { name: '粒子系统', baseFPS: 120, duration: 3000 },
      { name: '光照渲染', baseFPS: 90, duration: 3000 },
      { name: '物理模拟', baseFPS: 100, duration: 3000 },
      { name: '材质计算', baseFPS: 110, duration: 3000 },
    ];

    let currentSubTestIndex = 0;
    let subTestStartTime = startTime;

    const finishBenchmark = () => {
      const history = fpsHistoryRef.current;
      const avgFPS = history.length > 0
        ? history.reduce((a, b) => a + b, 0) / history.length
        : 60;

      let r: PerformanceRating;
      let overallScore: number;

      if (avgFPS >= 100) {
        r = 'flagship';
        overallScore = Math.round(15000 + (avgFPS - 100) * 50);
      } else if (avgFPS >= 60) {
        r = 'mainstream';
        overallScore = Math.round(10000 + (avgFPS - 60) * 125);
      } else {
        r = 'entry';
        overallScore = Math.round(5000 + avgFPS * 83);
      }

      const chunkSize = Math.floor(history.length / subTests.length);
      const subTestResults = subTests.map((test, index) => {
        const chunk = history.slice(index * chunkSize, (index + 1) * chunkSize);
        const avg = chunk.length > 0
          ? Math.round(chunk.reduce((a, b) => a + b, 0) / chunk.length)
          : test.baseFPS;
        return {
          name: test.name,
          fps: avg,
          score: Math.round(avg * 100),
        };
      });

      setTestResult({
        overallScore,
        rating: r,
        subTests: subTestResults,
        gpuInfo: {
          name: 'NVIDIA GeForce RTX 4090',
          memory: '24GB GDDR6X',
          driver: '550.76',
        },
      });
    };

    const simulateFrame = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const subTestElapsed = currentTime - subTestStartTime;

      if (subTestElapsed > subTests[currentSubTestIndex].duration) {
        currentSubTestIndex++;
        subTestStartTime = currentTime;
      }

      if (currentSubTestIndex >= subTests.length) {
        currentSubTestIndex = subTests.length - 1;
      }

      const baseFPS = subTests[currentSubTestIndex].baseFPS;
      const variance = Math.random() * 40 - 20;
      const fps = Math.max(20, Math.min(180, baseFPS + variance));
      const usage = Math.min(100, Math.max(30, 70 + Math.random() * 30));

      setCurrentFPS(Math.round(fps));
      setGpuUsage(Math.round(usage));
      addFPSRecord(Math.round(fps));
      fpsHistoryRef.current.push(Math.round(fps));

      const remaining = Math.max(0, totalDuration - elapsed);
      setRemainingTime(Math.ceil(remaining / 1000));

      if (elapsed < totalDuration) {
        animationRef.current = requestAnimationFrame(simulateFrame);
      } else {
        finishBenchmark();
      }
    };

    animationRef.current = requestAnimationFrame(simulateFrame);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, setCurrentFPS, setGpuUsage, addFPSRecord, setRemainingTime, setTestResult]);

  const handleStartTest = () => {
    if (status === 'idle' || status === 'completed') {
      setStatus('running');
    }
  };

  const ratingInfo = getRatingInfo(rating);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <SafeCanvas3D />

      <div className="relative z-10 container mx-auto px-6 py-32 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-tech-blue via-electric-purple to-perf-green bg-clip-text text-transparent">
            GPU 性能基准测试
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            点击下方按钮，开始评估你的 GPU 性能
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative bg-space-gray/80 backdrop-blur-lg rounded-3xl p-8 border border-tech-blue/30 shadow-2xl shadow-tech-blue/10"
        >
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <div className={`text-7xl font-mono font-bold ${getFPSColor(currentFPS)} transition-colors duration-300`}>
                {currentFPS}
              </div>
              <div className="text-sm text-text-secondary mt-2 flex items-center justify-center gap-1">
                <Gauge className="w-4 h-4" />
                FPS
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>GPU 占用率</span>
              <span>{gpuUsage}%</span>
            </div>
            <div className="h-3 bg-deep-black rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-tech-blue to-electric-purple rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${gpuUsage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {status === 'running' && remainingTime !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-text-secondary mb-4"
            >
              预计剩余时间: {remainingTime}s
            </motion.div>
          )}

          {status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`inline-block px-4 py-2 rounded-full ${ratingInfo.bg} border ${ratingInfo.border} ${ratingInfo.color} font-semibold mb-4`}
            >
              {ratingInfo.text}
            </motion.div>
          )}

          <motion.button
            onClick={handleStartTest}
            disabled={status === 'running'}
            whileHover={{ scale: status === 'idle' ? 1.05 : 1 }}
            whileTap={{ scale: 0.95 }}
            className={`
              relative w-full py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300
              ${status === 'running'
                ? 'bg-space-gray text-text-secondary cursor-not-allowed'
                : 'bg-gradient-to-r from-tech-blue to-electric-purple text-white hover:shadow-lg hover:shadow-tech-blue/50'
              }
            `}
          >
            {status === 'running' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                测试中...
              </span>
            ) : status === 'completed' ? (
              <span className="flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                重新测试
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                开始基准测试
              </span>
            )}
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex items-center gap-2 text-text-secondary text-sm"
        >
          <Cpu className="w-4 h-4" />
          <span>模拟真实游戏场景进行性能评估</span>
        </motion.div>
      </div>
    </section>
  );
}
