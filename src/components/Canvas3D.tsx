import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useTestStore } from '@/store/testStore';

function ParticleGalaxy({ intensity }: { intensity: number }) {
  const meshRef = useRef<THREE.Points>(null);
  const particleCount = 3000;

  const particles = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 10 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const colorChoice = Math.random();
      if (colorChoice < 0.3) {
        colors[i3] = 0.23;
        colors[i3 + 1] = 0.51;
        colors[i3 + 2] = 0.96;
      } else if (colorChoice < 0.6) {
        colors[i3] = 0.55;
        colors[i3 + 1] = 0.36;
        colors[i3 + 2] = 0.96;
      } else {
        colors[i3] = 0.06;
        colors[i3 + 1] = 0.73;
        colors[i3 + 2] = 0.51;
      }
    }

    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001 * intensity;
      meshRef.current.rotation.x += 0.0005 * intensity;
    }
  });

  return (
    <Points ref={meshRef} positions={particles.positions} colors={particles.colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#3B82F6"
        size={0.05 * intensity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function CentralCore({ intensity }: { intensity: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5 * intensity;
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.3 * intensity;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.5 * intensity, 2]} />
      <meshBasicMaterial
        color="#3B82F6"
        wireframe
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function Scene({ testIntensity }: { testIntensity: number }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#3B82F6" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8B5CF6" />
      <ParticleGalaxy intensity={testIntensity} />
      <CentralCore intensity={testIntensity} />
    </>
  );
}

export function Canvas3D() {
  const { status } = useTestStore();
  const testIntensity = status === 'running' ? 2 : 1;

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 15], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene testIntensity={testIntensity} />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-deep-black/50 pointer-events-none" />
    </div>
  );
}
