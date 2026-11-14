// INKRMN /join/ page on its own (opened directly, or without the homepage's
// script). The homepage shows the same block in place: see js/site.js.
import { mount } from '/geo-sc/player.js';
import { setupJoin, BACKDROP_WAIT_MS } from './join.js';

document.documentElement.classList.add('js');

// 1. The backdrop: the homepage scene with no logo, behind the page.
const backdrop = document.querySelector('.geo-backdrop');
const backdropDone = new Promise((resolve) => {
  setTimeout(resolve, BACKDROP_WAIT_MS);
  mount(backdrop.querySelector('canvas'), { scene: '/scenes/background/', interactive: false })
    .then(resolve)
    .catch((err) => { console.warn(err); resolve(); });
});

// 2. The text arrives as a cloud once the backdrop is drawing. Back is a
//    normal link to the homepage.
setupJoin(document.querySelector('.screen--join'), { backdrop }).arrive(backdropDone);
