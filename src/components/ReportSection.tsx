import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Download, RotateCcw, Award, Zap, Shield, Sparkles } from 'lucide-react';
import { useTestStore, type PerformanceRating } from '@/store/testStore';

export function ReportSection() {
  const { status, testResult, finalScore, rating, reset } = useTestStore();
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (status === 'completed' && finalScore !== null) {
      const duration = 2000;
      const steps = 60;
      const increment = finalScore / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current = Math.min(finalScore, Math.round(increment * step));
        setDisplayScore(current);

        if (step >= steps) {
          clearInterval(timer);
          setDisplayScore(finalScore);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [status, finalScore]);

  const getRatingDetails = (rating: PerformanceRating) => {
    switch (rating) {
      case 'flagship':
        return {
          text: '旗舰级',
          icon: Trophy,
          color: 'text-perf-green',
          bg: 'bg-perf-green/20',
          border: 'border-perf-green',
          description: '您的 GPU 性能处于行业领先水平，可以轻松应对 4K 高画质游戏',
        };
      case 'mainstream':
        return {
          text: '主流级',
          icon: Award,
          color: 'text-perf-amber',
          bg: 'bg-perf-amber/20',
          border: 'border-perf-amber',
          description: '您的 GPU 可以流畅运行主流游戏，建议适当降低画质设置',
        };
      case 'entry':
        return {
          text: '入门级',
          icon: Zap,
          color: 'text-perf-red',
          bg: 'bg-perf-red/20',
          border: 'border-perf-red',
          description: '您的 GPU 性能较为基础，建议升级或优化游戏设置',
        };
      default:
        return {
          text: '待测试',
          icon: Sparkles,
          color: 'text-text-secondary',
          bg: 'bg-space-gray',
          border: 'border-space-gray',
          description: '',
        };
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (!testResult) return;

    let content: string;
    let filename: string;
    let type: string;

    if (format === 'json') {
      content = JSON.stringify(testResult, null, 2);
      filename = 'gpu_benchmark_report.json';
      type = 'application/json';
    } else {
      const headers = '测试项目,FPS,得分\n';
      const rows = testResult.subTests.map(t => `${t.name},${t.fps},${t.score}`).join('\n');
      content = headers + rows;
      filename = 'gpu_benchmark_report.csv';
      type = 'text/csv';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRetest = () => {
    reset();
  };

  if (status !== 'completed') return null;

  const ratingDetails = getRatingDetails(rating);
  const RatingIcon = ratingDetails.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="py-20 bg-gradient-to-b from-deep-black to-space-gray"
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-center mb-12"
        >
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${ratingDetails.bg} border-2 ${ratingDetails.border} mb-6`}>
            <RatingIcon className={`w-6 h-6 ${ratingDetails.color}`} />
            <span className={`text-xl font-bold ${ratingDetails.color}`}>{ratingDetails.text}</span>
          </div>

          <div className="text-8xl font-mono font-bold mb-4 bg-gradient-to-r from-tech-blue via-electric-purple to-perf-green bg-clip-text text-transparent">
            {displayScore.toLocaleString()}
          </div>
          <div className="text-text-secondary text-lg mb-6">综合评分</div>

          <p className="text-text-secondary max-w-lg mx-auto flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-tech-blue" />
            {ratingDetails.description}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-4xl mx-auto bg-space-gray/50 backdrop-blur-lg rounded-2xl p-8 border border-tech-blue/20"
        >
          <h3 className="text-xl font-bold mb-6 text-center">测试结果详情</h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-space-gray">
                  <th className="text-left py-4 px-4 text-text-secondary font-medium">测试项目</th>
                  <th className="text-right py-4 px-4 text-text-secondary font-medium">压力级</th>
                  <th className="text-right py-4 px-4 text-text-secondary font-medium">平均 FPS</th>
                  <th className="text-right py-4 px-4 text-text-secondary font-medium">得分</th>
                </tr>
              </thead>
              <tbody>
                {testResult?.subTests.map((test, index) => (
                  <motion.tr
                    key={test.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="border-b border-space-gray/50 hover:bg-deep-black/30 transition-colors"
                  >
                    <td className="py-4 px-4 font-medium">{test.name}</td>
                    <td className="text-right py-4 px-4 font-mono text-electric-purple">P{test.maxPressureLevel}</td>
                    <td className="text-right py-4 px-4 font-mono">
                      <span className={
                        test.fps >= 100 ? 'text-perf-green' :
                        test.fps >= 60 ? 'text-perf-amber' : 'text-perf-red'
                      }>
                        {test.fps}
                      </span>
                    </td>
                    <td className="text-right py-4 px-4 font-mono text-tech-blue">{test.score.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-deep-black/30">
                  <td className="py-4 px-4 font-bold" colSpan={2}>总计</td>
                  <td className="text-right py-4 px-4 font-mono font-bold">
                    {testResult ? Math.round(testResult.subTests.reduce((a, b) => a + b.fps, 0) / testResult.subTests.length) : 0}
                  </td>
                  <td className="text-right py-4 px-4 font-mono font-bold text-electric-purple">
                    {displayScore.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap justify-center gap-4 mt-8"
        >
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-6 py-3 bg-space-gray hover:bg-space-gray/80 rounded-xl border border-tech-blue/30 transition-all hover:border-tech-blue/50"
          >
            <Download className="w-5 h-5" />
            导出 CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-2 px-6 py-3 bg-space-gray hover:bg-space-gray/80 rounded-xl border border-electric-purple/30 transition-all hover:border-electric-purple/50"
          >
            <Download className="w-5 h-5" />
            导出 JSON
          </button>
          <button
            onClick={handleRetest}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-tech-blue to-electric-purple rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-tech-blue/30"
          >
            <RotateCcw className="w-5 h-5" />
            重新测试
          </button>
        </motion.div>
      </div>
    </motion.section>
  );
}
