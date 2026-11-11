// INKRMN site script
import { mount } from '/geo-sc/player.js';

// The page works without any of this: the class only switches on the extras.
document.documentElement.classList.add('js');

// 1. GEO_SC: the logo behind the page. The still stays if anything goes wrong.
const hero = document.querySelector('.geo-hero');

// The button appears three seconds after the logo first shows (the CSS does
// the waiting). If the logo can't run, the still counts instead.
const boot = document.getElementById('boot');
const bootReady = () => {
  if (boot.classList.contains('is-ready')) return;
  boot.classList.add('is-ready');
  setTimeout(mountJoinButton, 2600); // just before the button fades in
};

// The Join mailing list button in particles. If it can't run, the plain
// button stays.
function mountJoinButton() {
  const button = document.querySelector('.button--geo');
  const canvas = button && button.querySelector('canvas');
  if (!canvas) return;
  mount(canvas, { scene: canvas.dataset.scene, mobileScale: 1, minDensity: 420 })
    .then((player) => { if (player) button.classList.add('is-geo'); })
    .catch((err) => console.warn(err));
}
setTimeout(bootReady, 6000); // never leave the button hidden for long

mount(hero.querySelector('canvas'), { scene: '/geo-sc/scenes/ink-mn-homepage/' })
  .then(bootReady)
  .catch((err) => { console.warn(err); bootReady(); });

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
