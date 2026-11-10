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

// 3. Sign up: a stand-in until the mailing list is connected.
const signup = document.querySelector('.boot__signup .button');
const note = document.getElementById('signup-note');
if (signup && note) {
  signup.addEventListener('click', () => {
    note.hidden = false;
    signup.setAttribute('aria-expanded', 'true');
  });
}
