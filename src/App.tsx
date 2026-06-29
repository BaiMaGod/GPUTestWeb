import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { MonitorPanel } from '@/components/MonitorPanel';
import { ReportSection } from '@/components/ReportSection';

export default function App() {
  return (
    <div className="min-h-screen bg-deep-black">
      <Navbar />
      <main>
        <HeroSection />
        <MonitorPanel />
        <ReportSection />
      </main>
      <footer className="py-8 text-center text-text-secondary text-sm border-t border-space-gray">
        <p>GPUBench - 专业 GPU 性能基准测试平台</p>
      </footer>
    </div>
  );
}
