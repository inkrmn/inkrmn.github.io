// INKRMN site script
import { mount } from '/geo-sc/player.js';

// The page works without any of this: the class only switches on the extras.
document.documentElement.classList.add('js');

// 1. GEO_SC: the logo behind the first screen, and the same scene with no
//    logo behind the rest. Only the one you can see keeps drawing.
//    The still stays if anything goes wrong.
const hero = document.querySelector('.geo-hero');
const players = { logo: null, backdrop: null };

mount(hero.querySelector('canvas'), { scene: '/geo-sc/scenes/ink-mn-homepage/' })
  .then((player) => { players.logo = player; })
  .catch((err) => console.warn(err));

mount(document.querySelector('.geo-backdrop canvas'), { scene: '/scenes/background/', interactive: false })
  .then((player) => { players.backdrop = player; if (player && !hero.classList.contains('is-away')) player.pause(); })
  .catch((err) => console.warn(err));

let settle;
function showLogo(show) {
  clearTimeout(settle);
  (show ? players.logo : players.backdrop)?.resume();
  hero.classList.toggle('is-away', !show);
  // once the fade is over, stop drawing the hidden one
  settle = setTimeout(() => (show ? players.backdrop : players.logo)?.pause(), 600);
}

if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => showLogo(entry.intersectionRatio > 0.5), { threshold: 0.5 })
    .observe(document.getElementById('boot'));
}

// 2. Screens "tune in" the first time they scroll into view,
//    and the channel number follows the screen you're on.
const screens = document.querySelectorAll('.screen');
const channel = document.querySelector('.osd__num');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-on');
      if (channel) channel.textContent = entry.target.dataset.ch;
    }
  }, { threshold: 0.5 });
  screens.forEach((screen) => observer.observe(screen));
} else {
  screens.forEach((screen) => screen.classList.add('is-on'));
}

// 3. Sign up. The button opens the form; the form sends the address to
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
      status.textContent = 'Nearly there. Check your inbox to confirm.';
    } catch (err) {
      console.warn(err);
      submit.disabled = false;
      status.textContent = "That didn't send. Try again, or email hello@inkr.mn.";
    }
  });
}

// 4. The disks: a live GEO_SC render of each one, started the first time the
//    releases screen comes near and paused whenever it is out of view.
//    Without WebGL2, or with reduced motion, the photos simply stay.
const releases = document.getElementById('releases');
const diskCanvases = document.querySelectorAll('.disk canvas[data-scene]');
let diskPlayers = null;

if (releases && diskCanvases.length && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !diskPlayers) {
      diskPlayers = [];
      diskCanvases.forEach((canvas) => {
        mount(canvas, { scene: canvas.dataset.scene, mobileScale: 1 })
          .then((player) => { if (player) diskPlayers.push(player); })
          .catch((err) => console.warn(err));
      });
    } else if (diskPlayers) {
      diskPlayers.forEach((player) => (entry.isIntersecting ? player.resume() : player.pause()));
    }
  }, { rootMargin: '25% 0px' }).observe(releases);
}
