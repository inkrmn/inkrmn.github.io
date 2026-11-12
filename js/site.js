// INKRMN site script
import { mount } from '/geo-sc/player.js';

// The page works without any of this: the class only switches on the extras.
document.documentElement.classList.add('js');

// 1. GEO_SC: the logo behind the page. The still stays if anything goes wrong.
const hero = document.querySelector('.geo-hero');

// The button appears three seconds after the logo first shows. If the logo
// can't run, the still counts instead.
const boot = document.getElementById('boot');
const REVEAL_MS = 3000; // matches the delay on .boot__after in the CSS
const bootReady = () => {
  if (boot.classList.contains('is-ready')) return;
  boot.classList.add('is-ready');
  const player = mountJoinButton(); // loads while the logo plays alone
  setTimeout(() => revealJoinButton(player), REVEAL_MS);
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
    const player = await mount(joinCanvas, { scene, form: true, mobileScale: 1, minDensity: 420 });
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
    player.form();
    addEventListener('resize', () => { player.settings.fx_crt_lines = crtLines(); });
    streamersOnHover(player);
  });
}

// Streamers ease up to full while the button is hovered or has keyboard
// focus, and back down to the preset's value after.
function streamersOnHover(player) {
  const rest = player.settings.stream;
  let target = rest;
  let raf = 0;
  const step = () => {
    const s = player.settings;
    s.stream += (target - s.stream) * 0.2;
    if (Math.abs(target - s.stream) < 0.002) { s.stream = target; raf = 0; return; }
    raf = requestAnimationFrame(step);
  };
  const aim = () => {
    target = joinButton.matches(':hover, :focus-visible') ? STREAMERS_MAX : rest;
    if (!raf) raf = requestAnimationFrame(step);
  };
  ['pointerenter', 'pointerleave', 'focus', 'blur'].forEach((type) =>
    joinButton.addEventListener(type, () => setTimeout(aim)));
}

// 2. Sign up. The button opens the form; the form sends the address to
//    MailerLite in the background, so nobody leaves the page. MailerLite then
//    emails them a link to confirm.
const signupButton = document.querySelector('.boot__signup .button');
const form = document.getElementById('signup');

if (signupButton && form) {
  const status = form.querySelector('.signup__status');
  const submit = form.querySelector('.signup__submit');

  signupButton.addEventListener('click', () => {
    const open = form.classList.toggle('is-open');
    signupButton.setAttribute('aria-expanded', String(open));
    if (open) form.querySelector('input[type=email]').focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Sending...';
    try {
      // MailerLite's reply can't be read from another site ('no-cors'),
      // but the address still reaches them.
      await fetch(form.action, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams(new FormData(form)),
      });
      form.classList.add('is-done');
      status.textContent = 'Saved.';
    } catch (err) {
      console.warn(err);
      submit.disabled = false;
      status.textContent = "That didn't send. Try again, or email hello@inkr.mn.";
    }
  });
}
