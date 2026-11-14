// INKRMN site script
import { mount } from '/geo-sc/player.js';
import { easeScatter, burst } from './scatter.js';
// GEO_SC's own look and camera code, to work out where the logo's scan is.
import { lookParams, tempo, TAU } from '/geo-sc/look.js';
import { Renderer } from '/geo-sc/renderer.js';

// ---- Timings for the Join mailing list button (milliseconds unless the
// name says otherwise). The logo plays, then the button's particles arrive
// as a cloud that settles into the button. (No cross-fade here, unlike the
// join page: the button stays as particles.)
const LOGO_WAIT_MS = 6000; // the logo hasn't drawn by now: show the still and carry on
const BUTTON_WAIT_MS = 4000; // the button's particles aren't ready this long after the logo: plain button instead
const CLOUD_DELAY_MS = 1700; // after the logo shows, before the button's cloud fades in
const CLOUD_FORM_SECONDS = 4; // how long the particles take to fade in
const CLOUD_SCATTER = 0.2; // how spread out the cloud starts (0 = no cloud)
const CLOUD_HOLD_MS = 0; // how long the cloud hangs, from when it starts fading in, before settling
const CLOUD_SECONDS = 0.1; // how long settling takes
// Kicked up by the scan: the logo's scan (the red/orange band that sweeps
// left to right across it) uncovers the button as it passes over, as if it
// kicks the button's particles up. The button waits for the scan's next
// pass after CLOUD_DELAY_MS: up to about 6 seconds more.
const SCAN_REVEAL = false; // false: the button just appears after CLOUD_DELAY_MS, as before
const SCAN_EDGE_PX = 300; // how soft the uncovering edge is
const SCAN_LEAD = 0; // the edge's place against the scan's band, as a share of the logo's width (+ = ahead of it)

// ---- Going to the join block and back, without loading a new page. The
// scene keeps running behind; the join block's own timings are in js/join.js.
const AWAY_SECONDS = 0.8; // the logo and button burst into a cloud as they fade out
const LOGO_BURST = 0; // how far the logo's particles are thrown out as it goes (0 = none)
const BUTTON_BURST = 0; // how far the button's are thrown out
const BACK_DELAY_MS = 250; // Back: after the join block starts to go, before the logo starts to come back
const BACK_SECONDS = 1.2; // Back: how long the logo and button take to come back together and fade in

// The page works without any of this: the class only switches on the extras.
document.documentElement.classList.add('js');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const players = { logo: null, backdrop: null, button: null };

// 1. GEO_SC: the logo behind the page. The still stays if anything goes wrong.
const hero = document.querySelector('.geo-hero');

// Once the logo first shows (or the still, if it can't run), the button's
// particles come in as a cloud and slowly settle into the button.
const boot = document.getElementById('boot');
const bootReady = () => {
  if (boot.classList.contains('is-ready')) return;
  boot.classList.add('is-ready');
  revealJoinButton(mountJoinButton());
};
// The still stays hidden unless the live logo can't run, or hasn't drawn
// after a few seconds.
const showStill = () => {
  if (!hero.querySelector('canvas.is-ready')) hero.classList.add('show-still');
};
setTimeout(() => { showStill(); bootReady(); }, LOGO_WAIT_MS); // never leave the page empty for long

// The logo faces straight on. The scene was saved with its clock's spin at
// 12.52 (it had been spinning while it was designed); with spin now off,
// that left it turned about 2.7° for good, the "I" end further away. It's
// put back to the nearest whole turn here, on the page, since GEO_SC's own
// export overwrites the scene folder.
const LOGO_SCENE = '/geo-sc/scenes/ink-mn-homepage/';
async function logoScene() {
  const base = new URL(LOGO_SCENE, location.href);
  const scene = await (await fetch(new URL('scene.json', base))).json();
  if (scene.clock) scene.clock.spin = Math.round(scene.clock.spin / TAU) * TAU;
  if (scene.camera) scene.camera.ty = 0;
  scene.embedded = {
    [scene.files.logo]: new URL(scene.files.logo, base).href,
    [scene.files.depth]: new URL(scene.files.depth, base).href,
  };
  return scene;
}

logoScene()
  .then((scene) => mount(hero.querySelector('canvas'), { scene }))
  .then((player) => {
    if (player) {
      players.logo = player;
      logoClock.time = player.scene.clock?.time ?? 0;
      runLogoClock(true); // started in step with the logo: both draw their first frame next
    } else showStill();
    bootReady();
  })
  .catch((err) => { console.warn(err); showStill(); bootReady(); });

// The backdrop: the same scene with no logo, under it, for while the join
// block is up. Only the one you can see keeps drawing.
let backdropMounting = null;
const mountBackdrop = () => {
  backdropMounting ||= mount(document.querySelector('.geo-backdrop canvas'), { scene: '/scenes/background/', interactive: false })
    .then((player) => {
      if (!player) return;
      players.backdrop = player;
      player.pause();
      if (view === 'join') playInStep(); // it's already wanted
    })
    .catch((err) => console.warn(err));
  return backdropMounting;
};

// The logo and the backdrop are one scene (the backdrop just has no logo),
// so as one fades into the other, their grain, scanlines and glitches have
// to match frame for frame. Each player's clock only runs while it plays, so
// this keeps count of the logo's, the way GEO_SC does, and the backdrop is
// set to it before a fade. (Only the backdrop's clock is ever changed: it
// has no particles, so nothing on it visibly jumps.)
const logoClock = { time: 0, last: 0, raf: 0, on: false };
function tickLogoClock(now) {
  logoClock.raf = 0;
  if (!logoClock.on || document.hidden) return;
  if (logoClock.last) logoClock.time += Math.min(0.25, (now - logoClock.last) / 1000);
  logoClock.last = now;
  logoClock.raf = requestAnimationFrame(tickLogoClock);
}
function runLogoClock(on) {
  logoClock.on = on;
  logoClock.last = 0; // as the player does: no jump after a pause
  if (logoClock.raf) cancelAnimationFrame(logoClock.raf);
  logoClock.raf = on && !document.hidden ? requestAnimationFrame(tickLogoClock) : 0;
}
document.addEventListener('visibilitychange', () => runLogoClock(logoClock.on));

// Both layers playing, in step, for a fade between them.
function playInStep() {
  const { logo, backdrop } = players;
  logo?.pause();
  backdrop?.pause();
  if (logo && backdrop) backdrop.seek(logoClock.time);
  logo?.resume();
  backdrop?.resume();
  if (logo) runLogoClock(true);
}

// The Join mailing list button in particles. It loads empty while the logo
// plays, then the particles fly in and form it, like pressing Space in GEO_SC.
// If GEO_SC can't run here (no WebGL2, reduced motion, or it's too slow to
// load), the plain button shows instead.
//
// A few of the preset's settings are changed here, on the page only, so the
// button looks like part of the logo's screen rather than a panel on top:
// - its own background, vignette and dither paper go black, so (with the
//   CSS screen blend) only the particles show and the page's own scene
//   shows round them;
// - its CRT scanlines are spaced to match the logo scene's, which counts
//   its lines over the whole screen height rather than the button's;
// - no scan. Instead it has streamers (see the button's look, below).
const joinButton = document.querySelector('.button--geo');
const joinCanvas = joinButton && joinButton.querySelector('canvas');
if (joinCanvas && !reducedMotion) {
  joinButton.classList.add('is-loading');
  // Its wrapper doesn't fade in (css/site.css): the canvas fades itself.
  boot.classList.add('has-geo-button');
}

const LOGO_CRT_LINES = 910; // the homepage scene's line count

// ---- The Join button's look: streamers and hover
// Streamers are particles that peel off the letters, drift along the wind
// (the scene's "wind": 180 = to the left) and fade as they go.
const STREAMERS = 0.3; // how many peel off while resting (0 = none, 1 = every particle)
const STREAMERS_HOVER = 0.3; // how many on hover or keyboard focus
// How fast they drift (GEO_SC's Speed; 0 = frozen in place, which only dims
// the button). It stays the same on hover: GEO_SC works out where each
// streamer is from the clock times this, so easing it would scramble them.
const STREAMER_SPEED = 1;
const HOVER_COLOUR = '#f95f47'; // the particles on hover (resting: the scene's ink, white). Brightest = white
const HOVER_SECONDS = 0.35; // how long the change takes, in and out
// The button's opacity, resting and on hover: --join-opacity and
// --join-opacity-hover in css/site.css.

const BUTTON_LOOK = {
  bg: 'plain',
  bg_plain_c1: '#000000',
  fx_crt_vignette: 0,
  fx_dither_c1: '#000000',
  fx_ascii_c2: '#000000',
  scan: false,
  size: 2.4,
  stream: STREAMERS,
  speed: STREAMER_SPEED,
};
const crtLines = () =>
  Math.max(60, Math.round((LOGO_CRT_LINES * joinCanvas.clientHeight) / hero.clientHeight));

async function mountJoinButton() {
  if (!joinCanvas) return null;
  try {
    const base = new URL(joinCanvas.dataset.scene, location.href);
    const scene = await (await fetch(new URL('scene.json', base))).json();
    Object.assign(scene.settings, BUTTON_LOOK, { fx_crt_lines: crtLines() });
    scene.embedded = {
      [scene.files.logo]: new URL(scene.files.logo, base).href,
      [scene.files.depth]: new URL(scene.files.depth, base).href,
    };
    const player = await mount(joinCanvas, {
      scene,
      form: true,
      formSeconds: CLOUD_FORM_SECONDS,
      mobileScale: 1,
      minDensity: 900,
    });
    if (player) player.settings.scatter = CLOUD_SCATTER; // set live: scene settings only keep GEO_SC's own
    player?.pause(); // nothing to draw until it forms
    return player;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

// Where the logo's scan band is on screen, worked out the way GEO_SC draws
// it (its own look and camera code), from the logo's clock kept in step
// above (logoClock). The band runs across the logo from -0.3 to 1.3 (0 =
// the logo's left edge, 1 = its right), then starts again; the logo sits
// slightly turned and zooms a little on the beat, which this follows.
function scanOnScreen() {
  const logo = players.logo;
  const S = logo.settings;
  const start = logo.scene.clock || { time: 0, scan: 0, spin: 0 };
  const cam = logo.scene.camera || {};
  const time = logoClock.time;
  const run = time - start.time;
  const f = lookParams(S, {
    time,
    scan: start.scan + run * S.scanSpeed * 0.25,
    spin: start.spin + (run / tempo(S).cycle) * TAU * S.spin,
    cam: { yaw: cam.ty ?? 0, pitch: cam.tp ?? 0, zoom: cam.tz ?? 1 },
    mosh: { lastKeyIdx: -1 }, // a scratch copy: the logo's own is left alone
    scaleMul: logo.stats.scaleMul,
  });
  const W = hero.clientWidth;
  const H = hero.clientHeight;
  const [halfWidth] = Renderer.prototype.plane(logo.scene.source.aspect, W / H, f.scale);
  const { view, proj } = Renderer.prototype.matrices.call({ width: W, height: H }, f);
  // The band's point on the logo's middle row, through the camera to the screen.
  const x = (f.scanPos + SCAN_LEAD - 0.5) * 2 * halfWidth;
  const v = [0, 1, 2, 3].map((r) => view[r] * x + view[12 + r]);
  const clip = (r) => proj[r] * v[0] + proj[4 + r] * v[1] + proj[8 + r] * v[2] + proj[12 + r] * v[3];
  return ((clip(0) / clip(3) + 1) / 2) * W;
}

// Waits for the scan to reach the button's canvas, then resolves with a
// function that starts uncovering it behind the scan. Resolves null (no
// waiting, nothing to uncover) when there's no live logo or it has no scan.
function scanReachesButton() {
  if (!players.logo?.settings.scan || !logoClock.on) return Promise.resolve(null);
  const left = () => joinCanvas.getBoundingClientRect().left - SCAN_EDGE_PX;
  return new Promise((resolve) => {
    let before = scanOnScreen();
    const watch = () => {
      if (view !== 'home') return resolve(null); // gone to the join block meanwhile
      const now = scanOnScreen();
      // Crossed the canvas's left edge this frame (moving right, not wrapping round).
      if (before < left() && now >= left() && now > before) return resolve(uncover);
      before = now;
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  function uncover() {
    joinCanvas.style.setProperty('--scan-edge', `${SCAN_EDGE_PX}px`);
    joinCanvas.classList.add('is-scanning');
    const step = () => {
      const r = joinCanvas.getBoundingClientRect();
      const x = scanOnScreen() - r.left;
      joinCanvas.style.setProperty('--scan-x', `${x}px`);
      // All uncovered, or the scan wrapped round: the mask goes.
      if (x - SCAN_EDGE_PX > r.width || x < -SCAN_EDGE_PX) return joinCanvas.classList.remove('is-scanning');
      requestAnimationFrame(step);
    };
    step();
  }
}

let reaim = () => {};
function revealJoinButton(loading) {
  const plain = () => joinButton?.classList.remove('is-loading');
  const fallback = setTimeout(plain, BUTTON_WAIT_MS); // still loading after this: show the plain button
  loading.then(async (player) => {
    // The join block's font and particles get ready in the background now,
    // so it can come in straight away when the button is pressed.
    joinParts.then((parts) => parts?.warmUp().then(() => view === 'home' && parts.prepare()));
    if (!player) { plain(); mountBackdrop(); return; }
    clearTimeout(fallback);
    if (CLOUD_DELAY_MS) await new Promise((r) => setTimeout(r, CLOUD_DELAY_MS));
    const sweep = SCAN_REVEAL && view === 'home' ? await scanReachesButton() : null;
    players.button = player;
    if (view === 'home') player.resume();
    player.form(); // the particles fade in, already scattered as a cloud
    // The button only shows once it's drawing them. Until then the canvas
    // stays hidden: a paused one can show leftover graphics memory (Safari
    // showed black, or the ASCII effect's characters).
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    joinButton.classList.remove('is-loading');
    joinButton.classList.add('is-geo');
    sweep?.(); // uncovered behind the scan as it carries on across
    // Slow at the start and end, like the particles drifting together.
    setTimeout(() => { if (view === 'home') easeScatter(player, 0, CLOUD_SECONDS); }, CLOUD_HOLD_MS);
    addEventListener('resize', () => { player.settings.fx_crt_lines = crtLines(); });
    reaim = streamersOnHover(player);
    mountBackdrop();
  });
}

// On hover or keyboard focus the button eases to HOVER_COLOUR and more of
// its particles stream off (STREAMERS_HOVER); both ease back after.

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function streamersOnHover(player) {
  const s = player.settings;
  const rest = { stream: s.stream, ink: hexToRgb(s.ink) };
  const hover = { stream: STREAMERS_HOVER, ink: hexToRgb(HOVER_COLOUR) };
  let k = 0; // 0 = resting, 1 = full hover
  let target = 0;
  let raf = 0;
  let last = 0;
  const step = (now) => {
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    k += Math.sign(target - k) * Math.min(Math.abs(target - k), dt / HOVER_SECONDS);
    s.stream = rest.stream + (hover.stream - rest.stream) * k;
    s.ink = rgbToHex(rest.ink.map((v, i) => v + (hover.ink[i] - v) * k));
    if (k === target) { raf = 0; last = 0; return; }
    raf = requestAnimationFrame(step);
  };
  const aim = () => {
    const focused = joinButton.matches(':focus-visible') && !joinButton.classList.contains('is-quiet-focus');
    target = joinButton.matches(':hover') || focused ? 1 : 0;
    if (!raf) raf = requestAnimationFrame(step);
  };
  ['pointerenter', 'pointerleave', 'focus', 'blur'].forEach((type) =>
    joinButton.addEventListener(type, () => setTimeout(aim)));
  return aim;
}

// 2. The join block, in place. Pressing the button doesn't load a new page:
//    the logo and button burst into a cloud and fade, leaving the scene
//    running behind, and the join block comes in over it as it does on
//    /join/. The address bar still says /join/, so the page can be shared,
//    reloaded or bookmarked (that loads join/index.html). Back, and the
//    browser's back button, reverse it.
//    Without the script, or if this part fails to load, the button is just
//    a link to /join/.
const joinSection = document.querySelector('.screen--join');
const HOME_TITLE = document.title;
let view = 'home';
let trip = 0; // every change of view takes a number; a later one takes over

const joinParts = joinSection
  ? import('./join.js')
    .then((m) => ({
      ...m.setupJoin(joinSection, { backdrop: document.querySelector('.geo-backdrop'), keepCloud: true }),
      warmUp: m.warmUp,
      title: m.JOIN_TITLE,
      heading: joinSection.querySelector('.join__title'),
    }))
    .catch((err) => { console.warn(err); return null; })
  : Promise.resolve(null);
let join = null;
joinParts.then((parts) => { join = parts; });

// A plain click (or Enter): anything with a modifier key, or another mouse
// button, is left to open the link the usual way.
// Whether the last thing someone did was on the keyboard, so focus moved
// for them shows its ring only when it'd help.
let keyboardUser = false;
addEventListener('keydown', () => { keyboardUser = true; }, true);
addEventListener('pointerdown', () => { keyboardUser = false; }, true);

const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
const isJoinPath = (path) => /^\/join(\/(index\.html)?)?$/.test(path);

joinButton?.addEventListener('click', (e) => {
  if (!join || !plainClick(e)) return;
  e.preventDefault();
  history.pushState({ view: 'join' }, '', '/join/');
  showJoin();
});
joinSection?.querySelector('.join__back a').addEventListener('click', (e) => {
  if (!join || !plainClick(e)) return;
  e.preventDefault();
  if (history.state?.view === 'join') history.back(); // the popstate below does the rest
  else {
    history.pushState({ view: 'home' }, '', '/');
    showHome();
  }
});
addEventListener('popstate', () => {
  if (!join) return;
  if (isJoinPath(location.pathname)) showJoin();
  else showHome();
});

function showJoin() {
  if (view === 'join') return;
  view = 'join';
  const me = ++trip;
  const seconds = reducedMotion ? 0 : AWAY_SECONDS;
  document.title = join.title;
  document.documentElement.style.setProperty('--away-fade', `${seconds}s`);
  mountBackdrop();
  playInStep();
  hero.classList.add('is-away');
  boot.classList.add('is-away');
  boot.inert = true;
  joinSection.hidden = false;
  easeScatter(players.logo, LOGO_BURST, seconds, { ease: burst });
  easeScatter(players.button, BUTTON_BURST, seconds, { ease: burst });
  const gone = wait(seconds * 1000);
  join.arrive(); // the cloud starts forming at once, as the logo bursts
  join.heading.focus({ preventScroll: true }); // after arrive(), which makes the block focusable again
  gone.then(() => {
    if (me !== trip) return;
    players.logo?.pause(); // out of sight: stop drawing it
    runLogoClock(false);
    players.button?.pause();
  });
}

async function showHome() {
  if (view === 'home') return;
  view = 'home';
  const me = ++trip;
  const seconds = reducedMotion ? 0 : BACK_SECONDS;
  document.title = HOME_TITLE;
  const left = join.leave();
  await wait(reducedMotion ? 0 : BACK_DELAY_MS);
  if (me !== trip) return;
  document.documentElement.style.setProperty('--away-fade', `${seconds}s`);
  playInStep();
  players.button?.resume();
  hero.classList.remove('is-away');
  boot.classList.remove('is-away');
  boot.inert = false;
  // Focus goes back to the button. Its focus ring (and hover look) only
  // shows for someone using the keyboard, not after a tap or click.
  joinButton.classList.toggle('is-quiet-focus', !keyboardUser);
  joinButton.addEventListener('blur', () => joinButton.classList.remove('is-quiet-focus'), { once: true });
  joinButton.focus({ preventScroll: true });
  reaim();
  easeScatter(players.logo, 0, seconds);
  easeScatter(players.button, 0, seconds);
  const [gone] = await Promise.all([left, wait(seconds * 1000)]);
  if (me !== trip) return;
  players.backdrop?.pause(); // out of sight under the logo: stop drawing it
  if (gone) joinSection.hidden = true;
}
