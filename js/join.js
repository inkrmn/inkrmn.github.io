// INKRMN join page script
import { mount } from '/geo-sc/player.js';

document.documentElement.classList.add('js');

// 1. GEO_SC: the homepage scene with no logo, behind the page. The text fades
//    in once it's drawing (or after a few seconds if it can't run).
const backdrop = document.querySelector('.geo-hero');
const join = document.querySelector('.join');
const ready = () => join.classList.add('is-ready');
setTimeout(ready, 4000);
mount(backdrop.querySelector('canvas'), { scene: '/scenes/background/' })
  .then(ready)
  .catch((err) => { console.warn(err); ready(); });

// 2. Sign up. Sends the address to MailerLite in the background, so nobody
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
    status.textContent = "Thanks. You're on the list.";
  } catch (err) {
    console.warn(err);
    submit.disabled = false;
    status.textContent = "That didn't send. Try again, or email hello@inkr.mn.";
  }
});
