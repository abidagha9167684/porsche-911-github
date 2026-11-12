// Section 2: a studio photo of the 911 from the front. It stays pinned while you scroll,
// and the headlights switch ON (with a short flicker) as you scroll down. Scrolling back up switches them off.
// Pictures: assets/front-off.jpg (lights off) and assets/front-on.jpg (lights on, aligned to the first one).
export function initLights() {
  const section = document.getElementById('drive');
  if (!section) return null;
  const stage = section.querySelector('.lights-stage');
  const onImg = section.querySelector('.lights-on');
  const frame = section.querySelector('.lights-frame');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sstep = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  let visible = false, shown = 0, last = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(section);

  function frameFn(now) {
    requestAnimationFrame(frameFn);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible) return;
    const r = section.getBoundingClientRect(), vh = window.innerHeight;
    const enter = clamp((vh - r.top) / vh, 0, 1);                       // 0..1 while the section slides in
    const pin = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);       // 0..1 while the picture is pinned
    const target = sstep(pin, 0.12, 0.55);                              // lights come on in the first half of the pinned scroll
    shown += (target - shown) * (1 - Math.exp(-10 * dt));
    const flicker = shown > 0.02 && shown < 0.9 ? 1 - 0.45 * Math.abs(Math.sin(now * 0.045)) * (1 - shown) : 1;
    onImg.style.opacity = (shown * flicker).toFixed(3);
    frame.style.transform = `scale(${(1.1 - 0.1 * enter + 0.03 * pin).toFixed(4)})`;
    stage.classList.toggle('lit', shown > 0.6);
  }
  requestAnimationFrame(frameFn);
  return { setPaint() {} };
}
