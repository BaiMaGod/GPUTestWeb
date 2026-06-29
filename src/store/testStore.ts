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
  memory: string;
  driver: string;
}

export interface TestResult {
  overallScore: number;
  rating: PerformanceRating;
  subTests: SubTestResult[];
  gpuInfo: GPUInfo;
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

  setStatus: (status: TestStatus) => void;
  setCurrentFPS: (fps: number) => void;
  setGpuUsage: (usage: number) => void;
  addFPSRecord: (fps: number) => void;
  setRemainingTime: (time: number | null) => void;
  setTestResult: (result: TestResult) => void;
  setGpuInfo: (info: GPUInfo) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as TestStatus,
  currentFPS: 0,
  gpuUsage: 0,
  fpsHistory: [],
  remainingTime: null,
  finalScore: null,
  rating: null,
  gpuInfo: {
    name: 'Unknown GPU',
    memory: 'Unknown',
    driver: 'Unknown',
  },
  testResult: null,
};

export const useTestStore = create<TestState>((set) => ({
  ...initialState,

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

  setGpuInfo: (info) => set({ gpuInfo: info }),

  reset: () => set(initialState),
}));
