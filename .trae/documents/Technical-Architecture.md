# GPU性能测试网站 - 技术架构文档

## 1. 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    前端 (React)                      │
├─────────────────────────────────────────────────────┤
│  组件层: 导航栏 / 3D测试场景 / 监控面板 / 报告区   │
├─────────────────────────────────────────────────────┤
│  状态层: React Hooks / Context (测试状态管理)       │
├─────────────────────────────────────────────────────┤
│  渲染层: Three.js (3D) / ECharts (图表)             │
├─────────────────────────────────────────────────────┤
│  样式层: Tailwind CSS + CSS Variables               │
└─────────────────────────────────────────────────────┘
```

## 2. 技术选型

- **前端框架**：React@18 + Vite
- **样式**：Tailwind CSS@3
- **3D渲染**：Three.js + @react-three/fiber + @react-three/drei
- **图表**：ECharts (echarts-for-react)
- **动画**：Framer Motion
- **状态管理**：React Hooks + Context
- **构建工具**：Vite

## 3. 路由定义

单页面应用，无需路由。所有功能在首页完成。

## 4. 页面结构

```
App
├── Navbar (导航栏)
│   ├── Logo (芯片图标 + 文字)
│   ├── StatusIndicator (状态 + 呼吸灯)
│   └── GPUInfo (GPU型号 + 性能等级)
├── HeroSection (核心测试区)
│   ├── Canvas3D (Three.js 3D场景)
│   ├── FPSDisplay (实时FPS数字)
│   ├── GPUUsageBar (GPU占用率)
│   └── StartButton (开始测试按钮)
├── MonitorPanel (实时监控面板)
│   ├── FPSChart (FPS折线图)
│   ├── GPUInfoCard (GPU信息卡)
│   └── FrameTimeDetails (帧耗时详情)
└── ReportSection (报告区)
    ├── ScoreDisplay (综合评分)
    ├── ResultTable (结果表格)
    └── ActionButtons (导出/重新测试)
```

## 5. 数据模型

### 5.1 测试状态

```typescript
interface TestState {
  status: 'idle' | 'running' | 'completed';
  currentFPS: number;
  gpuUsage: number;
  fpsHistory: number[];
  remainingTime: number | null;
  finalScore: number | null;
  rating: 'flagship' | 'mainstream' | 'entry' | null;
}

interface TestResult {
  overallScore: number;
  rating: string;
  subTests: {
    name: string;
    fps: number;
    score: number;
  }[];
  gpuInfo: {
    name: string;
    memory: string;
    driver: string;
  };
}
```

### 5.2 性能等级阈值

- 旗舰级 (≥60fps)
- 主流级 (30-60fps)
- 入门级 (<30fps)

## 6. 性能指标

- 首屏加载 < 3秒
- FPS检测精度：16.67ms（60fps基准）
- 图表刷新率：60fps
- 3D场景保持流畅渲染
