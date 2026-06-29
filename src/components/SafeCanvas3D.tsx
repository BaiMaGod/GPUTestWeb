import { Component, type ReactNode } from 'react';
import { Canvas3D } from './Canvas3D';
import { Canvas2DFallback } from './Canvas2DFallback';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('WebGL context not available, falling back to 2D:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return <Canvas2DFallback />;
    }
    return this.props.children;
  }
}

export function SafeCanvas3D() {
  const isWebGLAvailable = (() => {
    if (typeof window === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
      return false;
    }
  })();

  if (!isWebGLAvailable) {
    return <Canvas2DFallback />;
  }

  return (
    <WebGLErrorBoundary>
      <Canvas3D />
    </WebGLErrorBoundary>
  );
}
