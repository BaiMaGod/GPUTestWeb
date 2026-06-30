import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useTestStore, PRESSURE_LEVEL_CONFIG } from '@/store/testStore';
import type { TestPhase, PressureLevel } from '@/store/testStore';

function FPSMonitor() {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const setCurrentFPS = useTestStore((s) => s.setCurrentFPS);
  const addFPSRecord = useTestStore((s) => s.addFPSRecord);
  const status = useTestStore((s) => s.status);

  useFrame(() => {
    if (status !== 'running') return;

    frameCountRef.current++;
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;

    if (elapsed >= 250) {
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);
      setCurrentFPS(fps);
      addFPSRecord(fps);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }
  });

  return null;
}

function ParticlePhase({ particleCount }: { particleCount: number }) {
  const meshRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radius = Math.random() * 12 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        colors[i3] = 0.23;
        colors[i3 + 1] = 0.51;
        colors[i3 + 2] = 0.96;
      } else if (colorChoice < 0.66) {
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
  }, [particleCount]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
    }
  });

  return (
    <Points ref={meshRef} positions={particles.positions} colors={particles.colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.06}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function LightingPhase({ meshCount }: { meshCount: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const meshes = useMemo(() => {
    const result: { pos: [number, number, number]; scale: number; geoType: number }[] = [];
    for (let i = 0; i < meshCount; i++) {
      result.push({
        pos: [
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
        ],
        scale: 0.3 + Math.random() * 0.7,
        geoType: Math.floor(Math.random() * 3),
      });
    }
    return result;
  }, [meshCount]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.2;
    }
  });

  const lightCount = Math.min(8, 2 + Math.floor(meshCount / 25));

  return (
    <group ref={groupRef}>
      {meshes.map((m, i) => (
        <mesh key={i} position={m.pos} scale={m.scale}>
          {m.geoType === 0 && <torusKnotGeometry args={[0.5, 0.18, 48, 12]} />}
          {m.geoType === 1 && <icosahedronGeometry args={[0.6, 1]} />}
          {m.geoType === 2 && <octahedronGeometry args={[0.7, 0]} />}
          <meshStandardMaterial
            color={new THREE.Color().setHSL(i / meshCount, 0.7, 0.55)}
            metalness={0.7}
            roughness={0.2}
            emissive={new THREE.Color().setHSL(i / meshCount, 0.9, 0.1)}
          />
        </mesh>
      ))}
      {Array.from({ length: lightCount }).map((_, i) => {
        const angle = (i / lightCount) * Math.PI * 2;
        const hue = i / lightCount;
        return (
          <pointLight
            key={i}
            position={[Math.cos(angle) * 8, Math.sin(i * 1.7) * 6, Math.sin(angle) * 8]}
            intensity={1.5 + Math.random()}
            color={new THREE.Color().setHSL(hue, 0.8, 0.6)}
            distance={25}
            decay={1.5}
          />
        );
      })}
      <ambientLight intensity={0.2} />
    </group>
  );
}

function PhysicsPhase({ cubeCount }: { cubeCount: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const velocities = useRef<{ vx: number; vy: number; vz: number; rx: number; ry: number; rz: number }[]>([]);
  const bounds = 8;

  const cubes = useMemo(() => {
    velocities.current = [];
    const result: { pos: [number, number, number]; size: number }[] = [];
    for (let i = 0; i < cubeCount; i++) {
      result.push({
        pos: [
          (Math.random() - 0.5) * bounds * 1.5,
          (Math.random() - 0.5) * bounds * 1.5,
          (Math.random() - 0.5) * bounds * 1.5,
        ],
        size: 0.25 + Math.random() * 0.4,
      });
      velocities.current.push({
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        vz: (Math.random() - 0.5) * 0.15,
        rx: (Math.random() - 0.5) * 0.02,
        ry: (Math.random() - 0.5) * 0.02,
        rz: (Math.random() - 0.5) * 0.02,
      });
    }
    return result;
  }, [cubeCount]);

  useFrame(() => {
    cubes.forEach((_, i) => {
      const mesh = meshRefs.current[i];
      const v = velocities.current[i];
      if (!mesh || !v) return;

      mesh.position.x += v.vx;
      mesh.position.y += v.vy;
      mesh.position.z += v.vz;
      mesh.rotation.x += v.rx;
      mesh.rotation.y += v.ry;
      mesh.rotation.z += v.rz;

      if (Math.abs(mesh.position.x) > bounds) { v.vx *= -1; mesh.position.x = Math.sign(mesh.position.x) * bounds; }
      if (Math.abs(mesh.position.y) > bounds) { v.vy *= -1; mesh.position.y = Math.sign(mesh.position.y) * bounds; }
      if (Math.abs(mesh.position.z) > bounds) { v.vz *= -1; mesh.position.z = Math.sign(mesh.position.z) * bounds; }
    });
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 7]} intensity={1} color="#3B82F6" />
      <directionalLight position={[-5, -5, -5]} intensity={0.5} color="#8B5CF6" />
      {cubes.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshRefs.current[i] = el; }}
          position={c.pos}
          castShadow
        >
          <boxGeometry args={[c.size, c.size, c.size]} />
          <meshStandardMaterial
            color={new THREE.Color().setHSL(i / cubeCount, 0.6, 0.55)}
            metalness={0.5}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

function MaterialsPhase({ sphereCount }: { sphereCount: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const spheres = useMemo(() => {
    const result: { pos: [number, number, number]; scale: number; hue: number }[] = [];
    for (let i = 0; i < sphereCount; i++) {
      const angle = (i / sphereCount) * Math.PI * 2;
      const radius = 3 + (i % 5) * 1.2;
      result.push({
        pos: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 6,
          Math.sin(angle) * radius,
        ],
        scale: 0.6 + Math.random() * 0.6,
        hue: i / sphereCount,
      });
    }
    return result;
  }, [sphereCount]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  const matSegments = sphereCount > 50 ? 48 : 64;

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 3, 0]} intensity={3} color="#ffffff" distance={30} decay={1.2} />
      <pointLight position={[-5, 0, 5]} intensity={2} color="#3B82F6" distance={25} decay={1.5} />
      <pointLight position={[5, 0, -5]} intensity={2} color="#8B5CF6" distance={25} decay={1.5} />
      <pointLight position={[0, -3, 0]} intensity={1.5} color="#10B981" distance={20} decay={1.5} />
      {sphereCount > 40 && (
        <>
          <pointLight position={[3, 2, 3]} intensity={1.2} color="#F59E0B" distance={18} decay={1.5} />
          <pointLight position={[-3, -2, -3]} intensity={1.2} color="#EC4899" distance={18} decay={1.5} />
        </>
      )}
      {spheres.map((s, i) => (
        <mesh key={i} position={s.pos} scale={s.scale}>
          <sphereGeometry args={[0.8, matSegments, matSegments]} />
          <meshPhysicalMaterial
            color={new THREE.Color().setHSL(s.hue, 0.85, 0.5)}
            metalness={0.3}
            roughness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.1}
            transmission={0.5}
            thickness={0.5}
            ior={1.5}
            emissive={new THREE.Color().setHSL(s.hue, 1, 0.15)}
          />
        </mesh>
      ))}
    </group>
  );
}

function WarmupPhase({ particleCount }: { particleCount: number }) {
  const meshRef = useRef<THREE.Points>(null);

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
      if (colorChoice < 0.33) {
        colors[i3] = 0.23; colors[i3 + 1] = 0.51; colors[i3 + 2] = 0.96;
      } else if (colorChoice < 0.66) {
        colors[i3] = 0.55; colors[i3 + 1] = 0.36; colors[i3 + 2] = 0.96;
      } else {
        colors[i3] = 0.06; colors[i3 + 1] = 0.73; colors[i3 + 2] = 0.51;
      }
    }
    return { positions, colors };
  }, [particleCount]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.4;
    }
  });

  return (
    <Points ref={meshRef} positions={particles.positions} colors={particles.colors} stride={3} frustumCulled={false}>
      <PointMaterial transparent vertexColors size={0.06} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </Points>
  );
}

function IdleScene() {
  const meshRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
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
        colors[i3] = 0.23; colors[i3 + 1] = 0.51; colors[i3 + 2] = 0.96;
      } else if (colorChoice < 0.6) {
        colors[i3] = 0.55; colors[i3 + 1] = 0.36; colors[i3 + 2] = 0.96;
      } else {
        colors[i3] = 0.06; colors[i3 + 1] = 0.73; colors[i3 + 2] = 0.51;
      }
    }
    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
      meshRef.current.rotation.x += 0.0005;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      coreRef.current.rotation.z = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#3B82F6" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8B5CF6" />
      <Points ref={meshRef} positions={particles.positions} colors={particles.colors} stride={3} frustumCulled={false}>
        <PointMaterial transparent vertexColors size={0.05} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </Points>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.5, 2]} />
        <meshBasicMaterial color="#3B82F6" wireframe transparent opacity={0.8} />
      </mesh>
    </>
  );
}

function PhaseContent({ phase, pressureLevel }: { phase: TestPhase; pressureLevel: PressureLevel }) {
  const cfg = PRESSURE_LEVEL_CONFIG[pressureLevel];
  const warmupCount = Math.floor(cfg.particleCount * 0.6);

  switch (phase) {
    case 'warmup': return <WarmupPhase particleCount={warmupCount} />;
    case 'particles': return <ParticlePhase particleCount={cfg.particleCount} />;
    case 'lighting': return <LightingPhase meshCount={cfg.meshCount} />;
    case 'physics': return <PhysicsPhase cubeCount={cfg.cubeCount} />;
    case 'materials': return <MaterialsPhase sphereCount={cfg.sphereCount} />;
    default: return <IdleScene />;
  }
}

function Scene() {
  const currentTestPhase = useTestStore((s) => s.currentTestPhase);
  const pressureLevel = useTestStore((s) => s.pressureLevel);

  return (
    <>
      <PhaseContent phase={currentTestPhase} pressureLevel={pressureLevel} />
      <FPSMonitor />
    </>
  );
}

export function Canvas3D() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 18], fov: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-deep-black/50 pointer-events-none" />
    </div>
  );
}
