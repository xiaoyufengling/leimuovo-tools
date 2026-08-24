type BloomUniforms = {
  time: WebGLUniformLocation;
  explode: WebGLUniformLocation;
  bounce: WebGLUniformLocation;
  pointer: WebGLUniformLocation;
  aspect: WebGLUniformLocation;
  pointScale: WebGLUniformLocation;
  ice: WebGLUniformLocation;
  blue: WebGLUniformLocation;
  pink: WebGLUniformLocation;
};

const VERTEX_SHADER = `
  precision highp float;
  attribute vec3 a_position;
  attribute float a_seed;
  attribute float a_tint;
  uniform float u_time;
  uniform float u_explode;
  uniform float u_bounce;
  uniform vec2 u_pointer;
  uniform float u_aspect;
  uniform float u_point_scale;
  varying float v_tint;
  varying float v_alpha;

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec3 point = a_position;
    float seedAngle = a_seed * 6.28318530718;
    vec3 direction = normalize(point + vec3(cos(seedAngle), sin(seedAngle * 1.7), sin(seedAngle)) * 0.42);
    point += direction * u_explode * (0.62 + fract(a_seed * 41.73) * 0.82);
    point *= 1.0 + u_bounce;

    float breathe = 1.0 + sin(u_time * 0.82 + seedAngle) * 0.014;
    point *= breathe;
    point.xz = rotate2d(u_time * 0.075 + u_pointer.x * 0.34) * point.xz;
    point.yz = rotate2d(-0.12 + u_pointer.y * 0.2) * point.yz;

    float depth = max(2.35, 4.05 - point.z);
    float perspective = 2.48 / depth;
    gl_Position = vec4(point.x * perspective / u_aspect, point.y * perspective, 0.0, 1.0);
    gl_PointSize = (1.35 + a_tint * 1.7) * u_point_scale * perspective;
    v_tint = a_tint;
    v_alpha = clamp(1.15 - depth * 0.13, 0.48, 0.92);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 u_ice;
  uniform vec3 u_blue;
  uniform vec3 u_pink;
  varying float v_tint;
  varying float v_alpha;

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float radius = dot(point, point);
    if (radius > 1.0) discard;
    float alpha = smoothstep(1.0, 0.08, radius) * v_alpha;
    vec3 cool = mix(u_ice, u_blue, smoothstep(0.18, 0.78, v_tint));
    vec3 color = mix(cool, u_pink, smoothstep(0.86, 1.0, v_tint) * 0.38);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create particle shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Particle shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create particle program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Particle program link failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number): number {
  const first = Math.max(0.0001, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
}

function createBloomGeometry(count: number): { positions: Float32Array; seeds: Float32Array; tints: Float32Array } {
  const random = mulberry32(0x72656d6f);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const tints = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const group = random();
    let x = 0;
    let y = 0;
    let z = 0;
    let tint = random() * 0.72;

    if (group < 0.82) {
      const layer = Math.floor(random() * 7);
      const theta = random() * Math.PI * 2;
      const radius = Math.pow(random(), 0.58) * (0.34 + layer * 0.115);
      const petal = 1 + Math.cos(theta * (7 + (layer % 2)) + layer * 0.72) * (0.08 + layer * 0.012);
      const softness = gaussian(random) * 0.035;
      x = Math.cos(theta) * radius * petal * 1.12 + softness;
      z = Math.sin(theta) * radius * petal * 0.62 + gaussian(random) * 0.045;
      y = 0.35 + (1 - radius * radius) * 0.46 + Math.sin(theta * 7 + layer) * 0.055 + (layer - 3) * 0.026 + softness;
      tint = Math.min(1, 0.12 + radius * 0.54 + random() * 0.2);
    } else if (group < 0.93) {
      const progress = random();
      y = 0.32 - progress * 1.68;
      x = Math.sin(progress * 4.4) * 0.065 + gaussian(random) * 0.026;
      z = Math.cos(progress * 3.2) * 0.045 + gaussian(random) * 0.02;
      tint = 0.46 + random() * 0.25;
    } else if (group < 0.975) {
      const side = random() > 0.5 ? 1 : -1;
      const progress = random();
      const angle = progress * Math.PI * 2;
      x = side * (0.2 + progress * 0.56) + Math.cos(angle) * 0.13 * (1 - progress);
      y = -0.56 - progress * 0.52 + Math.sin(angle) * 0.055;
      z = Math.sin(angle) * 0.12;
      tint = 0.54 + random() * 0.2;
    } else {
      const theta = random() * Math.PI * 2;
      const radius = 0.98 + random() * 0.32;
      x = Math.cos(theta) * radius;
      y = 0.35 + Math.sin(theta) * radius * 0.66;
      z = gaussian(random) * 0.16;
      tint = 0.84 + random() * 0.16;
    }

    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    seeds[index] = random();
    tints[index] = tint;
  }

  return { positions, seeds, tints };
}

function getUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Missing particle uniform: ${name}`);
  return location;
}

function setPalette(gl: WebGLRenderingContext, uniforms: BloomUniforms): void {
  const root = document.documentElement;
  const dark = root.dataset.theme === "dark" || (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) {
    gl.uniform3f(uniforms.ice, 0.72, 0.86, 0.97);
    gl.uniform3f(uniforms.blue, 0.36, 0.66, 0.91);
    gl.uniform3f(uniforms.pink, 0.88, 0.56, 0.68);
  } else {
    gl.uniform3f(uniforms.ice, 0.7, 0.84, 0.94);
    gl.uniform3f(uniforms.blue, 0.25, 0.56, 0.78);
    gl.uniform3f(uniforms.pink, 0.78, 0.46, 0.58);
  }
}

function mountParticleBloom(card: HTMLElement): void {
  const canvas = card.querySelector<HTMLCanvasElement>("[data-bloom-canvas]");
  const stage = card.querySelector<HTMLButtonElement>("[data-bloom-trigger]");
  const immersive = card.querySelector<HTMLButtonElement>("[data-bloom-immersive]");
  const close = card.querySelector<HTMLButtonElement>("[data-bloom-close]");
  const status = card.querySelector<HTMLElement>("[data-bloom-status]");
  const announcement = card.querySelector<HTMLElement>("[data-bloom-announcement]");
  if (!canvas || !stage || !immersive || !close || !status) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(max-width: 47.99rem), (pointer: coarse)");
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const pointCount = coarsePointer.matches || memory <= 4 ? 7200 : 15000;
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: true,
  });

  let frame = 0;
  let visible = false;
  let pageVisible = document.visibilityState === "visible";
  let lastFrame = 0;
  let burstStarted = Number.NEGATIVE_INFINITY;
  let pointerX = 0;
  let pointerY = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let destroyed = false;
  let resizeObserver: ResizeObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let themeObserver: MutationObserver | null = null;

  const setFallback = (label = "CSS FALLBACK") => {
    card.dataset.renderer = "fallback";
    status.textContent = label;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const mountFallbackControls = () => {
    const setFallbackImmersive = (active: boolean) => {
      card.classList.toggle("is-immersive", active);
      document.body.classList.toggle("xyg-immersive-open", active);
      immersive.setAttribute("aria-pressed", String(active));
      immersive.textContent = active ? "退出沉浸" : "沉浸模式";
    };
    stage.addEventListener("click", () => {
      card.classList.remove("is-bursting");
      void card.offsetWidth;
      card.classList.add("is-bursting");
      window.setTimeout(() => card.classList.remove("is-bursting"), 900);
    });
    immersive.addEventListener("click", () => setFallbackImmersive(!card.classList.contains("is-immersive")));
    close.addEventListener("click", () => setFallbackImmersive(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && card.classList.contains("is-immersive")) setFallbackImmersive(false);
    });
  };

  if (!gl) {
    setFallback();
    mountFallbackControls();
    return;
  }

  try {
    const program = createProgram(gl);
    const geometry = createBloomGeometry(pointCount);
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const seedLocation = gl.getAttribLocation(program, "a_seed");
    const tintLocation = gl.getAttribLocation(program, "a_tint");
    const uniforms: BloomUniforms = {
      time: getUniform(gl, program, "u_time"),
      explode: getUniform(gl, program, "u_explode"),
      bounce: getUniform(gl, program, "u_bounce"),
      pointer: getUniform(gl, program, "u_pointer"),
      aspect: getUniform(gl, program, "u_aspect"),
      pointScale: getUniform(gl, program, "u_point_scale"),
      ice: getUniform(gl, program, "u_ice"),
      blue: getUniform(gl, program, "u_blue"),
      pink: getUniform(gl, program, "u_pink"),
    };

    const attachAttribute = (location: number, size: number, values: Float32Array) => {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to create particle buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };

    gl.useProgram(program);
    attachAttribute(positionLocation, 3, geometry.positions);
    attachAttribute(seedLocation, 1, geometry.seeds);
    attachAttribute(tintLocation, 1, geometry.tints);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    setPalette(gl, uniforms);
    card.dataset.renderer = "webgl";
    status.textContent = reducedMotion.matches ? "STILL FRAME" : `${pointCount.toLocaleString("zh-CN")} PARTICLES`;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ratioCap = coarsePointer.matches ? 1.45 : 1.8;
      const ratio = Math.min(window.devicePixelRatio || 1, ratioCap);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform1f(uniforms.aspect, rect.width / rect.height);
      gl.uniform1f(uniforms.pointScale, ratio * (coarsePointer.matches ? 2.05 : 1.7));
    };

    const render = (now: number) => {
      resize();
      const progress = Math.min(1, Math.max(0, (now - burstStarted) / 1350));
      const explode = progress < 1 ? Math.pow(Math.sin(progress * Math.PI), 0.78) : 0;
      const returnProgress = Math.max(0, (progress - 0.55) / 0.45);
      const bounce = progress < 1 && returnProgress > 0 ? Math.sin(returnProgress * Math.PI * 3) * (1 - returnProgress) * 0.055 : 0;
      pointerX += (pointerTargetX - pointerX) * 0.065;
      pointerY += (pointerTargetY - pointerY) * 0.065;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.time, reducedMotion.matches ? 0 : now * 0.001);
      gl.uniform1f(uniforms.explode, reducedMotion.matches ? 0 : explode);
      gl.uniform1f(uniforms.bounce, reducedMotion.matches ? 0 : bounce);
      gl.uniform2f(uniforms.pointer, reducedMotion.matches ? 0 : pointerX, reducedMotion.matches ? 0 : pointerY);
      gl.drawArrays(gl.POINTS, 0, pointCount);
    };

    const schedule = () => {
      if (frame || destroyed || reducedMotion.matches || !visible || !pageVisible) return;
      frame = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      frame = 0;
      if (destroyed || reducedMotion.matches || !visible || !pageVisible) return;
      const bursting = now - burstStarted < 1350;
      const interval = 1000 / (bursting ? 60 : 30);
      if (now - lastFrame >= interval) {
        render(now);
        lastFrame = now;
        if (!bursting) card.classList.remove("is-bursting");
      }
      schedule();
    };

    const renderStill = () => {
      resize();
      setPalette(gl, uniforms);
      render(0);
    };

    const burst = () => {
      if (reducedMotion.matches) {
        announcement?.replaceChildren(document.createTextNode("已开启减少动态效果，粒子保持为静态花朵"));
        return;
      }
      burstStarted = performance.now();
      card.classList.remove("is-bursting");
      void card.offsetWidth;
      card.classList.add("is-bursting");
      announcement?.replaceChildren(document.createTextNode("粒子已经散开，正在重新聚合"));
      navigator.vibrate?.(7);
      schedule();
    };

    const setImmersive = (active: boolean) => {
      card.classList.toggle("is-immersive", active);
      document.body.classList.toggle("xyg-immersive-open", active);
      immersive.setAttribute("aria-pressed", String(active));
      immersive.textContent = active ? "退出沉浸" : "沉浸模式";
      immersive.setAttribute("aria-label", active ? "退出粒子花园沉浸模式" : "进入粒子花园沉浸模式");
      requestAnimationFrame(() => {
        resize();
        if (reducedMotion.matches) renderStill();
      });
      if (active) stage.focus({ preventScroll: true });
    };

    stage.addEventListener("click", burst);
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      pointerTargetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerTargetY = ((event.clientY - rect.top) / rect.height - 0.5) * -2;
    }, { passive: true });
    stage.addEventListener("pointerleave", () => {
      pointerTargetX = 0;
      pointerTargetY = 0;
    }, { passive: true });
    immersive.addEventListener("click", () => setImmersive(!card.classList.contains("is-immersive")));
    close.addEventListener("click", () => setImmersive(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && card.classList.contains("is-immersive")) setImmersive(false);
    });
    document.addEventListener("visibilitychange", () => {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible) schedule();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    reducedMotion.addEventListener("change", () => {
      status.textContent = reducedMotion.matches ? "STILL FRAME" : `${pointCount.toLocaleString("zh-CN")} PARTICLES`;
      if (reducedMotion.matches) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        renderStill();
      } else schedule();
    });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      setFallback("CONTEXT RESTING");
    });

    resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion.matches) renderStill();
    });
    resizeObserver.observe(stage);
    intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) {
        if (reducedMotion.matches) renderStill();
        else schedule();
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }, { rootMargin: "180px 0px", threshold: 0.01 });
    intersectionObserver.observe(card);
    themeObserver = new MutationObserver(() => {
      setPalette(gl, uniforms);
      if (reducedMotion.matches) renderStill();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    renderStill();
  } catch (error) {
    console.warn("Particle bloom switched to its static fallback", error);
    setFallback();
    mountFallbackControls();
  }

  window.addEventListener("pagehide", () => {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    themeObserver?.disconnect();
  }, { once: true });
}

if (typeof document !== "undefined") {
  const bloom = document.querySelector<HTMLElement>("[data-particle-bloom]");
  if (bloom) mountParticleBloom(bloom);
}
