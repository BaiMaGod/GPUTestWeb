import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import { Cpu, HardDrive, Monitor } from 'lucide-react';
import { useTestStore } from '@/store/testStore';

export function MonitorPanel() {
  const { status, currentFPS, gpuUsage, fpsHistory, gpuInfo } = useTestStore();
  const chartRef = useRef<ReactECharts>(null);

  const option = {
    backgroundColor: 'transparent',
    grid: {
      top: 40,
      right: 20,
      bottom: 40,
      left: 60,
    },
    xAxis: {
      type: 'category',
      data: fpsHistory.map((_, i) => i.toString()),
      axisLine: { lineStyle: { color: '#3B82F6' } },
      axisLabel: { color: '#94A3B8', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 200,
      axisLine: { lineStyle: { color: '#3B82F6' } },
      axisLabel: { color: '#94A3B8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#131823' } },
    },
    series: [
      {
        name: 'FPS',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        sampling: 'lttb',
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#3B82F6' },
              { offset: 1, color: '#8B5CF6' },
            ],
          },
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ],
          },
        },
        itemStyle: {
          color: '#3B82F6',
          borderColor: '#8B5CF6',
          borderWidth: 2,
        },
        data: fpsHistory,
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#131823',
      borderColor: '#3B82F6',
      textStyle: { color: '#FFFFFF' },
      formatter: (params: any) => `FPS: ${params[0].value}`,
    },
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: status === 'running' || status === 'completed' ? 1 : 0, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`py-20 bg-deep-black ${status === 'running' || status === 'completed' ? 'block' : 'hidden'}`}
    >
      <div className="container mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-tech-blue to-electric-purple bg-clip-text text-transparent">
          实时性能监控
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-space-gray/50 backdrop-blur-lg rounded-2xl p-6 border border-tech-blue/20"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-tech-blue" />
              FPS 实时曲线
            </h3>
            <div className="h-64">
              <ReactECharts
                ref={chartRef}
                option={option}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-space-gray/50 backdrop-blur-lg rounded-2xl p-6 border border-tech-blue/20"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-electric-purple" />
              GPU 信息
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-deep-black/50 rounded-xl">
                <span className="text-text-secondary">显卡型号</span>
                <span className="font-mono font-semibold">{gpuInfo.name}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-deep-black/50 rounded-xl">
                <span className="text-text-secondary flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  显存大小
                </span>
                <span className="font-mono font-semibold">{gpuInfo.memory}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-deep-black/50 rounded-xl">
                <span className="text-text-secondary">驱动版本</span>
                <span className="font-mono font-semibold">{gpuInfo.driver}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-deep-black/50 rounded-xl">
                <span className="text-text-secondary">当前占用</span>
                <span className={`font-mono font-bold ${gpuUsage > 80 ? 'text-perf-red' : gpuUsage > 50 ? 'text-perf-amber' : 'text-perf-green'}`}>
                  {gpuUsage}%
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-space-gray/50 backdrop-blur-lg rounded-2xl p-6 border border-tech-blue/20"
        >
          <h3 className="text-lg font-semibold mb-4">帧耗时详情</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '渲染帧耗时', value: `${(16.67 * (60 / currentFPS || 1)).toFixed(2)}`, unit: 'ms' },
              { label: 'GPU计算耗时', value: `${(12.5 * (60 / currentFPS || 1)).toFixed(2)}`, unit: 'ms' },
              { label: 'Draw Call', value: '1,234', unit: '' },
              { label: '三角形面数', value: '2.5M', unit: '' },
            ].map((item, index) => (
              <div key={index} className="text-center p-4 bg-deep-black/50 rounded-xl">
                <div className="text-2xl font-mono font-bold text-tech-blue">{item.value}</div>
                <div className="text-xs text-text-secondary">{item.unit}</div>
                <div className="text-sm text-text-secondary mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
