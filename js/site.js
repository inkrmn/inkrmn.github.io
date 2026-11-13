// INKRMN site script
import { mount } from '/geo-sc/player.js';

// The page works without any of this: the class only switches on the extras.
document.documentElement.classList.add('js');

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
setTimeout(() => { showStill(); bootReady(); }, 6000); // never leave the page empty for long

mount(hero.querySelector('canvas'), { scene: '/geo-sc/scenes/ink-mn-homepage/' })
  .then((player) => { if (!player) showStill(); bootReady(); })
  .catch((err) => { console.warn(err); showStill(); bootReady(); });

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
// - no scan. Instead the streamers go to full on hover.
const joinButton = document.querySelector('.button--geo');
const joinCanvas = joinButton && joinButton.querySelector('canvas');
if (joinCanvas && !matchMedia('(prefers-reduced-motion: reduce)').matches) joinButton.classList.add('is-loading');

// The cloud: how spread out it starts (0 = no cloud), how long it hangs
// before settling, and how long settling takes.
const CLOUD_SCATTER = 0.8;
const CLOUD_HOLD_MS = 1000;
const CLOUD_SECONDS = 2.5;

const LOGO_CRT_LINES = 910; // the homepage scene's line count
const STREAMERS_MAX = 0.4; // GEO_SC's top Streamers value
const BUTTON_LOOK = {
  bg: 'plain',
  bg_plain_c1: '#000000',
  fx_crt_vignette: 0,
  fx_dither_c1: '#000000',
  fx_ascii_c2: '#000000',
  scan: false,
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
    const player = await mount(joinCanvas, { scene, form: true, mobileScale: 1, minDensity: 900 });
    if (player) player.settings.scatter = CLOUD_SCATTER; // set live: scene settings only keep GEO_SC's own
    player?.pause(); // nothing to draw until it forms
    return player;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

function revealJoinButton(loading) {
  const plain = () => joinButton?.classList.remove('is-loading');
  const fallback = setTimeout(plain, 4000); // still loading after this: show the plain button
  loading.then((player) => {
    if (!player) return plain();
    clearTimeout(fallback);
    joinButton.classList.remove('is-loading');
    joinButton.classList.add('is-geo');
    player.resume();
    player.form(); // the particles fade in, already scattered as a cloud
    setTimeout(() => settleCloud(player), CLOUD_HOLD_MS);
    addEventListener('resize', () => { player.settings.fx_crt_lines = crtLines(); });
    streamersOnHover(player);
  });
}

// Eases the scatter from the cloud down to nothing: slow at the start and
// end, like the particles drifting together.
function settleCloud(player) {
  const from = CLOUD_SCATTER;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / (CLOUD_SECONDS * 1000));
    const ease = t * t * (3 - 2 * t);
    player.settings.scatter = from * (1 - ease);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// On hover or keyboard focus the button eases to the scan's red/orange
// (the preset's accent colour) and the streamers go to full; both ease back
// after.
const HOVER_SECONDS = 0.35; // how long the change takes

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function streamersOnHover(player) {
  const s = player.settings;
  const rest = { stream: s.stream, ink: hexToRgb(s.ink) };
  const hover = { stream: STREAMERS_MAX, ink: hexToRgb(s.accent) };
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
    target = joinButton.matches(':hover, :focus-visible') ? 1 : 0;
    if (!raf) raf = requestAnimationFrame(step);
  };
  ['pointerenter', 'pointerleave', 'focus', 'blur'].forEach((type) =>
    joinButton.addEventListener(type, () => setTimeout(aim)));
}
