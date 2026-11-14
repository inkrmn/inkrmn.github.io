// INKRMN join page script
import { mount } from '/geo-sc/player.js';

document.documentElement.classList.add('js');

// ---- Timings (milliseconds unless the name says otherwise)
// The page: the backdrop draws, then the page's text arrives as a particle
// cloud that settles into place, and the real text fades in over it.
const BACKDROP_WAIT_MS = 3000; // the backdrop hasn't drawn by now: carry on without it
const CLOUD_WAIT_MS = 3000; // the cloud isn't ready this long after the backdrop: plain fade instead
const CLOUD_DELAY_MS = 0; // after the backdrop draws, before the cloud fades in (the backdrop's own fade)
const CLOUD_FORM_SECONDS = 2; // how long the particles take to fade in
const CLOUD_SCATTER = 2; // how spread out the cloud starts (0 = no cloud)
const CLOUD_HOLD_MS = 0; // how long the cloud hangs, from when it starts fading in, before settling
const CLOUD_SECONDS = 1.2; // how long settling takes
const CROSSFADE_AT = 95; // how far settled (%) the cloud is when the real text starts fading in
const CROSSFADE_SECONDS = 0.75; // how long the cross-fade takes: real text in, particles out (they keep settling meanwhile)
const QUICK_FADE_SECONDS = 0.4; // cutting the cloud short (someone starts typing, or the window changes size)

// ---- The cloud's look
// Smaller, denser particles than the homepage button, so small text reads.
const CLOUD_SIZE = 1.6; // particle size, relative to the gap between particles
const CLOUD_SPACING_PX = 0.75; // gap between particles, in CSS pixels (sets the particle count)
const CLOUD_MAX_DPR = 2; // sharpest the drawn text image gets
// Room round the text for the cloud to hang in, as a share of the text's
// width and height on each side (kept inside the window).
const CLOUD_ROOM_X = 0.25;
const CLOUD_ROOM_Y = 0.5;
const CLOUD_SCENE = '/scenes/join-button/';
const LOGO_CRT_LINES = 910; // the backdrop scene's CRT line count, over the whole screen
// GEO_SC fits an image to 0.82 × scale of the canvas (renderer.js, plane()).
// With the image the same shape as the canvas, this scale makes it fill the
// canvas exactly, so a pixel in the image lands on the same pixel on screen.
const FILL_SCALE = 1 / 0.82;
// Same page-side tweaks as BUTTON_LOOK in js/site.js: no background,
// vignette or dither paper, so (with the screen blend) only particles show.
// Plus flat and still: nothing moves except the cloud settling.
const CLOUD_LOOK = {
  bg: 'plain',
  bg_plain_c1: '#000000',
  fx_crt_vignette: 0,
  fx_dither_c1: '#000000',
  fx_ascii_c2: '#000000',
  scan: false,
  depthMode: 'flat',
  key: 0,
  colorMode: 'ink',
  tilt: 0, sway: 0, spin: 0, dolly: 0, twist: 0, wave: 0, ripple: 0, drift: 0, depth: 0,
  density: 'dense',
  size: CLOUD_SIZE,
  scale: FILL_SCALE,
};

const backdrop = document.querySelector('.geo-hero');
const join = document.querySelector('.join');
const cloudCanvas = document.querySelector('.join-cloud');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Shows the real text. With a duration, fades it in over that long.
let shown = false;
function showText(seconds) {
  if (shown) return;
  shown = true;
  if (seconds) document.documentElement.style.setProperty('--join-fade', `${seconds}s`);
  join.classList.add('is-ready');
}

// 1. The backdrop: the homepage scene with no logo, behind the page.
const backdropDone = new Promise((resolve) => {
  setTimeout(resolve, BACKDROP_WAIT_MS);
  mount(backdrop.querySelector('canvas'), { scene: '/scenes/background/' })
    .then(resolve)
    .catch((err) => { console.warn(err); resolve(); });
});

// 2. The cloud. Built straight away (it waits for the fonts), played once
//    the backdrop is drawing. If anything goes wrong, the text just fades in.
const cloudReady = reducedMotion || !cloudCanvas ? Promise.resolve(null) : buildCloud().catch((err) => {
  console.warn(err);
  return null;
});

backdropDone.then(async () => {
  const player = await Promise.race([cloudReady, wait(CLOUD_WAIT_MS).then(() => null)]);
  if (!player) {
    cloudReady.then((late) => late?.destroy());
    cloudCanvas?.remove();
    showText();
    return;
  }
  await wait(CLOUD_DELAY_MS);
  playCloud(player);
});

async function buildCloud() {
  await document.fonts.ready;
  const box = cloudBox();
  if (box.w < 1 || box.h < 1) return null;
  Object.assign(cloudCanvas.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
  cloudCanvas.style.setProperty('--cloud-room-x', `${box.roomX}px`);
  cloudCanvas.style.setProperty('--cloud-room-y', `${box.roomY}px`);

  const dpr = Math.min(devicePixelRatio || 1, CLOUD_MAX_DPR);
  const image = drawText(box, dpr);
  const logoURL = URL.createObjectURL(await new Promise((r) => image.toBlob(r, 'image/png')));

  const base = new URL(CLOUD_SCENE, location.href);
  const scene = await (await fetch(new URL('scene.json', base))).json();
  Object.assign(scene.settings, CLOUD_LOOK, {
    fx_crt_lines: Math.max(60, Math.round((LOGO_CRT_LINES * box.h) / backdrop.clientHeight)),
  });
  scene.source = { ...scene.source, width: image.width, height: image.height, aspect: box.w / box.h };
  scene.embedded = {
    [scene.files.logo]: logoURL,
    [scene.files.depth]: new URL(scene.files.depth, base).href, // flat: one pixel
  };
  try {
    const player = await mount(cloudCanvas, {
      scene,
      form: true,
      formSeconds: CLOUD_FORM_SECONDS,
      mobileScale: 1, // no enlarging on portrait screens: it has to land on the real text
      minDensity: Math.round(Math.max(box.w, box.h) / CLOUD_SPACING_PX),
      interactive: false,
    });
    if (!player) return null;
    player.settings.scatter = CLOUD_SCATTER; // set live: scene settings only keep GEO_SC's own
    player.pause(); // nothing to draw until it forms
    return player;
  } finally {
    URL.revokeObjectURL(logoURL);
  }
}

// The area the cloud draws in: the text plus room round it, inside the window.
function cloudBox() {
  const r = join.getBoundingClientRect();
  const left = Math.max(0, Math.floor(r.left - r.width * CLOUD_ROOM_X));
  const top = Math.max(0, Math.floor(r.top - r.height * CLOUD_ROOM_Y));
  const right = Math.min(innerWidth, Math.ceil(r.right + r.width * CLOUD_ROOM_X));
  const bottom = Math.min(innerHeight, Math.ceil(r.bottom + r.height * CLOUD_ROOM_Y));
  // The narrowest gap between the text and the edge, for the soft edges.
  const roomX = Math.max(0, Math.min(r.left - left, right - r.right));
  const roomY = Math.max(0, Math.min(r.top - top, bottom - r.bottom));
  return { x: left, y: top, w: right - left, h: bottom - top, roomX, roomY };
}

// Draws the page's text, white on transparent, where it sits on screen.
// Brightness sets how bright the particles are (ink colour mode), so dimmer
// text is drawn grey rather than see-through (GEO_SC drops anything under
// half opacity).
function drawText(box, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.round(box.w * dpr);
  c.height = Math.round(box.h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.translate(-box.x, -box.y);

  const grey = (el) => {
    const v = Math.round(255 * Math.min(1, +getComputedStyle(el).opacity));
    return `rgb(${v} ${v} ${v})`;
  };

  drawGlyphs(ctx, join.querySelector('.join__title'), '#fff');
  drawGlyphs(ctx, join.querySelector('.join__lede'), grey(join.querySelector('.join__lede')));

  const email = join.querySelector('.signup__email');
  if (email && email.offsetParent) {
    drawOutline(ctx, email, '#fff');
    if (!email.value) drawPlaceholder(ctx, email, 'rgb(128 128 128)'); // the placeholder is at half opacity
  }
  const submit = join.querySelector('.signup__submit');
  if (submit && submit.offsetParent) {
    drawOutline(ctx, submit, '#fff');
    drawGlyphs(ctx, submit, '#fff');
  }

  const back = join.querySelector('.join__back a');
  if (back) {
    drawGlyphs(ctx, back, '#fff');
    drawUnderline(ctx, back, '#fff');
  }
  return c;
}

function fontOf(style) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function caseOf(style, text) {
  if (style.textTransform === 'uppercase') return text.toUpperCase();
  if (style.textTransform === 'lowercase') return text.toLowerCase();
  return text;
}

// Each character drawn at the spot the browser laid it out, so letter
// spacing, kerning and line breaks all match the real text.
function drawGlyphs(ctx, el, colour) {
  if (!el) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  ctx.fillStyle = colour;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const style = getComputedStyle(node.parentElement);
    ctx.font = fontOf(style);
    const text = node.textContent;
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) continue;
      const ch = caseOf(style, text[i]);
      const m = ctx.measureText(ch);
      // The character's box is the font's ascent plus descent; the baseline
      // sits the ascent down from its top.
      const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
      const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
      const baseline = rect.top + (rect.height * ascent) / (ascent + descent || 1);
      ctx.fillText(ch, rect.left, baseline);
    }
  }
}

function drawOutline(ctx, el, colour) {
  const r = el.getBoundingClientRect();
  const lw = parseFloat(getComputedStyle(el).borderTopWidth) || 0;
  if (!lw) return;
  ctx.strokeStyle = colour;
  ctx.lineWidth = lw;
  ctx.strokeRect(r.left + lw / 2, r.top + lw / 2, r.width - lw, r.height - lw);
}

// The field's placeholder isn't in the page's text, so it's laid out here:
// at the start of the content box, centred down it, as inputs place it.
function drawPlaceholder(ctx, input, colour) {
  const style = getComputedStyle(input);
  const ph = getComputedStyle(input, '::placeholder');
  const text = caseOf(ph, input.placeholder);
  const r = input.getBoundingClientRect();
  const spacing = parseFloat(style.letterSpacing) || 0;
  ctx.font = fontOf(style);
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic'; // set before measuring: the font box is measured from the baseline
  const left = r.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  const top = r.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
  const bottom = r.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom);
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent;
  // Centre the font's box (not the letters) in the content box, as the browser does.
  const baseline = (top + bottom) / 2 + (ascent - descent) / 2;
  let x = left;
  for (const ch of text) {
    ctx.fillText(ch, x, baseline);
    x += ctx.measureText(ch).width + spacing;
  }
}

function drawUnderline(ctx, el, colour) {
  const style = getComputedStyle(el);
  const rect = el.getClientRects()[0];
  if (!rect || !style.textDecorationLine.includes('underline')) return;
  ctx.font = fontOf(style);
  const m = ctx.measureText('x');
  const ascent = m.fontBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent;
  const baseline = rect.top + (rect.height * ascent) / (ascent + descent || 1);
  const size = parseFloat(style.fontSize);
  const offset = parseFloat(style.textUnderlineOffset) || size * 0.1;
  const thick = Math.max(1, size / 14);
  // The underline stops at the last letter, not after its letter spacing.
  const width = rect.width - (parseFloat(style.letterSpacing) || 0);
  ctx.fillStyle = colour;
  ctx.fillRect(rect.left, baseline + offset, width, thick);
}

// The cloud fades in, hangs, settles; in the last part of settling the real
// text fades in as the particles fade out. Then the cloud is put away.
function playCloud(player) {
  const fade = (seconds) => {
    cloudCanvas.style.setProperty('--cloud-fade', `${seconds}s`);
    cloudCanvas.classList.remove('is-on');
    showText(seconds);
    setTimeout(() => {
      player.destroy();
      cloudCanvas.remove();
    }, seconds * 1000 + 100);
  };
  let finished = false;
  const finish = (seconds) => {
    if (finished) return;
    finished = true;
    removeEventListener('resize', onResize);
    join.removeEventListener('focusin', cutShort);
    fade(seconds);
  };
  // Typing, tabbing in, or the window changing shape so the text moves (the
  // cloud wouldn't line up any more): cut straight to the real text. Phones
  // send resizes for toolbars too, which don't move it, so those are ignored.
  const at = join.getBoundingClientRect();
  const cutShort = () => finish(QUICK_FADE_SECONDS);
  const onResize = () => {
    const now = join.getBoundingClientRect();
    if (Math.abs(now.left - at.left) > 1 || Math.abs(now.top - at.top) > 1 || Math.abs(now.width - at.width) > 1) cutShort();
  };
  addEventListener('resize', onResize);
  join.addEventListener('focusin', cutShort);
  if (join.contains(document.activeElement)) return cutShort();

  cloudCanvas.classList.add('is-on');
  player.resume();
  player.form(); // the particles fade in, already scattered as a cloud
  setTimeout(() => {
    if (finished) return;
    const start = performance.now();
    // Keeps settling through the cross-fade, so the particles land on the
    // text as it appears rather than stopping where they were.
    const step = (now) => {
      const t = Math.min(1, (now - start) / (CLOUD_SECONDS * 1000));
      const ease = t * t * (3 - 2 * t); // slow at the start and end, like drifting together
      player.settings.scatter = CLOUD_SCATTER * (1 - ease);
      if (ease * 100 >= CROSSFADE_AT) finish(CROSSFADE_SECONDS); // does nothing once it's started
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, CLOUD_HOLD_MS);
}

// 3. Sign up. Sends the address to MailerLite in the background, so nobody
//    leaves the page. MailerLite then emails them a link to confirm.
const form = document.querySelector('.signup');
const status = form.querySelector('.signup__status');
const submit = form.querySelector('.signup__submit');

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
    status.textContent = 'Nearly there. Check your email and tap the link to confirm.';
  } catch (err) {
    console.warn(err);
    submit.disabled = false;
    status.textContent = "That didn't send. Try again, or email hello@inkr.mn.";
  }
});
