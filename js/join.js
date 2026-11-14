// INKRMN join mailing list: the part both pages share.
// /join/ uses it on its own (js/join-page.js); the homepage brings the same
// block in over its scene without loading a new page (js/site.js).
import { mount } from '/geo-sc/player.js';
import { easeScatter, burst } from './scatter.js';

// ---- Timings (milliseconds unless the name says otherwise)
// Arriving: the page's text arrives straight away as a particle cloud that
// settles into place, and the real text fades in over it. (It doesn't wait
// for the backdrop, or on the homepage for the logo to finish going.)
const CLOUD_WAIT_MS = 3000; // the cloud isn't ready this long after arriving: plain fade instead
const CLOUD_DELAY_MS = 0; // after arriving, before the cloud fades in
const CLOUD_FORM_SECONDS = 2; // how long the particles take to fade in
const CLOUD_SCATTER = 2; // how spread out the cloud starts (0 = no cloud)
const CLOUD_HOLD_MS = 0; // how long the cloud hangs, from when it starts fading in, before settling
const CLOUD_SECONDS = 1.2; // how long settling takes
const CROSSFADE_AT = 95; // how far settled (%) the cloud is when the real text starts fading in
const CROSSFADE_SECONDS = 0.75; // how long the cross-fade takes: real text in, particles out (they keep settling meanwhile)
const QUICK_FADE_SECONDS = 0.4; // cutting the cloud short (someone starts typing, or the window changes size)
// Leaving (Back on the homepage): the real text swaps for particles lying
// on it, which burst back out into the cloud and fade away.
const LEAVE_WAIT_MS = 600; // the particles aren't ready this long after Back: the text just fades
const LEAVE_CROSSFADE_SECONDS = 0.25; // real text out, particles in (they line up, so nothing seems to move)
const LEAVE_SECONDS = 0.9; // how long the particles take to burst out into the cloud
const LEAVE_FADE_SECONDS = 0.7; // how long the cloud takes to fade out (starts with the burst)

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

export const JOIN_TITLE = 'Join the mailing list – INKRMN'; // the page title while it shows (as in join/index.html)

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Loads the font and the cloud's scene ahead of time, so the cloud can be
// drawn as soon as it's wanted. Safe to call more than once.
let warmed = null;
export function warmUp() {
  warmed ||= Promise.all([
    document.fonts.load('400 16px Archivo'),
    document.fonts.load('900 16px Archivo'),
    fetch(new URL('scene.json', new URL(CLOUD_SCENE, location.href))),
  ]).catch(() => {});
  return warmed;
}

// Sets up the join block in `section` (a .screen--join). `backdrop` is the
// logo-free scene behind it, for matching its scanlines. With `keepCloud`
// the particles are kept between visits, ready to burst back out on leave().
export function setupJoin(section, { backdrop, keepCloud = false }) {
  const join = section.querySelector('.join');
  const title = join.querySelector('.join__title');
  const email = join.querySelector('.signup__email');
  const form = join.querySelector('.signup');
  const status = form.querySelector('.signup__status');
  let canvas = section.querySelector('.join-cloud');

  setupSignup(form);

  // Every arrive or leave takes a turn; a step that finds a later turn has
  // been overtaken and stops.
  let turn = 0;
  let cloud = null; // { player, key }: the particles, and what they were drawn from
  let building = null; // { promise, key }
  let unlisten = () => {};

  const textIn = (seconds = 0.8) => {
    join.style.setProperty('--join-fade', `${seconds}s`);
    join.classList.add('is-ready');
  };
  const textOut = (seconds) => {
    join.style.setProperty('--join-fade', `${seconds}s`);
    join.classList.remove('is-ready');
  };
  const cloudFade = (on, seconds) => {
    canvas.style.setProperty('--cloud-fade', `${seconds}s`);
    canvas.classList.toggle('is-on', on);
  };

  // What the particles show. If the text moves, someone types, or the form
  // changes, they have to be drawn again.
  const drawnFrom = () => {
    const r = join.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height, devicePixelRatio, email.value, form.className, status.textContent].join('|');
  };

  // Puts away the particles made so far (and any being made), on a fresh
  // canvas, so the old graphics context goes with them.
  const dropCloud = () => {
    if (!cloud && !building) return;
    cloud?.player.destroy();
    cloud = null;
    building = null;
    const fresh = canvas.cloneNode(false);
    fresh.removeAttribute('style');
    fresh.className = 'join-cloud';
    canvas.replaceWith(fresh);
    canvas = fresh;
  };

  // The particles for the text as it is now: the ones already made if they
  // still match, otherwise new ones. `formed`: drawn in full straight away
  // (for leaving), rather than empty and waiting for form() (for arriving).
  function particles(formed) {
    const key = drawnFrom();
    if (cloud?.key === key) return Promise.resolve(cloud.player);
    if (building?.key === key) return building.promise;
    dropCloud();
    const promise = buildCloud(canvas, formed)
      .then((player) => {
        if (building?.promise !== promise) { player?.destroy(); return null; } // overtaken
        building = null;
        if (player) cloud = { player, key };
        return player;
      })
      .catch((err) => {
        console.warn(err);
        if (building?.promise === promise) building = null;
        return null;
      });
    building = { promise, key };
    return promise;
  }

  async function buildCloud(target, formed) {
    await warmUp();
    await document.fonts.ready;
    const box = cloudBox(join);
    if (box.w < 1 || box.h < 1) return null;
    Object.assign(target.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
    target.style.setProperty('--cloud-room-x', `${box.roomX}px`);
    target.style.setProperty('--cloud-room-y', `${box.roomY}px`);

    const dpr = Math.min(devicePixelRatio || 1, CLOUD_MAX_DPR);
    const image = drawText(join, box, dpr);
    const logoURL = URL.createObjectURL(await new Promise((r) => image.toBlob(r, 'image/png')));

    const base = new URL(CLOUD_SCENE, location.href);
    const scene = await (await fetch(new URL('scene.json', base))).json();
    const screenH = backdrop?.clientHeight || innerHeight;
    Object.assign(scene.settings, CLOUD_LOOK, {
      fx_crt_lines: Math.max(60, Math.round((LOGO_CRT_LINES * box.h) / screenH)),
    });
    scene.source = { ...scene.source, width: image.width, height: image.height, aspect: box.w / box.h };
    scene.embedded = {
      [scene.files.logo]: logoURL,
      [scene.files.depth]: new URL(scene.files.depth, base).href, // flat: one pixel
    };
    try {
      const player = await mount(target, {
        scene,
        form: !formed,
        formSeconds: CLOUD_FORM_SECONDS,
        mobileScale: 1, // no enlarging on portrait screens: it has to land on the real text
        minDensity: Math.round(Math.max(box.w, box.h) / CLOUD_SPACING_PX),
        interactive: false,
      });
      if (!player) return null;
      player.settings.scatter = formed ? 0 : CLOUD_SCATTER; // set live: scene settings only keep GEO_SC's own
      player.pause(); // nothing to draw until it's wanted
      return player;
    } finally {
      URL.revokeObjectURL(logoURL);
    }
  }

  // Once the particles have done their part: kept (paused) for next time,
  // or put away for good.
  const restCloud = (player) => {
    if (keepCloud) return player.pause();
    if (cloud?.player !== player) return;
    player.destroy();
    cloud = null;
    canvas.remove();
  };

  // Brings the block in. After `after` (a promise: the backdrop drawing, or
  // the homepage clearing), the text arrives as a cloud that settles into
  // place, then the real text fades in over it.
  async function arrive(after = Promise.resolve()) {
    const me = ++turn;
    unlisten();
    section.inert = false;
    const ready = reducedMotion || !canvas.isConnected ? Promise.resolve(null) : particles(false);
    // Someone tabbing or tapping into the form before the cloud has started
    // gets the real text straight away, and no cloud.
    let early = false;
    const onFocus = (e) => {
      if (e.target === title) return;
      early = true;
      unlisten();
      textIn(QUICK_FADE_SECONDS);
      if (!keepCloud) ready.then((late) => late && restCloud(late));
    };
    join.addEventListener('focusin', onFocus);
    unlisten = () => {
      join.removeEventListener('focusin', onFocus);
      unlisten = () => {};
    };
    await after;
    if (me !== turn || early) return;
    const player = await Promise.race([ready, wait(CLOUD_WAIT_MS).then(() => null)]);
    if (me !== turn || early) return;
    unlisten();
    if (!player) {
      if (!keepCloud) ready.then((late) => late && restCloud(late));
      textIn(reducedMotion ? 0 : 0.8);
      return;
    }
    await wait(CLOUD_DELAY_MS);
    if (me !== turn) return;
    play(player, me);
  }

  // The cloud fades in, hangs, settles; in the last part of settling the real
  // text fades in as the particles fade out. Then the cloud is put away.
  function play(player, me) {
    let finished = false;
    let settled = Promise.resolve();
    const finish = (seconds) => {
      if (finished) return;
      finished = true;
      unlisten();
      cloudFade(false, seconds);
      textIn(seconds);
      Promise.all([settled, wait(seconds * 1000 + 100)]).then(() => {
        if (me === turn) restCloud(player);
      });
    };
    // Typing, tabbing in, or the window changing shape so the text moves (the
    // cloud wouldn't line up any more): cut straight to the real text. Phones
    // send resizes for toolbars too, which don't move it, so those are
    // ignored. The heading gets focus on arrival, so that doesn't count.
    const at = join.getBoundingClientRect();
    const cutShort = () => finish(QUICK_FADE_SECONDS);
    const onFocus = (e) => { if (e.target !== title) cutShort(); };
    const onResize = () => {
      const now = join.getBoundingClientRect();
      if (Math.abs(now.left - at.left) > 1 || Math.abs(now.top - at.top) > 1 || Math.abs(now.width - at.width) > 1) cutShort();
    };
    addEventListener('resize', onResize);
    join.addEventListener('focusin', onFocus);
    unlisten = () => {
      removeEventListener('resize', onResize);
      join.removeEventListener('focusin', onFocus);
      unlisten = () => {};
    };
    const active = document.activeElement;
    if (join.contains(active) && active !== title) return cutShort();

    player.settings.scatter = CLOUD_SCATTER;
    cloudFade(true, 0.6);
    player.resume();
    player.form(); // the particles fade in, already scattered as a cloud
    settled = wait(CLOUD_HOLD_MS).then(() => {
      if (me !== turn) return;
      // Keeps settling through the cross-fade, so the particles land on the
      // text as it appears rather than stopping where they were.
      return easeScatter(player, 0, CLOUD_SECONDS, {
        onStep: (ease) => { if (ease * 100 >= CROSSFADE_AT) finish(CROSSFADE_SECONDS); }, // does nothing once it's started
      });
    });
  }

  // Takes the block away (Back on the homepage): the text swaps for
  // particles lying exactly on it, which burst out into the cloud as they
  // fade. Resolves true once it's gone, false if something else took over.
  async function leave() {
    const me = ++turn;
    unlisten();
    section.inert = true;
    const player = reducedMotion || !canvas.isConnected
      ? null
      : await Promise.race([particles(true), wait(LEAVE_WAIT_MS).then(() => null)]);
    if (me !== turn) return false;
    if (!player) {
      const seconds = reducedMotion ? 0 : LEAVE_FADE_SECONDS;
      cloudFade(false, seconds);
      textOut(seconds);
      await wait(seconds * 1000);
      return me === turn;
    }
    player.resume();
    // Shown only once it's drawing again: a paused canvas can show leftover
    // graphics memory in some browsers (Safari).
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (me !== turn) return false;
    if (!canvas.classList.contains('is-on')) cloudFade(true, LEAVE_CROSSFADE_SECONDS);
    textOut(LEAVE_CROSSFADE_SECONDS);
    const scattered = easeScatter(player, CLOUD_SCATTER, LEAVE_SECONDS, { ease: burst });
    await wait(LEAVE_CROSSFADE_SECONDS * 1000);
    if (me !== turn) return false;
    cloudFade(false, LEAVE_FADE_SECONDS);
    await Promise.all([scattered, wait(LEAVE_FADE_SECONDS * 1000)]);
    if (me !== turn) return false;
    player.pause();
    return true;
  }

  // Makes the particles ahead of time (the homepage does this while it's
  // idle), so arrive() can start forming them at once. The block has to be
  // laid out to be measured, so it's shown, unseen and untouchable, while
  // they're drawn, then hidden again.
  async function prepare() {
    if (reducedMotion || !canvas.isConnected || !section.hidden) return;
    section.style.visibility = 'hidden';
    section.hidden = false;
    const ready = particles(false);
    // Drawing the text image is the part that needs the layout; the rest
    // (starting the particles) can carry on once it's hidden again.
    await Promise.race([ready, wait(CLOUD_WAIT_MS)]);
    if (turn === 0 || section.inert) section.hidden = true; // not arrived meanwhile
    section.style.visibility = '';
  }

  return { arrive, leave, prepare, title };
}

// The area the cloud draws in: the text plus room round it, inside the window.
function cloudBox(join) {
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

// Draws the block's text, white on transparent, where it sits on screen.
// Brightness sets how bright the particles are (ink colour mode), so dimmer
// text is drawn grey rather than see-through (GEO_SC drops anything under
// half opacity).
function drawText(join, box, dpr) {
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
    if (email.value) drawFieldText(ctx, email, email.value, '#fff'); // what's been typed, for leaving
    else drawFieldText(ctx, email, caseOf(getComputedStyle(email, '::placeholder'), email.placeholder), 'rgb(128 128 128)'); // the placeholder is at half opacity
  }
  const submit = join.querySelector('.signup__submit');
  if (submit && submit.offsetParent) {
    drawOutline(ctx, submit, '#fff');
    drawGlyphs(ctx, submit, '#fff');
  }
  const status = join.querySelector('.signup__status');
  if (status && status.textContent) drawGlyphs(ctx, status, '#fff');

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

// Text inside the field (the placeholder, or what's been typed) isn't in the
// page's text, so it's laid out here: at the start of the content box,
// centred down it, as inputs place it, and cut off at its edge.
function drawFieldText(ctx, input, text, colour) {
  const style = getComputedStyle(input);
  const r = input.getBoundingClientRect();
  const spacing = parseFloat(style.letterSpacing) || 0;
  ctx.font = fontOf(style);
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic'; // set before measuring: the font box is measured from the baseline
  const left = r.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  const right = r.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
  const top = r.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
  const bottom = r.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom);
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent;
  // Centre the font's box (not the letters) in the content box, as the browser does.
  const baseline = (top + bottom) / 2 + (ascent - descent) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, r.top, right - left, r.height);
  ctx.clip();
  let x = left;
  for (const ch of text) {
    ctx.fillText(ch, x, baseline);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.restore();
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

// Sign up. Sends the address to MailerLite in the background, so nobody
// leaves the page. MailerLite then emails them a link to confirm.
function setupSignup(form) {
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
}
