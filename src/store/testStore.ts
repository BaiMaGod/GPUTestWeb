import { create } from 'zustand';

export type TestStatus = 'idle' | 'running' | 'completed';
export type PerformanceRating = 'flagship' | 'mainstream' | 'entry' | null;
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

// 根据动态压力指数计算 shader 参数
export function computeShaderParams(dynamicPressure: number, phase: TestPhase): ShaderParams {
  // 基础参数（压力=1时）
  const baseIterations = 64;
  const basePixelScale = 1.0;

  // 递进参数
  // 每次加压：迭代+32，像素+0.12，噪声+0.4，阴影+2，AO+0.5，体积雾+1
  const iterations = Math.min(512, baseIterations + dynamicPressure * 32);
  const pixelScale = Math.min(2.0, basePixelScale + dynamicPressure * 0.12);
  const fbmOctaves = Math.min(8, 2 + Math.floor(dynamicPressure * 0.4));
  const shadowSteps = Math.min(48, 8 + dynamicPressure * 2);
  const aoSteps = Math.min(12, 2 + Math.floor(dynamicPressure * 0.5));
  const volumeFogSteps = Math.min(24, 4 + dynamicPressure);
  const bloomIntensity = Math.min(2.0, 0.3 + dynamicPressure * 0.08);
  const reflectionEnabled = dynamicPressure >= 3;
  const stepScale = Math.min(1.5, 0.7 + dynamicPressure * 0.05);

  // 光源数：每 2 级加 1 个，上限 4
  const lightCount = Math.min(4, 1 + Math.floor(dynamicPressure / 2));

  const phaseConfig: Record<TestPhase, { name: string; weight: number }> = {
    idle: { name: '', weight: 0 },
    raymarch: { name: '光线步进', weight: 1.0 },
    fractal: { name: '分形几何', weight: 1.2 },
    lighting: { name: '全局光照', weight: 1.3 },
    compute: { name: '计算密度', weight: 1.5 },
  };

  return {
    maxIterations: iterations,
    stepScale,
    lightCount,
    fbmOctaves,
    shadowSteps,
    aoSteps,
    volumeFogSteps,
    reflectionEnabled,
    bloomIntensity,
    pixelScale,
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
