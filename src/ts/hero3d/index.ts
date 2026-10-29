/**
 * Jemawe Digital Ecosystem: interactive 3D hero for the home page.
 *
 * Progressive enhancement only. The HTML list of service links inside the
 * hero is the source of truth: the 3D objects mirror it (hover/focus sync) and
 * navigate to the same URLs. Labels are DOM text, never drawn in WebGL.
 *
 * Lifecycle: mountEcosystem() resolves with a cleanup function that cancels
 * the loop, removes listeners and observers, and disposes every geometry,
 * material, texture, and the renderer.
 */
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  BoxGeometry,
  Box3,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  Object3D,
  Sprite,
} from "three";
import { buildAmbient, buildCore, buildDigital, buildHardware, buildIt, createEnvironment, createPalette, FrameContext, ServiceId, ServiceModule } from "./builders";

export type EcoOptions = { lite: boolean; reducedMotion: boolean; force: boolean };

/** Give the main thread back between setup steps so taps and scrolls stay responsive. */
const yieldToMain = () =>
  new Promise<void>((resolve) => {
    const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
    if (sched?.yield) sched.yield().then(resolve);
    else setTimeout(resolve, 0);
  });

const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

export async function mountEcosystem(root: HTMLElement, options: EcoOptions): Promise<() => void> {
  const stage = root.querySelector<HTMLElement>("[data-eco-stage]");
  const label = root.querySelector<HTMLElement>("[data-eco-label]");
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-eco-target]"));
  if (!stage || !label || links.length !== 3) throw new Error("Ecosystem markup missing");

  const mark = (name: string) => performance.mark(`eco:${name}`);
  mark("mount");
  const motion = !options.reducedMotion;
  const lite = options.lite;

  /* ---------------- renderer */
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  const maxDpr = lite ? 1.5 : 1.75;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = "eco__canvas";
  canvas.setAttribute("aria-hidden", "true"); // the HTML links below are the accessible equivalent
  canvas.tabIndex = -1;

  /* ---------------- scene (built in small steps, yielding in between) */
  const scene = new Scene();
  await yieldToMain();
  mark("renderer");
  const envTex = createEnvironment(renderer);
  mark("environment");
  scene.environment = envTex;
  scene.environmentIntensity = 0.9;
  await yieldToMain();

  const world = new Group();
  scene.add(world);
  const palette = createPalette();
  const core = buildCore(palette);
  world.add(core.group);
  await yieldToMain();
  const modules: ServiceModule[] = [];
  for (const build of [buildDigital, buildIt, buildHardware]) {
    const m = build(palette, lite);
    modules.push(m);
    world.add(m.group);
    await yieldToMain();
  }
  const ambient = buildAmbient(palette, lite);
  world.add(ambient.group);
  mark("geometry");

  scene.add(new HemisphereLight(0xb8ccff, 0x071226, 1.1));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 6);
  scene.add(key);
  const coreLight = new PointLight(0x3b82f6, 18, 9, 2);
  coreLight.position.set(0, 0.2, 1.8);
  scene.add(coreLight);
  const rim = new PointLight(0x7dd3fc, 14, 12, 2);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  /* hit proxies: one invisible box per module for cheap, forgiving picking */
  const proxyMat = new MeshBasicMaterial({ visible: false });
  const proxies: Mesh[] = [];
  modules.forEach((m) => {
    m.group.updateMatrixWorld(true);
    const box = new Box3().setFromObject(m.inner);
    const size = box.getSize(new Vector3()).multiplyScalar(1.05);
    const proxy = new Mesh(new BoxGeometry(size.x, size.y, size.z), proxyMat);
    box.getCenter(proxy.position);
    proxy.userData.id = m.id;
    scene.add(proxy);
    proxies.push(proxy);
  });

  /* ---------------- camera + fitting */
  const camera = new PerspectiveCamera(32, 1, 0.1, 60);
  const target = new Vector3(0, -0.2, 0);
  let fitDistance = 12;
  const fit = () => {
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const halfW = 3.95, halfH = 2.75; // composition extents in scene units
    fitDistance = Math.max(halfH / tanHalf, halfW / (tanHalf * camera.aspect)) + (lite ? 0.6 : 1.4);
    camera.updateProjectionMatrix();
  };
  stage.append(canvas);
  fit();
  camera.position.set(0, 0.35, fitDistance * 1.18);
  camera.lookAt(target);
  // Compile shaders before the first frame; uses KHR_parallel_shader_compile where available.
  await yieldToMain();
  try {
    if (renderer.extensions.has("KHR_parallel_shader_compile")) {
      await renderer.compileAsync(scene, camera);
    } else {
      // No background compilation: compile one group at a time, and force each
      // program to link right away (otherwise linking happens, all at once, on the
      // first draw), so no single task is long.
      type LinkableProgram = { getUniforms?: () => unknown };
      for (const part of [core.group, ...modules.map((m) => m.group), ambient.group]) {
        renderer.compile(part, camera, scene);
        ((renderer.info as unknown as { programs?: LinkableProgram[] }).programs ?? []).forEach((prog) => prog.getUniforms?.());
        await yieldToMain();
      }
    }
  } catch {
    /* if pre-compilation fails, shaders simply compile on the first render */
  }
  mark("compiled");
  await yieldToMain();
  // Upload textures ahead of the first frame, a few at a time.
  const pending = new Set<Texture>();
  scene.traverse((o: Object3D) => {
    const mats = (o as Mesh).material;
    if (!mats) return;
    (Array.isArray(mats) ? mats : [mats]).forEach((mat: Material) =>
      Object.values(mat).forEach((v) => v instanceof Texture && v !== envTex && pending.add(v))
    );
  });
  let uploaded = 0;
  for (const tex of pending) {
    renderer.initTexture(tex);
    if (++uploaded % 4 === 0) await yieldToMain();
  }
  mark("textures");
  await yieldToMain();

  /* ---------------- interaction state */
  const pointer = new Vector2(0, 0); // NDC of last pointer over the canvas
  const pointerSmooth = new Vector2(0, 0);
  let pointerInside = false;
  let pointerDirty = false;
  let hovered: ServiceId | null = null; // from the 3D canvas
  let linkActive: ServiceId | null = null; // from the HTML list (hover / keyboard focus)
  let touchSelected: ServiceId | null = null;
  let focusing: { id: ServiceId; start: number; href: string } | null = null;
  const raycaster = new Raycaster();
  const byId = new Map(modules.map((m) => [m.id, m] as const));
  const linkById = new Map(links.map((a) => [a.dataset.ecoTarget as ServiceId, a] as const));
  let lastPointerType = "mouse";

  const activeId = (): ServiceId | null => focusing?.id ?? linkActive ?? hovered ?? touchSelected;

  const titleEl = label.querySelector<HTMLElement>(".eco__label-title")!;
  const textEl = label.querySelector<HTMLElement>(".eco__label-text")!;
  const hintEl = label.querySelector<HTMLElement>(".eco__label-hint")!;
  let shownLabel: ServiceId | null = null;
  const syncUi = () => {
    const id = activeId();
    links.forEach((a) => a.classList.toggle("is-active", a.dataset.ecoTarget === id));
    root.classList.toggle("is-hovering", hovered !== null);
    root.dataset.ecoHover = id ?? "";
    if (id !== shownLabel) {
      shownLabel = id;
      if (id) {
        const a = linkById.get(id)!;
        titleEl.textContent = a.querySelector(".eco__link-title")?.textContent || "";
        textEl.textContent = a.querySelector(".eco__link-desc")?.textContent || "";
        hintEl.textContent = linkActive ? "" : lastPointerType === "touch" ? "Tap again to open" : "Click to open";
        label.dataset.side = byId.get(id)!.labelSide;
        label.hidden = false;
        requestAnimationFrame(() => label.classList.add("is-visible"));
      } else {
        label.classList.remove("is-visible");
      }
    }
  };

  const toNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const pick = (): ServiceId | null => {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(proxies, false)[0];
    return hit ? (hit.object.userData.id as ServiceId) : null;
  };

  const navigate = (id: ServiceId) => {
    const href = linkById.get(id)!.href;
    if (!motion) {
      window.location.assign(href);
      return;
    }
    focusing = { id, start: performance.now(), href };
    syncUi();
    requestRender();
  };

  const onPointerMove = (e: PointerEvent) => {
    lastPointerType = e.pointerType;
    toNdc(e);
    pointerInside = true;
    pointerDirty = true;
    requestRender();
  };
  const onPointerLeave = () => {
    pointerInside = false;
    hovered = null;
    syncUi();
    requestRender();
  };
  let downAt: { x: number; y: number; t: number } | null = null;
  const onPointerDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onPointerUp = (e: PointerEvent) => {
    if (!downAt || focusing) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const quick = performance.now() - downAt.t < 600;
    downAt = null;
    if (moved > 10 || !quick) return; // a drag or scroll, not a tap
    lastPointerType = e.pointerType;
    toNdc(e);
    const id = pick();
    if (e.pointerType === "touch") {
      // First tap previews (label + highlight), second tap on the same object opens it.
      if (id && touchSelected === id) navigate(id);
      else {
        touchSelected = id;
        syncUi();
        requestRender();
      }
      return;
    }
    if (id) navigate(id);
  };
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);

  // HTML links drive the scene too (hover and keyboard focus).
  const linkHandlers: [HTMLAnchorElement, string, EventListener][] = [];
  links.forEach((a) => {
    const id = a.dataset.ecoTarget as ServiceId;
    const on = () => { linkActive = id; syncUi(); requestRender(); };
    const off = () => { if (linkActive === id) linkActive = null; syncUi(); requestRender(); };
    for (const [type, fn] of [["pointerenter", on], ["focus", on], ["pointerleave", off], ["blur", off]] as const) {
      a.addEventListener(type, fn);
      linkHandlers.push([a, type, fn]);
    }
  });

  /* ---------------- render loop with pause + adaptive quality */
  let raf = 0;
  let visible = true;
  let running = false;
  let needsRender = true;
  let introStart = -1;
  let last = performance.now();
  let elapsed = 0;
  const frameTimes: number[] = [];
  let qualityStepped = false;
  let firstFrameShown = false;
  const anchor = new Vector3();
  const lookTarget = new Vector3();
  const tmp = new Vector3();

  const ctx: FrameContext = { dt: 0, t: 0, pointerX: 0, pointerY: 0, motion };

  function requestRender() {
    needsRender = true;
    if (!running && visible && !document.hidden) loopOnce();
  }

  const heroEl = root.closest("section") ?? root;
  function heroProgress(): number {
    if (!motion) return 0;
    const r = heroEl.getBoundingClientRect();
    return Math.min(Math.max(-r.top / Math.max(r.height, 1), 0), 1);
  }

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    if (introStart < 0) introStart = elapsed;
    const intro = motion ? elapsed - introStart : 99;

    if (pointerDirty) {
      pointerDirty = false;
      const id = pointerInside ? pick() : null;
      if (id !== hovered) {
        hovered = id;
        if (id) touchSelected = null;
        syncUi();
      }
    }
    const px = pointerInside ? pointer.x : 0;
    const py = pointerInside ? pointer.y : 0;
    pointerSmooth.x = motion ? damp(pointerSmooth.x, px, 4, dt) : 0;
    pointerSmooth.y = motion ? damp(pointerSmooth.y, py, 4, dt) : 0;
    ctx.dt = dt;
    ctx.t = elapsed;
    ctx.pointerX = pointerSmooth.x;
    ctx.pointerY = pointerSmooth.y;

    // intro: core first, then modules staggered
    const coreIn = easeOutCubic(intro / 1.0);
    core.group.scale.setScalar(0.55 + 0.45 * coreIn);
    core.update(ctx);

    const act = activeId();
    modules.forEach((m, i) => {
      const k = easeOutCubic((intro - 0.25 - i * 0.15) / 1.1);
      const target = act === m.id ? 1 : 0;
      m.hover = motion ? damp(m.hover, target, 9, dt) : target;
      const bob = motion ? Math.sin(elapsed * 0.7 + m.phase) * 0.06 : 0;
      m.group.position.copy(m.basePos).addScaledVector(m.enterFrom, 1 - k);
      m.group.position.y += bob;
      m.inner.scale.setScalar(m.scale * (0.82 + 0.18 * k) * (1 + m.hover * 0.06));
      m.update(ctx);
    });
    ambient.update(ctx);
    if (motion) coreLight.intensity = 18 * (1 + Math.sin(elapsed * 1.1) * 0.12);

    // camera: settle in, parallax, scroll drift, focus on the selected service
    const settle = 1 - easeOutCubic(intro / 1.6);
    const scroll = heroProgress();
    let focusK = 0;
    lookTarget.copy(target);
    if (focusing) {
      focusK = easeOutCubic((performance.now() - focusing.start) / 420);
      lookTarget.lerp(byId.get(focusing.id)!.group.position, 0.45 * focusK);
      if (focusK >= 1) {
        const href = focusing.href;
        focusing = null;
        window.location.assign(href);
      }
    } else if (act && linkActive) {
      tmp.copy(byId.get(act)!.group.position);
      lookTarget.lerp(tmp, 0.12);
    }
    const dist = fitDistance * (1 + settle * 0.18) * (1 - focusK * 0.16);
    camera.position.set(pointerSmooth.x * 0.45, 0.35 + pointerSmooth.y * 0.3 + scroll * 1.1, dist);
    camera.lookAt(lookTarget);
    world.rotation.x = scroll * 0.18;

    renderer.render(scene, camera);
    if (!firstFrameShown) {
      mark("first-frame");
      firstFrameShown = true;
      root.classList.add("is-3d");
      root.dataset.ecoState = "ready";
    }

    // floating label follows its object
    if (shownLabel) {
      byId.get(shownLabel)!.labelAnchor.getWorldPosition(anchor);
      anchor.project(camera);
      const w = stage!.clientWidth, h = stage!.clientHeight;
      const side = byId.get(shownLabel)!.labelSide;
      const lw = label!.offsetWidth || 220, lh = label!.offsetHeight || 90;
      let x = (anchor.x * 0.5 + 0.5) * w;
      let y = (-anchor.y * 0.5 + 0.5) * h;
      // keep the whole label inside the stage
      if (side === "above") { x = Math.min(Math.max(x, lw / 2 + 8), w - lw / 2 - 8); y = Math.min(Math.max(y, lh + 22), h - 8); }
      else if (side === "left") { x = Math.min(Math.max(x, lw + 22), w - 8); y = Math.min(Math.max(y, lh / 2 + 8), h - lh / 2 - 8); }
      else { x = Math.min(Math.max(x, 8), w - lw - 22); y = Math.min(Math.max(y, lh / 2 + 8), h - lh / 2 - 8); }
      label!.style.setProperty("--x", `${x.toFixed(1)}px`);
      label!.style.setProperty("--y", `${y.toFixed(1)}px`);
    }

    // adaptive quality: measure real frame times once the intro is under way
    if (motion && intro > 0.6 && frameTimes.length < 90) {
      frameTimes.push(dt * 1000);
      if (frameTimes.length === 90) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        stats.avgFrameMs = Math.round(avg * 10) / 10;
        if (avg > 45 && !qualityStepped) {
          qualityStepped = true;
          dpr = 1;
          renderer.setPixelRatio(dpr);
          fit();
          stats.qualityStep = "reduced pixel ratio";
          frameTimes.length = 0;
        } else if (avg > 90 && qualityStepped && !options.force) {
          stats.qualityStep = "fell back to static diagram";
          teardown("fallback:slow");
          return false;
        }
      }
    }
    return true;
  }

  function tick(now: number) {
    raf = 0;
    if (!frame(now)) return;
    if (running) raf = requestAnimationFrame(tick);
  }
  function loopOnce() {
    if (raf) return;
    raf = requestAnimationFrame((now) => {
      raf = 0;
      if (needsRender) {
        needsRender = false;
        frame(now);
      }
    });
  }
  function start() {
    if (!motion) return requestRender(); // reduced motion: render on demand only
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(stage);
  const ro = new ResizeObserver(() => {
    fit();
    requestRender();
  });
  ro.observe(stage);
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);
  const onContextLost = (e: Event) => {
    e.preventDefault();
    teardown("fallback:context-lost");
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  /* ---------------- test/diagnostic hooks (read-only) */
  const stats = { avgFrameMs: 0, qualityStep: "none", lite, dpr: () => dpr };
  (root as HTMLElement & { ecoDebug?: unknown }).ecoDebug = {
    screenPosition(id: ServiceId) {
      const m = byId.get(id);
      if (!m) return null;
      const p = new Vector3();
      proxies.find((x) => x.userData.id === id)!.getWorldPosition(p);
      p.project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
    },
    stats() {
      const i = renderer.info;
      return { drawCalls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, dpr, lite, avgFrameMs: stats.avgFrameMs, qualityStep: stats.qualityStep, running };
    },
  };

  /* ---------------- cleanup */
  let torn = false;
  function teardown(state?: string) {
    if (torn) return;
    torn = true;
    stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    linkHandlers.forEach(([a, type, fn]) => a.removeEventListener(type, fn));
    links.forEach((a) => a.classList.remove("is-active"));
    label!.classList.remove("is-visible");
    label!.hidden = true;

    const textures = new Set<Texture>([envTex, palette.glowTex]);
    scene.traverse((o: Object3D) => {
      const mesh = o as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = (mesh as Mesh | Sprite).material;
      if (mats) {
        (Array.isArray(mats) ? mats : [mats]).forEach((mat: Material) => {
          Object.values(mat).forEach((v) => v instanceof Texture && textures.add(v));
          mat.dispose();
        });
      }
    });
    textures.forEach((t) => t.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    root.classList.remove("is-3d", "is-hovering");
    delete (root as HTMLElement & { ecoDebug?: unknown }).ecoDebug;
    if (state) root.dataset.ecoState = state;
  }

  start();
  if (!motion) requestRender();
  return () => teardown("unmounted");
}
