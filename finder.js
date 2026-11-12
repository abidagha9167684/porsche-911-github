// Section 4: three 911s lined up (seen from behind) on white.
// They roll in when the section appears; the red tail lights switch ON while the mouse is over the cars
// (one after another) and go off again when the mouse leaves. Touch screens: tap to toggle.
// The pictures are rendered once from the 3D car: lights off, lights on, and a "glow only" layer (blended with CSS).
export function initFinder({ getRearShots }) {
  const section = document.getElementById('finder');
  const area = document.getElementById('finderCars');
  if (!section || !area) return;
  const cars = [...section.querySelectorAll('.fcar')];
  let shots = null;

  function ensure() {
    if (shots) return;
    try { shots = getRearShots(); } catch (err) { console.error('Rear pictures failed:', err); shots = {}; }
    cars.forEach((c) => {
      if (shots.off) c.querySelector('img.off').src = shots.off;
      if (shots.on) c.querySelector('img.on').src = shots.on;
      if (shots.glow) c.querySelectorAll('img.glow').forEach((g) => (g.src = shots.glow));
    });
  }

  // make the pictures a bit before the section comes into view, so scrolling stays smooth
  new IntersectionObserver(([e]) => { if (e.isIntersecting) ensure(); }, { rootMargin: '700px 0px' }).observe(section);

  // cars roll in when the section is visible (replays when you scroll back)
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { ensure(); section.classList.add('in'); }
    else { section.classList.remove('in'); lights(false); }
  }, { threshold: 0.3 }).observe(section);

  // lights follow the mouse
  let timers = [], on = false;
  function lights(state) {
    if (state === on) return;
    on = state;
    timers.forEach(clearTimeout);
    timers = [];
    // the nearest car first, then the others
    [...cars].reverse().forEach((c, i) => timers.push(setTimeout(() => c.classList.toggle('lit', state), i * 140)));
  }
  area.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') lights(true); });
  area.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') lights(false); });
  area.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') lights(!on); });
}
