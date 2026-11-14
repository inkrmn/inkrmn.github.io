// INKRMN /join/ page on its own (opened directly, or without the homepage's
// script). The homepage shows the same block in place: see js/site.js.
import { mount } from '/geo-sc/player.js';
import { setupJoin } from './join.js';

document.documentElement.classList.add('js');

// 1. The backdrop: the homepage scene with no logo, behind the page.
const backdrop = document.querySelector('.geo-backdrop');
mount(backdrop.querySelector('canvas'), { scene: '/scenes/background/', interactive: false })
  .catch((err) => console.warn(err));

// 2. The text arrives as a cloud straight away, without waiting for the
//    backdrop. Back is a normal link to the homepage.
setupJoin(document.querySelector('.screen--join'), { backdrop }).arrive();
