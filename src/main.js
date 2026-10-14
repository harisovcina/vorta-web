import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { zoneVertex, zoneFragment, zoneDepthFragment } from './zoneShader.js';
import { glassFragment, glassDepthFragment } from './glassShader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { loader, startExperience } from './ui.js';
gsap.registerPlugin(ScrollTrigger);

const A = import.meta.env.BASE_URL + 'assets/';   // relative in builds (vite.config base './')
const man = await (await fetch(A + 'manifest.json')).json();
// Blender's display transform (AgX via its OCIO 3D LUT), sampled from Blender itself; fetched alongside the scene
const viewLutP = man.view && man.view.lut ? fetch(A + man.view.lut.file).then((r) => r.arrayBuffer()) : Promise.resolve(null);
const TL = man.timeline;
const FI = Object.fromEntries(TL.fields.map((f, i) => [f, i]));

// ---------- renderer / scene ----------
// ---------- quality tier (phones/tablets/weak GPUs get lighter settings; override with ?tier=low|mid|high) ----------
const DEBUG = new URLSearchParams(location.search).has('debug');
const qTier = new URLSearchParams(location.search).get('tier');
const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const TIER = qTier || (mobileUA ? (Math.min(screen.width, screen.height) < 600 ? 'low' : 'mid') : (navigator.hardwareConcurrency || 8) <= 4 ? 'mid' : 'high');
const Q = { low: { dpr: 1.25, shadow: 1024, msaa: 0, bloomScale: 0.5, lights: 6 }, mid: { dpr: 1.5, shadow: 1536, msaa: 2, bloomScale: 0.75, lights: 10 },
            high: { dpr: 1.5, shadow: 2048, msaa: 4, bloomScale: 1, lights: 16 } }[TIER] || { dpr: 1.5, shadow: 2048, msaa: 4, bloomScale: 1, lights: 16 };
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
{ const qq = new URLSearchParams(location.search);   // perf A/B toggles: ?dpr=1 ?msaa=0
  if (qq.has('dpr')) Q.dpr = +qq.get('dpr'); if (qq.has('msaa')) Q.msaa = +qq.get('msaa'); }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.dpr));
renderer.shadowMap.enabled = TIER !== 'low';   // live-lit objects (truck, cars, workers) get the static world's sun shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = Math.pow(2, 0.2);      // Blender exposure: keyed per story frame (man.view.exposureFrames), see applyFrame
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color();

// ---------- camera (orthographic iso from Blender) ----------
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, man.camera.near, man.camera.far);
cam.position.fromArray(man.camera.position);
cam.quaternion.fromArray(man.camera.quaternion);
const followTmp = new THREE.Vector3();
let followX = 0, followTarget = null;   // narrow screens: horizontal offset (world units in camera space) that keeps the truck in view
function frameCamera(ortho, sx, sy) {
  const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
  const h = ortho * 9 / 16, w = h * aspect;              // keep Blender's vertical framing on any screen
  if (aspect < 16 / 9 && followTarget) {
    // where the truck sits across Blender's 16:9 frame (camera-space x), then slide the narrower window so it stays
    // inside the middle 70% (eased so the camera never jerks)
    cam.updateMatrixWorld(); followTmp.copy(followTarget.position).applyMatrix4(cam.matrixWorldInverse);
    const cx = followTmp.x - sx * ortho, lim = w * 0.2, maxOff = (h * 16 / 9 - w) / 2;   // never leave Blender's 16:9 frame
    const inFrame = Math.abs(cx) < h * 16 / 9 / 2;   // truck not in Blender's shot yet -> show the shot's centre
    const want = inFrame ? THREE.MathUtils.clamp(Math.abs(cx) > lim ? cx - Math.sign(cx) * lim : 0, -maxOff, maxOff) : 0;
    followX += (want - followX) * 0.15;
  } else followX = 0;
  cam.left = -w / 2 + sx * ortho + followX; cam.right = w / 2 + sx * ortho + followX;
  cam.top = h / 2 + sy * ortho; cam.bottom = -h / 2 + sy * ortho;
  cam.updateProjectionMatrix();
}

// ---------- shared uniforms ----------
const U = {
  uFrame: { value: 1 }, uTime: { value: 0 },
  uSky: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3() },
  uLamp: { value: 0 }, uTrail: { value: 0 },
  uTrailColor: { value: new THREE.Vector3().fromArray(man.trail.color) },
  // glass (live-lit): view/sun directions, reflection colours, baked sun scale
  uViewDir: { value: new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunScale: { value: 1 },
  uSkyCol: { value: new THREE.Vector3() }, uGroundCol: { value: new THREE.Vector3() },
  // dynamic lights for the baked world (filled per frame from manifest.lightRigs)
  uDLCount: { value: 0 },
  uDLPos: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uDLDir: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
  uDLCol: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uDLRad2: { value: new Array(16).fill(0) },
  // moving-object sun shadows (filled per frame)
  uShadowMap: { value: null }, uShadowMat: { value: new THREE.Matrix4() }, uShadowTexel: { value: 1 / 2048 },
  uShadowFloor: { value: 0.0 }, uShadowOn: { value: 0 },   // floor 0: the shader keeps the baked bounce (sun term minus direct) instead
  uAOTop: { value: null }, uAOBot: { value: null }, uAOMat: { value: new THREE.Matrix4() }, uAOScale: { value: new THREE.Vector2(100, 100) }, uAOOn: { value: 0 },
  uShDeep: { value: +(new URLSearchParams(location.search).get('shdeep') || 1.2) }, uSkDeep: { value: +(new URLSearchParams(location.search).get('skdeep') || 2) },
  uAOStr: { value: +(new URLSearchParams(location.search).get('aostr') || 2) }, uAOCap: { value: +(new URLSearchParams(location.search).get('aocap') || 1) },
  uShadowScale: { value: new THREE.Vector3(100, 100, 500) }, uPenumbra: { value: 0.28 },
  // cloud shadows (mask painted below from manifest.cloudShadows)
  uFallback: { value: new URLSearchParams(location.search).get('fallback') === '0' ? 0 : 1 },
  uCloudMap: { value: null }, uCloudRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uCloudParams: { value: new THREE.Vector3() }, uCloudOn: { value: 0 },
};
// build-in curves: row 0/1 = scale springs (variants 0/1), row 2 = DROP_IN (variant 4: r xy scale, g z scale, b height offset)
const BROWS = ['0', '1', '4'];
const buildN = Math.max(...BROWS.filter((v) => man.buildCurves[v]).map((v) => man.buildCurves[v].frames));
const bdata = new Float32Array((buildN + 1) * BROWS.length * 4);
BROWS.forEach((v, row) => {
  const c = man.buildCurves[v];
  for (let i = 0; i <= buildN; i++) {
    const k = (row * (buildN + 1) + i) * 4;
    if (!c) { bdata[k] = 1; bdata[k + 1] = 1; continue; }
    const j = Math.min(i, c.frames);
    bdata[k] = c.xy[j]; bdata[k + 1] = c.z[j]; bdata[k + 2] = c.dz ? c.dz[j] : 0;
  }
});
const buildTex = new THREE.DataTexture(bdata, buildN + 1, BROWS.length, THREE.RGBAFormat, THREE.FloatType);
buildTex.needsUpdate = true;

// ---------- lights for live-lit objects (truck, loops, props, cars) ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x6b6b70, 1);
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
const sunDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0.864, 0, -2.902, 'ZYX'));
sunDir.set(sunDir.x, sunDir.z, -sunDir.y);
scene.add(hemi, sunLight, sunLight.target);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(Q.shadow, Q.shadow); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03;
U.uSunDir.value.copy(sunDir).negate();
U.uSunScale.value = (man.terrainFlat ? man.terrainFlat.sun[1] : 1.045) / Math.max(-sunDir.y, 0.1);   // flat ground bakes to sun x n.l
const tz = man.zones.find((z) => /^T\d/.test(z.zone));
const groundAlb = new THREE.Vector3().fromArray(man.terrainStyle ? man.terrainStyle.a : tz && tz.materials[0] ? tz.materials[0].albedo : [0.6, 0.65, 0.75]);

// ---------- loaders ----------
const texLoader = new THREE.TextureLoader();
// loading progress (first-frame assets): every texture / GLB / zone binary counts once
const track = (pr) => { pr.then(() => loader.tick(), () => {}); return pr; };
// lightmaps decode off the main thread (ImageBitmap) so big WebPs never stall a frame at upload time.
// Same pixels as TextureLoader: flipped at decode instead of at upload, no colour management, no premultiply.
// Safari / Firefox-iOS lack the options -> plain TextureLoader there (same rule as three's GLTFLoader).
const useBitmap = new URLSearchParams(location.search).get('bmp') !== '0' && typeof createImageBitmap !== 'undefined' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);
const bmpLoader = useBitmap ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : null;
const lmSetup = (t) => { t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; return t; };
const loadTex = (f) => track(new Promise((res, rej) => {
  if (bmpLoader) bmpLoader.load(A + f, (bmp) => { const t = lmSetup(new THREE.Texture(bmp)); t.flipY = false; t.needsUpdate = true; res(t); }, undefined, rej);
  else texLoader.load(A + f, (t) => res(lmSetup(t)), undefined, rej);
}));
const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// meshopt-packed copies (exporter step 'pack') when present: ~5x smaller downloads
const loadGLB = (f) => track(new Promise((res, rej) => gltf.load(A + ((man.packed && man.packed[f]) || f), res, undefined, rej)));

// build map: per 1 m cell the frame from which baked build-in shadows may show on the terrain (exact values: nearest, no mips)
const buildMapTex = man.buildMap ? await new Promise((res) => texLoader.load(A + man.buildMap.file, (t) => {
  t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.NearestFilter; res(t);
}, undefined, () => res(null))) : null;
const flat = man.terrainFlat;
const TS = man.terrainStyle;   // Blender Terrain_Wire parameters
// ---------- cloud shadows ----------
// Blender's Cloud_* planes (z ~160, camera-invisible, 30% opaque) only cast shadows; with the 16 deg sun the edges blur
// over ~2 z tan(8 deg) = 45 m. Paint their outlines into a transmission mask (each layer x 0.7), blur, scroll on real time.
const CS = man.cloudShadows;
if (CS && CS.polys.length) {
  const pts = CS.polys.flat(), pad = 70, RES = 1;
  const cx0 = Math.min(...pts.map((p) => p[0])) - pad, cy0 = Math.min(...pts.map((p) => p[1])) - pad;
  const cw = Math.ceil((Math.max(...pts.map((p) => p[0])) + pad - cx0) / RES), ch = Math.ceil((Math.max(...pts.map((p) => p[1])) + pad - cy0) / RES);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = `rgba(0,0,0,${CS.opacity})`;
  for (const poly of CS.polys) { ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (x - cx0) / RES, (y - cy0) / RES)); ctx.closePath(); ctx.fill(); }
  const src = ctx.getImageData(0, 0, cw, ch).data, a = new Float32Array(cw * ch), tmp = new Float32Array(cw * ch);
  for (let i = 0; i < a.length; i++) a[i] = src[i * 4] / 255;
  const sigma = 2 * CS.z * Math.tan(CS.sunAngle / 2) / 4 / RES, rad = Math.max(1, Math.round(sigma - 0.5));
  const box = (inp, out, w, h, r, horiz) => {   // wrapped box blur (the mask tiles)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += horiz ? inp[y * w + ((x + k + w) % w)] : inp[((y + k + h) % h) * w + x];
      out[y * w + x] = acc / (2 * r + 1);
    }
  };
  for (let n = 0; n < 3; n++) { box(a, tmp, cw, ch, rad, true); box(tmp, a, cw, ch, rad, false); }
  const u8 = new Uint8Array(cw * ch); for (let i = 0; i < a.length; i++) u8[i] = Math.round(a[i] * 255);
  const ct = new THREE.DataTexture(u8, cw, ch, THREE.RedFormat, THREE.UnsignedByteType);
  ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.magFilter = ct.minFilter = THREE.LinearFilter; ct.unpackAlignment = 1; ct.needsUpdate = true;
  U.uCloudMap.value = ct; U.uCloudRect.value.set(cx0, cy0, cw * RES, ch * RES); U.uCloudParams.value.set(CS.z, 0, 0);
  U.uCloudOn.value = new URLSearchParams(location.search).get('clouds') === '0' ? 0 : 1;   // debug: ?clouds=0
  U.uPenumbra.value = 2 * Math.tan(CS.sunAngle / 2);
}
async function zoneData(z) {
  const buf = await track(fetch(A + z.bin).then((r) => r.arrayBuffer()));
  const L = z.layout;
  const view = (k, C) => new C(buf, L[k].offset, L[k].count);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(view('position', Float32Array), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(view('uv', Uint16Array), 2, true));
  g.setAttribute('mat', new THREE.BufferAttribute(view('mat', Uint8Array), 1));
  g.setAttribute('objid', new THREE.BufferAttribute(view('objid', Uint16Array), 1));
  g.setAttribute('trailu', new THREE.BufferAttribute(view('trailu', Uint16Array), 1, true));
  g.setIndex(new THREE.BufferAttribute(view('index', Uint32Array), 1));
  g.computeBoundingSphere();
  const n = z.objects.length;
  const od = new Float32Array(n * 3 * 4);
  z.objects.forEach((o, i) => {
    od.set([o[0], o[1], o[2], o[3]], (0 * n + i) * 4);
    od.set([o[4], o[5], o[6], o[7]], (1 * n + i) * 4);
    od.set([o[8], o[9], 0, 0], (2 * n + i) * 4);
  });
  const objTex = new THREE.DataTexture(od, n, 3, THREE.RGBAFormat, THREE.FloatType); objTex.needsUpdate = true;
  if (man.terrainStyle && /^T\d/.test(z.zone)) {   // per-corner barycentrics for the screen-space wireframe
    const ng = g.toNonIndexed(), nv = ng.attributes.position.count, bc = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) bc[i * 3 + (i % 3)] = 1;
    ng.setAttribute('bary', new THREE.BufferAttribute(bc, 3)); ng.computeBoundingSphere();
    return { g: ng, objTex };
  }
  return { g, objTex };
}
// generous bounds for culling: build-in springs overshoot ~1.45x around object pivots, drop-ins start above
const NOCULL = new URLSearchParams(location.search).get('cull') === '0';   // debug A/B
function padBounds(g) { if (!g.boundingSphere) g.computeBoundingSphere(); g.boundingSphere.radius = g.boundingSphere.radius * 1.2 + 60; }
const pal = (z, key) => Array.from({ length: 64 }, (_, i) => new THREE.Vector3().fromArray(z.materials[i] ? z.materials[i][key] : [0, 0, 0]));
const palF = (z, f) => Array.from({ length: 64 }, (_, i) => (z.materials[i] ? +f(z.materials[i]) : 0));
const zoneLamp = {}, zoneMat = {}, zoneWin = {};   // per-zone lamps-layer brightness (manifest.lampCurves), zone materials by key
async function loadZone(z) {
  const { g, objTex } = await zoneData(z);
  const lm = man.lightmaps[z.zone] || {};
  const tex = {};
  await Promise.all(['sky', 'sun', 'lamps', 'trail', 'skyClean', 'sunClean', 'windows'].map(async (k) => { tex[k] = lm[k] ? await loadTex(lm[k].file) : black; }));
  const clean = !!(lm.skyClean && lm.sunClean && buildMapTex);
  const mat = new THREE.ShaderMaterial({
    vertexShader: zoneVertex, fragmentShader: zoneFragment,
    defines: { ...(lm.lamps ? { HAS_LAMPS: '' } : {}), ...(lm.trail ? { HAS_TRAIL: '' } : {}), ...(lm.windows ? { HAS_WINDOWS: '' } : {}), ...(flat && /^T\d/.test(z.zone) ? { FLAT_RECT: '' } : {}), ...(clean ? { HAS_CLEAN: '' } : {}), ...(TS && /^T\d/.test(z.zone) ? { TERRAIN_STYLE: '' } : {}), ...(TIER === 'low' ? { LOW_TIER: '' } : {}) },
    uniforms: {
      ...U, uLamp: (zoneLamp[z.zone] = { value: 1 }), uObj: { value: objTex }, uBuild: { value: buildTex }, uBuildN: { value: buildN },
      lmSky: { value: tex.sky }, lmSun: { value: tex.sun }, lmLamps: { value: tex.lamps }, lmTrail: { value: tex.trail },
      lmScale: { value: new THREE.Vector4(lm.sky?.scale || 0, lm.sun?.scale || 0, lm.lamps?.scale || 0, lm.trail?.scale || 0) },
      uTerrA: { value: new THREE.Vector3().fromArray(TS ? TS.a : [0.8, 0.8, 0.8]) }, uTerrB: { value: new THREE.Vector3().fromArray(TS ? TS.b : [0.8, 0.8, 0.8]) },
      uWireCol: { value: new THREE.Vector3().fromArray(TS ? TS.wire : [0, 0, 0]) },
      uTerrMap: { value: new THREE.Vector4(TS ? TS.fromMin : 0, TS ? TS.fromMax : 1, TS ? TS.k : 0, TS ? TS.wirePx : 1) },
      lmWin: { value: tex.windows }, lmScaleW: { value: lm.windows?.scale || 0 }, uWin: (zoneWin[z.zone] = { value: 1 }),
      lmSkyC: { value: tex.skyClean }, lmSunC: { value: tex.sunClean },
      lmScaleC: { value: new THREE.Vector2(lm.skyClean?.scale || 0, lm.sunClean?.scale || 0) },
      uBuildMap: { value: buildMapTex || black }, uBuildFade: { value: man.buildMap?.fade || 8 },
      uBuildRect: { value: new THREE.Vector4().fromArray(man.buildMap?.rect || [0, 0, 1, 1]) },
      uAlbedo: { value: pal(z, 'albedo') }, uEmit: { value: pal(z, 'emit') },
      uFlatRect: { value: flat ? new THREE.Vector4(flat.rect[0] + 0.1, flat.rect[1] - 0.1, -flat.rect[3] + 0.1, -flat.rect[2] - 0.1) : new THREE.Vector4() },
      uFlatSky: { value: new THREE.Vector3().fromArray(flat ? flat.sky : [1, 1, 1]) }, uFlatSun: { value: new THREE.Vector3().fromArray(flat ? flat.sun : [1, 1, 1]) },
      uObjColor: { value: Array.from({ length: 64 }, (_, i) => (z.materials[i] && z.materials[i].objcolor ? 1 : 0)) },
      uGlass: { value: Array.from({ length: 64 }, (_, i) => (z.materials[i] && /glass/i.test(z.materials[i].name) ? 1 : 0)) },
    },
  });
  zoneMat[z.zone] = mat;
  const mesh = new THREE.Mesh(g, mat);
  padBounds(g); mesh.frustumCulled = !NOCULL;   // padded sphere: off-screen districts are skipped
  mesh.name = 'zone_' + z.zone;
  mesh.castShadow = true;   // into three's sun shadow map (lights the live objects), with the build-in pop applied
  mesh.customDepthMaterial = new THREE.ShaderMaterial({ vertexShader: zoneVertex, fragmentShader: zoneDepthFragment, uniforms: mat.uniforms, defines: mat.defines });
  scene.add(mesh);
}

// glass zones: opaque glass in the opaque pass, clear glass (glasshouse) blended after it
async function loadGlassZone(z) {
  const { g, objTex } = await zoneData(z);
  padBounds(g);
  const uniforms = {
    ...U, uObj: { value: objTex }, uBuild: { value: buildTex }, uBuildN: { value: buildN },
    uAlbedo: { value: pal(z, 'albedo') }, uEmit: { value: pal(z, 'emit') },
    uObjColor: { value: palF(z, (m) => m.objcolor) }, uClear: { value: palF(z, (m) => m.clear) },
    uRough: { value: palF(z, (m) => m.rough ?? 0.3) }, uSpec: { value: palF(z, (m) => m.spec ?? 0.5) },
    uTint: { value: new THREE.Vector3(0.85, 0.97, 1.0) },   // Farm_Glass Glass BSDF colour
  };
  const opaque = new THREE.ShaderMaterial({ vertexShader: zoneVertex, fragmentShader: glassFragment, uniforms });
  // clear glass in two blended passes: multiply the scene behind by the tint, then add the reflection on top
  const clearMul = new THREE.ShaderMaterial({ vertexShader: zoneVertex, fragmentShader: glassFragment, uniforms, defines: { CLEAR_MUL: '' },
    transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true });
  const clearAdd = new THREE.ShaderMaterial({ vertexShader: zoneVertex, fragmentShader: glassFragment, uniforms, defines: { CLEAR_ADD: '' },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true });
  const hasClear = z.materials.some((m) => m.clear);
  for (const [mat, tag, order] of [[opaque, '', 0], ...(hasClear ? [[clearMul, '_clearMul', 10], [clearAdd, '_clearAdd', 11]] : [])]) {
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = !NOCULL; mesh.name = 'zone_' + z.zone + tag; mesh.renderOrder = order;
    if (!tag) { mesh.castShadow = true; mesh.customDepthMaterial = new THREE.ShaderMaterial({ vertexShader: zoneVertex, fragmentShader: glassDepthFragment, uniforms }); }
    scene.add(mesh);
  }
}

// ---------- trail tube ----------
const trailCurve = new THREE.CatmullRomCurve3(man.trail.points.map((p) => new THREE.Vector3().fromArray(p)), false, 'centripetal');
const TUB = 2400, RAD = 8;
const trailGeo = new THREE.TubeGeometry(trailCurve, TUB, man.trail.radius, RAD, false);
const tc = man.trail.color, ts = man.trail.strength;
const trailMesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(tc[0] * ts, tc[1] * ts, tc[2] * ts, THREE.LinearSRGBColorSpace) }));
scene.add(trailMesh);

// ---------- load everything ----------
// progressive loading: the warehouse/farm/terrain zones first (first frame sooner), the city zones (~2/3 of the bytes)
// in the background; the story waits at CITY_GATE until they are in
const EARLY = new Set(['W', 'M', 'T0', 'T1', 'T2', 'T3']);
const zoneKey = (z) => String(z.zone).replace('GLASS_', '');
const isEarly = (z) => EARLY.has(zoneKey(z));
const CITY_GATE = 400;   // first city pops happen at ~411
let cityReady = false;
const LM_KEYS = ['sky', 'sun', 'lamps', 'trail', 'skyClean', 'sunClean', 'windows'];
loader.expect(4 + man.zones.filter(isEarly).reduce((n, z) => n + 1 + LM_KEYS.filter((k) => (man.lightmaps[z.zone] || {})[k]).length, 0)
  + (man.glassZones || []).filter(isEarly).length);
const [ambient, truck, props, traffic] = await Promise.all([
  loadGLB('ambient.glb'), loadGLB('truck.glb'), loadGLB('props.glb'), loadGLB('traffic.glb'),
  ...man.zones.filter(isEarly).map(loadZone), ...(man.glassZones || []).filter(isEarly).map(loadGlassZone),
]);
// GPU uploads spread over frames (one texture per frame) instead of one long stall
const uploadQueue = []; let uploadDone = null;
function sceneTextures() {
  const texs = new Set();
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [], o.customDepthMaterial || [])) {
      for (const u of Object.values(m.uniforms || {})) if (u && u.value && u.value.isTexture) texs.add(u.value);
      for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]) texs.add(m[k]);
    }
  });
  return [...texs];
}
const cityLoad = Promise.all([...man.zones.filter((z) => !isEarly(z)).map(loadZone), ...(man.glassZones || []).filter((z) => !isEarly(z)).map(loadGlassZone)])
  .then(() => new Promise((done) => { uploadQueue.push(...sceneTextures()); uploadDone = done; }))   // drained by the render loop
  .then(() => (renderer.compileAsync ? renderer.compileAsync(scene, cam) : null))
  .then(() => { cityReady = true; window.__cityReady = true; console.log('[vorta] city ready', Math.round(performance.now()), 'ms'); });
scene.add(ambient.scene, truck.scene, props.scene, traffic.scene);
const qHide = new URLSearchParams(location.search).get('hide');   // debug: ?hide=T0,T1 hides zone meshes
if (qHide) qHide.split(',').forEach((z) => { const o = scene.getObjectByName('zone_' + z); if (o) o.visible = false; });
const mixer = new THREE.AnimationMixer(ambient.scene);
// start every loop at the same phase as Blender's frame 1, so the browser opens on the same picture as the preview
const sanitize = (n) => n.replace(/\s/g, '_').replace(/[\[\].:\/]/g, '');
const loops = Object.fromEntries(Object.entries(man.ambientLoops || {}).map(([k, v]) => [sanitize(k), v]));
const loopOf = (name) => { let o = ambient.scene.getObjectByName(name); while (o) { if (loops[o.name]) return loops[o.name]; o = o.parent; } return null; };
const actByTarget = {};
ambient.animations.forEach((clip) => {
  const act = mixer.clipAction(clip); act.play();
  const target = clip.tracks[0] && clip.tracks[0].name.split('.')[0];
  if (target) actByTarget[target] = act;
  const loop = target && loopOf(target);
  if (loop) { const P = loop[1] - loop[0]; act.time = ((((1 - loop[0]) % P) + P) % P) / TL.fps; }
});

// one-time springy entrance for the forklift the first time the warehouse is on screen
window.__state = { frame: TL.start };
const fk = ambient.scene.getObjectByName('LiftAnim_Root');
const fkCargo = ['LiftAnim_Pallet', 'LiftAnim_Crate'].map((n) => ambient.scene.getObjectByName(n)).filter(Boolean);
const spring = (t) => (t <= 0 ? 0 : 1 - Math.exp(-7 * t) * Math.cos(18 * t));
function entrance(k, drop, fall = 8) {
  if (k < 0) return [0, 0, drop];
  const q = Math.min(k / fall, 1), zoff = drop * (1 - q * q);
  if (k < fall) { const s = Math.min(1, spring((k / 24) * 1.6)); return [s, s, zoff]; }
  const sq = spring((k - fall) / 24 + 0.06);
  return [1 + (1 - sq) * 0.45, sq, 0];
}
const intro = { start: null, done: false };
const tmpV = new THREE.Vector3();
function applyIntro(now) {
  if (!fk || intro.done) return;
  if (intro.start === null) {
    if (window.__state.frame >= 250) { intro.done = true; return; }   // deep link past the warehouse: leave it as is
    if (window.__introGo) intro.start = now + 0.1;                  // UI sets this when the curtain starts opening
  }
  const k = intro.start === null ? -1 : (now - intro.start) * 24;      // k < 0: hidden until then
  if (k > 44) { fk.scale.set(1, 1, 1); intro.done = true; return; }
  const [sxy, sz, zoff] = entrance(k, 1.4);
  const r = fk.position.clone();
  fk.scale.set(sxy, sz, sxy); fk.position.y += zoff;
  for (const c of fkCargo) {
    if (c.position.distanceTo(r) > 3.2) continue;          // only cargo that is riding on the forks
    c.position.set(r.x + (c.position.x - r.x) * sxy, r.y + (c.position.y - r.y) * sz + zoff, r.z + (c.position.z - r.z) * sxy);
    c.scale.multiply(tmpV.set(sxy, sz, sxy));
  }
}

const gated = [];
for (const root of [ambient.scene, props.scene, traffic.scene]) {
  // props (signals, beacons, story lights) also replay Blender's build-in pop on the story frame (variants 0/1 of buildCurves)
  root.traverse((o) => { const g = man.gates[o.name]; if (g) gated.push([o, g[0], root === props.scene && (g[1] === 0 || g[1] === 1) ? man.buildCurves[String(g[1])] : null, o.scale.clone()]); });
}
const tk = truck.scene.getObjectByName('TK_Root');
followTarget = tk;
const wheels = [...man.truck.wheelsFront.map((n) => [n, 'front']), ...man.truck.wheelsRear.map((n) => [n, 'rear'])]
  .map(([n, k]) => { const o = truck.scene.getObjectByName(n); return o && { o, k, q0: o.quaternion.clone() }; }).filter(Boolean);
const axisOf = (i) => [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)][i];
// cars: real-time ring loops from traffic.glb (drive + wheel spin), phase of Blender frame 1 like the ambient loops
const tmixer = new THREE.AnimationMixer(traffic.scene);
const tloops = Object.fromEntries(Object.entries(man.trafficLoops || {}).map(([k, v]) => [sanitize(k), v]));
traffic.animations.forEach((clip) => {
  const act = tmixer.clipAction(clip); act.play();
  const target = clip.tracks[0] && clip.tracks[0].name.split('.')[0];
  const loop = tloops[target];
  if (loop) { const P = loop[1] - loop[0]; act.time = ((((1 - loop[0]) % P) + P) % P) / TL.fps; }
});
// one-time spring pop of each car root when its block is built (story frame), replayed from Blender's scale curve
const carPops = Object.entries(man.trafficPop || {}).map(([n, c]) => ({ o: traffic.scene.getObjectByName(sanitize(n)), ...c })).filter((c) => c.o);

// ---------- fades: objects whose alpha is keyed in Blender (steam puffs: object colour alpha -> transparent mix) ----------
const fades = Object.entries(man.fades || {}).map(([n, f]) => {
  const node = [ambient.scene, props.scene, traffic.scene].map((sc) => sc.getObjectByName(sanitize(n))).find(Boolean);
  if (!node) return null;
  const mats = [];
  node.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material.clone();
    if (/^Steam/i.test(m.name)) {   // Diffuse white + Emission, mixed over Transparent by the keyed alpha
      m.color.setRGB(1, 1, 1); m.roughness = 1; m.metalness = 0;
      m.emissive.setRGB(0.97, 0.98, 1); m.emissiveIntensity = /Box/i.test(m.name) ? 1.3 : 0.75;
    }
    m.transparent = true; m.depthWrite = false; o.material = m; mats.push(m);
  });
  return { node, mats, act: actByTarget[sanitize(n)], ...f };
}).filter(Boolean);
function updateFades(t) {
  for (const f of fades) {
    const P = f.a.length - 1;
    const fr = f.act ? f.act.time * TL.fps : ((((1 - f.loop[0]) + t * TL.fps) % P) + P) % P;
    const i = Math.min(Math.floor(fr), P), u = fr - i, a = f.a[i] + ((f.a[Math.min(i + 1, P)] ?? f.a[i]) - f.a[i]) * u;
    for (const m of f.mats) m.opacity = a;
  }
}

// ---------- traffic signals, rooftop beacon, story lights (props.glb) ----------
// Signals: object colour R/G/B drives the red/yellow/green lens emission; one 240-frame CONSTANT pattern with a phase per
// signal, played on real time. Beacon: blinks on real time once the story reaches its first flash. Story lights (window
// flickers, floods): keyed on the story frame (R channel scales the emission).
const SG = man.signals;
const sigGroups = new Map();
const CH = { Red: 1, Green: 2, Blue: 3 };
if (SG) for (const [name, o] of Object.entries(SG.objects)) {
  const node = props.scene.getObjectByName(sanitize(name)); if (!node) continue;
  const key = o.pattern + '|' + o.phase;
  let gr = sigGroups.get(key);
  if (!gr) { gr = { pattern: SG.patterns[o.pattern], phase: o.phase, mats: {} }; sigGroups.set(key, gr); }
  node.traverse((mh) => {
    if (!mh.isMesh) return;
    const ch = man.signalChannels[mh.material.name]; if (!ch) return;
    if (!gr.mats[mh.material.name]) { const c = mh.material.clone(); c.userData = { base: mh.material.emissiveIntensity, ch }; gr.mats[mh.material.name] = c; }
    mh.material = gr.mats[mh.material.name];
  });
}
const stepKey = (keys, f) => { let k = keys[0]; for (const q of keys) { if (q[0] <= f) k = q; else break; } return k; };
const linKey = (keys, f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return a[1] + (b[1] - a[1]) * (f - a[0]) / Math.max(b[0] - a[0], 1e-6); }
  return keys[keys.length - 1][1];
};
const storyLights = [];
for (const [name, sl] of [...Object.entries(man.storyLights || {}), ...Object.entries(man.blink || {}).map(([n, b]) => [n, { ...b, blink: true }])]) {
  const node = props.scene.getObjectByName(sanitize(name)); if (!node) continue;
  const mats = [];
  node.traverse((mh) => { if (mh.isMesh) { mh.material = mh.material.clone(); mh.material.userData = { base: mh.material.emissiveIntensity }; mats.push(mh.material); } });
  let start = 0, period = 0;
  if (sl.blink) {   // first rising edges -> period; real-time blinking after the first flash
    const rise = sl.keys.filter((k, i) => i > 0 && k[1] > 0.5 && sl.keys[i - 1][1] <= 0.5).map((k) => k[0]);
    start = sl.keys[sl.keys.findIndex((k) => k[0] === rise[0]) - 1]?.[0] ?? rise[0]; period = rise.length > 1 ? rise[1] - rise[0] : 24;
  }
  storyLights.push({ mats, keys: sl.keys, step: sl.interp === 'CONSTANT', blink: !!sl.blink, start, period });
}
function updateSignals(frame, t) {
  for (const gr of sigGroups.values()) {
    const f = ((((1 + t * TL.fps) - gr.phase) % SG.period) + SG.period) % SG.period;
    const k = stepKey(gr.pattern, f);
    for (const m of Object.values(gr.mats)) m.emissiveIntensity = m.userData.base * k[CH[m.userData.ch]];
  }
  for (const s of storyLights) {
    let f = frame;
    if (s.blink && frame >= s.start) f = s.start + ((t * TL.fps) % s.period);
    const v = s.step || s.blink ? stepKey(s.keys, f)[1] : linKey(s.keys, f);
    for (const m of s.mats) m.emissiveIntensity = m.userData.base * v;
  }
}

// ---------- dynamic lights: truck/car headlights + forklift lamps ----------
// Cycles point/spot of power P (W): radiant intensity P / 4pi; the bakes store E / pi, so a surface gains P cos / (4 pi^2 d^2).
// Every rig feeds the zone shader (light pools on roads, walls, terrain); the nearest few also drive real three.js lights
// so the live-lit objects (truck, cars, workers) get lit too. Fixed light counts -> no shader recompiles.
const rigs = (man.lightRigs || []).map((r) => {
  const parent = [truck.scene, traffic.scene, ambient.scene].map((sc) => sc.getObjectByName(sanitize(r.parent))).find(Boolean);
  if (!parent) return null;
  const half = r.spot ? r.spot[0] / 2 : 0;
  return { ...r, parent, local: new THREE.Vector3().fromArray(r.pos), ldir: new THREE.Vector3().fromArray(r.dir).normalize(),
    cosHalf: r.spot ? Math.cos(half) : -2, blendW: r.spot ? (1 - Math.cos(half)) * r.spot[1] : 1,
    truck: r.parent === 'TK_Root', car: carPops.find((c) => c.o === parent), wp: new THREE.Vector3(), wd: new THREE.Vector3(), P: 0, score: 0 };
}).filter(Boolean);
// ---------- sun shadows of moving objects ----------
// Static shadows are baked. Everything that moves (truck, cars, workers, forklift, doors, loops, birds, signals) renders
// into a depth map from the sun each frame; the zone shader darkens only its sun term there. The shadow camera follows the
// view footprint on the ground, so texel density tracks the zoom.
const SHADOW_SIZE = Q.shadow;
const shadowRT = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
shadowRT.texture.minFilter = shadowRT.texture.magFilter = THREE.NearestFilter; shadowRT.texture.generateMipmaps = false;
const shadowCam = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 2000);
shadowCam.layers.set(1);
const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
const noShadow = new Set((man.noShadow || []).map(sanitize));   // Cycles shadow visibility off (steam puffs)
// birds: no shadows (user decision 2026-10-13 - correct in Cycles but reads as dirt on the hill)
const castsShadow = (o) => { for (let p = o; p; p = p.parent) if (noShadow.has(p.name) || /^Bird_\d/.test(p.name)) return false; return true; };
const qNoCast = (new URLSearchParams(location.search).get('nocast') || '').split(',');
const qAO = new URLSearchParams(location.search).get('ao');   // debug: ?ao=0 disables the moving-object sky occlusion   // debug: ?nocast=ambient,props
// sky-occlusion casters (layer 2): things that stand on the ground and move - truck, cars, forklift, pallet jack, hand
// truck, workers, carried crates. Not birds, fans, doors, steam, the windmill or the park rides (a height map would turn
// anything elevated or thin into a solid column)
const AO_ROOT = /(_Rig$|^HT_|^JK_|^LiftAnim_|^Carry_Crate)/;
const aoCaster = (o, tag) => { if (tag === 'truck' || tag === 'traffic') return true; if (tag !== 'ambient') return false; for (let p = o; p; p = p.parent) if (AO_ROOT.test(p.name)) return true; return false; };
for (const [tag, root] of [['truck', truck.scene], ['ambient', ambient.scene], ['traffic', traffic.scene], ['props', props.scene]]) {
  if (qAO !== '0') root.traverse((o) => { if (o.isMesh && aoCaster(o, tag)) o.layers.enable(2); });
  if (qNoCast.includes(tag)) continue;
  root.traverse((o) => { if (o.isMesh && castsShadow(o)) { o.layers.enable(1); o.castShadow = true; } if (o.isMesh) o.receiveShadow = true; });
}
U.uShadowMap.value = shadowRT.texture; U.uShadowTexel.value = 1 / SHADOW_SIZE;
// top / bottom height of the AO casters: r = world height, g = 1 (cleared to 0), half float + linear filtering so the
// shader gets smooth, coverage-weighted heights
const AO_SIZE = Q.shadow / 2, AO_TOP = 60;
const aoRTs = [0, 1].map(() => { const t = new THREE.WebGLRenderTarget(AO_SIZE, AO_SIZE, { type: THREE.HalfFloatType });
  t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter; t.texture.generateMipmaps = false; return t; });
// the top map keeps mipmaps: the shader skips the AO loop where mip 6 shows no caster nearby (most of the screen)
aoRTs[0].texture.generateMipmaps = true; aoRTs[0].texture.minFilter = THREE.LinearMipmapLinearFilter;
const aoCam = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 70);
aoCam.layers.set(2);
const aoVS = `#include <common>
#include <skinning_pars_vertex>
varying float vH;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vH = (modelMatrix * vec4(transformed, 1.0)).y;
}`;
const aoFS = 'varying float vH; void main() { gl_FragColor = vec4(vH, 1.0, 0.0, 1.0); }';
const aoTopMat = new THREE.ShaderMaterial({ vertexShader: aoVS, fragmentShader: aoFS, side: THREE.DoubleSide });
const aoBotMat = new THREE.ShaderMaterial({ vertexShader: aoVS, fragmentShader: aoFS, side: THREE.DoubleSide, depthFunc: THREE.GreaterDepth });
U.uAOTop.value = aoRTs[0].texture; U.uAOBot.value = aoRTs[1].texture;
const qShadow = new URLSearchParams(location.search).get('shadow');   // debug: ?shadow=0 off
const ndcRay = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmpG = new THREE.Vector3();
const toSun = U.uSunDir.value, clearCol = new THREE.Color();
function renderShadow() {
  if (qShadow === '0') { U.uShadowOn.value = 0; return; }
  // view footprint on the ground (+ raised copy for tall casters)
  const pts = [];
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ndcRay.setFromCamera({ x, y }, cam);
    if (ndcRay.ray.intersectPlane(groundPlane, tmpG)) { pts.push(tmpG.clone(), tmpG.clone().setY(30)); }
  }
  if (pts.length < 8) { U.uShadowOn.value = 0; return; }
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length).setY(0);
  shadowCam.position.copy(c).addScaledVector(toSun, 800); shadowCam.up.set(0, 1, 0); shadowCam.lookAt(c); shadowCam.updateMatrixWorld();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { const q = p.clone().applyMatrix4(shadowCam.matrixWorldInverse); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); z0 = Math.min(z0, -q.z); z1 = Math.max(z1, -q.z); }
  const m = 6;
  shadowCam.left = x0 - m; shadowCam.right = x1 + m; shadowCam.bottom = y0 - m; shadowCam.top = y1 + m;
  shadowCam.near = Math.max(z0 - 60, 1); shadowCam.far = z1 + 20; shadowCam.updateProjectionMatrix();
  const bg = scene.background, ca = renderer.getClearAlpha(); renderer.getClearColor(clearCol);
  scene.background = null; scene.overrideMaterial = depthMat;
  renderer.setRenderTarget(shadowRT); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, shadowCam);
  renderer.setRenderTarget(null); renderer.setClearColor(clearCol, ca);
  scene.overrideMaterial = null; scene.background = bg;
  if (renderer.shadowMap.enabled) {
    sunLight.position.copy(shadowCam.position); sunLight.target.position.copy(c); sunLight.target.updateMatrixWorld();
    const sc3 = sunLight.shadow.camera;
    sc3.left = shadowCam.left; sc3.right = shadowCam.right; sc3.top = shadowCam.top; sc3.bottom = shadowCam.bottom;
    sc3.near = shadowCam.near; sc3.far = shadowCam.far; sc3.updateProjectionMatrix();
  }
  // sky occlusion: the AO casters from straight above, over the ground footprint + 10 m (the AO reach)
  if (qAO !== '0') {
    aoCam.position.set(c.x, AO_TOP, c.z); aoCam.up.set(0, 0, -1); aoCam.lookAt(c.x, 0, c.z); aoCam.updateMatrixWorld();
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of pts) { if (p.y > 1) continue; const q = p.clone().applyMatrix4(aoCam.matrixWorldInverse); a0 = Math.min(a0, q.x); a1 = Math.max(a1, q.x); b0 = Math.min(b0, q.y); b1 = Math.max(b1, q.y); }
    aoCam.left = a0 - 10; aoCam.right = a1 + 10; aoCam.bottom = b0 - 10; aoCam.top = b1 + 10; aoCam.near = 1; aoCam.far = 70; aoCam.updateProjectionMatrix();
    scene.background = null; renderer.setClearColor(0x000000, 0);
    const dbuf = renderer.state.buffers.depth;
    scene.overrideMaterial = aoTopMat; renderer.setRenderTarget(aoRTs[0]); renderer.clear(); renderer.render(scene, aoCam);
    // bottom: keep the farthest (lowest) surface
    scene.overrideMaterial = aoBotMat; renderer.setRenderTarget(aoRTs[1]); dbuf.setClear(0); renderer.clear(); renderer.render(scene, aoCam); dbuf.setClear(1);   // render() auto-clears too
    renderer.setRenderTarget(null); renderer.setClearColor(clearCol, ca);
    scene.overrideMaterial = null; scene.background = bg;
    U.uAOMat.value.multiplyMatrices(aoCam.projectionMatrix, aoCam.matrixWorldInverse);
    U.uAOScale.value.set(aoCam.right - aoCam.left, aoCam.top - aoCam.bottom);
    U.uAOOn.value = 1;
  }
  U.uShadowMat.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
  U.uShadowScale.value.set(shadowCam.right - shadowCam.left, shadowCam.top - shadowCam.bottom, shadowCam.far - shadowCam.near);
  U.uShadowOn.value = 1;
}
// door bulbs: colour follows the door loop (real time) or the story frame; drawn as live area lights + bulb emission
const bulbs = (man.bulbs || []).map((b) => {
  const zm = zoneMat.W, mi = zm ? (man.zones.find((z) => z.zone === 'W').materials || []).findIndex((m) => m.name === b.mat) : -1;
  return { ...b, wp: new THREE.Vector3().fromArray(b.pos), wd: new THREE.Vector3().fromArray(b.dir).normalize(),
    act: b.door ? actByTarget[sanitize(b.door)] : null, emit: mi >= 0 ? zm.uniforms.uEmit.value[mi] : null, col: [0, 0, 0] };
});
function bulbColor(b, frame) {
  const f = b.act && b.loop ? b.loop[0] + b.act.time * TL.fps : frame;
  let k = b.keys[0]; for (const q of b.keys) { if (q[0] <= f) k = q; else break; }
  b.col[0] = k[1]; b.col[1] = k[2]; b.col[2] = k[3];
  if (b.emit) b.emit.set(k[1] * b.strength, k[2] * b.strength, k[3] * b.strength);
}
const POOL_SPOT = 4, POOL_POINT = 4;
const spotPool = Array.from({ length: POOL_SPOT }, () => { const l = new THREE.SpotLight(0xffffff, 0, 0, 0.6, 0.9, 2); scene.add(l, l.target); return l; });
const pointPool = Array.from({ length: POOL_POINT }, () => { const l = new THREE.PointLight(0xffffff, 0, 0, 2); scene.add(l); return l; });
const tmpN = new THREE.Vector3(), tmpQ2 = new THREE.Quaternion();
let tkLightW = 0;
function updateLights() {
  const live = [];
  for (const r of rigs) {
    r.P = r.truck ? tkLightW : r.energy;
    if (r.P <= 0) continue;
    if (r.car && r.car.o.scale.x < 0.3) continue;            // car not built yet
    r.parent.updateWorldMatrix(true, false);
    r.wp.copy(r.local).applyMatrix4(r.parent.matrixWorld);
    r.wd.copy(r.ldir).applyQuaternion(r.parent.getWorldQuaternion(tmpQ2)).normalize();
    tmpN.copy(r.wp).project(cam);
    if (Math.abs(tmpN.x) > 1.5 || Math.abs(tmpN.y) > 1.5) continue;
    r.score = tmpN.x * tmpN.x + tmpN.y * tmpN.y - Math.log10(r.P) * 0.05;
    live.push(r);
  }
  for (const b of bulbs) {
    bulbColor(b, state.frame);
    tmpN.copy(b.wp).project(cam);
    if (Math.abs(tmpN.x) > 1.5 || Math.abs(tmpN.y) > 1.5) continue;
    live.push({ wp: b.wp, wd: b.wd, P: b.energy, color: b.col, spot: null, area: true, cosHalf: 0, blendW: 1, radius: b.radius,
      score: tmpN.x * tmpN.x + tmpN.y * tmpN.y });
  }
  live.sort((a, b) => a.score - b.score);
  const n = Math.min(live.length, Q.lights);
  U.uDLCount.value = n;
  for (let i = 0; i < n; i++) {
    const r = live[i], k = r.P / ((r.area ? 1 : 4) * Math.PI * Math.PI);   // area: Lambertian, I0 = P / pi
    U.uDLPos.value[i].set(r.wp.x, r.wp.y, r.wp.z, r.area ? 2 : r.spot ? 1 : 0);
    U.uDLDir.value[i].set(r.wd.x, r.wd.y, r.wd.z, r.cosHalf);
    U.uDLCol.value[i].set(r.color[0] * k, r.color[1] * k, r.color[2] * k, r.blendW);
    U.uDLRad2.value[i] = r.radius * r.radius;
  }
  let si = 0, pi = 0;
  for (const r of live) {
    if (r.area) continue;
    const I = r.P / (4 * Math.PI);
    if (r.spot && si < POOL_SPOT) {
      const l = spotPool[si++]; l.position.copy(r.wp); l.target.position.copy(r.wp).add(r.wd); l.target.updateMatrixWorld();
      l.angle = r.spot[0] / 2; l.penumbra = r.spot[1]; l.color.setRGB(r.color[0], r.color[1], r.color[2], THREE.LinearSRGBColorSpace); l.intensity = I;
    } else if (!r.spot && pi < POOL_POINT) {
      const l = pointPool[pi++]; l.position.copy(r.wp); l.color.setRGB(r.color[0], r.color[1], r.color[2], THREE.LinearSRGBColorSpace); l.intensity = I;
    }
  }
  for (; si < POOL_SPOT; si++) spotPool[si].intensity = 0;
  for (; pi < POOL_POINT; pi++) pointPool[pi].intensity = 0;
}
console.log('[vorta] first frame ready', Math.round(performance.now()), 'ms');

// ---------- frame state ----------
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), tmpQ = new THREE.Quaternion();
function applyFrame(frame) {
  if (!cityReady && frame > CITY_GATE) frame = CITY_GATE;   // city still streaming in
  const f = Math.min(Math.max(frame, TL.start), TL.end) - TL.start;
  const i = Math.floor(f), t = f - i;
  const a = TL.frames[i], b = TL.frames[Math.min(i + 1, TL.frames.length - 1)];
  const v = (k) => a[FI[k]] + (b[FI[k]] - a[FI[k]]) * t;
  U.uFrame.value = frame;
  window.__state.shown = frame;            // what is actually on screen (city gate applied) -> UI steps follow this
  const EF = man.view && man.view.exposureFrames;
  if (EF) renderer.toneMappingExposure = Math.pow(2, EF[i] + (EF[Math.min(i + 1, EF.length - 1)] - EF[i]) * t);
  if (viewPass) { viewPass.uniforms.uExposure.value = renderer.toneMappingExposure; viewPass.uniforms.uSeed.value = (viewPass.uniforms.uSeed.value + 17.13) % 997; }
  frameCamera(v('ortho'), v('shiftX'), v('shiftY'));
  const ss = v('skyStrength');
  U.uSky.value.set(v('skyR') * ss, v('skyG') * ss, v('skyB') * ss);
  const se = v('sunEnergy') / 5;
  U.uSun.value.set(v('sunR') * se, v('sunG') * se, v('sunB') * se);
  window.__state.sunE = v('sunEnergy');   // day/night -> UI text colour
  U.uLamp.value = THREE.MathUtils.clamp((5 - v('sunEnergy')) / 4.7, 0, 1);
  for (const [zk, u] of Object.entries(zoneWin)) {
    const c = man.windowCurves && man.windowCurves[zk];
    u.value = c === undefined ? 0 : (typeof c === 'number' ? c : c[Math.min(Math.max(Math.round(frame) - TL.start, 0), c.length - 1)]);
  }
  for (const [zk, u] of Object.entries(zoneLamp)) {
    const c = man.lampCurves && man.lampCurves[zk];
    u.value = c === undefined ? U.uLamp.value : (typeof c === 'number' ? c : c[Math.min(Math.max(Math.round(frame) - TL.start, 0), c.length - 1)]);
  }
  U.uTrail.value = v('trail');
  tkLightW = FI.tkLight !== undefined ? v('tkLight') : 0;
  scene.background.setRGB(v('skyR') * Math.min(ss, 1), v('skyG') * Math.min(ss, 1), v('skyB') * Math.min(ss, 1), THREE.LinearSRGBColorSpace);
  U.uSkyCol.value.set(scene.background.r, scene.background.g, scene.background.b);
  U.uGroundCol.value.copy(U.uSky.value).addScaledVector(U.uSun.value, man.terrainFlat ? man.terrainFlat.sun[1] : 1.045).multiply(groundAlb);
  hemi.color.setRGB(v('skyR'), v('skyG'), v('skyB'), THREE.LinearSRGBColorSpace); hemi.intensity = Math.PI * ss;
  // ground half of the hemisphere = light bounced off the lit ground (Cycles lights the truck's sides/underside this way):
  // ground radiance = albedo x (sky + sun) on the lightmap scale, divided by the hemisphere intensity factor
  const gs = 0.5 / Math.max(ss, 1e-3), fs = man.terrainFlat ? man.terrainFlat.sun[1] : 1.045;   // 0.5: the object hides half the lit ground below it (matches Cycles at f420)
  hemi.groundColor.setRGB(groundAlb.x * (U.uSky.value.x + fs * U.uSun.value.x) * gs, groundAlb.y * (U.uSky.value.y + fs * U.uSun.value.y) * gs,
    groundAlb.z * (U.uSky.value.z + fs * U.uSun.value.z) * gs, THREE.LinearSRGBColorSpace);
  sunLight.color.setRGB(v('sunR'), v('sunG'), v('sunB'), THREE.LinearSRGBColorSpace); sunLight.intensity = v('sunEnergy');
  // truck
  tk.position.set(v('truckX'), v('truckY'), v('truckZ'));
  qa.set(a[FI.truckQx], a[FI.truckQy], a[FI.truckQz], a[FI.truckQw]);
  qb.set(b[FI.truckQx], b[FI.truckQy], b[FI.truckQz], b[FI.truckQw]);
  tk.quaternion.slerpQuaternions(qa, qb, t);
  for (const w of wheels) {
    const ang = w.k === 'front' ? v('wheelFront') - man.truck.wheelFrontAtExport : v('wheelRear') - man.truck.wheelRearAtExport;
    const ax = w.k === 'front' ? man.truck.wheelAxisFront : man.truck.wheelAxisRear;
    w.o.quaternion.copy(w.q0).multiply(tmpQ.setFromAxisAngle(axisOf(ax), ang));
  }
  sunLight.position.copy(tk.position).addScaledVector(sunDir, -300);
  sunLight.target.position.copy(tk.position);
  // trail tube reveal
  trailGeo.setDrawRange(0, Math.floor(THREE.MathUtils.clamp(v('trail'), 0, 1) * TUB) * RAD * 6);
  // build-in gates for exported objects
  for (const [o, start, bc, s0] of gated) {
    o.visible = frame >= start;
    if (!bc) continue;
    const k = Math.min(Math.max(frame - start, 0), bc.frames), i = Math.floor(k), u = k - i, j = Math.min(i + 1, bc.frames);
    const xy = bc.xy[i] + (bc.xy[j] - bc.xy[i]) * u, z = bc.z[i] + (bc.z[j] - bc.z[i]) * u;
    o.scale.set(s0.x * Math.max(xy, 1e-3), s0.y * Math.max(z, 1e-3), s0.z * Math.max(xy, 1e-3));   // blender z is three y; never 0 (NaN normals)
  }
  // car roots: build-in pop (the drive itself runs on real time in tmixer)
  for (const c of carPops) {
    const k = frame - c.start;
    let sc = k <= 0 ? 0 : 1;
    if (k > 0 && k < c.s.length - 1) { const i = Math.floor(k), u = k - i; sc = c.s[i] + (c.s[i + 1] - c.s[i]) * u; }
    c.o.scale.setScalar(Math.max(sc, 1e-4));
  }
  if (!DEBUG) document.getElementById('hud').textContent = `frame ${frame.toFixed(1)}${cityReady ? '' : ' · loading city'}`;
}

// ---------- scroll ----------
const state = window.__state || { frame: TL.start };
const qFrame = new URLSearchParams(location.search).get('frame');
if (qFrame !== null) state.frame = +qFrame;            // debug: pin a story frame (?frame=600) instead of scrolling
// (scrolling: ui.js plays frames 1 -> INTRO_END by itself, then scrubs INTRO_END -> STORY_END with the scroll)

// ---------- loop ----------
// ---------- post: linear HDR target (correct blending for glass), Blender's Glare/Bloom, then AgX + sRGB ----------
// Blender compositor: Glare Bloom, threshold 1.8, smoothness 0.6, strength 0.45, size 0.55 (scene-linear, before AgX)
const hdr = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.msaa });
const composer = new EffectComposer(renderer, hdr);
composer.addPass(new RenderPass(scene, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.55, 1.8);
bloom.highPassUniforms.smoothWidth.value = 0.6 * 1.8;
composer.addPass(bloom);
// Blender's colour management, in Blender's order: view curve (Use Curves, scene-linear) -> exposure (keyed per frame) ->
// view transform + display. The view transform is a 3D LUT sampled from Blender's own pipeline on a log2 grid: three's
// analytic AgX is not Blender's (Blender 4+ runs AgX as an OCIO cube over E-Gamut) and was up to 12/255 too bright.
let viewPass = null;
const VC = man.view && man.view.curve, VL = man.view && man.view.lut;
const qView = new URLSearchParams(location.search).get('view');   // debug: ?view=three uses three's AgX OutputPass, ?view=nocurve
const viewLutBuf = await viewLutP;
if (VL && viewLutBuf && qView !== 'three') {
  const h = THREE.DataUtils.toHalfFloat, n = VL.n, src = new Uint16Array(viewLutBuf), lut3 = new Uint16Array(n * n * n * 4);
  for (let i = 0, m = n * n * n; i < m; i++) { lut3[i * 4] = h(src[i * 3] / 65535); lut3[i * 4 + 1] = h(src[i * 3 + 1] / 65535); lut3[i * 4 + 2] = h(src[i * 3 + 2] / 65535); lut3[i * 4 + 3] = h(1); }
  const lutTex3 = new THREE.Data3DTexture(lut3, n, n, n);
  lutTex3.type = THREE.HalfFloatType; lutTex3.format = THREE.RGBAFormat;
  lutTex3.minFilter = lutTex3.magFilter = THREE.LinearFilter; lutTex3.wrapS = lutTex3.wrapT = lutTex3.wrapR = THREE.ClampToEdgeWrapping;
  lutTex3.unpackAlignment = 1; lutTex3.needsUpdate = true;
  const useCurve = !!VC && qView !== 'nocurve', cn = useCurve ? VC.n : 2, clut = new Uint16Array(cn * 4);
  for (let i = 0; i < cn; i++) for (let c = 0; c < 3; c++) clut[i * 4 + c] = THREE.DataUtils.toHalfFloat(useCurve ? VC.lut[c][i] : i / (cn - 1));
  const curveTex = new THREE.DataTexture(clut, cn, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  curveTex.minFilter = curveTex.magFilter = THREE.LinearFilter; curveTex.needsUpdate = true;
  const V3 = (a) => new THREE.Vector3(...a);
  const bw = useCurve ? VC.white.map((w, i) => 1 / Math.max(w - VC.black[i], 1e-5)) : [1, 1, 1];
  viewPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uCurve: { value: curveTex }, uCN: { value: cn }, uLut3: { value: lutTex3 }, uLN: { value: n },
      uLo: { value: V3(useCurve ? VC.slopeLo : [1, 1, 1]) }, uHi: { value: V3(useCurve ? VC.slopeHi : [1, 1, 1]) },
      uL0: { value: V3(useCurve ? VC.lut.map((l) => l[0]) : [0, 0, 0]) }, uL1: { value: V3(useCurve ? VC.lut.map((l) => l[cn - 1]) : [1, 1, 1]) },
      uBlack: { value: V3(useCurve ? VC.black : [0, 0, 0]) }, uBW: { value: V3(bw) },
      uExposure: { value: 1 }, uRange: { value: new THREE.Vector2(VL.lo, VL.hi) }, uDither: { value: (VL.dither || 0) / 255 }, uSeed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp sampler3D;
      uniform sampler2D tDiffuse, uCurve; uniform sampler3D uLut3; uniform float uCN, uLN, uExposure, uDither, uSeed;
      uniform vec3 uLo, uHi, uL0, uL1, uBlack, uBW; uniform vec2 uRange; varying vec2 vUv;
      float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main() {
        vec3 x = (texture2D(tDiffuse, vUv).rgb - uBlack) * uBW;
        vec3 u = clamp(x, 0.0, 1.0) * ((uCN - 1.0) / uCN) + 0.5 / uCN;
        vec3 y = vec3(texture2D(uCurve, vec2(u.r, 0.5)).r, texture2D(uCurve, vec2(u.g, 0.5)).g, texture2D(uCurve, vec2(u.b, 0.5)).b);
        y = mix(y, uL0 + x * uLo, vec3(lessThan(x, vec3(0.0))));
        y = mix(y, uL1 + (x - 1.0) * uHi, vec3(greaterThan(x, vec3(1.0))));
        y *= uExposure;
        vec3 t = clamp((log2(max(y, vec3(1e-10))) - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0);
        vec3 d = texture(uLut3, t * ((uLN - 1.0) / uLN) + 0.5 / uLN).rgb;
        d += (h12(gl_FragCoord.xy + uSeed) - 0.5) * uDither;   // Blender render dither
        gl_FragColor = vec4(clamp(d, 0.0, 1.0), 1.0);
      }`,
  });
  composer.addPass(viewPass);
} else composer.addPass(new OutputPass());
const qBloom = new URLSearchParams(location.search).get('bloom');   // debug: ?bloom=0 disables, ?bloom=0.6,0.5,1.8 = strength,radius,threshold
if (qBloom !== null) { const [st, ra, th] = qBloom.split(',').map(Number); bloom.enabled = st > 0; bloom.strength = st; if (ra >= 0) bloom.radius = ra; if (th >= 0) bloom.threshold = th; }
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(Math.round(window.innerWidth * renderer.getPixelRatio() * Q.bloomScale), Math.round(window.innerHeight * renderer.getPixelRatio() * Q.bloomScale));
}
window.addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
const qT = +(new URLSearchParams(location.search).get('t') || 0);   // debug: ?t=30 starts the real-time loops 30 s in
if (qT) { mixer.update(qT); tmixer.update(qT); U.uTime.value += qT; }
let warmFrames = 0;
// adaptive resolution: if frames run slower than ~50 fps for a while, step the pixel ratio down (never below 1)
const perf = { acc: 0, n: 0, skip: 90, dpr: renderer.getPixelRatio() };
function adapt(raw) {
  if (perf.skip > 0 || uploadQueue.length) { perf.skip--; return; }   // ignore warm-up and upload frames
  perf.acc += raw; perf.n++;
  if (perf.n < 40) return;
  const avg = perf.acc / perf.n; perf.acc = perf.n = 0;
  if (avg > 1 / 50 && perf.dpr > 1) {
    perf.dpr = Math.max(1, +(perf.dpr - 0.25).toFixed(2));
    renderer.setPixelRatio(perf.dpr); resize(); perf.skip = 30;
    console.log('[vorta] adaptive pixel ratio ->', perf.dpr, `(avg ${(avg * 1000).toFixed(1)} ms)`);
  }
}
const qP = new URLSearchParams(location.search);
const SKIP = Math.max(1, +(qP.get('skip') || 1));   // shadow + AO refresh every frame (stale ones made the contact shadow trail the truck); ?skip=2 to halve the cost
let frameNo = 0, hudAcc = 0, hudN = 0, hudMax = 0, hudT = 0;
function perfHud(raw, cpu) {
  hudAcc += raw; hudN++; hudMax = Math.max(hudMax, raw); hudT += raw;
  if (hudT < 0.5) return;
  const i = renderer.info.render;
  document.getElementById('hud').textContent = `frame ${(window.__state.shown ?? window.__state.frame).toFixed(0)} · ${(hudN / hudAcc).toFixed(0)} fps · avg ${(hudAcc / hudN * 1000).toFixed(1)} ms · worst ${(hudMax * 1000).toFixed(0)} ms · cpu ${cpu.toFixed(1)} ms · ${i.calls} calls · ${(i.triangles / 1000).toFixed(0)}k tris · dpr ${renderer.getPixelRatio()}`;
  hudAcc = hudN = hudMax = hudT = 0; renderer.info.reset();
}
const FPS_CAP = +(qP.get('fps') || 60), MIN_MS = 1000 / FPS_CAP - 1.5;   // steady 60 beats a wobbling 90 on 120Hz screens; ?fps=120 to uncap
let lastT = 0;
renderer.setAnimationLoop((now) => {
  if (FPS_CAP < 120 && now - lastT < MIN_MS) return;   // skip this display refresh, keep the cadence even
  lastT = now;
  const raw = clock.getDelta(), dt = Math.min(raw, 0.1);
  // hidden behind the loader: after two warm-up frames don't spend GPU / main thread (keeps the loader smooth)
  if ((window.__hold3D && warmFrames >= 2) || window.__offscreen) return;   // behind the loader, or scrolled past the hero
  warmFrames++;
  if (uploadQueue.length) { renderer.initTexture(uploadQueue.shift()); if (!uploadQueue.length && uploadDone) uploadDone(); }
  else if (uploadDone && !cityReady) uploadDone();
  if (!window.__hold3D) adapt(raw);
  U.uTime.value += dt;
  mixer.update(dt);
  tmixer.update(dt);
  applyIntro(U.uTime.value);
  applyFrame(state.frame);
  if (CS) U.uCloudParams.value.set(CS.z, CS.vel[0] * U.uTime.value, CS.vel[1] * U.uTime.value);
  updateFades(U.uTime.value);
  updateSignals(state.frame, U.uTime.value);
  updateLights();
  // shadow + sky-occlusion are 3 extra scene passes: refresh them every SKIP-th frame (the maps and their matrices stay paired)
  if (DEBUG) renderer.info.autoReset = false;
  const doShadow = (frameNo++ % SKIP) === 0;
  renderer.shadowMap.autoUpdate = doShadow;
  if (doShadow) renderShadow();
  const t0 = performance.now();
  composer.render(dt);
  if (DEBUG) perfHud(raw, performance.now() - t0);
});
window.__vorta = { scene, cam, man, state, bloom, composer, TIER, U, aoRTs, aoCam, aoTopMat, aoBotMat };
window.__ready = true;
// upload the first-frame textures + compile programs while the loader sits still (the city streams in later)
async function warm3D() {
  sceneTextures().forEach((t) => renderer.initTexture(t));
  if (renderer.compileAsync) await renderer.compileAsync(scene, cam);
  applyFrame(state.frame); renderShadow(); composer.render(0);
}
startExperience({ state, pinned: qFrame !== null, warm: warm3D });
