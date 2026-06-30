import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, Cpu, Gauge, Zap, Activity } from 'lucide-react';
import { SafeCanvas3D } from './SafeCanvas3D';
import { useTestStore, TEST_PHASES, computeShaderParams } from '@/store/testStore';
import type { PerformanceRating } from '@/store/testStore';

const TARGET_FPS = 30;
const STABILIZE_TIME = 2000;
const PRESSURE_INCREASE_INTERVAL = 1500;

export function HeroSection() {
  const {
    status,
    currentFPS,
    gpuUsage,
    dynamicPressure,
    currentTestPhase,
    phaseRecords,
    finalScore,
    rating,
    gpuInfo,
    setStatus,
    setCurrentTestPhase,
    incrementDynamicPressure,
    setGpuUsage,
    setTestResult,
    reset,
  } = useTestStore();

  const animationRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const currentPhaseIdxRef = useRef(0);
  const phaseStartTimeRef = useRef(0);
  const lastPressureIncreaseRef = useRef(0);
  const stabilizeStartRef = useRef(0);
  const isStabilizedRef = useRef(false);
  const fpsRecordsRef = useRef<number[]>([]);
  const phaseMaxPressureRef = useRef(1);

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

  const getPhaseName = (): string => {
    if (currentTestPhase === 'idle') return '空闲';
    const config = TEST_PHASES.find(t => t.phase === currentTestPhase);
    return config?.name || '测试中';
  };

  const finishTest = () => {
    const results = phaseRecords.map((record, idx) => {
      const config = TEST_PHASES[idx];
      const avgFPS = record.fpsHistory.length > 0
        ? Math.round(record.fpsHistory.reduce((a, b) => a + b, 0) / record.fpsHistory.length)
        : TARGET_FPS;
      const params = computeShaderParams(record.maxPressureLevel, record.phase);
      const score = Math.round(avgFPS * record.maxPressureLevel * config.weight * 50);
      return {
        name: config.name,
        fps: avgFPS,
        maxPressureLevel: record.maxPressureLevel,
        score,
      };
    });

    const overallScore = results.reduce((sum, r) => sum + r.score, 0);
    let ratingVal: PerformanceRating;
    if (overallScore >= 20000) ratingVal = 'flagship';
    else if (overallScore >= 8000) ratingVal = 'mainstream';
    else ratingVal = 'entry';

    const finalPressure = phaseRecords.length > 0
      ? Math.max(...phaseRecords.map(r => r.maxPressureLevel))
      : 1;

    setTestResult({
      overallScore,
      rating: ratingVal,
      subTests: results,
      gpuInfo,
      finalDynamicPressure: finalPressure,
    });
  };

  const advanceToNextPhase = () => {
    currentPhaseIdxRef.current++;
    if (currentPhaseIdxRef.current < TEST_PHASES.length) {
      const nextPhase = TEST_PHASES[currentPhaseIdxRef.current].phase;
      setCurrentTestPhase(nextPhase);
      fpsRecordsRef.current = [];
      phaseMaxPressureRef.current = 1;
      isStabilizedRef.current = false;
      phaseStartTimeRef.current = performance.now();
      lastPressureIncreaseRef.current = performance.now();
    } else {
      finishTest();
    }
  };

  const updateTest = () => {
    const currentTime = performance.now();
    const currentPhaseIdx = currentPhaseIdxRef.current;
    const currentPhase = TEST_PHASES[currentPhaseIdx];

    if (!currentPhase) {
      finishTest();
      return;
    }

    const currentFPSVal = useTestStore.getState().currentFPS;
    const currentDynPressure = useTestStore.getState().dynamicPressure;
    const phaseElapsed = currentTime - phaseStartTimeRef.current;

    if (currentFPSVal > 0) {
      fpsRecordsRef.current.push(currentFPSVal);
    }

    if (!isStabilizedRef.current) {
      if (currentFPSVal >= TARGET_FPS) {
        stabilizeStartRef.current = currentTime;
        if (currentTime - lastPressureIncreaseRef.current >= PRESSURE_INCREASE_INTERVAL) {
          lastPressureIncreaseRef.current = currentTime;
          incrementDynamicPressure();
          phaseMaxPressureRef.current = Math.max(phaseMaxPressureRef.current, currentDynPressure + 1);
        }
      } else {
        const stabilizeElapsed = currentTime - stabilizeStartRef.current;
        if (stabilizeElapsed >= STABILIZE_TIME) {
          isStabilizedRef.current = true;
          advanceToNextPhase();
        }
      }
    }

    const estimatedUsage = Math.min(99, Math.max(15, Math.round((60 / Math.max(currentFPSVal, 1)) * 30 + 20)));
    setGpuUsage(estimatedUsage);

    animationRef.current = requestAnimationFrame(updateTest);
  };

  useEffect(() => {
    if (status !== 'running') {
      hasStartedRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    currentPhaseIdxRef.current = 0;
    phaseStartTimeRef.current = performance.now();
    lastPressureIncreaseRef.current = performance.now();
    stabilizeStartRef.current = performance.now();
    isStabilizedRef.current = false;
    fpsRecordsRef.current = [];
    phaseMaxPressureRef.current = 1;

    setCurrentTestPhase(TEST_PHASES[0].phase);

    animationRef.current = requestAnimationFrame(updateTest);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [status]);

  const handleStartTest = () => {
    if (status === 'idle' || status === 'completed') {
      reset();
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
            {status === 'completed'
              ? '测试完成！以下是详细的性能分析报告'
              : '点击下方按钮，开始评估你的 GPU 性能'}
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative bg-space-gray/80 backdrop-blur-lg rounded-3xl p-8 border border-tech-blue/30 shadow-2xl shadow-tech-blue/10 w-full max-w-md"
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
            <div className="text-center">
              <div className="text-4xl font-mono font-bold text-electric-purple">
                P{dynamicPressure}
              </div>
              <div className="text-sm text-text-secondary mt-2 flex items-center justify-center gap-1">
                <Activity className="w-4 h-4" />
                压力级
              </div>
            </div>
          </div>

          {status === 'running' && currentTestPhase !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-4"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-tech-blue/20 text-tech-blue border border-tech-blue/30">
                <Zap className="w-3.5 h-3.5" />
                {getPhaseName()}
              </span>
            </motion.div>
          )}

          <div className="mb-6">
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>GPU 占用 <span className="text-xs text-text-muted">(估算)</span></span>
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

          {status === 'running' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs text-text-secondary mb-4"
            >
              {isStabilizedRef.current
                ? '压力已稳定，即将进入下一阶段...'
                : currentFPS >= TARGET_FPS
                  ? 'GPU 性能充足，自动提升压力中...'
                  : 'GPU 性能受限，稳定压力中...'}
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
                测试中 (P{dynamicPressure})...
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
          <span>自动递增加压 · 智能探测 GPU 性能上限</span>
        </motion.div>
      </div>
    </section>
  );
}
