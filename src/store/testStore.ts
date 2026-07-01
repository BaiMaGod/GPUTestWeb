import { create } from 'zustand';

export type TestStatus = 'idle' | 'running' | 'completed';
export type PerformanceRating = 'top' | 'flagship' | 'high' | 'mainstream' | 'mid' | 'entry' | null;

export const FORMAL_RATINGS: { key: PerformanceRating; name: string; minScore: number }[] = [
  { key: 'top',       name: '顶尖级', minScore: 20000 },
  { key: 'flagship',  name: '旗舰级', minScore: 14000 },
  { key: 'high',      name: '高端级', minScore: 9000 },
  { key: 'mainstream', name: '主流级', minScore: 5000 },
  { key: 'mid',       name: '中端级', minScore: 2000 },
  { key: 'entry',     name: '入门级', minScore: 0 },
];

export const FUN_RATINGS: { key: string; name: string; minScore: number }[] = [
  { key: 'hardcore', name: '夯爆了', minScore: 23000 },
  { key: 'solid',    name: '夯',     minScore: 17000 },
  { key: 'top',      name: '顶级',   minScore: 12000 },
  { key: 'boss',     name: '人上人',  minScore: 7000 },
  { key: 'npc',      name: 'NPC',    minScore: 3500 },
  { key: 'ok',       name: '拉',     minScore: 1500 },
  { key: 'done',     name: '拉完了',  minScore: 0 },
];

export function getRatingByScore(score: number, formal: boolean = true): PerformanceRating | string {
  const ratings = formal ? FORMAL_RATINGS : FUN_RATINGS;
  for (const r of ratings) {
    if (score >= r.minScore) return r.key;
  }
  return formal ? 'entry' : 'done';
}

export function getRatingName(key: PerformanceRating | string, formal: boolean = true): string {
  const ratings = formal ? FORMAL_RATINGS : FUN_RATINGS;
  const found = ratings.find(r => r.key === key);
  return found?.name || '待测试';
}
export type TestPhase = 'idle' | 'raymarch' | 'fractal' | 'lighting' | 'compute';

// 目标帧率阈值 - 当 FPS 低于此值时停止加压
const TARGET_FPS_THRESHOLD = 30;

export interface ShaderParams {
  maxIterations: number;
  stepScale: number;
  lightCount: number;
  fbmOctaves: number;
  shadowSteps: number;
  aoSteps: number;
  volumeFogSteps: number;
  reflectionEnabled: boolean;
  bloomIntensity: number;
  pixelScale: number; // 像素倍率，1.0 = 原分辨率，2.0 = 4倍像素
  phaseName: string;
  weight: number;
}

export const TEST_PHASES: { phase: TestPhase; name: string; weight: number }[] = [
  { phase: 'raymarch', name: '光线步进', weight: 1.0 },
  { phase: 'fractal', name: '分形几何', weight: 1.2 },
  { phase: 'lighting', name: '全局光照', weight: 1.3 },
  { phase: 'compute', name: '计算密度', weight: 1.5 },
];

// GPU Benchmark 压力等级参数标准 (参考 3DMark / Unigine / 毒蘑菇 Volume Shader)
// 迭代次数参考: 毒蘑菇 Light=200, Medium=600, Heavy=1002, Extreme=1500
// 等级划分:
//   P1-P5:   入门级 (200-400 iter, 1080p基础画质)
//   P6-P10:  主流级 (400-700 iter, 1080p-1440p中等画质)
//   P11-P15: 高端级 (700-1000 iter, 1440p-4K高等画质)
//   P16-P20: 旗舰级 (1000-1500 iter, 4K+极致画质)
const PRESSURE_LEVELS: Record<number, {
  pixelScale: number;
  maxIterations: number;
  fbmOctaves: number;
  shadowSteps: number;
  aoSteps: number;
  volumeFogSteps: number;
  reflectionEnabled: boolean;
  lightCount: number;
  bloomIntensity: number;
  stepScale: number;
}> = {
  1:  { pixelScale: 1.0,  maxIterations: 200,  fbmOctaves: 2, shadowSteps: 8,   aoSteps: 4,  volumeFogSteps: 0,  reflectionEnabled: false, lightCount: 1, bloomIntensity: 0.3, stepScale: 0.8 },
  2:  { pixelScale: 1.05, maxIterations: 240,  fbmOctaves: 3, shadowSteps: 10,  aoSteps: 5,  volumeFogSteps: 4,  reflectionEnabled: false, lightCount: 1, bloomIntensity: 0.4, stepScale: 0.85 },
  3:  { pixelScale: 1.1,  maxIterations: 280,  fbmOctaves: 3, shadowSteps: 12,  aoSteps: 6,  volumeFogSteps: 6,  reflectionEnabled: false, lightCount: 1, bloomIntensity: 0.5, stepScale: 0.9 },
  4:  { pixelScale: 1.15, maxIterations: 320,  fbmOctaves: 4, shadowSteps: 14,  aoSteps: 7,  volumeFogSteps: 8,  reflectionEnabled: false, lightCount: 2, bloomIntensity: 0.6, stepScale: 0.95 },
  5:  { pixelScale: 1.2,  maxIterations: 400,  fbmOctaves: 4, shadowSteps: 16,  aoSteps: 8,  volumeFogSteps: 10, reflectionEnabled: false, lightCount: 2, bloomIntensity: 0.7, stepScale: 1.0 },
  6:  { pixelScale: 1.25, maxIterations: 460,  fbmOctaves: 5, shadowSteps: 18,  aoSteps: 9,  volumeFogSteps: 12, reflectionEnabled: false, lightCount: 2, bloomIntensity: 0.8, stepScale: 1.0 },
  7:  { pixelScale: 1.3,  maxIterations: 520,  fbmOctaves: 5, shadowSteps: 20,  aoSteps: 10, volumeFogSteps: 14, reflectionEnabled: false, lightCount: 2, bloomIntensity: 0.9, stepScale: 1.0 },
  8:  { pixelScale: 1.35, maxIterations: 580,  fbmOctaves: 6, shadowSteps: 22,  aoSteps: 11, volumeFogSteps: 16, reflectionEnabled: true,  lightCount: 3, bloomIntensity: 1.0, stepScale: 1.05 },
  9:  { pixelScale: 1.4,  maxIterations: 640,  fbmOctaves: 6, shadowSteps: 24,  aoSteps: 12, volumeFogSteps: 18, reflectionEnabled: true,  lightCount: 3, bloomIntensity: 1.1, stepScale: 1.05 },
  10: { pixelScale: 1.5,  maxIterations: 700,  fbmOctaves: 7, shadowSteps: 26,  aoSteps: 13, volumeFogSteps: 20, reflectionEnabled: true,  lightCount: 3, bloomIntensity: 1.2, stepScale: 1.1 },
  11: { pixelScale: 1.6,  maxIterations: 780,  fbmOctaves: 7, shadowSteps: 28,  aoSteps: 14, volumeFogSteps: 22, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 1.3, stepScale: 1.1 },
  12: { pixelScale: 1.7,  maxIterations: 860,  fbmOctaves: 8, shadowSteps: 30,  aoSteps: 15, volumeFogSteps: 24, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 1.4, stepScale: 1.15 },
  13: { pixelScale: 1.8,  maxIterations: 940,  fbmOctaves: 8, shadowSteps: 32,  aoSteps: 16, volumeFogSteps: 26, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 1.5, stepScale: 1.15 },
  14: { pixelScale: 1.9,  maxIterations: 1002, fbmOctaves: 8, shadowSteps: 36,  aoSteps: 16, volumeFogSteps: 28, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 1.6, stepScale: 1.2 },
  15: { pixelScale: 2.0,  maxIterations: 1100, fbmOctaves: 8, shadowSteps: 40,  aoSteps: 16, volumeFogSteps: 30, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 1.7, stepScale: 1.2 },
  16: { pixelScale: 2.1,  maxIterations: 1200, fbmOctaves: 8, shadowSteps: 44,  aoSteps: 16, volumeFogSteps: 32, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 1.8, stepScale: 1.2 },
  17: { pixelScale: 2.2,  maxIterations: 1300, fbmOctaves: 8, shadowSteps: 48,  aoSteps: 16, volumeFogSteps: 34, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 1.9, stepScale: 1.2 },
  18: { pixelScale: 2.3,  maxIterations: 1400, fbmOctaves: 8, shadowSteps: 52,  aoSteps: 16, volumeFogSteps: 36, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 2.0, stepScale: 1.2 },
  19: { pixelScale: 2.4,  maxIterations: 1450, fbmOctaves: 8, shadowSteps: 56,  aoSteps: 16, volumeFogSteps: 38, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 2.0, stepScale: 1.2 },
  20: { pixelScale: 2.5,  maxIterations: 1500, fbmOctaves: 8, shadowSteps: 60,  aoSteps: 16, volumeFogSteps: 40, reflectionEnabled: true,  lightCount: 4, bloomIntensity: 2.0, stepScale: 1.2 },
};

function getPressureLevelParams(level: number) {
  if (level <= 1) return PRESSURE_LEVELS[1];
  if (level >= 20) return PRESSURE_LEVELS[20];
  return PRESSURE_LEVELS[level];
}

// 根据动态压力指数计算 shader 参数
export function computeShaderParams(dynamicPressure: number, phase: TestPhase): ShaderParams {
  const params = getPressureLevelParams(dynamicPressure);

  const phaseConfig: Record<TestPhase, { name: string; weight: number }> = {
    idle: { name: '', weight: 0 },
    raymarch: { name: '光线步进', weight: 1.0 },
    fractal: { name: '分形几何', weight: 1.2 },
    lighting: { name: '全局光照', weight: 1.3 },
    compute: { name: '计算密度', weight: 1.5 },
  };

  return {
    maxIterations: params.maxIterations,
    stepScale: params.stepScale,
    lightCount: params.lightCount,
    fbmOctaves: params.fbmOctaves,
    shadowSteps: params.shadowSteps,
    aoSteps: params.aoSteps,
    volumeFogSteps: params.volumeFogSteps,
    reflectionEnabled: params.reflectionEnabled,
    bloomIntensity: params.bloomIntensity,
    pixelScale: params.pixelScale,
    phaseName: phaseConfig[phase].name,
    weight: phaseConfig[phase].weight,
  };
}

export interface SubTestResult {
  name: string;
  fps: number;
  maxPressureLevel: number;
  score: number;
}

export interface GPUInfo {
  name: string;
  vendor: string;
  memory: string;
  driver: string;
}

export interface TestResult {
  overallScore: number;
  rating: PerformanceRating;
  subTests: SubTestResult[];
  gpuInfo: GPUInfo;
  finalDynamicPressure: number;
}

function cleanGPUName(rawRenderer: string): string {
  let name = rawRenderer;
  const angleMatch = name.match(/^ANGLE\s*\((.+)\)$/i);
  if (angleMatch && angleMatch[1]) {
    const inner = angleMatch[1];
    const parts = inner.split(',');
    if (parts.length >= 2) {
      name = parts.slice(1, -1).join(',').trim() || parts[1].trim();
    } else {
      name = inner;
    }
    if (/SwiftShader/i.test(name)) {
      name = 'SwiftShader';
    }
  } else if (name.startsWith('Mesa ')) {
    name = name.replace(/^Mesa\s+/i, '');
    const lastParen = name.lastIndexOf(' (');
    if (lastParen > 0) {
      name = name.substring(0, lastParen);
    }
  } else {
    const hasParen = name.includes('(') && name.includes(')');
    if (!hasParen) {
    } else if (!name.startsWith('(')) {
    } else {
      const parenMatch = name.match(/\((.+)\)/);
      if (parenMatch && parenMatch[1]) {
        name = parenMatch[1];
      }
    }
  }
  name = name.replace(/\s*Direct3D\d*\s*vs_\d+_0\s*ps_\d+_0/i, '');
  name = name.replace(/\s*\(0x[0-9a-fA-F]+\)/g, '');
  name = name.replace(/\s*OpenGL Engine.*/i, '');
  name = name.replace(/\s*OpenGL[\d.]*.*/i, '');
  name = name.replace(/\s*Vulkan[\d.]*.*/i, '');
  name = name.replace(/\s*via.*$/i, '');
  name = name.replace(/\s*ANGLE.*/i, '');
  name = name.replace(/\s*D3D\d+.*/i, '');
  name = name.replace(/\s*Mesa.*/i, '');
  name = name.replace(/\s*\/\s*PCIe.*$/i, '');
  name = name.replace(/\s*\/\s*SSE2.*$/i, '');
  name = name.replace(/\s*\/.*$/, '');
  name = name.trim();
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim()).filter(p => p.length > 0);
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!/^(D3D|Direct3D|OpenGL|Vulkan|Metal|ANGLE|vs_|ps_)/i.test(part)) {
        name = part;
        break;
      }
    }
  }
  name = name.replace(/\s+/g, ' ').trim();
  return name || rawRenderer;
}

function cleanVendor(rawVendor: string, rawRenderer: string): string {
  let vendor = rawVendor;
  const parenMatch = vendor.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    vendor = parenMatch[1];
  }
  const rendererLower = rawRenderer.toLowerCase();
  if (rendererLower.includes('nvidia') || vendor.toLowerCase().includes('nvidia')) return 'NVIDIA';
  if (rendererLower.includes('amd') || rendererLower.includes('radeon') || vendor.toLowerCase().includes('amd')) return 'AMD';
  if (rendererLower.includes('intel') || vendor.toLowerCase().includes('intel')) return 'Intel';
  if (rendererLower.includes('apple') || vendor.toLowerCase().includes('apple')) return 'Apple';
  if (rendererLower.includes('qualcomm') || rendererLower.includes('adreno')) return 'Qualcomm';
  if (rendererLower.includes('mali') || rendererLower.includes('arm')) return 'ARM';
  return vendor.trim() || 'Unknown';
}

function getGPUMemory(gpuName: string, rawRenderer: string): string {
  const nameLower = gpuName.toLowerCase();
  const rawLower = rawRenderer.toLowerCase();
  const memMatch = rawLower.match(/(\d+)\s*gb/);
  if (memMatch) {
    const gb = parseInt(memMatch[1]);
    if (gb >= 16) return `${gb}GB GDDR6X`;
    if (gb >= 10) return `${gb}GB GDDR6X`;
    return `${gb}GB GDDR6`;
  }
  if (/swiftshader|llvmpipe/i.test(nameLower)) return 'Software';
  if (/uhd/i.test(nameLower)) return 'Shared Memory';
  if (/iris xe max/i.test(nameLower)) return '4GB GDDR6';
  if (/iris/i.test(nameLower)) return 'Shared Memory';
  if (/hd graphics/i.test(nameLower)) return 'Shared Memory';
  if (/hd .+intel/i.test(nameLower)) return 'Shared Memory';
  if (/arc a770/i.test(nameLower)) return '16GB GDDR6';
  if (/arc a750/i.test(nameLower)) return '8GB GDDR6';
  if (/arc a580/i.test(nameLower)) return '8GB GDDR6';
  if (/arc a380/i.test(nameLower)) return '6GB GDDR6';
  if (/arc a310/i.test(nameLower)) return '4GB GDDR6';
  if (/arc/i.test(nameLower)) return 'Shared Memory';
  if (/rtx 5090/i.test(nameLower)) return '32GB GDDR7';
  if (/rtx 5080/i.test(nameLower)) return '16GB GDDR7';
  if (/rtx 5070 ti/i.test(nameLower)) return '16GB GDDR7';
  if (/rtx 5070/i.test(nameLower)) return '12GB GDDR7';
  if (/rtx 5060 ti/i.test(nameLower)) return '16GB GDDR7';
  if (/rtx 5060/i.test(nameLower)) return '8GB GDDR7';
  if (/rtx 4090/i.test(nameLower)) return '24GB GDDR6X';
  if (/rtx 4080/i.test(nameLower)) return '16GB GDDR6X';
  if (/rtx 4070/i.test(nameLower)) return '12GB GDDR6X';
  if (/rtx 4060/i.test(nameLower)) return '8GB GDDR6';
  if (/rtx 3090/i.test(nameLower)) return '24GB GDDR6X';
  if (/rtx 3080/i.test(nameLower)) return '10GB GDDR6X';
  if (/rtx 3070/i.test(nameLower)) return '8GB GDDR6';
  if (/rtx 3060/i.test(nameLower)) return '12GB GDDR6';
  if (/rtx 3050/i.test(nameLower)) return '8GB GDDR6';
  if (/rtx/i.test(nameLower)) return '8GB GDDR6';
  if (/gtx 16/i.test(nameLower)) return '6GB GDDR6';
  if (/gtx/i.test(nameLower)) return '8GB GDDR5';
  if (/rx 7900/i.test(nameLower)) return '24GB GDDR6';
  if (/rx 7800/i.test(nameLower)) return '16GB GDDR6';
  if (/rx 7700/i.test(nameLower)) return '12GB GDDR6';
  if (/rx 7600/i.test(nameLower)) return '8GB GDDR6';
  if (/rx 6900|rx 6800/i.test(nameLower)) return '16GB GDDR6';
  if (/rx 6700|rx 6650|rx 6600/i.test(nameLower)) return '8GB GDDR6';
  if (/rx/i.test(nameLower)) return '8GB GDDR6';
  return 'Unknown';
}

function getGPUDriver(gpuName: string, rawRenderer: string, rawVendor: string): string {
  const nameLower = gpuName.toLowerCase();
  const combined = `${rawRenderer} ${rawVendor}`;
  const patterns = [
    /(\d{2,}\.\d+\.\d+\.\d+)/, /(\d{3,}\.\d+\.\d+)/,
    /(\d{2}\.\d+\.\d+\.\d{4,})/, /(\d+\.\d+\.\d+\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match && match[1] && match[1].length >= 5 && !match[1].startsWith('0.')) {
      return match[1];
    }
  }
  if (/swiftshader|llvmpipe/i.test(nameLower)) return 'Software';
  if (/intel|uhd|hd graphics|iris/i.test(nameLower)) {
    if (/arc/i.test(nameLower)) return '31.x+';
    if (/iris xe/i.test(nameLower)) return '31.x+';
    if (/uhd 7/i.test(nameLower)) return '31.x+';
    if (/uhd 6/i.test(nameLower)) return '30.x+';
    if (/uhd/i.test(nameLower)) return '30.x+';
    if (/hd 6/i.test(nameLower)) return '27.x+';
    if (/hd 5/i.test(nameLower)) return '26.x+';
    if (/hd 4/i.test(nameLower)) return '20.x+';
    return '31.x+';
  }
  if (/rtx 50/i.test(nameLower)) return '570.x+';
  if (/rtx 40/i.test(nameLower)) return '550.x+';
  if (/rtx 30/i.test(nameLower)) return '530.x+';
  if (/rtx/i.test(nameLower)) return '520.x+';
  if (/gtx 16|gtx 10|geforce/i.test(nameLower)) return '515.x+';
  if (/amd|radeon|rx/i.test(nameLower)) return '22.x+';
  return 'Unknown';
}

function getWebGLGPUInfo(): GPUInfo {
  try {
    if (typeof document === 'undefined') return { name: 'Unknown GPU', vendor: 'Unknown', memory: 'Unknown', driver: 'Unknown' };
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return { name: 'Unknown GPU', vendor: 'Unknown', memory: 'Unknown', driver: 'Unknown' };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let rawVendor = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
    let rawRenderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    const gpuName = cleanGPUName(rawRenderer);
    const vendor = cleanVendor(rawVendor, rawRenderer);
    const memory = getGPUMemory(gpuName, rawRenderer);
    const driver = getGPUDriver(gpuName, rawRenderer, rawVendor);
    return { name: gpuName, vendor, memory, driver };
  } catch {
    return { name: 'Unknown GPU', vendor: 'Unknown', memory: 'Unknown', driver: 'Unknown' };
  }
}

interface PhaseRecord {
  phase: TestPhase;
  fpsHistory: number[];
  maxPressureLevel: number;
}

interface TestState {
  status: TestStatus;
  currentTestPhase: TestPhase;
  dynamicPressure: number;
  currentFPS: number;
  gpuUsage: number;
  fpsHistory: number[];
  phaseRecords: PhaseRecord[];
  finalScore: number | null;
  rating: PerformanceRating;
  gpuInfo: GPUInfo;
  testResult: TestResult | null;
  phaseStartTime: number;
  lastPressureIncreaseTime: number;

  initializeGPUInfo: () => void;
  setStatus: (status: TestStatus) => void;
  setCurrentTestPhase: (phase: TestPhase) => void;
  setDynamicPressure: (pressure: number) => void;
  incrementDynamicPressure: () => void;
  setCurrentFPS: (fps: number) => void;
  setGpuUsage: (usage: number) => void;
  addFPSRecord: (fps: number) => void;
  recordPhaseFPS: (fps: number) => void;
  setTestResult: (result: TestResult) => void;
  reset: () => void;
}

const initialGPUInfo = getWebGLGPUInfo();

const initialState = {
  status: 'idle' as TestStatus,
  currentTestPhase: 'idle' as TestPhase,
  dynamicPressure: 1,
  currentFPS: 0,
  gpuUsage: 0,
  fpsHistory: [] as number[],
  phaseRecords: [] as PhaseRecord[],
  finalScore: null as number | null,
  rating: null as PerformanceRating,
  gpuInfo: initialGPUInfo,
  testResult: null as TestResult | null,
  phaseStartTime: 0,
  lastPressureIncreaseTime: 0,
};

export const useTestStore = create<TestState>((set, get) => ({
  ...initialState,

  initializeGPUInfo: () => {
    const info = getWebGLGPUInfo();
    set({ gpuInfo: info });
  },

  setStatus: (status) => set({ status }),

  setCurrentTestPhase: (phase) => {
    const now = Date.now();
    set({ currentTestPhase: phase, dynamicPressure: 1, phaseStartTime: now, lastPressureIncreaseTime: now, fpsHistory: [] });
  },

  setDynamicPressure: (pressure) => set({ dynamicPressure: pressure }),

  incrementDynamicPressure: () => {
    const { dynamicPressure, currentFPS } = get();
    if (currentFPS >= TARGET_FPS_THRESHOLD) {
      set({ dynamicPressure: dynamicPressure + 1, lastPressureIncreaseTime: Date.now() });
    }
  },

  setCurrentFPS: (fps) => set({ currentFPS: fps }),

  setGpuUsage: (usage) => set({ gpuUsage: usage }),

  addFPSRecord: (fps) => set((state) => ({
    fpsHistory: [...state.fpsHistory.slice(-999), fps],
  })),

  recordPhaseFPS: (fps) => {
    const { currentTestPhase, dynamicPressure, phaseRecords } = get();
    if (currentTestPhase === 'idle') return;
    const existing = phaseRecords.find(r => r.phase === currentTestPhase);
    if (existing) {
      existing.fpsHistory.push(fps);
      existing.maxPressureLevel = Math.max(existing.maxPressureLevel, dynamicPressure);
      set({ phaseRecords: [...phaseRecords] });
    } else {
      set({ phaseRecords: [...phaseRecords, { phase: currentTestPhase, fpsHistory: [fps], maxPressureLevel: dynamicPressure }] });
    }
  },

  setTestResult: (result) => set({
    testResult: result,
    finalScore: result.overallScore,
    rating: result.rating,
    status: 'completed',
    currentTestPhase: 'idle',
  }),

  reset: () => set({ ...initialState, gpuInfo: getWebGLGPUInfo() }),
}));
