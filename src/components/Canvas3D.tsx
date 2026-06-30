import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTestStore, computeShaderParams } from '@/store/testStore';
import type { TestPhase } from '@/store/testStore';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// GLSL宏 - 预编译时设置，不依赖 uniform
const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMaxIterations;
  uniform float uStepScale;
  uniform int uLightCount;
  uniform int uPhase;
  uniform int uFbmOctaves;
  uniform int uShadowSteps;
  uniform int uAoSteps;
  uniform int uVolumeFogSteps;
  uniform bool uReflectionEnabled;
  varying vec2 vUv;

  #define MAX_STEPS 512
  #define MAX_DIST 150.0
  #define SURF_DIST 0.0008
  #define PI 3.14159265359

  mat2 rot2(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                    mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                    mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    return n;
  }

  float fbmCustom(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return value;
  }

  float turbulence(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amplitude * abs(noise(p * frequency) * 2.0 - 1.0);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }

  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }

  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }

  float mandelbulb(vec3 pos, int iterations) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    float power = 10.0;
    for (int i = 0; i < 128; i++) {
      if (i >= iterations) break;
      r = length(z);
      if (r > 2.5) break;
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

  float mandelbox(vec3 p, int iterations) {
    vec3 z = p;
    float dr = 1.0;
    float scale = 2.0;
    float minRadius = 0.5;
    float fixedRadius = 1.0;
    for (int i = 0; i < 128; i++) {
      if (i >= iterations) break;
      z = clamp(z, -1.0, 1.0) * 2.0 - z;
      float r2 = dot(z, z);
      if (r2 < minRadius) {
        float temp = fixedRadius / minRadius;
        z *= temp;
        dr *= temp;
      } else if (r2 < fixedRadius) {
        float temp = fixedRadius / r2;
        z *= temp;
        dr *= temp;
      }
      z = z * scale + p;
      dr = dr * scale + 1.0;
      if (dot(z, z) > 100.0) break;
    }
    return length(z) / abs(dr);
  }

  float getDist(vec3 p) {
    float t = uTime * 0.25;
    float result = 1e10;

    if (uPhase == 0) {
      vec3 bp = p;
      bp.xy *= rot2(t * 0.25);
      bp.xz *= rot2(t * 0.15);
      result = sdSphere(bp, 2.0);
      result = min(result, sdTorus(bp, vec2(3.5, 0.25)));
      result = min(result, sdTorus(bp.yxz, vec2(3.0, 0.2)));
      result = min(result, sdSphere(bp + vec3(0.0, 3.0, 0.0), 1.0));
      result = min(result, sdSphere(bp - vec3(0.0, 3.0, 0.0), 1.0));

      for (int i = 0; i < 16; i++) {
        float fi = float(i);
        float angle = fi * PI * 2.0 / 16.0 + t * 0.5;
        vec3 sp = vec3(cos(angle) * 5.0, sin(fi * 1.5 + t) * 2.0, sin(angle) * 5.0);
        result = min(result, sdSphere(bp + sp, 0.4 + sin(fi + t) * 0.1));
      }

      float noiseVal = fbmCustom(p * 0.8 + t * 0.3, uFbmOctaves) * 0.5;
      result += noiseVal * 0.3;
    }
    else if (uPhase == 1) {
      vec3 mp = p * 0.55;
      mp.xy *= rot2(t * 0.15);
      mp.xz *= rot2(t * 0.1);
      float mb = mandelbulb(mp, uMaxIterations) * 1.8;
      float noiseVal = turbulence(p * 1.2 + t * 0.2, uFbmOctaves) * 0.4;
      float fbmVal = fbmCustom(p * 0.6 + t * 0.15, uFbmOctaves) * 0.3;
      result = mb + noiseVal * 0.4 + fbmVal * 0.2;

      for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float angle = fi * PI * 2.0 / 12.0 + t * 0.3;
        float rad = 4.0 + sin(fi * 2.0 + t) * 1.0;
        vec3 tp = vec3(cos(angle) * rad, sin(fi * 1.3 + t * 0.7) * 2.5, sin(angle) * rad);
        vec3 trp = p - tp;
        trp.xy *= rot2(t * 0.5 + fi);
        result = min(result, sdTorus(trp, vec2(0.8, 0.15)));
      }
    }
    else if (uPhase == 2) {
      vec3 mp = p * 0.45;
      mp.xy *= rot2(t * 0.1);
      mp.xz *= rot2(t * 0.08);
      float mb = mandelbulb(mp, max(32, uMaxIterations / 2)) * 2.2;
      float mb2 = mandelbox(mp * 1.5, max(24, uMaxIterations / 4)) * 1.5;
      float noiseVal = turbulence(p * 1.5 + t * 0.25, uFbmOctaves) * 0.5;
      float fbmVal = fbmCustom(p * 0.8 + t * 0.1, uFbmOctaves) * 0.4;
      result = min(mb + noiseVal * 0.3, mb2 + fbmVal * 0.2);

      for (int i = 0; i < 20; i++) {
        float fi = float(i);
        float angle = fi * PI * 2.0 / 20.0 + t * 0.4;
        float rad = 5.5 + sin(fi * 2.5 + t * 1.5) * 1.5;
        vec3 sp = vec3(cos(angle) * rad, sin(fi * 1.7 + t) * 3.0, sin(angle) * rad);
        result = min(result, sdSphere(p - sp, 0.35 + sin(fi * 3.0 + t * 2.0) * 0.1));
      }

      result = min(result, sdCapsule(p, vec3(-6.0, 0.0, 0.0), vec3(6.0, 0.0, 0.0), 0.15));
      result = min(result, sdCapsule(p, vec3(0.0, -6.0, 0.0), vec3(0.0, 6.0, 0.0), 0.15));
    }
    else {
      vec3 mp = p * 0.4;
      mp.xy *= rot2(t * 0.08);
      mp.xz *= rot2(t * 0.06);
      mp.yz *= rot2(t * 0.04);
      float mb = mandelbulb(mp, uMaxIterations) * 2.5;
      float mb2 = mandelbox(mp * 1.3 + vec3(0.5, -0.3, 0.2), max(48, uMaxIterations / 2)) * 1.8;
      float turbVal = turbulence(p * 2.0 + t * 0.3, uFbmOctaves) * 0.6;
      float fbmVal = fbmCustom(p * 1.0 + t * 0.2, uFbmOctaves) * 0.5;
      float noiseVal = noise(p * 3.0 + t * 0.5) * 0.3;
      result = mb + turbVal * 0.35 + fbmVal * 0.25 + noiseVal * 0.15;
      result = min(result, mb2 + fbmVal * 0.3);

      for (int i = 0; i < 28; i++) {
        float fi = float(i);
        float angle1 = fi * PI * 2.0 / 28.0 + t * 0.5;
        float angle2 = fi * PI * 3.0 / 28.0 + t * 0.3;
        float rad = 6.0 + sin(fi * 1.8 + t * 1.2) * 2.0;
        float rad2 = 4.0 + cos(fi * 2.2 + t * 0.8) * 1.5;
        vec3 sp = vec3(cos(angle1) * rad, sin(angle2) * rad2, sin(angle1) * rad);
        vec3 tsp = p - sp;
        tsp.xy *= rot2(t + fi * 0.5);
        tsp.xz *= rot2(t * 0.7 + fi * 0.3);
        result = min(result, sdTorus(tsp, vec2(0.6, 0.1)));
      }

      for (int i = 0; i < 16; i++) {
        float fi = float(i);
        float angle = fi * PI * 2.0 / 16.0 + t * 0.2;
        vec3 sp = vec3(cos(angle) * 8.0, sin(fi + t * 0.5) * 4.0, sin(angle) * 8.0);
        result = min(result, sdSphere(p - sp, 0.5 + sin(fi * 2.0 + t) * 0.15));
      }
    }

    float planeDist = p.y + 8.0;
    result = min(result, planeDist);
    return result;
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
    vec2 e = vec2(0.0008, 0.0);
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
    for (int i = 0; i < 48; i++) {
      if (i >= uShadowSteps) break;
      if (t >= maxt) break;
      float h = getDist(ro + rd * t);
      if (h < 0.0005) return 0.0;
      res = min(res, k * h / t);
      t += h * 0.4;
    }
    return clamp(res, 0.0, 1.0);
  }

  float ambientOcclusion(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 12; i++) {
      if (i >= uAoSteps) break;
      float h = 0.01 + 0.12 * float(i) / 7.0;
      float d = getDist(p + n * h);
      occ += (h - d) * sca;
      sca *= 0.85;
    }
    return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
  }

  vec3 skyColor(vec3 rd) {
    float t = 0.5 * (rd.y + 1.0);
    vec3 col = mix(vec3(0.02, 0.02, 0.05), vec3(0.1, 0.05, 0.15), t);
    float stars = pow(noise(rd * 100.0), 20.0) * 2.0;
    col += vec3(stars);
    return col;
  }

  vec3 getLighting(vec3 p, vec3 n, vec3 ro, vec3 rd) {
    vec3 col = vec3(0.0);
    vec3 ambient = vec3(0.03, 0.03, 0.06);
    float ao = ambientOcclusion(p, n);
    col += ambient * ao;

    float t = uTime * 0.4;
    vec3 viewDir = normalize(ro - p);

    if (uLightCount >= 1) {
      vec3 lightPos1 = vec3(6.0 * sin(t), 7.0, 6.0 * cos(t));
      vec3 lightCol1 = vec3(0.4, 0.6, 1.0) * 1.2;
      vec3 l1 = normalize(lightPos1 - p);
      float diff1 = max(dot(n, l1), 0.0);
      float shadow1 = softShadow(p + n * 0.01, l1, 0.01, 15.0, 24.0);
      vec3 half1 = normalize(l1 + viewDir);
      float spec1 = pow(max(dot(n, half1), 0.0), 128.0);
      col += lightCol1 * (diff1 * shadow1 * ao + spec1 * shadow1 * 0.6);
    }

    if (uLightCount >= 2) {
      vec3 lightPos2 = vec3(-6.0 * cos(t * 0.7), 4.0 * sin(t * 0.8), -6.0 * sin(t * 0.7));
      vec3 lightCol2 = vec3(1.0, 0.3, 0.7) * 1.0;
      vec3 l2 = normalize(lightPos2 - p);
      float diff2 = max(dot(n, l2), 0.0);
      float shadow2 = softShadow(p + n * 0.01, l2, 0.01, 12.0, 20.0);
      vec3 half2 = normalize(l2 + viewDir);
      float spec2 = pow(max(dot(n, half2), 0.0), 96.0);
      col += lightCol2 * (diff2 * shadow2 * ao + spec2 * shadow2 * 0.5);
    }

    if (uLightCount >= 3) {
      vec3 lightPos3 = vec3(0.0, -5.0, 4.0 * sin(t * 1.2));
      vec3 lightCol3 = vec3(0.1, 1.0, 0.5) * 0.9;
      vec3 l3 = normalize(lightPos3 - p);
      float diff3 = max(dot(n, l3), 0.0);
      float shadow3 = softShadow(p + n * 0.01, l3, 0.01, 10.0, 16.0);
      vec3 half3 = normalize(l3 + viewDir);
      float spec3 = pow(max(dot(n, half3), 0.0), 64.0);
      col += lightCol3 * (diff3 * shadow3 * ao + spec3 * shadow3 * 0.4);
    }

    if (uLightCount >= 4) {
      vec3 lightPos4 = vec3(4.0 * cos(t * 1.5), 5.0 * cos(t * 0.5), -4.0 * sin(t * 1.5));
      vec3 lightCol4 = vec3(1.0, 0.7, 0.1) * 0.8;
      vec3 l4 = normalize(lightPos4 - p);
      float diff4 = max(dot(n, l4), 0.0);
      float shadow4 = softShadow(p + n * 0.01, l4, 0.01, 10.0, 12.0);
      vec3 half4 = normalize(l4 + viewDir);
      float spec4 = pow(max(dot(n, half4), 0.0), 48.0);
      col += lightCol4 * (diff4 * shadow4 * ao + spec4 * shadow4 * 0.3);
    }

    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
    col += vec3(0.2, 0.4, 1.0) * fresnel * 0.5 * ao;

    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
    col += vec3(0.3, 0.5, 1.0) * rim * 0.3;

    return col;
  }

  vec3 volumetricFog(vec3 ro, vec3 rd, float dist, vec3 baseCol) {
    vec3 col = baseCol;
    float t = uTime * 0.15;
    float fogAmount = 0.0;
    vec3 fogCol = vec3(0.1, 0.08, 0.2);
    float stepSize = dist / 16.0;
    for (int i = 0; i < 24; i++) {
      if (i >= uVolumeFogSteps) break;
      float fi = float(i);
      float d = stepSize * fi;
      vec3 p = ro + rd * d;
      float noiseVal = fbmCustom(p * 0.3 + vec3(t * 0.2, t * 0.1, t * 0.15), uFbmOctaves);
      float density = max(0.0, noiseVal - 0.3) * 0.08;
      fogAmount += density * stepSize;
      float lightDist = length(p - vec3(6.0 * sin(t), 7.0, 6.0 * cos(t)));
      float lightInfluence = 1.0 / (1.0 + lightDist * 0.1);
      fogCol += vec3(0.4, 0.6, 1.0) * lightInfluence * density * 0.5;
    }
    fogAmount = clamp(fogAmount, 0.0, 1.0);
    col = mix(col, fogCol, fogAmount * 0.5);
    return col;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    float t = uTime * 0.15;
    vec3 ro = vec3(sin(t) * 7.0, 2.5 + sin(t * 0.6) * 1.0, cos(t) * 7.0);
    vec3 lookAt = vec3(0.0, 0.0, 0.0);

    vec3 f = normalize(lookAt - ro);
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
    vec3 u = cross(f, r);
    vec3 rd = normalize(f + uv.x * r + uv.y * u);

    float d = rayMarch(ro, rd);

    vec3 col;
    if (d < MAX_DIST) {
      vec3 p = ro + rd * d;
      vec3 n = getNormal(p);
      col = getLighting(p, n, ro, rd);
      col = volumetricFog(ro, rd, d, col);

      if (uReflectionEnabled && uPhase >= 2) {
        vec3 reflectDir = reflect(rd, n);
        float reflectDist = rayMarch(p + n * 0.02, reflectDir);
        if (reflectDist < MAX_DIST * 0.5) {
          vec3 rp = p + n * 0.02 + reflectDir * reflectDist;
          vec3 rn = getNormal(rp);
          vec3 reflectCol = getLighting(rp, rn, p, reflectDir) * 0.3;
          float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          col = mix(col, reflectCol, fresnel * 0.4);
        }
      }
    } else {
      col = skyColor(rd);
      float glow = 0.0;
      for (int i = 0; i < 64; i++) {
        if (i >= uMaxIterations / 3) break;
        vec3 p = ro + rd * float(i) * 0.6;
        float dist = getDist(p);
        glow += 0.006 / (dist * dist + 0.05);
      }
      col += vec3(0.3, 0.5, 1.0) * glow * 0.4;
      col = volumetricFog(ro, rd, 50.0, col);
    }

    col = pow(col, vec3(0.4545));
    col = col / (1.0 + col);

    float vig = 1.0 - 0.3 * length(uv);
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function FPSMonitor() {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const setCurrentFPS = useTestStore((s) => s.setCurrentFPS);
  const addFPSRecord = useTestStore((s) => s.addFPSRecord);
  const recordPhaseFPS = useTestStore((s) => s.recordPhaseFPS);
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
      recordPhaseFPS(fps);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }
  });

  return null;
}

function ShaderScene({ phase, dynamicPressure }: { phase: TestPhase; dynamicPressure: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();
  const params = computeShaderParams(dynamicPressure, phase);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      mat.uniforms.uResolution.value.set(size.width, size.height);
      mat.uniforms.uMaxIterations.value = params.maxIterations;
      mat.uniforms.uStepScale.value = params.stepScale;
      mat.uniforms.uLightCount.value = params.lightCount;
      mat.uniforms.uPhase.value = phase === 'idle' ? 0 : ['raymarch', 'fractal', 'lighting', 'compute'].indexOf(phase);
      mat.uniforms.uFbmOctaves.value = params.fbmOctaves;
      mat.uniforms.uShadowSteps.value = params.shadowSteps;
      mat.uniforms.uAoSteps.value = params.aoSteps;
      mat.uniforms.uVolumeFogSteps.value = params.volumeFogSteps;
      mat.uniforms.uReflectionEnabled.value = params.reflectionEnabled;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[40, 30]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(size.width, size.height) },
          uMaxIterations: { value: params.maxIterations },
          uStepScale: { value: params.stepScale },
          uLightCount: { value: params.lightCount },
          uPhase: { value: phase === 'idle' ? 0 : ['raymarch', 'fractal', 'lighting', 'compute'].indexOf(phase) },
          uFbmOctaves: { value: params.fbmOctaves },
          uShadowSteps: { value: params.shadowSteps },
          uAoSteps: { value: params.aoSteps },
          uVolumeFogSteps: { value: params.volumeFogSteps },
          uReflectionEnabled: { value: params.reflectionEnabled },
        }}
      />
    </mesh>
  );
}

function IdleScene() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uMaxIterations: { value: 48 },
    uStepScale: { value: 0.7 },
    uLightCount: { value: 1 },
    uPhase: { value: 0 },
    uFbmOctaves: { value: 2 },
    uShadowSteps: { value: 8 },
    uAoSteps: { value: 2 },
    uVolumeFogSteps: { value: 4 },
    uReflectionEnabled: { value: false },
  }), [size.width, size.height]);

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

function Scene() {
  const currentPhase = useTestStore((s) => s.currentTestPhase);
  const dynamicPressure = useTestStore((s) => s.dynamicPressure);
  const status = useTestStore((s) => s.status);
  const params = computeShaderParams(dynamicPressure, currentPhase);

  return (
    <>
      {status === 'idle' || currentPhase === 'idle' ? (
        <IdleScene />
      ) : (
        <ShaderScene phase={currentPhase} dynamicPressure={dynamicPressure} />
      )}
      <FPSMonitor />
      {status === 'running' && currentPhase !== 'idle' && (
        <EffectComposer>
          <Bloom
            intensity={params.bloomIntensity}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.8}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </>
  );
}

export function Canvas3D() {
  const status = useTestStore((s) => s.status);
  const dynamicPressure = useTestStore((s) => s.dynamicPressure);
  const currentPhase = useTestStore((s) => s.currentTestPhase);

  const params = computeShaderParams(dynamicPressure, currentPhase);
  const isRunning = status === 'running' && currentPhase !== 'idle';

  const dpr = useMemo(() => {
    const baseDpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    return isRunning ? Math.max(1, baseDpr * params.pixelScale) : baseDpr;
  }, [isRunning, params.pixelScale]);

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
          preserveDrawingBuffer: false,
        }}
        dpr={dpr}
        frameloop="always"
      >
        <Scene />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-deep-black/50 pointer-events-none" />
    </div>
  );
}
