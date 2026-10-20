// Glass zones (BK_GLASS_*): faces split off the bake meshes. No lightmaps: lit live with the timeline sky/sun.
//  - opaque glass (City_Glass, Clay_Glass): Principled, transmission 0 in Blender -> diffuse + fresnel sky reflection,
//    City_Glass also glows teal when its building's lights come on (object-colour rig, same as City_Window)
//  - clear glass (Farm_Glass, the glasshouse): see-through, fresnel glossy + faint emission, drawn after opaque
// Same vertex shader as the zones (build-in pop, light-on timing, world position).
export const glassFragment = /* glsl */`
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunDir;      // towards the sun
uniform vec3 uViewDir;     // towards the (orthographic) camera
uniform vec3 uSkyCol;      // sky seen in reflections
uniform vec3 uGroundCol;   // lit ground seen in reflections
uniform float uSunScale;   // baked sun value per unit n.l (keeps glass on the same scale as the lightmaps)
uniform float uLamp;
uniform vec3 uTint;          // clear glass transmission tint
uniform vec3 uAlbedo[64];
uniform vec3 uEmit[64];
uniform float uObjColor[64];
uniform float uEmitBase[64];
uniform float uClear[64];
uniform float uRough[64];
uniform float uSpec[64];
varying vec2 vUv;
varying float vMat;
varying float vTrailU;
varying float vLight;
varying vec3 vWorld;
vec3 env(vec3 r, float rough) {
  vec3 hor = uSkyCol * 1.35 + vec3(0.02);
  vec3 up = mix(hor, uSkyCol, smoothstep(0.0, 0.75, r.y));
  float w = 0.06 + rough * 0.6;
  return mix(uGroundCol, up, smoothstep(-w, w, r.y));
}
void main() {
  int m = int(vMat + 0.5);
#if defined(CLEAR_MUL) || defined(CLEAR_ADD)
  if (uClear[m] < 0.5) discard;
#else
  if (uClear[m] > 0.5) discard;
#endif
  vec3 nc = cross(dFdx(vWorld), dFdy(vWorld)); float nl2 = dot(nc, nc);
  vec3 n = nl2 > 1e-24 ? nc * inversesqrt(nl2) : vec3(0.0, 1.0, 0.0);   // squashed while popping: avoid NaN
  vec3 V = normalize(uViewDir);
  if (dot(n, V) < 0.0) n = -n;
  float cv = clamp(dot(n, V), 0.0, 1.0);
  float ro = uRough[m];
  vec3 r = reflect(-V, n);
  vec3 spec = env(r, ro) + uSun * pow(max(dot(r, uSunDir), 0.0), mix(600.0, 24.0, ro)) * (1.0 - ro) * 3.0;
  float e = uObjColor[m] > 0.5 ? (vLight < 0.0 ? 1.0 : mix(uEmitBase[m], 1.0, vLight)) : 1.0;
  vec3 em = uEmit[m] * e;
#if defined(CLEAR_MUL) || defined(CLEAR_ADD)
  // Farm_Glass: front = mix(Glass BSDF, Glossy, fresnel(1.45) x 2.2) + faint emission; back faces fully transparent
  float F0 = 0.034;
  float Fc = clamp((F0 + (1.0 - F0) * pow(1.0 - cv, 5.0)) * 2.2, 0.0, 1.0);
#ifdef CLEAR_MUL
  gl_FragColor = vec4(mix(vec3(1.0), uTint, 1.0) * (1.0 - Fc), 1.0);   // transmitted: dst x tint x (1 - glossy share)
  return;
#else
  gl_FragColor = vec4(uAlbedo[m] * spec * Fc + em, 1.0);               // added: glossy reflection + emission
#endif
#else
  float F0 = 0.08 * uSpec[m];
  float F = F0 + (1.0 - F0) * pow(1.0 - cv, 5.0);
  // diffuse on the lightmap scale: sky (half hemisphere on walls + ground bounce) + direct sun + sunlit-ground bounce
  float up = max(n.y, 0.0);
  vec3 Ld = uSky * (0.62 + 0.38 * n.y) + uSun * (uSunScale * max(dot(n, uSunDir), 0.0) + 0.35 * (1.0 - up));
  gl_FragColor = vec4(uAlbedo[m] * Ld * (1.0 - F) + spec * F + em, 1.0);
#endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// opaque glass casts sun shadows on the live objects (Farm_Glass is shadow-transparent in Blender -> skipped)
export const glassDepthFragment = /* glsl */`
#include <packing>
uniform float uClear[64];
varying float vMat;
void main() { if (uClear[int(vMat + 0.5)] > 0.5) discard; gl_FragColor = packDepthToRGBA(gl_FragCoord.z); }`;
