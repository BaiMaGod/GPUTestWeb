import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, Cpu, Gauge, Zap } from 'lucide-react';
import { SafeCanvas3D } from './SafeCanvas3D';
import {
  useTestStore,
  type PerformanceRating,
  SUB_TEST_CONFIG_BASE,
  PRESSURE_LEVEL_CONFIG,
  getPressureLevelFromFPS,
} from '@/store/testStore';
import type { TestPhase, PressureLevel } from '@/store/testStore';

const WARMUP_DURATION = 5000;

export function HeroSection() {
  const {
    status,
    currentFPS,
    gpuUsage,
    remainingTime,
    setStatus,
    setCurrentTestPhase,
    setPressureLevel,
    setGpuUsage,
    setRemainingTime,
    setTestResult,
    rating,
  } = useTestStore();

  const animationRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const phaseFPSRecordsRef = useRef<number[][]>([]);
  const currentPhaseRef = useRef<number>(0);
  const phaseStartTimeRef = useRef(0);
  const totalStartTimeRef = useRef(0);
  const warmupFPSRef = useRef<number[]>([]);
  const testModeRef = useRef<'warmup' | 'main'>('warmup');
  const pressureLevelRef = useRef<PressureLevel>('medium');

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

  const getCurrentPhaseInfo = (): { name: string; isWarmup: boolean } => {
    if (testModeRef.current === 'warmup') {
      return { name: '性能预估', isWarmup: true };
    }
    const idx = currentPhaseRef.current;
    if (idx >= 0 && idx < SUB_TEST_CONFIG_BASE.length) {
      return { name: SUB_TEST_CONFIG_BASE[idx].name, isWarmup: false };
    }
    return { name: '测试中', isWarmup: false };
  };

  const calculateRating = (weightedAvgFPS: number, pressureLevel: PressureLevel): { rating: PerformanceRating; score: number } => {
    const pressureMultiplier = {
      low: 0.7,
      medium: 1.0,
      high: 1.4,
      extreme: 2.0,
    }[pressureLevel];

    const adjustedFPS = weightedAvgFPS * pressureMultiplier;

    let r: PerformanceRating;
    let overallScore: number;

    if (adjustedFPS >= 120) {
      r = 'flagship';
      overallScore = Math.round(12000 + (adjustedFPS - 120) * 100);
    } else if (adjustedFPS >= 60) {
      r = 'mainstream';
      overallScore = Math.round(5000 + (adjustedFPS - 60) * 116.7);
    } else {
      r = 'entry';
      overallScore = Math.round(500 + adjustedFPS * 75);
    }

    return { rating: r, score: Math.min(99999, overallScore) };
  };

  const finishBenchmark = () => {
    const pressureLevel = pressureLevelRef.current;
    const cfg = PRESSURE_LEVEL_CONFIG[pressureLevel];

    const subTestResults = SUB_TEST_CONFIG_BASE.map((test, index) => {
      const records = phaseFPSRecordsRef.current[index] || [];
      const avg = records.length > 0
        ? Math.round(records.reduce((a, b) => a + b, 0) / records.length)
        : 30;
      return {
        name: test.name,
        fps: avg,
        score: Math.round(avg * 100 * test.weight),
      };
    });

    const totalWeight = SUB_TEST_CONFIG_BASE.reduce((sum, t) => sum + t.weight, 0);
    const weightedAvgFPS = subTestResults.reduce((sum, r, i) => sum + r.fps * SUB_TEST_CONFIG_BASE[i].weight, 0) / totalWeight;

    const { rating: r, score: overallScore } = calculateRating(weightedAvgFPS, pressureLevel);

    const gpuInfo = useTestStore.getState().gpuInfo;
    setTestResult({
      overallScore,
      rating: r,
      subTests: subTestResults,
      gpuInfo,
    });
  };

  const startMainTest = (pressureLevel: PressureLevel) => {
    pressureLevelRef.current = pressureLevel;
    setPressureLevel(pressureLevel);
    testModeRef.current = 'main';
    currentPhaseRef.current = 0;
    phaseFPSRecordsRef.current = [];
    phaseStartTimeRef.current = performance.now();
    totalStartTimeRef.current = performance.now();

    setCurrentTestPhase(SUB_TEST_CONFIG_BASE[0].phase);
    phaseFPSRecordsRef.current[0] = [];
  };

  const finishWarmup = () => {
    const records = warmupFPSRef.current;
    const avgFPS = records.length > 0
      ? records.reduce((a, b) => a + b, 0) / records.length
      : 60;

    const pressureLevel = getPressureLevelFromFPS(avgFPS);
    startMainTest(pressureLevel);
  };

  const updateTest = () => {
    const currentTime = performance.now();

    if (testModeRef.current === 'warmup') {
      const elapsed = currentTime - totalStartTimeRef.current;
      const remaining = Math.max(0, WARMUP_DURATION - elapsed);
      setRemainingTime(Math.ceil(remaining / 1000));

      const currentFPSVal = useTestStore.getState().currentFPS;
      if (currentFPSVal > 0) {
        warmupFPSRef.current.push(currentFPSVal);
      }

      const targetUsage = 50 + currentFPSVal * 0.4;
      const usage = Math.min(100, Math.max(20, targetUsage + (Math.random() - 0.5) * 8));
      setGpuUsage(Math.round(usage));

      if (elapsed >= WARMUP_DURATION) {
        finishWarmup();
      }

      animationRef.current = requestAnimationFrame(updateTest);
      return;
    }

    const currentPhaseIdx = currentPhaseRef.current;
    const testConfig = SUB_TEST_CONFIG_BASE[currentPhaseIdx];
    const pressureCfg = PRESSURE_LEVEL_CONFIG[pressureLevelRef.current];

    if (!testConfig) {
      finishBenchmark();
      return;
    }

    const phaseElapsed = currentTime - phaseStartTimeRef.current;
    const phaseDuration = pressureCfg.phaseDuration;
    const totalElapsed = currentTime - totalStartTimeRef.current;

    if (phaseElapsed >= phaseDuration) {
      currentPhaseRef.current++;
      phaseStartTimeRef.current = currentTime;

      if (currentPhaseRef.current < SUB_TEST_CONFIG_BASE.length) {
        setCurrentTestPhase(SUB_TEST_CONFIG_BASE[currentPhaseRef.current].phase);
        phaseFPSRecordsRef.current[currentPhaseRef.current] = [];
      } else {
        finishBenchmark();
        return;
      }
    }

    const totalDuration = SUB_TEST_CONFIG_BASE.length * phaseDuration;
    const remaining = Math.max(0, totalDuration - totalElapsed);
    setRemainingTime(Math.ceil(remaining / 1000));

    const currentFPSVal = useTestStore.getState().currentFPS;
    if (currentFPSVal > 0 && phaseFPSRecordsRef.current[currentPhaseIdx]) {
      phaseFPSRecordsRef.current[currentPhaseIdx].push(currentFPSVal);
    }

    const targetUsage = 50 + currentFPSVal * 0.5;
    const usage = Math.min(100, Math.max(20, targetUsage + (Math.random() - 0.5) * 10));
    setGpuUsage(Math.round(usage));

    animationRef.current = requestAnimationFrame(updateTest);
  };

  useEffect(() => {
    if (status !== 'running') {
      hasStartedRef.current = false;
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    warmupFPSRef.current = [];
    testModeRef.current = 'warmup';
    pressureLevelRef.current = 'medium';
    setPressureLevel('medium');
    totalStartTimeRef.current = performance.now();

    setCurrentTestPhase('warmup');

    animationRef.current = requestAnimationFrame(updateTest);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, setRemainingTime, setTestResult, setGpuUsage, setCurrentTestPhase, setPressureLevel]);

  const handleStartTest = () => {
    if (status === 'idle' || status === 'completed') {
      setStatus('running');
    }
  };

  const ratingInfo = getRatingInfo(rating);
  const phaseInfo = getCurrentPhaseInfo();

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
          <div className="flex items-center justify-center gap-8 mb-4">
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

          {status === 'running' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-4"
            >
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                phaseInfo.isWarmup
                  ? 'bg-electric-purple/20 text-electric-purple border border-electric-purple/30'
                  : 'bg-tech-blue/20 text-tech-blue border border-tech-blue/30'
              }`}>
                {phaseInfo.isWarmup ? <Zap className="w-3.5 h-3.5" /> : null}
                {phaseInfo.name}
              </span>
            </motion.div>
          )}

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
          <span>自适应压力测试 · 智能匹配 GPU 性能</span>
        </motion.div>
      </div>
    </section>
  );
}
