export const zoneVertex = /* glsl */`
attribute float mat;
attribute float objid;
attribute float trailu;
uniform sampler2D uObj;
uniform sampler2D uBuild;
uniform float uBuildN;
uniform float uFrame;
uniform float uTime;
varying vec2 vUv;
varying float vMat;
varying float vTrailU;
varying float vLight;
varying vec3 vWorld;
#ifdef TERRAIN_STYLE
attribute vec3 bary;
varying vec3 vBary;
#endif
void main() {
  int id = int(objid + 0.5);
  vec4 o0 = texelFetch(uObj, ivec2(id, 0), 0);   // pivot.xyz, buildStart
  vec4 o1 = texelFetch(uObj, ivec2(id, 1), 0);   // buildVariant, lightStart, lightEnd, swayAmp
  vec4 o2 = texelFetch(uObj, ivec2(id, 2), 0);   // swayPeriod, swayPhase
  vec3 piv = o0.xyz;
  vec3 p = position - piv;
  vec2 s = vec2(1.0);
  float dz = 0.0;
  if (o0.w >= 0.0) {
    float t = uFrame - o0.w;
    if (t < 0.0) s = vec2(0.0);
    else if (o1.x < 1.5 && t < uBuildN) s = texelFetch(uBuild, ivec2(int(t), o1.x < 0.5 ? 0 : 1), 0).rg;
    else if (o1.x > 3.5 && o1.x < 4.5) {   // DROP_IN (variant 4): hidden on the key frame like Blender, then the per-frame curve, interpolated
      if (t < 1.0) s = vec2(0.0);
      else if (t < uBuildN) {
        int i = int(t);
        vec3 b = mix(texelFetch(uBuild, ivec2(i, 2), 0).rgb, texelFetch(uBuild, ivec2(i + 1, 2), 0).rgb, fract(t));
        s = b.rg; dz = b.b;
      }
    }
  }
  p = vec3(p.x * s.x, p.y * s.y + dz, p.z * s.x);
  if (o1.w > 0.0) {
    float w = 6.28318 * uTime * 24.0 / max(o2.x, 1.0);
    float a = o1.w * sin(w + o2.y);
    float b = o1.w * 0.6 * sin(w * 0.83 + o2.y * 1.7);
    p = vec3(p.x, p.y * cos(a) - p.z * sin(a), p.y * sin(a) + p.z * cos(a));
    p = vec3(p.x * cos(b) - p.y * sin(b), p.x * sin(b) + p.y * cos(b), p.z);
  }
  vLight = o1.y >= 0.0 ? smoothstep(o1.y, max(o1.z, o1.y + 0.001), uFrame) : -1.0;
  vUv = uv; vMat = mat; vTrailU = trailu; vWorld = piv + p;
#ifdef TERRAIN_STYLE
  vBary = bary;
#endif
  gl_Position = projectionMatrix * modelViewMatrix * vec4(piv + p, 1.0);
}`;

export const zoneFragment = /* glsl */`
uniform sampler2D lmSky;
uniform sampler2D lmSun;
uniform sampler2D lmLamps;
uniform sampler2D lmTrail;
#ifdef HAS_WINDOWS
uniform sampler2D lmWin;     // light spilled by lit windows / glows (baked at full light-on)
uniform float lmScaleW;
uniform float uWin;         // share of the zone's window area lit now (manifest.windowCurves)
#endif
uniform vec4 lmScale;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uTrailColor;
uniform float uLamp;
uniform float uTrail;
uniform vec3 uAlbedo[64];
uniform vec3 uEmit[64];
uniform float uObjColor[64];
uniform float uGlass[64];
#ifdef FLAT_RECT
uniform vec4 uFlatRect;   // three x0,x1,z0,z1 of the city plates
uniform vec3 uFlatSky;
uniform vec3 uFlatSun;
#endif
varying vec3 vWorld;
#ifdef TERRAIN_STYLE
// Blender Terrain_Wire: colour by height + screen-space wireframe on the slopes (flat ground = Clay_Ground colour)
uniform vec3 uTerrA;
uniform vec3 uTerrB;
uniform vec3 uWireCol;
uniform vec4 uTerrMap;   // fromMin, fromMax, k, wire px
varying vec3 vBary;
#endif
// dynamic lights (truck/car headlights, forklift lamps): Cycles units, L += P cos / (4 pi^2 d^2) = col.rgb * cos / d^2
#define MAX_DL 16
uniform int uDLCount;
uniform vec4 uDLPos[MAX_DL];   // xyz world, w = 1 spot / 0 point
uniform vec4 uDLDir[MAX_DL];   // xyz spot axis, w = cos(half angle)
uniform vec4 uDLCol[MAX_DL];   // rgb = colour * P / (4 pi^2), w = blend width (1 - cosHalf) * blend
uniform float uDLRad2[MAX_DL]; // soft radius^2
// sun shadows of the moving objects (truck, cars, workers, forklift, loops): darken only the sun term
#include <packing>
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowTexel;
uniform float uShadowFloor;   // share of the baked sun term that is bounce light and survives in shadow
uniform float uShadowOn;
uniform vec3 uShadowScale;   // metres per shadow-map UV (x, y) and depth range (m)
uniform float uPenumbra;     // 2 tan(sun angle / 2): Blender's 16 deg sun -> soft, distance-dependent edges
float sDepth(vec2 uv) { return unpackRGBAToDepth(texture2D(uShadowMap, uv)); }
float sunVis() {
  if (uShadowOn < 0.5) return 1.0;
  vec4 sp = uShadowMat * vec4(vWorld, 1.0);
  vec3 p = sp.xyz / sp.w * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  // blocker search (PCSS): average depth of casters within ~1.5 m
  vec2 sr = vec2(0.75) / uShadowScale.xy;
  float bsum = 0.0, bn = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    float d = sDepth(p.xy + vec2(float(i), float(j)) * sr);
    if (d < p.z - 0.0004) { bsum += d; bn += 1.0; }
  }
  if (bn < 0.5) return 1.0;
  float w = clamp((p.z - bsum / bn) * uShadowScale.z * uPenumbra, 0.05, 2.5);   // penumbra width (m)
  vec2 r = vec2(w * 0.25) / uShadowScale.xy;
  float vis = 0.0;
#ifdef LOW_TIER
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) vis += (p.z - 0.0004 > sDepth(p.xy + vec2(float(i), float(j)) * r * 2.0)) ? 0.0 : 1.0;
  return mix(uShadowFloor, 1.0, vis / 9.0);
#else
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) vis += (p.z - 0.0004 > sDepth(p.xy + vec2(float(i), float(j)) * r)) ? 0.0 : 1.0;
  return mix(uShadowFloor, 1.0, vis / 25.0);
#endif
}
// cloud shadows: transmission mask of Blender's Cloud_* planes, hit by the sun ray at cloud height, drifting on real time
uniform sampler2D uCloudMap;
uniform vec4 uCloudRect;     // blender x0, y0, W, H
uniform vec3 uCloudParams;   // cloud height (m), drift x, drift y (blender)
uniform float uCloudOn;
uniform vec3 uSunDir;
float cloudT() {
  if (uCloudOn < 0.5) return 1.0;
  vec3 q = vWorld + uSunDir * ((uCloudParams.x - vWorld.y) / max(uSunDir.y, 0.05));
  vec2 b = vec2(q.x, -q.z) - uCloudParams.yz;
  return texture2D(uCloudMap, (b - uCloudRect.xy) / uCloudRect.zw).r;
}
// sky occlusion by the moving ground objects (truck, cars, forklift, workers): in Cycles they hide part of the sky from
// the ground around them (contact darkening, deeper shadows). Horizon-based AO over two top-down maps of those casters:
// top and bottom height (r = height x coverage, g = coverage), so a truck body is a slab with clearance under it.
uniform sampler2D uAOTop;
uniform sampler2D uAOBot;
uniform mat4 uAOMat;       // world -> AO clip (orthographic, looking straight down)
uniform vec2 uAOScale;     // metres per AO uv (x, y)
uniform float uAOOn;
uniform float uFallback;   // debug ?fallback=0
float s2(float dh, float d) { float t = max(dh, 0.0) / d; return t * t / (1.0 + t * t); }   // sin^2 of the elevation
float skyVis(float up) {
  if (uAOOn < 0.5 || up < 0.2) return 1.0;
  vec4 sp = uAOMat * vec4(vWorld, 1.0);
  vec2 c = sp.xy / sp.w * 0.5 + 0.5;
  if (c.x <= 0.0 || c.x >= 1.0 || c.y <= 0.0 || c.y >= 1.0) return 1.0;
  if (textureLod(uAOTop, c, 6.0).g < 0.0005) return 1.0;   // no caster within ~6 m (mip 6 of the coverage): skip
#ifdef LOW_TIER
  const int DIRS = 5; const int STEPS = 3; const float GROW = 2.6;
#else
  const int DIRS = 10; const int STEPS = 5; const float GROW = 1.8;
#endif
  ivec2 fc = ivec2(gl_FragCoord.xy) & 1;   // 2x2 Bayer rotation: fine, stable dither instead of grain
  float jit = (float(fc.x * 2 + fc.y) * 0.25 + float(fc.x) * 0.125 + 0.0625);
  float occ = 0.0;
  for (int i = 0; i < DIRS; i++) {
    float a = 6.2831853 * (float(i) + jit) / float(DIRS);
    vec2 dir = vec2(cos(a), sin(a)) / uAOScale;
    float o = 0.0;
    for (int j = 0; j < STEPS; j++) {
      float d = 0.4 * pow(GROW, float(j)) * (0.9 + 0.2 * jit);   // ~0.4 .. 4.2 m (desktop)
      vec2 uv = c + dir * d;
      vec2 tp = textureLod(uAOTop, uv, 0.0).rg, bt = textureLod(uAOBot, uv, 0.0).rg;
      if (tp.g < 0.02) continue;
      float y0 = bt.g > 0.02 ? bt.r / bt.g : tp.r / tp.g;
      o = max(o, (s2(tp.r / tp.g - vWorld.y, d) - s2(y0 - vWorld.y, d)) * min(tp.g, 1.0));
    }
    occ += o;
  }
  return 1.0 - up * min(occ / float(DIRS), 0.85);
}
varying vec2 vUv;
varying float vMat;
varying float vTrailU;
varying float vLight;
vec3 dec(sampler2D t, float s) { return pow(texture2D(t, vUv).rgb, vec3(2.2)) * s; }
#ifdef HAS_CLEAN
// terrain: clean bake (no build-in occluders) until the objects shadowing this spot have popped in (build map)
uniform sampler2D lmSkyC;
uniform sampler2D lmSunC;
uniform vec2 lmScaleC;
uniform sampler2D uBuildMap;
uniform vec4 uBuildRect;   // blender x0, y0, W, H
uniform float uBuildFade;
uniform float uFrame;
#endif
// face normal from screen derivatives. Guarded: while a build-in pops, its triangles are squashed to slivers whose
// derivatives can be parallel or zero -> normalize(0) = NaN, and the bloom blur smears one NaN pixel into huge black blocks
vec3 faceN() { vec3 c = cross(dFdx(vWorld), dFdy(vWorld)); float l2 = dot(c, c); return l2 > 1e-24 ? c * inversesqrt(l2) : vec3(0.0, 1.0, 0.0); }
void main() {
  int m = int(vMat + 0.5);
  vec3 sk = dec(lmSky, lmScale.x);
  vec3 su = dec(lmSun, lmScale.y);
#ifdef HAS_CLEAN
  vec4 bm = texture2D(uBuildMap, vec2((vWorld.x - uBuildRect.x) / uBuildRect.z, (-vWorld.z - uBuildRect.y) / uBuildRect.w));
  float bstart = floor(bm.r * 255.0 + 0.5) * 256.0 + floor(bm.g * 255.0 + 0.5);
  float bw = bstart < 0.5 ? 1.0 : clamp((uFrame - bstart) / uBuildFade, 0.0, 1.0);
  if (bw < 1.0) { sk = mix(dec(lmSkyC, lmScaleC.x), sk, bw); su = mix(dec(lmSunC, lmScaleC.y), su, bw); }
#endif
  // moving-object shadows remove only the DIRECT sun (Blender sun, 5 W/m2 at bake time: E/pi = 5/pi cos); the bounce part
  // of the baked sun term stays (on open ground it is ~1%, so shadows go as deep as in Cycles)
  vec3 fn = faceN();
  vec3 ind = max(su - vec3(1.5915494 * max(dot(fn, uSunDir), 0.0)), vec3(0.0));
  vec3 L = sk * uSky * skyVis(abs(fn.y)) + mix(ind, su, sunVis() * cloudT()) * uSun;
  // texels the bake never reached (slivers thinner than a lightmap texel) come out pure black: fall back to flat light
  if (uFallback > 0.5 && max(sk.r, max(sk.g, sk.b)) < 0.004) L = uSky * 0.75 + uSun * 0.5;
#ifdef HAS_LAMPS
  L += dec(lmLamps, lmScale.z) * uLamp;
#endif
#ifdef HAS_WINDOWS
  L += dec(lmWin, lmScaleW) * uWin;
#endif
#ifdef HAS_TRAIL
  float rev = 1.0 - smoothstep(uTrail - 0.01, uTrail + 0.002, vTrailU);
  L += dec(lmTrail, lmScale.w).r * uTrailColor * rev;
#endif
#ifdef FLAT_RECT
  // terrain under the city: the bake saw the city on top of it; light it as open ground (the plates cover it once built)
  if (all(greaterThan(vWorld.xz, uFlatRect.xz)) && all(lessThan(vWorld.xz, uFlatRect.yw))) L = uFlatSky * uSky + uFlatSun * uSun;
#endif
  if (uDLCount > 0) {
    vec3 nrm = fn;
    for (int i = 0; i < MAX_DL; i++) {
      if (i >= uDLCount) break;
      vec3 dv = uDLPos[i].xyz - vWorld;
      float d2 = dot(dv, dv);
      vec3 l = dv * inversesqrt(max(d2, 1e-4));
      float c = max(dot(nrm, l), 0.0);
      float mask = 1.0;
      if (uDLPos[i].w > 1.5) mask = max(dot(-l, uDLDir[i].xyz), 0.0);   // area light: Lambertian emitter
      else if (uDLPos[i].w > 0.5) mask = smoothstep(0.0, 1.0, (dot(-l, uDLDir[i].xyz) - uDLDir[i].w) / max(uDLCol[i].w, 1e-4));
      L += uDLCol[i].rgb * (c * mask / (d2 + uDLRad2[i]));
    }
  }
  if (uGlass[m] > 0.5) L = uSky * 0.55 + uSun * 0.35;   // glass: no diffuse bake, tint by the sky
  float e = uObjColor[m] > 0.5 ? (vLight < 0.0 ? 1.0 : vLight) : 1.0;   // no light-on keys = white object colour = on (Blender)
  vec3 alb = uAlbedo[m];
#ifdef TERRAIN_STYLE
  float th = clamp((vWorld.y - uTerrMap.x) / (uTerrMap.y - uTerrMap.x), 0.0, 1.0);
  alb = mix(uTerrA, uTerrB, th * uTerrMap.z);
  vec3 fw = fwidth(vBary) * uTerrMap.w * 0.5;
  vec3 eb = smoothstep(fw * 0.5, fw * 1.5, vBary);
  alb = mix(alb, uWireCol, (1.0 - min(min(eb.x, eb.y), eb.z)) * th);
#endif
  vec3 col = alb * L + uEmit[m] * e;
  gl_FragColor = vec4(clamp(col, 0.0, 60000.0), 1.0);   // never hand NaN/Inf to the half-float target (bloom spreads it)
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// depth for three's sun shadow map (RGBA packed like MeshDepthMaterial), so zone geometry shadows the live-lit objects
// with the same build-in pop / sway as it is drawn
export const zoneDepthFragment = /* glsl */`
#include <packing>
void main() { gl_FragColor = packDepthToRGBA(gl_FragCoord.z); }`;
