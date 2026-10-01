import * as THREE from "three";
import { gsap } from "gsap";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import "./style.css";

/* ---------- Scene ---------- */
const BG = 0x040b1b;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.04);

const CAM_Z = 13;
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, CAM_Z);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.querySelector("#webgl").appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;

const key = new THREE.DirectionalLight(0xbfd8ff, 2.6);
key.position.set(-4, 6, 6);
const rim = new THREE.PointLight(0xff8a30, 30, 18);
rim.position.set(5, -3, 4);
scene.add(key, rim, new THREE.AmbientLight(0x2a4a8a, 0.4));

const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4;   // MSAA inside the composer, otherwise thin rotating tubes shimmer
composer.renderTarget2.samples = 4;
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.5, 0.9));
composer.addPass(new OutputPass());

/* ---------- Materials: dark navy metal + a single amber accent ---------- */
const metal = (color, emissive, ei) =>
  new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: ei, metalness: 0.85, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 });
const strandMat = metal(0x1b3260, 0x08162e, 0.6);
const rungMat = metal(0x2a4a80, 0x0c1f40, 0.5);
const amber = new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff8a1c, emissiveIntensity: 1.3, roughness: 0.35 });

const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const unit = new THREE.CylinderGeometry(1, 1, 1, 16);
const torus = new THREE.TorusGeometry(1, 0.16, 12, 36);

const rod = (a, b, r, m) => {
  const d = new THREE.Vector3().subVectors(b, a);
  const o = new THREE.Mesh(unit, m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.scale.set(r, d.length(), r);
  o.quaternion.setFromUnitVectors(Y, d.normalize());
  return o;
};
const ring = (p, axis, r) => {
  const o = new THREE.Mesh(torus, amber);
  o.position.copy(p);
  o.scale.setScalar(r);
  o.quaternion.setFromUnitVectors(Z, axis.clone().normalize());
  return o;
};

/* ---------- Clean double helix (built along Y, then laid on its side) ---------- */
// LEN is far wider than any screen, so neither end can ever appear in view
const R = 1.25, LEN = 40, TURNS = 6.1, RUNGS = 56;
const P = (t, ph) => {
  const a = t * Math.PI * 2 * TURNS + ph;
  return new THREE.Vector3(Math.cos(a) * R, (t - 0.5) * LEN, Math.sin(a) * R);
};
const helix = new THREE.Group();
for (const ph of [0, Math.PI]) {
  helix.add(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 560 }, (_, i) => P(i / 559, ph))), 1900, 0.07, 16), strandMat));
}
for (let k = 1; k < RUNGS; k++) {
  const t = k / RUNGS, a = P(t, 0), b = P(t, Math.PI), axis = b.clone().sub(a);
  helix.add(rod(a, b, 0.028, rungMat));
  helix.add(ring(a.clone().lerp(b, 0.22), axis, 0.075), ring(a.clone().lerp(b, 0.78), axis, 0.075));
  for (const [ph, q] of [[0, a], [Math.PI, b]]) {
    const tan = P(Math.min(1, t + 0.004), ph).sub(P(Math.max(0, t - 0.004), ph));
    helix.add(ring(q, tan, 0.13));
  }
}

const pivot = new THREE.Group();
const tilt = new THREE.Group();
pivot.add(tilt);
tilt.add(helix);
scene.add(pivot);

/* ---------- Dust ---------- */
const N = 350, pos = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  pos[i * 3] = (Math.random() - 0.5) * 30;
  pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
  pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 4;
}
const dg = new THREE.BufferGeometry();
dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x7fb2ff, size: 0.02, transparent: true, opacity: 0.28, depthWrite: false }));
scene.add(dust);

/* ---------- Progress bar ---------- */
const bar = document.createElement("div");
bar.className = "progress";
bar.innerHTML = "<i></i>";
document.body.appendChild(bar);

/* ---------- State ---------- */
const panels = [...document.querySelectorAll(".panel")];
const copies = panels.map((p) => p.querySelector(".copy"));
let target = 0, progress = 0;
const mouse = { x: 0, y: 0 }, ms = { x: 0, y: 0 };

addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  target = max > 0 ? scrollY / max : 0;
}, { passive: true });
addEventListener("pointermove", (e) => {
  mouse.x = e.clientX / innerWidth - 0.5;
  mouse.y = e.clientY / innerHeight - 0.5;
});

/* ---------- Intro ---------- */
const intro = { v: 0.001 };
gsap.to(intro, { v: 1, duration: 2.6, ease: "expo.out", delay: 0.2 });

/* ---------- Text reveal: headline words slide up, then label, body and button follow ---------- */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveals = panels.map((p) => {
  const copy = p.querySelector(".copy");
  const h = copy.querySelector("h1, h2");
  h.innerHTML = h.textContent.trim().split(/\s+/).map((w) => `<span class="w"><span>${w}</span></span>`).join(" ");
  const words = h.querySelectorAll(".w > span");
  gsap.set(words, { yPercent: 115 });
  const tl = gsap.timeline({ paused: true });
  tl.to(words, { yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.07 })
    .fromTo(copy.querySelectorAll(".eyebrow"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0)
    .fromTo(copy.querySelectorAll(".description, .cta"), { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 }, 0.35);
  if (reduce) tl.progress(1);
  return tl;
});
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  const tl = reveals[panels.indexOf(en.target)];
  en.isIntersecting ? tl.timeScale(1).play() : tl.timeScale(1.8).reverse();
}), { threshold: 0.55 });
panels.forEach((p, i) => i && io.observe(p));
gsap.delayedCall(0.9, () => { reveals[0].play(); io.observe(panels[0]); });
gsap.from(".nav, .scroll-hint", { opacity: 0, duration: 1.4, delay: 1.4 });

/* ---------- Cached layout (no layout reads inside the render loop) ---------- */
let metrics = [];
const measure = () => (metrics = panels.map((p) => p.offsetTop + p.offsetHeight / 2));
measure();
addEventListener("load", measure);

/* ---------- Loop ---------- */
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
let last = 0, spinTime = 0, p1 = 0;

function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;   // rAF timestamp = steadiest clock
  last = now;
  const mobile = innerWidth < 800;

  // two-stage smoothing = ease-in AND ease-out, so wheel "steps" never look steppy
  p1 = damp(p1, target, 5, dt);
  progress = damp(progress, p1, 4, dt);
  ms.x = damp(ms.x, mouse.x, 2, dt);
  ms.y = damp(ms.y, mouse.y, 2, dt);
  spinTime += dt;

  // rotation = constant slow drift + scroll-driven turn, both continuous
  helix.rotation.y = progress * Math.PI * 2.5 + spinTime * 0.2;
  tilt.rotation.z = -Math.PI / 2 - (0.1 + Math.sin(progress * Math.PI * 2) * 0.05 + ms.y * 0.05);
  pivot.rotation.y = -0.22 + Math.cos(progress * Math.PI * 2) * 0.15 + ms.x * 0.1;
  pivot.position.set(Math.sin(progress * Math.PI * 2) * 2, (mobile ? 2.2 : 1.9) + Math.sin(spinTime * 0.4) * 0.06, 0);
  pivot.scale.setScalar(intro.v * (mobile ? 0.6 : 1));

  camera.position.set(ms.x * 0.4, -ms.y * 0.25, CAM_Z + (mobile ? 3 : 0));
  camera.lookAt(0, 0, 0);
  rim.position.x = 5 + Math.sin(spinTime * 0.6) * 1.5;
  dust.rotation.y = spinTime * 0.03;

  const vh = innerHeight, sy = scrollY;
  for (let i = 1; i < panels.length; i++) {
    const v = Math.max(0, 1 - Math.abs(metrics[i] - sy - vh / 2) / (vh * 0.6));
    const e = v * v * (3 - 2 * v);
    copies[i].style.opacity = e.toFixed(3);
    copies[i].style.transform = `translate3d(0,${((1 - e) * 24).toFixed(1)}px,0)`;
  }
  bar.firstChild.style.transform = `scaleY(${progress.toFixed(4)})`;

  composer.render();
}
renderer.setAnimationLoop(frame);

/* ---------- Menu ---------- */
const menu = document.querySelector("#menuPanel");
const close = () => menu.classList.remove("open");
document.querySelector("#menuBtn").onclick = () => menu.classList.add("open");
document.querySelector("#closeMenu").onclick = close;
menu.querySelectorAll("a").forEach((a) => (a.onclick = close));
addEventListener("keydown", (e) => e.key === "Escape" && close());

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  measure();
});