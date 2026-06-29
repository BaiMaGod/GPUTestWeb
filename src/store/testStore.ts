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

function getWebGLGPUInfo(): GPUInfo {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

    if (!gl) {
      return {
        name: 'Unknown GPU',
        vendor: 'Unknown',
        memory: 'Unknown',
        driver: 'Unknown',
      };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';

      // 尝试从渲染器名称中提取显存信息
      let memory = 'Unknown';
      const rendererLower = renderer.toLowerCase();

      // 常见的显存大小模式
      if (rendererLower.includes('24gb') || rendererLower.includes('24 g')) {
        memory = '24GB GDDR6X';
      } else if (rendererLower.includes('16gb') || rendererLower.includes('16 g')) {
        memory = '16GB GDDR6X';
      } else if (rendererLower.includes('12gb') || rendererLower.includes('12 g')) {
        memory = '12GB GDDR6';
      } else if (rendererLower.includes('8gb') || rendererLower.includes('8 g')) {
        memory = '8GB GDDR6';
      } else if (rendererLower.includes('6gb') || rendererLower.includes('6 g')) {
        memory = '6GB GDDR6';
      } else if (rendererLower.includes('4gb') || rendererLower.includes('4 g')) {
        memory = '4GB GDDR';
      } else if (rendererLower.includes('2gb') || rendererLower.includes('2 g')) {
        memory = '2GB GDDR';
      }

      // 估算驱动版本（通常可以从渲染器名称中看到代际信息）
      let driver = 'Unknown';
      if (rendererLower.includes('rtx 40')) {
        driver = '550.x+';
      } else if (rendererLower.includes('rtx 30')) {
        driver = '530.x+';
      } else if (rendererLower.includes('rtx 20')) {
        driver = '520.x+';
      } else if (rendererLower.includes('gtx 16') || rendererLower.includes('gtx1650')) {
        driver = '515.x+';
      } else if (rendererLower.includes('radeon rx 7')) {
        driver = '23.x+';
      } else if (rendererLower.includes('radeon rx 6')) {
        driver = '22.x+';
      }

      return {
        name: renderer,
        vendor: vendor,
        memory: memory,
        driver: driver,
      };
    }

    return {
      name: gl.getParameter(gl.RENDERER) || 'Unknown GPU',
      vendor: gl.getParameter(gl.VENDOR) || 'Unknown',
      memory: 'Unknown',
      driver: 'Unknown',
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
