// Fundo dithered "B sutil" (React Bits Dither), portado do protótipo aprovado
// docs/superpowers/specs/assets/redesign-visual/7-fundo-dithered.html (primeiro quadro).

/** Calibragem escolhida pelo usuário: 4 tons, pixel fino (2 px CSS), intensidade "sutil" e 60% da velocidade. */
export const PARAMETROS_DITHERED = { tons: 4, pixel: 2, intensidade: 0.6, velocidade: 0.6 } as const

const PALETAS = {
  dark: ["#0a0a0b", "#120b07", "#4a1f08", "#9a420e"],
  light: ["#f7f6f3", "#f2e9e0", "#ead2bd", "#dba57c"],
} as const

/** Rampa de 4 cores do tema, do fundo até o tom mais forte. */
export function paletaDithered(tema: "dark" | "light"): readonly [string, string, string, string] {
  return PALETAS[tema]
}

/** "#rrggbb" → [r, g, b] entre 0 e 1, para os uniforms do shader. */
export function rgbNormalizado(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const SHADER_VERTICE = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0., 1.); }`

export const SHADER_FRAGMENTO = `#version 300 es
precision highp float;
uniform vec2 res; uniform float tt; uniform float vel; uniform vec2 mouse; uniform float mAtivo;
uniform float px; uniform float niveis; uniform float forca; uniform float limpa;
uniform vec3 c0; uniform vec3 c2; uniform vec3 c3;
out vec4 cor;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * ruido(p); p *= 2.02; a *= .5; } return v; }
// Matriz de Bayer 8x8 por bits.
float bay(vec2 c) {
  ivec2 p = ivec2(mod(c, 8.)); int x = p.x, y = p.y, xy = x ^ y;
  int v = ((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) | ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2);
  return (float(v) + .5) / 64.;
}
void main() {
  float t = tt * vel;
  vec2 celula = floor(gl_FragCoord.xy / px);
  vec2 uv = (celula * px + px * .5) / res; float asp = res.x / res.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  vec2 w = q * 2.4; vec2 o = vec2(fbm(w + t * .05), fbm(w + vec2(5.2, 1.3) - t * .04));
  float v = fbm(w + 2.2 * o + t * .03);
  v = smoothstep(.3, .85, v) * (0.25 + 0.6 * (1. - uv.y));
  vec2 m = mouse / res; float dm = length((uv - m) * vec2(asp, 1.));
  v -= exp(-dm * dm * 28.) * mAtivo * .9;
  float centro = length((uv - vec2(.5, .56)) * vec2(1., 1.5));
  v *= mix(1., mix(.06, 1., smoothstep(.14, .62, centro)), limpa);
  v = clamp(v * forca, 0., 1.);
  float n = niveis - 1.; float nivel = floor(v * n + bay(celula)) / n;
  vec3 rampa = nivel < .5 ? mix(c0, c2, nivel * 2.) : mix(c2, c3, (nivel - .5) * 2.);
  cor = vec4(rampa, 1.);
}`
