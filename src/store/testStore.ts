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

  // 处理 ANGLE 格式: ANGLE (Vendor, GPU Name ..., API)
  const angleMatch = name.match(/^ANGLE\s*\((.+)\)$/i);
  if (angleMatch && angleMatch[1]) {
    const inner = angleMatch[1];
    const parts = inner.split(',');
    if (parts.length >= 2) {
      name = parts.slice(1, -1).join(',').trim() || parts[1].trim();
    } else {
      name = inner;
    }
    // 特殊处理 SwiftShader 等软件渲染器
    const swiftMatch = name.match(/SwiftShader/i);
    if (swiftMatch) {
      name = 'SwiftShader';
    }
  } else if (name.startsWith('Mesa ')) {
    // Mesa 格式: Mesa Intel(R) UHD Graphics 630 (CFL GT2)
    name = name.replace(/^Mesa\s+/i, '');
    const lastParen = name.lastIndexOf(' (');
    if (lastParen > 0) {
      name = name.substring(0, lastParen);
    }
  } else {
    // 非 ANGLE 格式，尝试提取显卡名
    // 如果包含括号且括号不在开头，保留原名进行后续清理
    const hasParen = name.includes('(') && name.includes(')');
    if (!hasParen) {
      // 没有括号，直接用原名
    } else if (!name.startsWith('(')) {
      // 括号不在开头，可能是 "Intel(R) UHD Graphics 630" 这种格式
      // 保留原名进行后续清理
    } else {
      // 括号在开头，提取内容
      const parenMatch = name.match(/\((.+)\)/);
      if (parenMatch && parenMatch[1]) {
        name = parenMatch[1];
      }
    }
  }

  // 移除 Direct3D / Metal / OpenGL 相关后缀
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

  // 如果还有逗号，取最后一个有意义的部分
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

  // 清理多余的空格
  name = name.replace(/\s+/g, ' ').trim();

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

  // 软件渲染器
  if (nameLower.includes('swiftshader') || nameLower.includes('llvmpipe')) {
    return 'Software';
  }

  // Intel 集成显卡检测优先
  if (nameLower.includes('uhd')) return 'Shared Memory';
  if (nameLower.includes('iris xe max')) return '4GB GDDR6';
  if (nameLower.includes('iris')) return 'Shared Memory';
  if (nameLower.includes('hd graphics')) return 'Shared Memory';
  if (nameLower.includes('hd ') && nameLower.includes('intel')) return 'Shared Memory';

  // Intel 独立显卡 (Arc)
  if (nameLower.includes('arc a770')) return '16GB GDDR6';
  if (nameLower.includes('arc a750')) return '8GB GDDR6';
  if (nameLower.includes('arc a580')) return '8GB GDDR6';
  if (nameLower.includes('arc a380')) return '6GB GDDR6';
  if (nameLower.includes('arc a310')) return '4GB GDDR6';
  if (nameLower.includes('arc')) return 'Shared Memory';

  // NVIDIA 显卡
  if (nameLower.includes('rtx 5090')) return '32GB GDDR7';
  if (nameLower.includes('rtx 5080')) return '16GB GDDR7';
  if (nameLower.includes('rtx 5070 ti')) return '16GB GDDR7';
  if (nameLower.includes('rtx 5070')) return '12GB GDDR7';
  if (nameLower.includes('rtx 5060 ti')) return '16GB GDDR7';
  if (nameLower.includes('rtx 5060')) return '8GB GDDR7';
  if (nameLower.includes('rtx 4090')) return '24GB GDDR6X';
  if (nameLower.includes('rtx 4080 super')) return '16GB GDDR6X';
  if (nameLower.includes('rtx 4080')) return '16GB GDDR6X';
  if (nameLower.includes('rtx 4070 ti super')) return '16GB GDDR6X';
  if (nameLower.includes('rtx 4070 ti')) return '12GB GDDR6X';
  if (nameLower.includes('rtx 4070 super')) return '12GB GDDR6X';
  if (nameLower.includes('rtx 4070')) return '12GB GDDR6X';
  if (nameLower.includes('rtx 4060 ti')) return '8GB GDDR6';
  if (nameLower.includes('rtx 4060')) return '8GB GDDR6';
  if (nameLower.includes('rtx 4050')) return '6GB GDDR6';
  if (nameLower.includes('rtx 3090 ti')) return '24GB GDDR6X';
  if (nameLower.includes('rtx 3090')) return '24GB GDDR6X';
  if (nameLower.includes('rtx 3080 ti')) return '12GB GDDR6X';
  if (nameLower.includes('rtx 3080')) return '10GB GDDR6X';
  if (nameLower.includes('rtx 3070 ti')) return '8GB GDDR6X';
  if (nameLower.includes('rtx 3070')) return '8GB GDDR6';
  if (nameLower.includes('rtx 3060 ti')) return '8GB GDDR6';
  if (nameLower.includes('rtx 3060')) return '12GB GDDR6';
  if (nameLower.includes('rtx 3050')) return '8GB GDDR6';
  if (nameLower.includes('rtx 2080 ti')) return '11GB GDDR6';
  if (nameLower.includes('rtx 2080 super')) return '8GB GDDR6';
  if (nameLower.includes('rtx 2080')) return '8GB GDDR6';
  if (nameLower.includes('rtx 2070 super')) return '8GB GDDR6';
  if (nameLower.includes('rtx 2070')) return '8GB GDDR6';
  if (nameLower.includes('rtx 2060 super')) return '8GB GDDR6';
  if (nameLower.includes('rtx 2060')) return '6GB GDDR6';
  if (nameLower.includes('gtx 1660 super')) return '6GB GDDR6';
  if (nameLower.includes('gtx 1660 ti')) return '6GB GDDR6';
  if (nameLower.includes('gtx 1660')) return '6GB GDDR5';
  if (nameLower.includes('gtx 1650 super')) return '4GB GDDR6';
  if (nameLower.includes('gtx 1650')) return '4GB GDDR6';
  if (nameLower.includes('gtx 1080 ti')) return '11GB GDDR5X';
  if (nameLower.includes('gtx 1080')) return '8GB GDDR5X';
  if (nameLower.includes('gtx 1070 ti')) return '8GB GDDR5';
  if (nameLower.includes('gtx 1070')) return '8GB GDDR5';
  if (nameLower.includes('gtx 1060')) return '6GB GDDR5';
  if (nameLower.includes('gtx 1050 ti')) return '4GB GDDR5';
  if (nameLower.includes('gtx 1050')) return '2GB GDDR5';

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

  return 'Unknown';
}

function getGPUDriver(gpuName: string, rawRenderer: string, rawVendor: string): string {
  const nameLower = gpuName.toLowerCase();
  const rawLower = rawRenderer.toLowerCase();
  const vendorLower = rawVendor.toLowerCase();

  // 合并所有可能包含版本号的字符串
  const combined = `${rawRenderer} ${rawVendor}`;

  // 从原始字符串中查找驱动版本号 - 尝试多种模式
  const patterns = [
    /(\d{2,}\.\d+\.\d+\.\d+)/,
    /(\d{3,}\.\d+\.\d+)/,
    /(\d{2}\.\d+\.\d+\.\d{4,})/,
    /(\d+\.\d+\.\d+\.\d+)/,
    /driver\s*version\s*[:\s]*([\d.]+)/i,
    /version\s*[:\s]*([\d]+\.[\d]+\.[\d]+)/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match && match[1]) {
      const version = match[1];
      if (version.length >= 5 && !version.startsWith('0.')) {
        return version;
      }
    }
  }

  // 软件渲染器
  if (nameLower.includes('swiftshader') || nameLower.includes('llvmpipe')) {
    return 'Software';
  }

  // Intel 驱动版本检测优先
  if (nameLower.includes('intel') || nameLower.includes('uhd') || nameLower.includes('hd graphics') || nameLower.includes('iris')) {
    if (nameLower.includes('arc')) return '31.x+';
    if (nameLower.includes('iris xe')) return '31.x+';
    if (nameLower.includes('uhd 7')) return '31.x+';
    if (nameLower.includes('uhd 6')) return '30.x+';
    if (nameLower.includes('uhd')) return '30.x+';
    if (nameLower.includes('hd 6')) return '27.x+';
    if (nameLower.includes('hd 5')) return '26.x+';
    if (nameLower.includes('hd 4')) return '20.x+';
    return '31.x+';
  }

  // NVIDIA
  if (nameLower.includes('rtx 50')) return '570.x+';
  if (nameLower.includes('rtx 40')) return '550.x+';
  if (nameLower.includes('rtx 30')) return '530.x+';
  if (nameLower.includes('rtx 20')) return '520.x+';
  if (nameLower.includes('gtx 16')) return '515.x+';
  if (nameLower.includes('gtx 10')) return '490.x+';
  if (nameLower.includes('nvidia') || nameLower.includes('geforce')) return '530.x+';

  // AMD
  if (nameLower.includes('rx 7')) return '23.x+';
  if (nameLower.includes('rx 6')) return '22.x+';
  if (nameLower.includes('rx 5')) return '21.x+';
  if (nameLower.includes('amd') || nameLower.includes('radeon')) return '22.x+';

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
