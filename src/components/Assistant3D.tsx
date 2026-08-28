import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import type { Mood, Persona } from "../lib/personas";
import { alpha } from "../lib/personas";
import { engine } from "../lib/musicEngine";

export interface BeatRef {
  current: { at: number; accent: boolean };
}

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

interface Shard {
  base: [number, number, number];
  scale: number;
  speed: number;
}

function Avatar({ persona, mood, beatRef }: { persona: Persona; mood: Mood; beatRef: BeatRef }) {
  const group = useRef<THREE.Group>(null!);
  const coreGroup = useRef<THREE.Group>(null!);
  const shardsRef = useRef<THREE.Group>(null!);
  const ringA = useRef<THREE.Mesh>(null!);
  const ringB = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Sprite>(null!);
  const keyLight = useRef<THREE.PointLight>(null!);

  const coreMat = useRef<THREE.MeshStandardMaterial>(null!);
  const wireMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ringMatA = useRef<THREE.MeshBasicMaterial>(null!);
  const ringMatB = useRef<THREE.MeshBasicMaterial>(null!);
  const glowMat = useRef<THREE.SpriteMaterial>(null!);

  const target = useMemo(() => new THREE.Color(persona.accent), [persona.accent]);
  const targetDark = useMemo(() => new THREE.Color(persona.accent).multiplyScalar(0.22), [persona.accent]);

  const shards = useMemo<Shard[]>(() => {
    const arr: Shard[] = [];
    for (let i = 0; i < 11; i++) {
      const angle = (i / 11) * Math.PI * 2;
      const r = 1.85 + (i % 3) * 0.32;
      arr.push({
        base: [Math.cos(angle) * r, (Math.sin(i * 2.7) * 0.7), Math.sin(angle) * r],
        scale: 0.055 + (i % 4) * 0.028,
        speed: 0.8 + (i % 5) * 0.35,
      });
    }
    return arr;
  }, []);

  const glowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.25)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  const bornAt = useRef(performance.now());
  useEffect(() => {
    bornAt.current = performance.now();
  }, [persona.id]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const since = performance.now() - beatRef.current.at;
    const rawPulse = Math.max(0, 1 - since / 300) * (beatRef.current.accent ? 1 : 0.6);
    const level = engine.getLevel();

    const spin = mood === "thinking" ? 2.4 : mood === "djing" ? 1.25 : 0.45;
    group.current.rotation.y += dt * spin;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -state.pointer.y * 0.22, 4, dt);

    const morph = Math.min(1, (performance.now() - bornAt.current) / 650);
    const morphScale = easeOutBack(morph);

    const breathe = Math.sin(t * 1.7) * 0.03;
    const talk = mood === "talking" ? Math.abs(Math.sin(t * 9.5)) * 0.055 : 0;
    const musicPump = mood === "djing" ? level * 0.42 + rawPulse * 0.14 : level * 0.22;
    const targetScale = (1 + breathe + talk + musicPump) * morphScale;
    const cur = coreGroup.current.scale.x;
    const next = THREE.MathUtils.damp(cur, targetScale, 10, dt);
    coreGroup.current.scale.setScalar(Math.max(0.001, next));

    if (mood === "thinking") {
      group.current.rotation.z = Math.sin(t * 5.5) * 0.09;
    } else {
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, 0, 5, dt);
    }

    // color drift toward persona accent
    const k = 1 - Math.pow(0.0015, dt);
    coreMat.current.color.lerp(targetDark, k);
    coreMat.current.emissive.lerp(target, k);
    coreMat.current.emissiveIntensity = THREE.MathUtils.damp(
      coreMat.current.emissiveIntensity,
      0.55 + level * 1.9 + rawPulse * 1.1,
      8,
      dt
    );
    wireMat.current.color.lerp(target, k);
    wireMat.current.opacity = 0.16 + rawPulse * 0.3 + level * 0.2;
    ringMatA.current.color.lerp(target, k);
    ringMatB.current.color.lerp(target, k);
    ringMatA.current.opacity = 0.3 + rawPulse * 0.55 + level * 0.3;
    ringMatB.current.opacity = 0.2 + rawPulse * 0.4 + level * 0.25;
    glowMat.current.color.lerp(target, k);
    keyLight.current.color.lerp(target, k);

    const glowTarget = 3.1 + level * 2.4 + rawPulse * 1.3;
    const gs = THREE.MathUtils.damp(glow.current.scale.x, glowTarget * morphScale, 8, dt);
    glow.current.scale.setScalar(Math.max(0.001, gs));

    ringA.current.rotation.z += dt * (0.35 + level * 1.4);
    ringB.current.rotation.z -= dt * (0.5 + level * 1.2);
    ringB.current.rotation.x = Math.PI / 2.6 + Math.sin(t * 0.5) * 0.18;
    ringA.current.rotation.x = Math.PI / 2.15 + Math.cos(t * 0.4) * 0.12;

    const shardSpin = mood === "thinking" ? 2.6 : mood === "djing" ? 1.5 : 0.7;
    shardsRef.current.rotation.y += dt * shardSpin;
    shardsRef.current.children.forEach((child, i) => {
      const s = shards[i];
      child.position.y = s.base[1] + Math.sin(t * s.speed + i * 1.7) * 0.16;
      child.rotation.x += dt * s.speed;
      child.rotation.z += dt * s.speed * 0.7;
    });
  });

  const isBlob = persona.shape === "blob";

  return (
    <>
      <pointLight ref={keyLight} color={persona.accent} intensity={2.6} position={[-3.5, -1.6, 3.2]} distance={13} />
      <group ref={group}>
        <Float speed={2.2} rotationIntensity={0.35} floatIntensity={0.7}>
          <group ref={coreGroup}>
            <sprite ref={glow} scale={3.1}>
              <spriteMaterial ref={glowMat} map={glowTex} color={persona.accent} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>

            {isBlob ? (
              <mesh>
                <sphereGeometry args={[1.02, 48, 48]} />
                <MeshDistortMaterial
                  color={alpha(persona.accent, 0.25)}
                  emissive={persona.accent}
                  emissiveIntensity={0.6}
                  roughness={0.25}
                  metalness={0.35}
                  distort={0.38}
                  speed={mood === "djing" ? 3.4 : 2}
                />
              </mesh>
            ) : (
              <mesh>
                {persona.shape === "icosa" && <icosahedronGeometry args={[1.08, 0]} />}
                {persona.shape === "knot" && <torusKnotGeometry args={[0.68, 0.24, 150, 22, 2, 3]} />}
                {persona.shape === "dodeca" && <dodecahedronGeometry args={[1.08, 0]} />}
                <meshStandardMaterial ref={coreMat} color={alpha(persona.accent, 0.25)} emissive={persona.accent} emissiveIntensity={0.6} roughness={0.3} metalness={0.4} flatShading />
              </mesh>
            )}

            {isBlob ? (
              <mesh scale={1.12}>
                <sphereGeometry args={[1.02, 20, 20]} />
                <MeshDistortMaterial color={persona.accent} wireframe transparent opacity={0.2} distort={0.3} speed={1.6} />
              </mesh>
            ) : (
              <mesh scale={1.04}>
                {persona.shape === "icosa" && <icosahedronGeometry args={[1.08, 1]} />}
                {persona.shape === "knot" && <torusKnotGeometry args={[0.68, 0.24, 90, 12, 2, 3]} />}
                {persona.shape === "dodeca" && <dodecahedronGeometry args={[1.08, 0]} />}
                <meshBasicMaterial ref={wireMat} color={persona.accent} wireframe transparent opacity={0.2} />
              </mesh>
            )}
          </group>
        </Float>

        <group ref={shardsRef}>
          {shards.map((s, i) => (
            <mesh key={i} position={s.base} scale={s.scale}>
              <tetrahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color={alpha(persona.accent, 0.4)} emissive={persona.accent} emissiveIntensity={0.8} roughness={0.4} metalness={0.5} flatShading />
            </mesh>
          ))}
        </group>

        <mesh ref={ringA} rotation={[Math.PI / 2.15, 0, 0]}>
          <torusGeometry args={[1.75, 0.012, 8, 120]} />
          <meshBasicMaterial ref={ringMatA} color={persona.accent} transparent opacity={0.35} />
        </mesh>
        <mesh ref={ringB} rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[2.15, 0.008, 8, 120]} />
          <meshBasicMaterial ref={ringMatB} color={persona.accent} transparent opacity={0.22} />
        </mesh>
      </group>

      <Sparkles
        count={85}
        scale={[8, 5, 8]}
        size={2.1}
        speed={mood === "thinking" ? 1.3 : 0.35}
        color={persona.accent}
        opacity={0.55}
      />
    </>
  );
}

export default function Assistant3D({
  persona,
  mood,
  beatRef,
}: {
  persona: Persona;
  mood: Mood;
  beatRef: BeatRef;
}) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.25, 6.4], fov: 42 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 5, 6]} intensity={0.9} color="#dff5f2" />
      <pointLight color="#ffb46b" intensity={0.8} position={[4.5, 2.5, -4]} distance={15} />
      <Avatar persona={persona} mood={mood} beatRef={beatRef} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={mood === "thinking" ? 2.4 : 0.7}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.65}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
