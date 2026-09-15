const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const compile = (file) =>
  ts.transpileModule(
    readFileSync(
      path.join(__dirname, "../src/components/ambient", file),
      "utf8",
    ).replaceAll("import.meta.url", '"http://localhost:3000/landscape.js"'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
const scenes = { exports: {} };
vm.runInNewContext(compile("scenes.ts"), scenes);
const rendererModule = { exports: {}, require: () => scenes.exports };
// No window/document in this context: the renderer must run independently of the DOM.
vm.runInNewContext(compile("landscape-renderer.ts"), rendererModule);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function setupRenderer(
  variant = "bottom",
  scene = "snow",
  deferImages = false,
) {
  let now = 1000,
    id = 0;
  const frames = new Map();
  const loads = [];
  const stats = { paints: 0, arcs: 0, strokes: 0, draws: [], ready: 0 };
  const width = variant === "side" ? 420 : 390;
  const height = variant === "side" ? 720 : 220;
  const makeCanvas = (main = false) => {
    const context = new Proxy(
      {},
      {
        get(target, method) {
          if (method in target) return target[method];
          return (...args) => {
            for (const value of args)
              if (typeof value === "number") assert.ok(Number.isFinite(value));
            if (
              method === "createLinearGradient" ||
              method === "createRadialGradient"
            )
              return { addColorStop() {} };
            if (!main) return;
            if (
              method === "fillRect" &&
              args[0] === 0 &&
              args[1] === 0 &&
              args[3] === height
            )
              stats.paints++;
            if (method === "drawImage") stats.draws.push(args);
            if (method === "arc") stats.arcs++;
            if (method === "stroke") stats.strokes++;
          };
        },
      },
    );
    return { width: 1, height: 1, getContext: () => context };
  };
  const canvas = makeCanvas(true);
  const renderer = rendererModule.exports.createLandscapeRenderer(
    canvas,
    variant,
    scene,
    {
      makeCanvas: () => makeCanvas(),
      now: () => now,
      requestFrame(callback) {
        frames.set(++id, callback);
        return id;
      },
      cancelFrame(frame) {
        frames.delete(frame);
      },
      onReady() {
        stats.ready++;
      },
      loadImage(url) {
        return new Promise((resolve, reject) => {
          const image = {
            width: 1536,
            height: 1024,
            closed: false,
            close() {
              this.closed = true;
            },
          };
          loads.push({ url, image, resolve: () => resolve(image), reject });
          if (!deferImages) resolve(image);
        });
      },
    },
  );
  renderer.resize({ width, height, pixelRatio: 1.5 });
  return {
    renderer,
    frames,
    loads,
    stats,
    canvas,
    tick(ms) {
      now += ms;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(now));
    },
  };
}

for (const hz of [60, 120, 144])
  test(`renderer maintains 30 fps on a ${hz} Hz clock`, async () => {
    const app = setupRenderer();
    app.renderer.setVisibility(true, false);
    await flush();
    app.stats.paints = 0;
    for (let i = 0; i < hz * 2; i++) app.tick(1000 / hz);
    assert.ok(
      app.stats.paints >= 59 && app.stats.paints <= 60,
      `${app.stats.paints} paints in 2 seconds`,
    );
    app.renderer.destroy();
  });

for (const variant of ["side", "bottom"])
  test(`all eight ${variant} scenes retain their weather and interactions`, async () => {
    const app = setupRenderer(variant);
    app.renderer.setVisibility(true, false);
    await flush();
    for (const [index, scene] of Object.keys(scenes.exports.SCENES).entries()) {
      app.renderer.setScene(scene);
      await flush();
      for (let i = 0; i < 30; i++) app.tick(50);
      app.stats.arcs = app.stats.strokes = 0;
      const previousTerrain = app.stats.draws.at(-1);
      app.renderer.setInput({
        scroll: index % 2 ? 0.9 : 0.1,
        pointerX: index % 2 ? 3 : -3,
        pointerY: 2,
        interact: true,
      });
      app.tick(50);
      assert.notEqual(app.stats.draws.at(-1)[1], previousTerrain[1]);
      if (scene === "night") {
        assert.ok(app.stats.arcs > 20);
        assert.ok(app.stats.strokes > 0);
      }
      if (scene === "snow") {
        assert.ok(app.stats.arcs > 20);
        assert.equal(app.stats.strokes, 0);
      }
      if (scene === "rain") {
        assert.ok(app.stats.strokes > 20);
        assert.equal(app.stats.arcs, 0);
      }
      if (scene === "cloudy") {
        assert.equal(app.stats.arcs + app.stats.strokes, 0);
      }
      if (["sunset", "sunrise", "clear", "blueClouds"].includes(scene))
        assert.equal(app.stats.arcs, 1);
    }
    assert.equal(app.stats.ready, 1);
    app.renderer.destroy();
    assert.ok(app.loads.every(({ image }) => image.closed));
  });

test("assets stay lazy; hidden and reduced-motion scenes do no animation work", async () => {
  const app = setupRenderer();
  assert.equal(app.loads.length + app.frames.size, 0);
  app.renderer.setVisibility(true, false);
  await flush();
  assert.equal(app.frames.size, 1);
  for (const [active, reduced] of [
    [false, false],
    [true, true],
  ]) {
    app.renderer.setVisibility(active, reduced);
    app.stats.paints = 0;
    app.tick(1000);
    assert.equal(app.stats.paints + app.frames.size, 0);
  }
  app.renderer.setVisibility(true, false);
  assert.equal(app.frames.size, 1);
  app.renderer.destroy();
  assert.equal(app.frames.size, 0);
});

test("failed WebP falls back once; readiness waits for terrain and late images are released", async () => {
  const app = setupRenderer("bottom", "night", true);
  app.renderer.setVisibility(true, false);
  assert.equal(app.stats.ready, 0);
  app.loads[0].reject(new Error("WebP failed"));
  await flush();
  assert.equal(app.loads[1].url, "/art/moonlit-mountains.png");
  app.loads[1].resolve();
  await flush();
  assert.equal(app.stats.ready, 1);
  app.renderer.setScene("snow");
  const cloud = app.loads.at(-1);
  app.renderer.destroy();
  cloud.resolve();
  await flush();
  assert.equal(cloud.image.closed, true);
});

const hostSource = compile("landscape.ts");
function setupHost(workerSupported = true) {
  const events = () => ({
    handlers: new Map(),
    addEventListener(name, callback) {
      this.handlers.set(name, callback);
    },
    removeEventListener(name) {
      this.handlers.delete(name);
    },
  });
  let id = 0,
    intersection,
    resize;
  const frames = new Map(),
    timers = new Map(),
    messages = [],
    workers = [],
    canvases = [];
  const stats = { reads: 0, contexts: 0 };
  const motion = { ...events(), matches: false };
  const window = {
    ...events(),
    scrollY: 0,
    innerHeight: 800,
    devicePixelRatio: 3,
    matchMedia: () => motion,
    setTimeout(callback) {
      timers.set(++id, callback);
      return id;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
  };
  const classes = new Set();
  const figure = {
    ...events(),
    clientWidth: 520,
    clientHeight: 900,
    parentElement: null,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    append(canvas) {
      canvases.push(canvas);
    },
    getBoundingClientRect() {
      stats.reads++;
      return { top: 500 - window.scrollY, left: 0, width: 520, height: 900 };
    },
  };
  const document = {
    ...events(),
    hidden: false,
    createElement() {
      const canvas = {
        replaceWith(next) {
          canvases.splice(canvases.indexOf(canvas), 1, next);
        },
        remove() {
          canvases.splice(canvases.indexOf(canvas), 1);
        },
        getContext() {
          stats.contexts++;
          throw new Error("The main thread must not paint in worker mode");
        },
      };
      if (workerSupported)
        canvas.transferControlToOffscreen = () => ({ offscreen: true });
      return canvas;
    },
  };
  const fallbackStates = [];
  let fallbackDestroyed = false;
  const sandbox = {
    exports: {},
    window,
    document,
    URL,
    performance: { now: () => 1000 },
    requestAnimationFrame(callback) {
      frames.set(++id, callback);
      return id;
    },
    cancelAnimationFrame(key) {
      frames.delete(key);
    },
    ResizeObserver: class {
      constructor(callback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
    IntersectionObserver: class {
      constructor(callback) {
        intersection = callback;
      }
      observe() {}
      disconnect() {}
    },
    Worker: class {
      constructor() {
        workers.push(this);
      }
      postMessage(message) {
        messages.push(structuredClone(message));
      }
      terminate() {
        this.terminated = true;
      }
    },
    require: () => ({
      createLandscapeRenderer: () => ({
        resize() {},
        setInput() {},
        setScene() {},
        setVisibility(active) {
          fallbackStates.push(active);
        },
        destroy() {
          fallbackDestroyed = true;
        },
      }),
    }),
  };
  vm.runInNewContext(hostSource, sandbox);
  const create = () =>
    sandbox.exports.createLandscape(figure, "bottom", "snow");
  const renderer = create();
  return {
    renderer,
    create,
    workers,
    messages,
    stats,
    canvases,
    fallbackStates,
    window,
    document,
    motion,
    frames,
    fallbackDestroyed: () => fallbackDestroyed,
    visible(value) {
      intersection([{ isIntersecting: value }]);
    },
    resize() {
      resize();
    },
    scroll(y) {
      window.scrollY = y;
      window.handlers.get("scroll")();
    },
    tick() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(1000));
    },
    settle() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

test("worker mode does zero main-thread drawing or layout reads for scroll bursts", () => {
  const app = setupHost();
  app.visible(true);
  app.tick();
  app.stats.reads = 0;
  app.messages.length = 0;
  for (let i = 1; i <= 120; i++) app.scroll(i);
  assert.equal(app.messages.length, 0);
  assert.equal(app.frames.size, 1);
  app.tick();
  assert.equal(app.stats.contexts + app.stats.reads, 0);
  assert.equal(app.messages.length, 1);
  assert.equal(app.messages[0].type, "input");
  assert.equal(app.messages[0].input.interact, true);
  app.tick();
  assert.equal(app.frames.size, 0, "no perpetual main-thread animation loop");
  app.renderer.destroy();
  assert.ok(app.workers[0].terminated);
  assert.equal(app.canvases.length, 0);
  assert.equal(
    app.window.handlers.size +
      app.document.handlers.size +
      app.motion.handlers.size,
    0,
  );
});

test("worker receives visibility/scene updates; canvas pixel allocation stays bounded across restarts", () => {
  const app = setupHost();
  const size = app.messages.find(
    (message) => message.type === "resize",
  ).viewport;
  assert.ok(
    Math.round(size.width * size.pixelRatio) *
      Math.round(size.height * size.pixelRatio) <=
      752000,
  );
  app.visible(true);
  app.renderer.setScene("sunset");
  assert.equal(app.messages.at(-1).scene, "sunset");
  app.visible(false);
  assert.equal(app.messages.at(-1).active, false);
  app.document.hidden = true;
  app.document.handlers.get("visibilitychange")();
  assert.equal(app.messages.at(-1).active, false);
  app.renderer.destroy();
  const next = app.create();
  assert.equal(app.canvases.length, 1);
  assert.equal(app.workers.length, 2);
  next.destroy();
});

test("compatibility renderer yields during scrolling and resumes after the gesture", async () => {
  const app = setupHost(false);
  app.visible(true);
  await flush();
  assert.equal(app.fallbackStates.at(-1), true);
  app.scroll(120);
  assert.equal(app.fallbackStates.at(-1), false);
  app.tick();
  app.settle();
  assert.equal(app.fallbackStates.at(-1), true);
  app.renderer.destroy();
  assert.equal(app.fallbackDestroyed(), true);
});

test("worker failure switches to a fresh canvas and a guarded compatibility renderer", async () => {
  const app = setupHost();
  app.visible(true);
  const firstCanvas = app.canvases[0];
  app.workers[0].onerror({ preventDefault() {} });
  await flush();
  assert.ok(app.workers[0].terminated);
  assert.notEqual(app.canvases[0], firstCanvas);
  assert.equal(app.fallbackStates.at(-1), true);
  app.renderer.destroy();
});
