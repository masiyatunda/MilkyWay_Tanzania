// GO LIVE launcher: sizes the orbiting "GO LIVE" label and lines the meteor trail up behind it.
(() => {
  const svg = document.querySelector('#composeBtn .mw-live-orbit');
  if (!svg) return;
  const text = svg.querySelector('.mw-live-orbit-text');
  const label = text.querySelector('textPath');
  const circumference = 2 * Math.PI * 47;
  const top = circumference / 4;
  const widest = 124;
  const layers = [...svg.querySelectorAll('.mw-live-trail use')];
  // The ring always reads "GO LIVE" after the meteor lands; the button's spoken label still follows the chosen language.
  const translated = () => 'GO LIVE';
  function render() {
    const value = translated();
    if (label.textContent !== value) label.textContent = value;
    text.style.fontSize = '';
    let length = text.getComputedTextLength() || value.length * 10;
    // Long translations shrink to fit above the globe instead of wrapping round it.
    if (length > widest) { text.style.fontSize = `${Math.max(10, 15 * widest / length)}px`; length = text.getComputedTextLength() || widest; }
    const head = top - length / 2 - 1.5;
    for (const layer of layers) {
      const size = circumference * Number(layer.dataset.length);
      layer.style.strokeDasharray = `${size} ${circumference - size}`;
      layer.style.strokeDashoffset = String(size - head);
    }
    svg.style.direction = 'ltr';
  }
  window.addEventListener('mw-language-change', render);
  document.fonts?.ready.then(render);
  render();
})();
