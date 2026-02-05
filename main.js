import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { SVGLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/SVGLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Camera
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  20000
);
camera.position.set(0, 0, 200);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.2 : window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// Audio (autoplay attempt + first interaction fallback)
const audioSrc = new URL("assets/music/LBM.mp3", window.location.href).toString();
const audio = new Audio(audioSrc);
audio.preload = "auto";
audio.loop = false;
audio.volume = 0.7;
audio.load();

const muteBtn = document.getElementById("muteBtn");
function updateMuteButton() {
  if (!muteBtn) return;
  muteBtn.textContent = audio.muted ? "Unmute" : "Mute";
  muteBtn.setAttribute("aria-pressed", audio.muted ? "true" : "false");
}

let userInteracted = false;
let audioStarted = false;

async function tryPlay() {
  try {
    await audio.play();
    audioStarted = true;
  } catch {
    // Autoplay might be blocked; will retry on first interaction.
  }
}

if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    userInteracted = true;
    audio.muted = !audio.muted;
    updateMuteButton();
    if (!audio.muted) {
      tryPlay();
    }
  });
  updateMuteButton();
}

const unlockEvents = ["pointerdown", "keydown", "wheel", "touchstart"];
const unlockAudio = () => {
  userInteracted = true;
  tryPlay();
  if (audioStarted) {
    for (const evt of unlockEvents) {
      window.removeEventListener(evt, unlockAudio);
    }
  }
};
for (const evt of unlockEvents) {
  window.addEventListener(evt, unlockAudio, { passive: true });
}

// Initial autoplay attempt
tryPlay();

// If user interacted before the audio finished loading, start when ready
audio.addEventListener("canplay", () => {
  if (userInteracted && !audioStarted) {
    tryPlay();
  }
});
audio.addEventListener("error", () => {
  console.warn("Audio failed to load:", audioSrc);
});

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.enableZoom = !isMobile ? false : true;
controls.rotateSpeed = 0.6;
controls.minDistance = 20;
controls.maxDistance = 20000;
if (isMobile) {
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
  };
}

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.2 : window.devicePixelRatio));
});

// Text content
const messages = [
  "You became like home, without even trying:heart:",
  "I don't want perfect, i want you:rose::kneel:",
  "Please stay with me even in the dark",
  "your name is a soft echo i keep repeating:heart:",
  "I fall every the night for you:rose::kneel:",
  "I wasn't searching, and then suddenly you appeared:heart:",
  "we drift, and still I find you",
  "hold me where the light ends",
  "You matter more than you know:rose:",
  "You changed the way i feel time, quite literally:heart:",
  "I love you a lott, more than i can ever express:rose::kneel:",
  "I remember you in starlight:rose:",
  "I&#309;m always here",
  "Don't you ever feel alone:heart:",
  "let&#309s spend as long as we can together:rose::kneel:",
  "you are my :heart: in the dark",
  "let :rose: bloom between us",
  "stay with me :kneel: here"
];

const textGroup = new THREE.Group();
scene.add(textGroup);

// Fog for abyss depth (stronger to push distance and haze)
scene.fog = new THREE.Fog(0x000000, 150, 14000);

const TEXT_COUNT = isMobile ? 220 : 280;
const HEART_COUNT = isMobile ? 36 : 48;
const X_RANGE = isMobile ? 900 : 1080;
const Y_RANGE = isMobile ? 155 : 170;

// Keep all texts close together in depth with tight spacing.
const Z_MIN = -360;
const Z_MAX = 360;
const Z_LAYER_SPACING_MIN = 36;
const Z_LAYER_SPACING_MAX = 55;
const Z_JITTER = 1.2;

// Scroll to move through additional layers (bigger range = deeper travel)
const SCROLL_Z_STEP = 80;
const SCROLL_Z_MIN = -600;
const SCROLL_Z_MAX = 600;
let scrollZOffset = 0;

const BASE_PLANE_WIDTH = isMobile ? 195 : 210;
const BASE_PLANE_HEIGHT = isMobile ? 56 : 60;
const MIN_TEXT_SEPARATION = 58;

function currentXRange(distance) {
  // Expand horizontal spread as you zoom out so the field still fills the screen
  const t = THREE.MathUtils.clamp(distance / 1200, 0, 1);
  return X_RANGE * (1 + t * 0.9);
}

const textPlanes = [];
const tempTextColor = new THREE.Color();
const tempHeartColor = new THREE.Color();
const TEXT_SPAWN_PER_FRAME = isMobile ? 18 : 24;
const GLYPH_REFRESH_PER_FRAME = isMobile ? 14 : 18;
let pendingTextCount = TEXT_COUNT;
let glyphRefreshQueue = [];

// Subtle mouse parallax (adds cinematic depth without taking over controls)
const parallax = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0
};
window.addEventListener("mousemove", (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  parallax.targetX = nx;
  parallax.targetY = ny;
});

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickMessage() {
  return messages[Math.floor(Math.random() * messages.length)];
}

function pickZFromBands() {
  const spacing = randomInRange(Z_LAYER_SPACING_MIN, Z_LAYER_SPACING_MAX);
  const layerCount = Math.floor((Z_MAX - Z_MIN) / spacing);
  const layerIndex = Math.floor(randomInRange(0, layerCount));
  return Z_MIN + layerIndex * spacing;
}

// Outline glyphs (rose / kneeling / heart_t) rendered into text textures
const glyphs = {
  rose: null,
  kneeling: null,
  heart_t: null
};
const glyphTokenMap = {
  ":rose:": "rose",
  ":kneel:": "kneeling",
  ":heart:": "heart_t"
};

function computeBounds(segments) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const seg of segments) {
    for (const p of seg) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function loadGlyph(name, url) {
  return new Promise((resolve) => {
    const loader = new SVGLoader();
    loader.load(
      url,
      (data) => {
        const segments = [];
        for (const path of data.paths) {
          if (path.subPaths && path.subPaths.length) {
            for (const subPath of path.subPaths) {
              if (subPath.getPoints) {
                segments.push(subPath.getPoints(120));
              }
            }
          } else if (path.getPoints) {
            segments.push(path.getPoints(120));
          }
        }
        glyphs[name] = {
          segments,
          bounds: computeBounds(segments)
        };
        // Queue refresh so glyphs appear without a huge one-frame spike
        glyphRefreshQueue = textPlanes.slice();
        resolve();
      },
      undefined,
      (err) => {
        console.error(`Failed to load glyph ${name} from ${url}`, err);
        resolve();
      }
    );
  });
}

// Fire and forget: glyphs appear as they load (next recycle)
loadGlyph("rose", "assets/shape/rose.svg");
loadGlyph("kneeling", "assets/shape/kneeling.svg");
loadGlyph("heart_t", "assets/shape/heart_t.svg");

function drawGlyphOutline(ctx, glyph, x, y, size, rotateSideways = false) {
  if (!glyph || !glyph.segments.length) {
    return;
  }

  const { minX, minY, maxX, maxY } = glyph.bounds;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = size / Math.max(width, height);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, -scale);
  ctx.rotate(Math.PI);
  if (rotateSideways) {
    ctx.scale(-1, 1);
  }
  ctx.translate(-(minX + width / 2), -(minY + height / 2));

  ctx.beginPath();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const seg of glyph.segments) {
    if (!seg.length) continue;
    ctx.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i += 1) {
      ctx.lineTo(seg[i].x, seg[i].y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawTextWithGlyphs(ctx, text, centerX, centerY, fontSize) {
  const tokens = text.split(/(:rose:|:kneel:|:heart:)/g);
  const glyphSize = fontSize * 0.95;
  const glyphPadding = fontSize * 0.18;

  let totalWidth = 0;
  const parts = tokens.map((token) => {
    const glyphName = glyphTokenMap[token];
    if (glyphName) {
      const width = glyphSize + glyphPadding;
      totalWidth += width;
      return { type: "glyph", name: glyphName, width };
    }
    const width = ctx.measureText(token).width;
    totalWidth += width;
    return { type: "text", value: token, width };
  });

  let cursor = centerX - totalWidth / 2;
  for (const part of parts) {
    if (part.type === "text") {
      ctx.fillText(part.value, cursor + part.width / 2, centerY);
      cursor += part.width;
    } else {
      const glyph = glyphs[part.name];
      const flipSideways = part.name === "kneeling";
      drawGlyphOutline(ctx, glyph, cursor + part.width / 2, centerY, glyphSize, flipSideways);
      cursor += part.width;
    }
  }
}

function renderTextToCanvas(ctx, canvas, text) {
  // Fit text to canvas width
  const maxWidth = canvas.width * 0.9;
  let fontSize = isMobile ? 104 : 118;
  ctx.font = `${fontSize}px 'Times New Roman', serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 32) {
    fontSize -= 2;
    ctx.font = `${fontSize}px 'Times New Roman', serif`;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${fontSize}px 'Times New Roman', serif`;

  // Warm glow (tight, not foggy)
  ctx.shadowColor = "rgba(255, 150, 205, 1)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "rgba(255, 240, 250, 0.7)";
  ctx.strokeStyle = "rgba(255, 245, 252, 1)";
  ctx.lineWidth = Math.max(1.5, fontSize * 0.06);
  drawTextWithGlyphs(ctx, text, canvas.width / 2, canvas.height / 2, fontSize);

  // Cool rim glow (subtle)
  ctx.shadowColor = "rgba(170, 225, 255, 1)";
  ctx.shadowBlur = 34;
  ctx.fillStyle = "rgba(200, 235, 255, 0.22)";
  ctx.strokeStyle = "rgba(200, 235, 255, 0.4)";
  ctx.lineWidth = Math.max(1.2, fontSize * 0.05);
  drawTextWithGlyphs(ctx, text, canvas.width / 2, canvas.height / 2, fontSize);

  // Crisp pass (dominant)
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.strokeStyle = "rgba(255, 255, 255, 1)";
  ctx.lineWidth = Math.max(2.8, fontSize * 0.095);
  drawTextWithGlyphs(ctx, text, canvas.width / 2, canvas.height / 2, fontSize);

  return fontSize;
}

function createTextTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const fontSize = renderTextToCanvas(ctx, canvas, text);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return { texture, canvas, ctx, fontSize };
}

function createTextPlane(text) {
  const { texture, canvas, ctx, fontSize } = createTextTexture(text);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const geometry = new THREE.PlaneGeometry(BASE_PLANE_WIDTH, BASE_PLANE_HEIGHT);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(0, 0, 0);

  mesh.userData = {
    texture,
    canvas,
    ctx,
    fontSize,
    text,
    speed: randomInRange(3.5, 9),
    driftX: randomInRange(-0.4, 0.4),
    driftPhase: Math.random() * Math.PI * 2,
    baseScale: 1,
    colorA: new THREE.Color(0xff9fd1), // bright pink
    colorB: new THREE.Color(0x9fd8ff)  // bright blue
  };

  return mesh;
}

function resetTextPlane(mesh, topY, xRange) {
  const spread = xRange ?? X_RANGE;
  mesh.position.x = randomInRange(-spread, spread);
  mesh.position.y = topY + randomInRange(0, 40);

  // Spread text across wide Z bands for depth layering.
  mesh.position.z = pickZFromBands() + randomInRange(-Z_JITTER, Z_JITTER);

  // Push apart from nearby texts so words are readable
  for (let attempts = 0; attempts < 12; attempts += 1) {
    let tooClose = false;
    for (const other of textPlanes) {
      if (other === mesh) continue;
      const dx = mesh.position.x - other.position.x;
      const dy = mesh.position.y - other.position.y;
      const dz = mesh.position.z - other.position.z;
      if (dx * dx + dy * dy + dz * dz < MIN_TEXT_SEPARATION * MIN_TEXT_SEPARATION) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      break;
    }
    mesh.position.x = randomInRange(-spread, spread);
    mesh.position.y = topY + randomInRange(0, 40);
    mesh.position.z = pickZFromBands() + randomInRange(-Z_JITTER, Z_JITTER);
  }

  const newText = pickMessage();
  const { canvas, ctx, texture } = mesh.userData;
  const fontSize = renderTextToCanvas(ctx, canvas, newText);
  mesh.userData.text = newText;
  mesh.userData.fontSize = fontSize;

  texture.needsUpdate = true;
  mesh.userData.speed = randomInRange(3.5, 9);
  mesh.userData.driftX = randomInRange(-0.4, 0.4);
  mesh.userData.driftPhase = Math.random() * Math.PI * 2;
  mesh.userData.huePhase = Math.random() * Math.PI * 2;

  // Scale contrast: many small, occasional huge foreground phrases.
  const isLarge = Math.random() < 0.1;
  const scale = isLarge ? randomInRange(2.6, 3.8) : randomInRange(0.85, 1.6);
  mesh.userData.baseScale = scale;
  mesh.scale.set(scale, scale, scale);
}

function addTextPlane() {
  const mesh = createTextPlane(pickMessage());
  const topY = camera.position.y + Y_RANGE;
  const spread = currentXRange(camera.position.distanceTo(controls.target));
  resetTextPlane(mesh, topY - randomInRange(0, Y_RANGE * 2), spread);
  textGroup.add(mesh);
  textPlanes.push(mesh);
}

// Spawn an initial batch so the scene appears quickly
const INITIAL_TEXT_BATCH = 60;
for (let i = 0; i < Math.min(INITIAL_TEXT_BATCH, pendingTextCount); i += 1) {
  addTextPlane();
  pendingTextCount -= 1;
}

const clock = new THREE.Clock();

// Smooth scroll handling: wheel scroll nudges the whole field forward/backward
// through layered depth, keeping steps small and eased to avoid lag.
let scrollZTarget = 0;
window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();

    const d = THREE.MathUtils.clamp(e.deltaY, -240, 240);
    scrollZTarget = THREE.MathUtils.clamp(
      scrollZTarget - d * (SCROLL_Z_STEP / 240),
      SCROLL_Z_MIN,
      SCROLL_Z_MAX
    );
  },
  { passive: false }
);

// Background particles (more dense for starry depth)
const particleCount = isMobile ? 2000 : 2800;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i += 1) {
  particlePositions[i * 3] = randomInRange(-2400, 2400);
  particlePositions[i * 3 + 1] = randomInRange(-2400, 2400);
  particlePositions[i * 3 + 2] = randomInRange(-24000, 2000);
}
particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(particlePositions, 3)
);
const particleMaterial = new THREE.PointsMaterial({
  color: 0xe6f2ff,
  size: 1.2,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.85,
  depthWrite: false
});
const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// 3D hearts from SVG (emoji-like silhouette)
const heartMeshes = [];
const heartMaterial = new THREE.MeshStandardMaterial({
  color: 0xff4d6d,
  emissive: 0x2a0614,
  emissiveIntensity: 0.9,
  roughness: 0.35,
  metalness: 0.05
});

// Lighting for 3D hearts
const heartKeyLight = new THREE.DirectionalLight(0xffffff, 0.8);
heartKeyLight.position.set(120, 200, 260);
scene.add(heartKeyLight);

const heartFillLight = new THREE.DirectionalLight(0xffcde0, 0.4);
heartFillLight.position.set(-160, -40, 120);
scene.add(heartFillLight);

const heartAmbient = new THREE.AmbientLight(0xffd6e6, 0.18);
scene.add(heartAmbient);

// Load SVG heart and extrude into 3D
const svgLoader = new SVGLoader();
svgLoader.load("assets/shape/heart.svg", (data) => {
  const shapes = data.paths.flatMap((p) => p.toShapes(true));
  const extrudeSettings = {
    depth: 3.2,
    bevelEnabled: true,
    bevelThickness: 2.2,
    bevelSize: 2.0,
    bevelSegments: 12,
    curveSegments: 48
  };

  const geometries = shapes.map((shape) => new THREE.ExtrudeGeometry(shape, extrudeSettings));
  const template = new THREE.Group();
  for (const geometry of geometries) {
    geometry.center();
    const part = new THREE.Mesh(geometry, heartMaterial.clone());
    template.add(part);
  }

  for (let i = 0; i < HEART_COUNT; i += 1) {
    const heart = template.clone(true);
    heart.position.x = randomInRange(-X_RANGE * 0.9, X_RANGE * 0.9);
    heart.position.y = randomInRange(-Y_RANGE, Y_RANGE);
    heart.position.z = pickZFromBands() + randomInRange(-Z_JITTER, Z_JITTER);

    heart.scale.setScalar(randomInRange(0.7, 1.4));
    heart.rotation.z = Math.PI;
    const materials = [];
    heart.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        materials.push(obj.material);
      }
    });
    heart.userData = {
      speed: randomInRange(3.5, 7),
      driftX: randomInRange(-0.2, 0.2),
      driftPhase: Math.random() * Math.PI * 2,
      spinSpeed: randomInRange(0.1, 0.35),
      colorA: new THREE.Color(0xff3b4f),
      colorB: new THREE.Color(0xff3b4f),
      materials
    };
    textGroup.add(heart);
    heartMeshes.push(heart);
  }
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.elapsedTime;

  const topY = camera.position.y + Y_RANGE * 1.6;
  const bottomY = camera.position.y - Y_RANGE * 1.6;
  const distance = camera.position.distanceTo(controls.target);
  const xSpread = currentXRange(distance);
  const phase = time * 0.6;
  const mix = (Math.sin(phase) + 1) * 0.5;

  // Density increases as you get closer, thins out far away
  const densityT = THREE.MathUtils.clamp(1 - distance / 5000, 0.2, 1);
  const activeTextCount = Math.floor(textPlanes.length * densityT);

  // Smoothly ease scroll to avoid lag during wheel input.
  scrollZOffset += (scrollZTarget - scrollZOffset) * 0.08;
  textGroup.position.z = scrollZOffset;

  // Subtle mouse parallax rotation for cinematic depth (very light touch).
  parallax.x += (parallax.targetX - parallax.x) * 0.04;
  parallax.y += (parallax.targetY - parallax.y) * 0.04;
  textGroup.rotation.y = parallax.x * 0.08;
  textGroup.rotation.x = -parallax.y * 0.06;

  // Progressive spawn to avoid long startup stalls
  if (pendingTextCount > 0) {
    const spawnCount = Math.min(TEXT_SPAWN_PER_FRAME, pendingTextCount);
    for (let i = 0; i < spawnCount; i += 1) {
      addTextPlane();
    }
    pendingTextCount -= spawnCount;
  }

  // Refresh a few text textures per frame once glyphs are loaded
  if (glyphRefreshQueue.length) {
    const refreshCount = Math.min(GLYPH_REFRESH_PER_FRAME, glyphRefreshQueue.length);
    for (let i = 0; i < refreshCount; i += 1) {
      const mesh = glyphRefreshQueue.pop();
      if (mesh && mesh.userData && mesh.userData.text) {
        const fontSize = renderTextToCanvas(
          mesh.userData.ctx,
          mesh.userData.canvas,
          mesh.userData.text
        );
        mesh.userData.fontSize = fontSize;
        mesh.userData.texture.needsUpdate = true;
      }
    }
  }

  for (let i = 0; i < textPlanes.length; i += 1) {
    const mesh = textPlanes[i];
    const isActive = i < activeTextCount;
    mesh.visible = isActive;
    if (!isActive) {
      continue;
    }

    // Subtle non-linear drift to avoid uniform motion.
    const drift = Math.sin(time * 0.6 + mesh.userData.driftPhase) * 0.4;
    mesh.position.x += (mesh.userData.driftX + drift) * delta * 6;
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -xSpread, xSpread);
    mesh.position.y -= mesh.userData.speed * delta * 10;
    if (mesh.position.y < bottomY) {
      resetTextPlane(mesh, topY + randomInRange(120, 320), xSpread);
    }

    // Distance-based scale/opacity to create depth bands and haze.
    const depth = Math.abs(mesh.position.z + textGroup.position.z);
    const depthT = THREE.MathUtils.clamp(depth / 20000, 0, 1);
    const depthScale = THREE.MathUtils.lerp(1.2, 0.55, depthT);
    mesh.scale.setScalar(mesh.userData.baseScale * depthScale);

    // Fade with distance + soften below camera
    const fadeBelow = THREE.MathUtils.clamp(
      1 - (bottomY - mesh.position.y) / 120,
      0,
      1
    );
    mesh.material.opacity = THREE.MathUtils.lerp(0.5, 1, 1 - depthT) * fadeBelow;

    // Global synced color cycling: bright pink -> bright blue -> bright pink
    const a = mesh.userData.colorA;
    const b = mesh.userData.colorB;
    tempTextColor.setRGB(
      a.r + (b.r - a.r) * mix,
      a.g + (b.g - a.g) * mix,
      a.b + (b.b - a.b) * mix
    );
    mesh.material.color.copy(tempTextColor);
  }

  for (const heart of heartMeshes) {
    const drift = Math.sin(time * 0.5 + heart.userData.driftPhase) * 0.25;
    heart.position.x += (heart.userData.driftX + drift) * delta * 4;
    heart.position.x = THREE.MathUtils.clamp(heart.position.x, -xSpread, xSpread);
    heart.position.y -= heart.userData.speed * delta * 9;
    // Spin only around Y (horizontal spin)
    heart.rotation.y += heart.userData.spinSpeed * delta * 0.8;

    if (heart.position.y < bottomY) {
      heart.position.y = topY + randomInRange(120, 320);
      heart.position.x = randomInRange(-xSpread * 0.9, xSpread * 0.9);

      heart.position.z = pickZFromBands() + randomInRange(-Z_JITTER, Z_JITTER);
    }

    const a = heart.userData.colorA;
    const b = heart.userData.colorB;
    tempHeartColor.setRGB(
      a.r + (b.r - a.r) * mix,
      a.g + (b.g - a.g) * mix,
      a.b + (b.b - a.b) * mix
    );
    // Hearts drift slower and feel more distant with depth.
    const heartDepth = Math.abs(heart.position.z + textGroup.position.z);
    const heartDepthT = THREE.MathUtils.clamp(heartDepth / 12000, 0, 1);
    const heartOpacity = 1;
    for (const mat of heart.userData.materials) {
      mat.opacity = heartOpacity;
      mat.transparent = false;
      mat.color.copy(tempHeartColor);
    }
  }

  // Subtle particle drift
  particles.rotation.y = Math.sin(time * 0.05) * 0.08;
  particles.rotation.x = Math.cos(time * 0.04) * 0.05;

  controls.update();
  renderer.render(scene, camera);
}

animate();
