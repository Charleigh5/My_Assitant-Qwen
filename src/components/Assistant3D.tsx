import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject, ReactNode } from "react";
import type { Mood, Persona } from "../lib/personas";
import { alpha } from "../lib/personas";
import { engine } from "../lib/musicEngine";
import type { HandFrame } from "../lib/hands";
import type { PinnedImage, SceneObject, ShapeKind } from "../lib/sceneTypes";

export interface BeatRef {
  current: { at: number; accent: boolean };
}

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Shard {
  base: [number, number, number];
  scale: number;
  speed: number;
}

/* ================= avatar core ================= */

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
        base: [Math.cos(angle) * r, Math.sin(i * 2.7) * 0.7, Math.sin(angle) * r],
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

/* ================= forged objects ================= */

function ShapeGeometry({ shape }: { shape: ShapeKind }) {
  switch (shape) {
    case "cube":
      return <boxGeometry args={[1, 1, 1]} />;
    case "sphere":
      return <sphereGeometry args={[0.62, 32, 24]} />;
    case "torus":
      return <torusGeometry args={[0.5, 0.22, 20, 44]} />;
    case "cone":
      return <coneGeometry args={[0.55, 1.1, 24]} />;
    case "cylinder":
      return <cylinderGeometry args={[0.4, 0.4, 1.1, 24]} />;
    case "gem":
      return <octahedronGeometry args={[0.66, 0]} />;
    case "knot":
      return <torusKnotGeometry args={[0.42, 0.15, 100, 14]} />;
  }
}

function ForgeObject({
  obj,
  register,
  onDown,
}: {
  obj: SceneObject;
  register: (id: string, g: THREE.Group | null) => void;
  onDown: (e: any, id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    register(obj.id, ref.current);
    return () => register(obj.id, null);
  }, [obj.id, register]);

  return (
    <group ref={ref} position={obj.position} scale={obj.scale}>
      <mesh
        onPointerDown={(e) => onDown(e, obj.id)}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <ShapeGeometry shape={obj.shape} />
        <meshStandardMaterial
          color={obj.color}
          emissive={obj.color}
          emissiveIntensity={0.16}
          metalness={0.38}
          roughness={0.26}
          flatShading={obj.shape === "gem" || obj.shape === "cube"}
        />
      </mesh>
      <mesh scale={1.07}>
        <ShapeGeometry shape={obj.shape} />
        <meshBasicMaterial color={obj.color} wireframe transparent opacity={0.13} />
      </mesh>
    </group>
  );
}

/* ================= pinned image holograms ================= */

class TexBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PinnedImagePlane({ pin, accent }: { pin: PinnedImage; accent: string }) {
  const tex = useLoader(THREE.TextureLoader, pin.src);
  const ref = useRef<THREE.Group>(null!);
  const angle = pin.slot * 1.02 + 0.55;
  const radius = 4.7;
  const baseY = 0.15 + (pin.slot % 3) * 0.62 - 0.4;
  const pos = useMemo<[number, number, number]>(
    () => [Math.sin(angle) * radius, baseY, Math.cos(angle) * radius],
    [angle, baseY, radius]
  );
  const rotY = Math.atan2(pos[0], pos[2]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.position.y = baseY + Math.sin(t * 0.9 + pin.slot * 1.4) * 0.1;
  });

  return (
    <group ref={ref} position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[2.78, 1.84]} />
        <meshBasicMaterial color="#0b1317" />
      </mesh>
      <mesh>
        <planeGeometry args={[2.6, 1.64]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.96, 0]}>
        <boxGeometry args={[2.78, 0.055, 0.02]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <boxGeometry args={[2.78, 0.02, 0.02]} />
        <meshBasicMaterial color={accent} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

/* ================= grid floor ================= */

function GridFloor({ color }: { color: string }) {
  const ref = useRef<THREE.GridHelper>(null);
  useLayoutEffect(() => {
    const m = ref.current?.material as THREE.Material | undefined;
    if (m) {
      m.transparent = true;
      m.opacity = 0.12;
    }
  }, [color]);
  return <gridHelper key={color} ref={ref} args={[26, 32, color, color]} position={[0, -2.85, 0]} />;
}

/* ================= interaction scene ================= */

function Scene({
  persona,
  mood,
  beatRef,
  handRef,
  objects,
  pinned,
  onObjectMove,
  onCorePulse,
}: {
  persona: Persona;
  mood: Mood;
  beatRef: BeatRef;
  handRef: MutableRefObject<HandFrame>;
  objects: SceneObject[];
  pinned: PinnedImage[];
  onObjectMove: (id: string, pos: [number, number, number]) => void;
  onCorePulse: () => void;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<any>(null);
  const cursorRef = useRef<THREE.Group>(null);
  const registry = useRef(new Map<string, THREE.Group>());
  const baseY = useRef(new Map<string, number>());
  const spinMap = useRef(new Map<string, number>());
  const scaleMap = useRef(new Map<string, number>());
  const drag = useRef<{ id: string; plane: THREE.Plane; offset: THREE.Vector3 } | null>(null);
  const handGrab = useRef<{ id: string; plane: THREE.Plane; offset: THREE.Vector3 } | null>(null);
  const lastPulse = useRef(0);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const tmp = useMemo(
    () => ({
      ndc: new THREE.Vector2(),
      v: new THREE.Vector3(),
      camDir: new THREE.Vector3(),
      origin: new THREE.Vector3(0, 0, 0),
    }),
    []
  );

  const register = useCallback((id: string, g: THREE.Group | null) => {
    if (g) registry.current.set(id, g);
    else registry.current.delete(id);
  }, []);

  useEffect(() => {
    for (const o of objects) {
      if (!baseY.current.has(o.id)) baseY.current.set(o.id, o.position[1]);
      spinMap.current.set(o.id, o.spin);
      scaleMap.current.set(o.id, o.scale);
    }
  }, [objects]);

  /* ---- mouse drag ---- */
  const onDown = useCallback(
    (e: any, id: string) => {
      e.stopPropagation();
      const g = registry.current.get(id);
      if (!g) return;
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* noop */
      }
      tmp.camDir.copy(camera.position).normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(tmp.camDir, g.position);
      const hit = new THREE.Vector3();
      e.ray.intersectPlane(plane, hit);
      drag.current = { id, plane, offset: g.position.clone().sub(hit) };
      if (controls.current) controls.current.enabled = false;
      document.body.style.cursor = "grabbing";
    },
    [camera, tmp]
  );

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      tmp.ndc.set(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(tmp.ndc, camera);
      const g = registry.current.get(drag.current.id);
      if (!g) return;
      if (raycaster.ray.intersectPlane(drag.current.plane, tmp.v)) {
        tmp.v.add(drag.current.offset);
        g.position.set(clamp(tmp.v.x, -6, 6), clamp(tmp.v.y, -2.6, 3.4), clamp(tmp.v.z, -3.5, 3.5));
      }
    };
    const up = () => {
      if (!drag.current) return;
      const g = registry.current.get(drag.current.id);
      if (g) onObjectMove(drag.current.id, [g.position.x, g.position.y, g.position.z]);
      drag.current = null;
      if (controls.current) controls.current.enabled = true;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [camera, gl, raycaster, tmp, onObjectMove]);

  /* ---- per-frame: hand cursor, hand grab, object animation ---- */
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const hand = handRef.current;
    const sinceBeat = performance.now() - beatRef.current.at;
    const beat = Math.max(0, 1 - sinceBeat / 320);

    // cursor reticle
    const cursor = cursorRef.current;
    if (cursor) {
      cursor.visible = hand.present;
      if (hand.present) {
        tmp.ndc.set(hand.x * 2 - 1, -(hand.y * 2 - 1));
        raycaster.setFromCamera(tmp.ndc, camera);
        tmp.camDir.copy(camera.position).normalize();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(tmp.camDir, tmp.origin);
        if (raycaster.ray.intersectPlane(plane, tmp.v)) cursor.position.copy(tmp.v);
        cursor.quaternion.copy(camera.quaternion);
        const s = 1 + hand.pinch * 0.55;
        cursor.scale.setScalar(THREE.MathUtils.damp(cursor.scale.x, s, 14, dt));
      }
    }

    // hand pinch → grab nearest object (screen space)
    if (hand.present && hand.pinched && !handGrab.current) {
      const hx = hand.x * 2 - 1;
      const hy = -(hand.y * 2 - 1);
      let bestId: string | null = null;
      let bestD = 0.17;
      registry.current.forEach((g, id) => {
        tmp.v.copy(g.position).project(camera);
        const d = Math.hypot(tmp.v.x - hx, tmp.v.y - hy);
        if (d < bestD) {
          bestD = d;
          bestId = id;
        }
      });
      if (bestId) {
        const g = registry.current.get(bestId);
        if (g) {
          tmp.camDir.copy(camera.position).normalize();
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(tmp.camDir, g.position);
          tmp.ndc.set(hx, hy);
          raycaster.setFromCamera(tmp.ndc, camera);
          const hit = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, hit);
          handGrab.current = { id: bestId, plane, offset: g.position.clone().sub(hit) };
        }
      } else {
        // pet the core
        tmp.v.set(0, 0, 0).project(camera);
        const dc = Math.hypot(tmp.v.x - hx, tmp.v.y - hy);
        const now = performance.now();
        if (dc < 0.13 && now - lastPulse.current > 1100) {
          lastPulse.current = now;
          onCorePulse();
        }
      }
    }

    // hand grab movement / release
    if (handGrab.current) {
      const g = registry.current.get(handGrab.current.id);
      if (!hand.present || !hand.pinched || !g) {
        if (g) onObjectMove(handGrab.current.id, [g.position.x, g.position.y, g.position.z]);
        handGrab.current = null;
      } else {
        tmp.ndc.set(hand.x * 2 - 1, -(hand.y * 2 - 1));
        raycaster.setFromCamera(tmp.ndc, camera);
        if (raycaster.ray.intersectPlane(handGrab.current.plane, tmp.v)) {
          tmp.v.add(handGrab.current.offset);
          g.position.set(clamp(tmp.v.x, -6, 6), clamp(tmp.v.y, -2.6, 3.4), clamp(tmp.v.z, -3.5, 3.5));
        }
      }
    }

    // object ambience
    registry.current.forEach((g, id) => {
      const held = drag.current?.id === id || handGrab.current?.id === id;
      if (!held) {
        const base = baseY.current.get(id) ?? g.position.y;
        g.position.y = base + Math.sin(t * 1.1 + g.position.x * 1.7) * 0.09;
        g.rotation.y += (spinMap.current.get(id) ?? 0.4) * dt;
        g.rotation.x += (spinMap.current.get(id) ?? 0.4) * dt * 0.35;
      } else {
        g.rotation.y += dt * 1.6;
      }
      const baseScale = scaleMap.current.get(id) ?? 1;
      const target = baseScale * (held ? 1.22 : 1 + beat * 0.07);
      const cur = g.scale.x;
      g.scale.setScalar(THREE.MathUtils.damp(cur, target, 10, dt));
    });
  });

  return (
    <>
      <Avatar persona={persona} mood={mood} beatRef={beatRef} />
      <GridFloor color={persona.accent} />

      {objects.map((o) => (
        <ForgeObject key={o.id} obj={o} register={register} onDown={onDown} />
      ))}

      <Suspense fallback={null}>
        {pinned.map((p) => (
          <TexBoundary key={p.id}>
            <PinnedImagePlane pin={p} accent={persona.accent} />
          </TexBoundary>
        ))}
      </Suspense>

      {/* barehands cursor reticle */}
      <group ref={cursorRef} visible={false}>
        <mesh>
          <ringGeometry args={[0.14, 0.175, 36]} />
          <meshBasicMaterial color={persona.accent} transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color="#eaf4f3" side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.26, 0.268, 48]} />
          <meshBasicMaterial color={persona.accent} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom
        minDistance={4.2}
        maxDistance={13}
        autoRotate
        autoRotateSpeed={mood === "thinking" ? 2.4 : 0.55}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI / 1.62}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

/* ================= root ================= */

export default function Assistant3D({
  persona,
  mood,
  beatRef,
  handRef,
  objects,
  pinned,
  onObjectMove,
  onCorePulse,
}: {
  persona: Persona;
  mood: Mood;
  beatRef: BeatRef;
  handRef: MutableRefObject<HandFrame>;
  objects: SceneObject[];
  pinned: PinnedImage[];
  onObjectMove: (id: string, pos: [number, number, number]) => void;
  onCorePulse: () => void;
}) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.25, 6.6], fov: 42 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 5, 6]} intensity={0.9} color="#dff5f2" />
      <pointLight color="#ffb46b" intensity={0.8} position={[4.5, 2.5, -4]} distance={15} />
      <Scene
        persona={persona}
        mood={mood}
        beatRef={beatRef}
        handRef={handRef}
        objects={objects}
        pinned={pinned}
        onObjectMove={onObjectMove}
        onCorePulse={onCorePulse}
      />
    </Canvas>
  );
}
