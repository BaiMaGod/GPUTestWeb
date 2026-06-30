import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTestStore, PRESSURE_LEVEL_CONFIG } from '@/store/testStore';
import type { TestPhase, PressureLevel } from '@/store/testStore';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMaxIterations;
  uniform float uStepScale;
  uniform int uLightCount;
  uniform int uPhase;
  varying vec2 vUv;

  #define MAX_STEPS 256
  #define MAX_DIST 100.0
  #define SURF_DIST 0.001

  mat2 rot2(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }

  float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }

  float mandelbulb(vec3 pos, int iterations) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    float power = 8.0;

    for (int i = 0; i < 64; i++) {
      if (i >= iterations) break;
      r = length(z);
      if (r > 2.0) break;

      float theta = acos(z.z / r);
      float phi = atan(z.y, z.x);
      dr = pow(r, power - 1.0) * power * dr + 1.0;

      float zr = pow(r, power);
      theta = theta * power;
      phi = phi * power;

      z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
      z += pos;
    }
    return 0.5 * log(r) * r / dr;
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * sin(p.x * frequency) * sin(p.y * frequency) * sin(p.z * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  float getDist(vec3 p) {
    float t = uTime * 0.3;

    if (uPhase == 0) {
      vec3 bp = p;
      bp.xy *= rot2(t * 0.3);
      bp.xz *= rot2(t * 0.2);
      float sphere = sdSphere(bp, 1.8);
      float torus = sdTorus(bp + vec3(0.0, 0.0, 0.0), vec2(2.5, 0.3));
      return min(sphere, torus);
    }

    if (uPhase == 1) {
      vec3 mp = p * 0.6;
      mp.xy *= rot2(t * 0.2);
      mp.xz *= rot2(t * 0.15);
      return mandelbulb(mp, uMaxIterations) * 1.6;
    }

    if (uPhase == 2) {
      vec3 mp = p * 0.5;
      mp.xy *= rot2(t * 0.15);
      float mb = mandelbulb(mp, max(32, uMaxIterations / 2)) * 2.0;
      float noise = fbm(p * 1.5 + t * 0.5) * 0.3;
      return mb + noise;
    }

    vec3 mp = p * 0.45;
    mp.xy *= rot2(t * 0.1);
    mp.xz *= rot2(t * 0.08);
    float mb = mandelbulb(mp, uMaxIterations) * 2.2;
    float noise = fbm(p * 2.0 + t * 0.3) * 0.25;
    vec3 tp = p;
    tp.xy *= rot2(t * 0.4);
    float torus = sdTorus(tp, vec2(3.0, 0.15));
    return min(mb + noise, torus);
  }

  float rayMarch(vec3 ro, vec3 rd) {
    float d0 = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
      if (i >= uMaxIterations) break;
      vec3 p = ro + rd * d0;
      float ds = getDist(p) * uStepScale;
      d0 += ds;
      if (d0 > MAX_DIST || abs(ds) < SURF_DIST) break;
    }
    return d0;
  }

  vec3 getNormal(vec3 p) {
    float d = getDist(p);
    vec2 e = vec2(0.001, 0.0);
    vec3 n = d - vec3(
      getDist(p - e.xyy),
      getDist(p - e.yxy),
      getDist(p - e.yyx)
    );
    return normalize(n);
  }

  float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 32; i++) {
      if (t >= maxt) break;
      float h = getDist(ro + rd * t);
      if (h < 0.001) return 0.0;
      res = min(res, k * h / t);
      t += h * 0.5;
    }
    return clamp(res, 0.0, 1.0);
  }

  vec3 getLighting(vec3 p, vec3 n, vec3 ro) {
    vec3 col = vec3(0.0);
    vec3 ambient = vec3(0.05, 0.05, 0.1);
    col += ambient;

    float t = uTime * 0.5;
    vec3 viewDir = normalize(ro - p);

    if (uLightCount >= 1) {
      vec3 lightPos1 = vec3(5.0 * sin(t), 5.0, 5.0 * cos(t));
      vec3 lightCol1 = vec3(0.4, 0.6, 1.0);
      vec3 l1 = normalize(lightPos1 - p);
      float diff1 = max(dot(n, l1), 0.0);
      float shadow1 = softShadow(p + n * 0.01, l1, 0.01, 10.0, 16.0);
      vec3 half1 = normalize(l1 + viewDir);
      float spec1 = pow(max(dot(n, half1), 0.0), 64.0);
      col += lightCol1 * (diff1 * shadow1 + spec1 * shadow1 * 0.5);
    }

    if (uLightCount >= 2) {
      vec3 lightPos2 = vec3(-5.0 * cos(t * 0.7), 3.0 * sin(t * 0.8), -5.0 * sin(t * 0.7));
      vec3 lightCol2 = vec3(1.0, 0.4, 0.8);
      vec3 l2 = normalize(lightPos2 - p);
      float diff2 = max(dot(n, l2), 0.0);
      float shadow2 = softShadow(p + n * 0.01, l2, 0.01, 10.0, 16.0);
      vec3 half2 = normalize(l2 + viewDir);
      float spec2 = pow(max(dot(n, half2), 0.0), 64.0);
      col += lightCol2 * (diff2 * shadow2 + spec2 * shadow2 * 0.5);
    }

    if (uLightCount >= 3) {
      vec3 lightPos3 = vec3(0.0, -4.0, 3.0 * sin(t * 1.2));
      vec3 lightCol3 = vec3(0.2, 1.0, 0.6);
      vec3 l3 = normalize(lightPos3 - p);
      float diff3 = max(dot(n, l3), 0.0);
      float shadow3 = softShadow(p + n * 0.01, l3, 0.01, 10.0, 12.0);
      vec3 half3 = normalize(l3 + viewDir);
      float spec3 = pow(max(dot(n, half3), 0.0), 48.0);
      col += lightCol3 * (diff3 * shadow3 + spec3 * shadow3 * 0.3);
    }

    if (uLightCount >= 4) {
      vec3 lightPos4 = vec3(3.0 * cos(t * 1.5), 4.0 * cos(t * 0.5), -3.0 * sin(t * 1.5));
      vec3 lightCol4 = vec3(1.0, 0.8, 0.2);
      vec3 l4 = normalize(lightPos4 - p);
      float diff4 = max(dot(n, l4), 0.0);
      float shadow4 = softShadow(p + n * 0.01, l4, 0.01, 8.0, 12.0);
      vec3 half4 = normalize(l4 + viewDir);
      float spec4 = pow(max(dot(n, half4), 0.0), 32.0);
      col += lightCol4 * (diff4 * shadow4 + spec4 * shadow4 * 0.3);
    }

    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    col += vec3(0.3, 0.5, 1.0) * fresnel * 0.4;

    return col;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    float t = uTime * 0.2;
    vec3 ro = vec3(sin(t) * 6.0, 2.0 + sin(t * 0.7) * 0.5, cos(t) * 6.0);
    vec3 lookAt = vec3(0.0, 0.0, 0.0);

    vec3 f = normalize(lookAt - ro);
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
    vec3 u = cross(f, r);
    vec3 rd = normalize(f + uv.x * r + uv.y * u);

    float d = rayMarch(ro, rd);

    vec3 col = vec3(0.0);
    if (d < MAX_DIST) {
      vec3 p = ro + rd * d;
      vec3 n = getNormal(p);
      col = getLighting(p, n, ro);

      float glow = exp(-d * 0.15) * 0.3;
      col += vec3(0.3, 0.5, 1.0) * glow;
    } else {
      float glow = 0.0;
      for (int i = 0; i < 48; i++) {
        if (i >= uMaxIterations / 4) break;
        vec3 p = ro + rd * float(i) * 0.8;
        float dist = getDist(p);
        glow += 0.008 / (dist + 0.1);
      }
      col = vec3(0.1, 0.15, 0.3) + vec3(0.3, 0.5, 1.0) * glow * 0.5;
    }

    col = pow(col, vec3(0.4545));
    col = col / (1.0 + col);

    gl_FragColor = vec4(col, 1.0);
  }
`;

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

function ShaderScene({ phase, pressureLevel }: { phase: TestPhase; pressureLevel: PressureLevel }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const cfg = PRESSURE_LEVEL_CONFIG[pressureLevel];

  const phaseIndex = useMemo(() => {
    switch (phase) {
      case 'raymarch': return 0;
      case 'fractal': return 1;
      case 'lighting': return 2;
      case 'compute': return 3;
      default: return 0;
    }
  }, [phase]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(viewport.width * 100, viewport.height * 100) },
    uMaxIterations: { value: cfg.maxIterations },
    uStepScale: { value: cfg.stepScale },
    uLightCount: { value: cfg.lightCount },
    uPhase: { value: phaseIndex },
  }), [cfg.maxIterations, cfg.stepScale, cfg.lightCount, phaseIndex, viewport.width, viewport.height]);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      mat.uniforms.uMaxIterations.value = cfg.maxIterations;
      mat.uniforms.uStepScale.value = cfg.stepScale;
      mat.uniforms.uLightCount.value = cfg.lightCount;
      mat.uniforms.uPhase.value = phaseIndex;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[40, 30]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function IdleScene() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(viewport.width * 100, viewport.height * 100) },
    uMaxIterations: { value: 48 },
    uStepScale: { value: 0.8 },
    uLightCount: { value: 1 },
    uPhase: { value: 0 },
  }), [viewport.width, viewport.height]);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[40, 30]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function WarmupPhase({ pressureLevel }: { pressureLevel: PressureLevel }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const cfg = PRESSURE_LEVEL_CONFIG[pressureLevel];

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(viewport.width * 100, viewport.height * 100) },
    uMaxIterations: { value: Math.floor(cfg.maxIterations * 0.6) },
    uStepScale: { value: cfg.stepScale },
    uLightCount: { value: Math.max(1, Math.floor(cfg.lightCount * 0.5)) },
    uPhase: { value: 0 },
  }), [cfg.maxIterations, cfg.stepScale, cfg.lightCount, viewport.width, viewport.height]);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[40, 30]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function PhaseContent({ phase, pressureLevel }: { phase: TestPhase; pressureLevel: PressureLevel }) {
  switch (phase) {
    case 'warmup': return <WarmupPhase pressureLevel={pressureLevel} />;
    case 'raymarch':
    case 'fractal':
    case 'lighting':
    case 'compute':
      return <ShaderScene phase={phase} pressureLevel={pressureLevel} />;
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
            luminanceThreshold={0.4}
            luminanceSmoothing={0.85}
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
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: false,
        }}
        dpr={[1, 2]}
      >
        <Scene bloomIntensity={bloomIntensity} />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-deep-black/50 pointer-events-none" />
    </div>
  );
}
