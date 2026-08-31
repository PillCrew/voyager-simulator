document.addEventListener('DOMContentLoaded', () => {
  const skybox = document.getElementById('main-skybox');
  const bgStars = document.querySelector('[background-stars]');
  const btn1 = document.getElementById('skybox-btn-1');
  const btn2 = document.getElementById('skybox-btn-2');
  const btn3 = document.getElementById('skybox-btn-3');
  function setSkybox(url, btn, starCount) {
    if (!skybox) return;
    skybox.setAttribute('src', url);
    [btn1, btn2, btn3].forEach(b => b && b.setAttribute('material', 'color', '#0044aa'));
    if (btn) btn.setAttribute('material', 'color', '#00aa44');
    if (bgStars) {
      const capped = Math.min(starCount | 0, 2500);
      bgStars.setAttribute('background-stars', 'count', capped);
    }
  }
  if (btn1) btn1.addEventListener('click', () => setSkybox('assets/images/skybox_2k.jpg', btn1, 0));
  if (btn2) btn2.addEventListener('click', () => setSkybox('assets/images/deep_star_map_2k.jpg', btn2, 0));
  if (btn3) btn3.addEventListener('click', () => setSkybox('assets/images/nebula.png', btn3, 1500));
  if (btn1) btn1.setAttribute('material', 'color', '#00aa44');
  const cursor = document.getElementById('menu-cursor');
  const crossVisuals = document.getElementById('cursor-cross-visuals');
  const cBtn1 = document.getElementById('cursor-btn-1');
  const cBtn2 = document.getElementById('cursor-btn-2');
  const cBtn3 = document.getElementById('cursor-btn-3');
  function setCursor(type, btn) {
    if (!cursor) return;
    [cBtn1, cBtn2, cBtn3].forEach(b => {
      if (b) b.setAttribute('material', 'color', '#0044aa');
    });
    if (btn) btn.setAttribute('material', 'color', '#00aa44');
    if (crossVisuals) crossVisuals.setAttribute('visible', 'false');
    cursor.setAttribute('material', 'visible', 'true');
    if (type === 'ring') {
      cursor.setAttribute('geometry', { primitive: 'ring', radiusInner: 0.02, radiusOuter: 0.03 });
    } else if (type === 'dot') {
      cursor.setAttribute('geometry', { primitive: 'ring', radiusInner: 0.0001, radiusOuter: 0.015 });
    } else if (type === 'cross') {
      cursor.setAttribute('material', 'visible', 'false');
      if (crossVisuals) crossVisuals.setAttribute('visible', 'true');
    }
  }
  if (cBtn1) cBtn1.addEventListener('click', () => setCursor('ring', cBtn1));
  if (cBtn2) cBtn2.addEventListener('click', () => setCursor('dot', cBtn2));
  if (cBtn3) cBtn3.addEventListener('click', () => setCursor('cross', cBtn3));
});
