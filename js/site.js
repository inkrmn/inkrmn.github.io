// INKRMN site script
import { mount } from '/geo-sc/player.js';

// The page works without any of this: the class only switches on the extras.
document.documentElement.classList.add('js');

// 1. The GEO_SC logo. The still stays if anything goes wrong.
mount(document.querySelector('.geo-hero canvas'), { scene: '/geo-sc/scenes/ink-mn-homepage/' })
  .catch((err) => console.warn(err));

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
