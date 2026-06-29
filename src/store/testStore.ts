import { create } from 'zustand';

export type TestStatus = 'idle' | 'running' | 'completed';
export type PerformanceRating = 'flagship' | 'mainstream' | 'entry' | null;

export interface SubTestResult {
  name: string;
  fps: number;
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
}

interface GPUSpec {
  memory: string;
  driverHint: string;
}

function getWebGLGPUInfo(): GPUInfo {
  try {
    if (typeof document === 'undefined') {
      return {
        name: 'Unknown GPU',
        vendor: 'Unknown',
        memory: 'Unknown',
        driver: 'Unknown',
      };
    }

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

    if (!gl) {
      return {
        name: 'Unknown GPU',
        vendor: 'Unknown',
        memory: 'Unknown',
        driver: 'Unknown',
      };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    let rawVendor = 'Unknown';
    let rawRenderer = 'Unknown';

    if (debugInfo) {
      rawVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
      rawRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
    } else {
      rawVendor = gl.getParameter(gl.VENDOR) || 'Unknown';
      rawRenderer = gl.getParameter(gl.RENDERER) || 'Unknown GPU';
    }

    const gpuName = cleanGPUName(rawRenderer);
    const vendor = cleanVendor(rawVendor, rawRenderer);
    const memory = getGPUMemory(gpuName, rawRenderer);
    const driver = getGPUDriver(gpuName, rawRenderer, rawVendor);

    return {
      name: gpuName,
      vendor: vendor,
      memory: memory,
      driver: driver,
    };
  } catch {
    return {
      name: 'Unknown GPU',
      vendor: 'Unknown',
      memory: 'Unknown',
      driver: 'Unknown',
    };
  }
}

function cleanGPUName(rawRenderer: string): string {
  let name = rawRenderer;

  // 移除 ANGLE 前缀
  const angleMatch = name.match(/ANGLE\s*\([^)]*,\s*([^)]+?)\s*\(/i);
  if (angleMatch && angleMatch[1]) {
    name = angleMatch[1];
  } else {
    // 尝试提取括号里的显卡名
    const parenMatch = name.match(/\((.*?)\)/);
    if (parenMatch && parenMatch[1]) {
      name = parenMatch[1];
    }
  }

  // 移除 Direct3D / Metal / OpenGL 相关后缀
  name = name.replace(/\s*Direct3D\d*\s*vs_\d+_0\s*ps_\d+_0,?\s*(D3D\d*)?/i, '');
  name = name.replace(/\s*\(0x[0-9a-f]+\)/i, '');
  name = name.replace(/\s*OpenGL Engine.*/i, '');
  name = name.replace(/\s*via.*$/i, '');
  name = name.replace(/\s*ANGLE.*/i, '');
  name = name.replace(/\s*D3D\d+.*/i, '');
  name = name.replace(/\s*\(.*\)\s*$/, '');
  name = name.trim();

  // 如果还有逗号，取第一部分（通常是 GPU 名）
  if (name.includes(',')) {
    const parts = name.split(',');
    name = parts[parts.length - 1]?.trim() || name;
  }

  return name || rawRenderer;
}

function cleanVendor(rawVendor: string, rawRenderer: string): string {
  // 从 vendor 中提取真实厂商
  let vendor = rawVendor;

  // 去除 Google Inc. 等浏览器相关前缀
  const parenMatch = vendor.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    vendor = parenMatch[1];
  }

  // 从 renderer 中补充判断
  const rendererLower = rawRenderer.toLowerCase();
  if (rendererLower.includes('nvidia') || vendor.toLowerCase().includes('nvidia')) {
    return 'NVIDIA';
  }
  if (rendererLower.includes('amd') || rendererLower.includes('radeon') || vendor.toLowerCase().includes('amd')) {
    return 'AMD';
  }
  if (rendererLower.includes('intel') || vendor.toLowerCase().includes('intel')) {
    return 'Intel';
  }
  if (rendererLower.includes('apple') || vendor.toLowerCase().includes('apple')) {
    return 'Apple';
  }
  if (rendererLower.includes('qualcomm') || rendererLower.includes('adreno')) {
    return 'Qualcomm';
  }
  if (rendererLower.includes('mali') || rendererLower.includes('arm')) {
    return 'ARM';
  }

  return vendor.trim() || 'Unknown';
}

function getGPUMemory(gpuName: string, rawRenderer: string): string {
  const nameLower = gpuName.toLowerCase();
  const rawLower = rawRenderer.toLowerCase();

  // 从原始字符串中直接查找显存信息
  const memMatch = rawLower.match(/(\d+)\s*gb/);
  if (memMatch) {
    const gb = parseInt(memMatch[1]);
    if (gb >= 16) return `${gb}GB GDDR6X`;
    if (gb >= 10) return `${gb}GB GDDR6X`;
    return `${gb}GB GDDR6`;
  }

  // NVIDIA 显卡数据库
  const nvidiaGPUs: Record<string, GPUSpec> = {
    'rtx 5090': { memory: '32GB GDDR7', driverHint: '570.x+' },
    'rtx 5080': { memory: '16GB GDDR7', driverHint: '570.x+' },
    'rtx 5070 ti': { memory: '16GB GDDR7', driverHint: '570.x+' },
    'rtx 5070': { memory: '12GB GDDR7', driverHint: '570.x+' },
    'rtx 5060 ti': { memory: '16GB GDDR7', driverHint: '570.x+' },
    'rtx 5060': { memory: '8GB GDDR7', driverHint: '570.x+' },
    'rtx 4090': { memory: '24GB GDDR6X', driverHint: '550.x+' },
    'rtx 4080 super': { memory: '16GB GDDR6X', driverHint: '550.x+' },
    'rtx 4080': { memory: '16GB GDDR6X', driverHint: '550.x+' },
    'rtx 4070 ti super': { memory: '16GB GDDR6X', driverHint: '550.x+' },
    'rtx 4070 ti': { memory: '12GB GDDR6X', driverHint: '550.x+' },
    'rtx 4070 super': { memory: '12GB GDDR6X', driverHint: '550.x+' },
    'rtx 4070': { memory: '12GB GDDR6X', driverHint: '550.x+' },
    'rtx 4060 ti': { memory: '8GB GDDR6', driverHint: '550.x+' },
    'rtx 4060': { memory: '8GB GDDR6', driverHint: '550.x+' },
    'rtx 4050': { memory: '6GB GDDR6', driverHint: '550.x+' },
    'rtx 3090 ti': { memory: '24GB GDDR6X', driverHint: '530.x+' },
    'rtx 3090': { memory: '24GB GDDR6X', driverHint: '530.x+' },
    'rtx 3080 ti': { memory: '12GB GDDR6X', driverHint: '530.x+' },
    'rtx 3080': { memory: '10GB GDDR6X', driverHint: '530.x+' },
    'rtx 3070 ti': { memory: '8GB GDDR6X', driverHint: '530.x+' },
    'rtx 3070': { memory: '8GB GDDR6', driverHint: '530.x+' },
    'rtx 3060 ti': { memory: '8GB GDDR6', driverHint: '530.x+' },
    'rtx 3060': { memory: '12GB GDDR6', driverHint: '530.x+' },
    'rtx 3050': { memory: '8GB GDDR6', driverHint: '530.x+' },
    'rtx 2080 ti': { memory: '11GB GDDR6', driverHint: '520.x+' },
    'rtx 2080 super': { memory: '8GB GDDR6', driverHint: '520.x+' },
    'rtx 2080': { memory: '8GB GDDR6', driverHint: '520.x+' },
    'rtx 2070 super': { memory: '8GB GDDR6', driverHint: '520.x+' },
    'rtx 2070': { memory: '8GB GDDR6', driverHint: '520.x+' },
    'rtx 2060 super': { memory: '8GB GDDR6', driverHint: '520.x+' },
    'rtx 2060': { memory: '6GB GDDR6', driverHint: '520.x+' },
    'gtx 1660 super': { memory: '6GB GDDR6', driverHint: '515.x+' },
    'gtx 1660 ti': { memory: '6GB GDDR6', driverHint: '515.x+' },
    'gtx 1660': { memory: '6GB GDDR5', driverHint: '515.x+' },
    'gtx 1650 super': { memory: '4GB GDDR6', driverHint: '515.x+' },
    'gtx 1650': { memory: '4GB GDDR6', driverHint: '515.x+' },
    'gtx 1080 ti': { memory: '11GB GDDR5X', driverHint: '490.x+' },
    'gtx 1080': { memory: '8GB GDDR5X', driverHint: '490.x+' },
    'gtx 1070 ti': { memory: '8GB GDDR5', driverHint: '490.x+' },
    'gtx 1070': { memory: '8GB GDDR5', driverHint: '490.x+' },
    'gtx 1060': { memory: '6GB GDDR5', driverHint: '490.x+' },
    'gtx 1050 ti': { memory: '4GB GDDR5', driverHint: '490.x+' },
    'gtx 1050': { memory: '2GB GDDR5', driverHint: '490.x+' },
  };

  for (const [key, spec] of Object.entries(nvidiaGPUs)) {
    if (nameLower.includes(key)) {
      return spec.memory;
    }
  }

  // AMD 显卡
  if (nameLower.includes('rx 7900 xtx')) return '24GB GDDR6';
  if (nameLower.includes('rx 7900 xt')) return '20GB GDDR6';
  if (nameLower.includes('rx 7800 xt')) return '16GB GDDR6';
  if (nameLower.includes('rx 7700 xt')) return '12GB GDDR6';
  if (nameLower.includes('rx 7600 xt')) return '16GB GDDR6';
  if (nameLower.includes('rx 7600')) return '8GB GDDR6';
  if (nameLower.includes('rx 7500')) return '8GB GDDR6';
  if (nameLower.includes('rx 6900 xt')) return '16GB GDDR6';
  if (nameLower.includes('rx 6800 xt')) return '16GB GDDR6';
  if (nameLower.includes('rx 6800')) return '16GB GDDR6';
  if (nameLower.includes('rx 6750 xt')) return '12GB GDDR6';
  if (nameLower.includes('rx 6700 xt')) return '12GB GDDR6';
  if (nameLower.includes('rx 6700')) return '10GB GDDR6';
  if (nameLower.includes('rx 6650 xt')) return '8GB GDDR6';
  if (nameLower.includes('rx 6600 xt')) return '8GB GDDR6';
  if (nameLower.includes('rx 6600')) return '8GB GDDR6';
  if (nameLower.includes('rx 6500 xt')) return '4GB GDDR6';
  if (nameLower.includes('rx 5700 xt')) return '8GB GDDR6';
  if (nameLower.includes('rx 5700')) return '8GB GDDR6';

  // Intel 显卡
  if (nameLower.includes('arc a770')) return '16GB GDDR6';
  if (nameLower.includes('arc a750')) return '8GB GDDR6';
  if (nameLower.includes('arc a580')) return '8GB GDDR6';
  if (nameLower.includes('arc a380')) return '6GB GDDR6';

  return 'Unknown';
}

function getGPUDriver(gpuName: string, rawRenderer: string, rawVendor: string): string {
  const nameLower = gpuName.toLowerCase();
  const rawLower = rawRenderer.toLowerCase();
  const vendorLower = rawVendor.toLowerCase();

  // 从原始字符串中查找驱动版本号 - 尝试多种模式
  const patterns = [
    /driver\s*version\s*[:\s]*([\d.]+)/i,
    /version\s*[:\s]*([\d]+\.[\d]+\.[\d]+\.[\d]+)/i,
    /([\d]+\.[\d]+\.[\d]+\.[\d]+)/,
    /(\d{2,}\.\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = rawLower.match(pattern) || vendorLower.match(pattern);
    if (match && match[1]) {
      const version = match[1];
      if (version.length >= 5) {
        return version;
      }
    }
  }

  // 如果仍然匹配不到，尝试从 vendor 中查找数字序列
  const numMatch = vendorLower.match(/(\d{2,}[\d.]*)/);
  if (numMatch && numMatch[1].length >= 5) {
    return numMatch[1];
  }

  // 根据 GPU 代际估算
  const nvidiaGPUs: Record<string, GPUSpec> = {
    'rtx 50': { memory: '', driverHint: '570.x+' },
    'rtx 40': { memory: '', driverHint: '550.x+' },
    'rtx 30': { memory: '', driverHint: '530.x+' },
    'rtx 20': { memory: '', driverHint: '520.x+' },
    'gtx 16': { memory: '', driverHint: '515.x+' },
    'gtx 10': { memory: '', driverHint: '490.x+' },
  };

  for (const [key, spec] of Object.entries(nvidiaGPUs)) {
    if (nameLower.includes(key)) {
      return spec.driverHint;
    }
  }

  // AMD
  if (nameLower.includes('rx 7')) return '23.x+';
  if (nameLower.includes('rx 6')) return '22.x+';
  if (nameLower.includes('rx 5')) return '21.x+';

  // Intel
  if (nameLower.includes('arc')) return '31.x+';

  return 'Unknown';
}

interface TestState {
  status: TestStatus;
  currentFPS: number;
  gpuUsage: number;
  fpsHistory: number[];
  remainingTime: number | null;
  finalScore: number | null;
  rating: PerformanceRating;
  gpuInfo: GPUInfo;
  testResult: TestResult | null;

  initializeGPUInfo: () => void;
  setStatus: (status: TestStatus) => void;
  setCurrentFPS: (fps: number) => void;
  setGpuUsage: (usage: number) => void;
  addFPSRecord: (fps: number) => void;
  setRemainingTime: (time: number | null) => void;
  setTestResult: (result: TestResult) => void;
  reset: () => void;
}

const initialGPUInfo = getWebGLGPUInfo();

const initialState = {
  status: 'idle' as TestStatus,
  currentFPS: 0,
  gpuUsage: 0,
  fpsHistory: [] as number[],
  remainingTime: null as number | null,
  finalScore: null as number | null,
  rating: null as PerformanceRating,
  gpuInfo: initialGPUInfo,
  testResult: null as TestResult | null,
};

export const useTestStore = create<TestState>((set) => ({
  ...initialState,

  initializeGPUInfo: () => {
    const info = getWebGLGPUInfo();
    set({ gpuInfo: info });
  },

  setStatus: (status) => set({ status }),

  setCurrentFPS: (fps) => set({ currentFPS: fps }),

  setGpuUsage: (usage) => set({ gpuUsage: usage }),

  addFPSRecord: (fps) => set((state) => ({
    fpsHistory: [...state.fpsHistory.slice(-299), fps],
  })),

  setRemainingTime: (time) => set({ remainingTime: time }),

  setTestResult: (result) => set({
    testResult: result,
    finalScore: result.overallScore,
    rating: result.rating,
    status: 'completed',
  }),

  reset: () => set({ ...initialState, gpuInfo: getWebGLGPUInfo() }),
}));
