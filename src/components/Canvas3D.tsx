import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
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
      const radius = Math.random() * 15 + 2;
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
      meshRef.current.rotation.y += 0.003;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
    }
  });

  return (
    <Points ref={meshRef} positions={particles.positions} colors={particles.colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.05}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function LightingPhase({ meshCount, shadowQuality }: { meshCount: number; shadowQuality: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const meshData = useMemo(() => {
    const data: { pos: [number, number, number]; scale: number; hue: number; rotSpeed: number }[] = [];
    for (let i = 0; i < meshCount; i++) {
      data.push({
        pos: [
          (Math.random() - 0.5) * 25,
          (Math.random() - 0.5) * 25,
          (Math.random() - 0.5) * 25,
        ],
        scale: 0.3 + Math.random() * 0.8,
        hue: Math.random(),
        rotSpeed: 0.5 + Math.random() * 1.5,
      });
    }
    return data;
  }, [meshCount]);

  useFrame((state) => {
    if (instancedRef.current) {
      for (let i = 0; i < meshCount; i++) {
        const d = meshData[i];
        dummy.position.set(d.pos[0], d.pos[1], d.pos[2]);
        dummy.scale.setScalar(d.scale);
        dummy.rotation.x = state.clock.elapsedTime * d.rotSpeed * 0.5;
        dummy.rotation.y = state.clock.elapsedTime * d.rotSpeed * 0.7;
        dummy.updateMatrix();
        instancedRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedRef.current.instanceMatrix.needsUpdate = true;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  const lightCount = Math.min(12, 4 + Math.floor(meshCount / 100));

  return (
    <group ref={groupRef}>
      <instancedMesh ref={instancedRef} args={[undefined, undefined, meshCount]} castShadow receiveShadow>
        <torusKnotGeometry args={[0.5, 0.18, 64, 16]} />
        <meshStandardMaterial
          metalness={0.8}
          roughness={0.15}
          color="#ffffff"
        />
      </instancedMesh>
      {Array.from({ length: lightCount }).map((_, i) => {
        const angle = (i / lightCount) * Math.PI * 2;
        const hue = i / lightCount;
        return (
          <pointLight
            key={i}
            position={[Math.cos(angle) * 10, Math.sin(i * 1.7) * 8, Math.sin(angle) * 10]}
            intensity={2 + Math.random()}
            color={new THREE.Color().setHSL(hue, 0.8, 0.6)}
            distance={35}
            decay={2}
            castShadow
            shadow-mapSize-width={shadowQuality}
            shadow-mapSize-height={shadowQuality}
          />
        );
      })}
      <ambientLight intensity={0.15} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -12, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.8} />
      </mesh>
    </group>
  );
}

function PhysicsPhase({ cubeCount, shadowQuality }: { cubeCount: number; shadowQuality: number }) {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const velocities = useRef<{ vx: number; vy: number; vz: number; rx: number; ry: number; rz: number }[]>([]);
  const bounds = 10;

  const cubes = useMemo(() => {
    velocities.current = [];
    const result: { pos: [number, number, number]; size: number; hue: number }[] = [];
    for (let i = 0; i < cubeCount; i++) {
      result.push({
        pos: [
          (Math.random() - 0.5) * bounds * 1.8,
          (Math.random() - 0.5) * bounds * 1.8,
          (Math.random() - 0.5) * bounds * 1.8,
        ],
        size: 0.2 + Math.random() * 0.5,
        hue: Math.random(),
      });
      velocities.current.push({
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        vz: (Math.random() - 0.5) * 0.2,
        rx: (Math.random() - 0.5) * 0.03,
        ry: (Math.random() - 0.5) * 0.03,
        rz: (Math.random() - 0.5) * 0.03,
      });
    }
    return result;
  }, [cubeCount]);

  useFrame(() => {
    if (!instancedRef.current) return;

    for (let i = 0; i < cubeCount; i++) {
      const c = cubes[i];
      const v = velocities.current[i];
      if (!v) continue;

      c.pos[0] += v.vx;
      c.pos[1] += v.vy;
      c.pos[2] += v.vz;

      if (Math.abs(c.pos[0]) > bounds) { v.vx *= -1; c.pos[0] = Math.sign(c.pos[0]) * bounds; }
      if (Math.abs(c.pos[1]) > bounds) { v.vy *= -1; c.pos[1] = Math.sign(c.pos[1]) * bounds; }
      if (Math.abs(c.pos[2]) > bounds) { v.vz *= -1; c.pos[2] = Math.sign(c.pos[2]) * bounds; }

      dummy.position.set(c.pos[0], c.pos[1], c.pos[2]);
      dummy.scale.setScalar(c.size);
      dummy.rotation.x += v.rx;
      dummy.rotation.y += v.ry;
      dummy.rotation.z += v.rz;
      dummy.updateMatrix();
      instancedRef.current.setMatrixAt(i, dummy.matrix);
    }
    instancedRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.5}
        color="#3B82F6"
        castShadow
        shadow-mapSize-width={shadowQuality}
        shadow-mapSize-height={shadowQuality}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <directionalLight position={[-8, -5, -8]} intensity={0.6} color="#8B5CF6" />
      <instancedMesh ref={instancedRef} args={[undefined, undefined, cubeCount]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          metalness={0.6}
          roughness={0.3}
          color="#ffffff"
        />
      </instancedMesh>
    </group>
  );
}

function MaterialsPhase({ sphereCount, shadowQuality }: { sphereCount: number; shadowQuality: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const spheres = useMemo(() => {
    const result: { pos: [number, number, number]; scale: number; hue: number; speed: number }[] = [];
    for (let i = 0; i < sphereCount; i++) {
      const angle = (i / sphereCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 3 + (i % 8) * 1.2 + Math.random() * 2;
      result.push({
        pos: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 10,
          Math.sin(angle) * radius,
        ],
        scale: 0.4 + Math.random() * 0.8,
        hue: i / sphereCount,
        speed: 0.3 + Math.random() * 0.7,
      });
    }
    return result;
  }, [sphereCount]);

  useFrame((state) => {
    if (instancedRef.current) {
      for (let i = 0; i < sphereCount; i++) {
        const s = spheres[i];
        const angle = (i / sphereCount) * Math.PI * 2 + state.clock.elapsedTime * s.speed * 0.3;
        const radius = 3 + (i % 8) * 1.2;
        dummy.position.set(
          Math.cos(angle) * radius,
          s.pos[1] + Math.sin(state.clock.elapsedTime * s.speed + i) * 1.5,
          Math.sin(angle) * radius
        );
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        instancedRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedRef.current.instanceMatrix.needsUpdate = true;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 4, 0]} intensity={4} color="#ffffff" distance={40} decay={1.5} castShadow shadow-mapSize-width={shadowQuality} shadow-mapSize-height={shadowQuality} />
      <pointLight position={[-8, 0, 8]} intensity={2.5} color="#3B82F6" distance={30} decay={2} />
      <pointLight position={[8, 0, -8]} intensity={2.5} color="#8B5CF6" distance={30} decay={2} />
      <pointLight position={[0, -4, 0]} intensity={2} color="#10B981" distance={25} decay={2} />
      <pointLight position={[6, 3, 6]} intensity={1.5} color="#F59E0B" distance={20} decay={2} />
      <pointLight position={[-6, -3, -6]} intensity={1.5} color="#EC4899" distance={20} decay={2} />
      <instancedMesh ref={instancedRef} args={[undefined, undefined, sphereCount]} castShadow receiveShadow>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshPhysicalMaterial
          metalness={0.2}
          roughness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transmission={0.6}
          thickness={0.8}
          ior={1.5}
          color="#ffffff"
        />
      </instancedMesh>
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
      const radius = Math.random() * 12 + 2;
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
      meshRef.current.rotation.y += 0.004;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.4;
    }
  });

  return (
    <Points ref={meshRef} positions={particles.positions} colors={particles.colors} stride={3} frustumCulled={false}>
      <PointMaterial transparent vertexColors size={0.05} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </Points>
  );
}

function IdleScene() {
  const meshRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const particleCount = 5000;

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
    case 'lighting': return <LightingPhase meshCount={cfg.meshCount} shadowQuality={cfg.shadowQuality} />;
    case 'physics': return <PhysicsPhase cubeCount={cfg.cubeCount} shadowQuality={cfg.shadowQuality} />;
    case 'materials': return <MaterialsPhase sphereCount={cfg.sphereCount} shadowQuality={cfg.shadowQuality} />;
    default: return <IdleScene />;
  }
}

function Scene({ bloomIntensity }: { bloomIntensity: number }) {
  const currentTestPhase = useTestStore((s) => s.currentTestPhase);
  const pressureLevel = useTestStore((s) => s.pressureLevel);
  const status = useTestStore((s) => s.status);

  const showEffects = status === 'running' && currentTestPhase !== 'idle' && currentTestPhase !== 'warmup';

  return (
    <>
      <PhaseContent phase={currentTestPhase} pressureLevel={pressureLevel} />
      <FPSMonitor />
      {showEffects && (
        <EffectComposer>
          <Bloom
            intensity={bloomIntensity}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </>
  );
}

export function Canvas3D() {
  const bloomIntensity = useTestStore((s) => {
    const cfg = PRESSURE_LEVEL_CONFIG[s.pressureLevel];
    return cfg?.bloomIntensity || 0.5;
  });

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        dpr={[1, 2]}
        shadows
      >
        <Scene bloomIntensity={bloomIntensity} />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-deep-black/50 pointer-events-none" />
    </div>
  );
}
