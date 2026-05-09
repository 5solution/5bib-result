'use client';

import * as React from 'react';

/**
 * WebGL hero canvas — custom GLSL fragment shader rendering animated
 * gradient noise (FBM) with brand colours. Mouse-reactive distortion +
 * scroll-driven displacement. ~60fps on M1, falls back to static gradient
 * on machines without WebGL.
 *
 * Shader is plain WebGL2 (no Three.js) for minimum bundle weight on
 * the hero — we use Three.js for richer scenes elsewhere.
 */

const VERT = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// FBM (fractal brownian motion) noise → animated gradient with brand colors.
const FRAG = `#version 300 es
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;
uniform float u_scroll;

out vec4 fragColor;

// 2D simplex-ish noise
vec2 hash(vec2 p) {
  p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453);
}
float noise(in vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x+p.y)*K1);
  vec2 a = p - i + (i.x+i.y)*K2;
  float m = step(a.y,a.x);
  vec2 o = vec2(m, 1.0-m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0*K2;
  vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  vec3 n = h*h*h*h * vec3(dot(a, hash(i+0.0)), dot(b, hash(i+o)), dot(c, hash(i+1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p  = (gl_FragCoord.xy - 0.5*u_res.xy) / min(u_res.x, u_res.y);

  // Mouse-reactive offset
  vec2 mouseN = (u_mouse / u_res - 0.5);
  vec2 q = p + mouseN * 0.25;

  float t = u_time * 0.06 + u_scroll * 0.0008;

  // Layered noise → flowing field
  float n1 = fbm(q * 1.4 + vec2(t, -t * 0.7));
  float n2 = fbm(q * 2.1 + vec2(-t * 0.5, t * 1.1) + n1);
  float n  = (n1 + n2 * 0.6);

  // Brand palette
  vec3 navy    = vec3(0.024, 0.031, 0.094);   // #060818
  vec3 deep    = vec3(0.008, 0.012, 0.039);   // #02030A
  vec3 blue    = vec3(0.114, 0.286, 1.000);   // #1D49FF
  vec3 magenta = vec3(1.000, 0.055, 0.396);   // #FF0E65

  // Mix blue ↔ magenta along noise field
  float mixA = smoothstep(-0.6, 0.7, n);
  float mixB = smoothstep(0.0,  1.4, n + n1*0.5);

  vec3 col = mix(navy, blue * 0.55, mixA);
  col = mix(col, magenta * 0.45, mixB * 0.6);
  col = mix(col, deep, smoothstep(0.7, 1.0, length(p)*0.7));

  // Subtle film grain
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)) + u_time) * 43758.5453);
  col += (grain - 0.5) * 0.03;

  // Vignette
  float vig = 1.0 - smoothstep(0.5, 1.4, length(p));
  col *= 0.55 + vig * 0.6;

  fragColor = vec4(col, 1.0);
}
`;

export function S2HeroCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true }) as WebGL2RenderingContext | null;
    if (!gl) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('Shader compile error:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Program link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    const uScroll = gl.getUniformLocation(prog, 'u_scroll');

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let mxLerp = mx;
    let myLerp = my;
    let scrollY = 0;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    const onScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      mxLerp += (mx - mxLerp) * 0.06;
      myLerp += (my - myLerp) * 0.06;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, mxLerp * (canvas.width / window.innerWidth), (window.innerHeight - myLerp) * (canvas.height / window.innerHeight));
      gl.uniform1f(uScroll, scrollY);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={canvasRef} className="s2-hero-canvas" aria-hidden="true" />;
}
