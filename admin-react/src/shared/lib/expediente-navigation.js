export function irASeccionExpediente(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const heading = target.matches('h1,h2,h3') ? target : target.querySelector('h1,h2,h3') || target;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}
