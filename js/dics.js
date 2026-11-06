(function () {
  'use strict';

  const METHODS = [
    { value: 'realityscan', label: 'RealityScan' },
    { value: 'colmap', label: 'COLMAP' },
    { value: 'pgsr', label: 'PGSR' },
    { value: 'neus2', label: 'NeuS2' },
    { value: 'neuralangelo', label: 'Neuralangelo' },
    { value: 'rnbneus2', label: 'RNb-NeuS2' },
  ];

  let selectedDicsObject = '15_lego';
  let selectedMethodLeft = 'colmap';
  let selectedMethodRight = 'neus2';

  function createMethodSelect(current, side) {
    const select = document.createElement('select');
    select.className = 'dics-method-select';
    select.dataset.side = side;
    for (const m of METHODS) {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      if (m.value === current) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      if (side === 'left') selectedMethodLeft = select.value;
      else selectedMethodRight = select.value;
      updateDics();
    });
    return select;
  }

  function initDics(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const obj = selectedDicsObject;
    const imgLeftSrc = `assets/images/qualitative/${obj}_${selectedMethodLeft}.png`;
    const imgRightSrc = `assets/images/qualitative/${obj}_${selectedMethodRight}.png`;

    const imgLeft = document.createElement('img');
    imgLeft.src = imgLeftSrc;
    imgLeft.style.clipPath = 'inset(0 50% 0 0)';

    const imgRight = document.createElement('img');
    imgRight.src = imgRightSrc;

    const sliderLine = document.createElement('div');
    sliderLine.className = 'dics-slider-line';
    sliderLine.style.left = '50%';

    const handle = document.createElement('div');
    handle.className = 'dics-handle';
    handle.style.left = '50%';
    handle.innerHTML = '<i class="fas fa-arrows-left-right"></i>';

    const selectLeft = createMethodSelect(selectedMethodLeft, 'left');
    const wrapLeft = document.createElement('div');
    wrapLeft.className = 'dics-label dics-label-left';
    wrapLeft.appendChild(selectLeft);

    const selectRight = createMethodSelect(selectedMethodRight, 'right');
    const wrapRight = document.createElement('div');
    wrapRight.className = 'dics-label dics-label-right';
    wrapRight.appendChild(selectRight);

    container.appendChild(imgRight);
    container.appendChild(imgLeft);
    container.appendChild(sliderLine);
    container.appendChild(handle);
    container.appendChild(wrapLeft);
    container.appendChild(wrapRight);

    let isDragging = false;

    function updatePosition(x) {
      const rect = container.getBoundingClientRect();
      let pct = ((x - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      imgLeft.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      sliderLine.style.left = pct + '%';
      handle.style.left = pct + '%';
    }

    handle.addEventListener('mousedown', () => { isDragging = true; });
    sliderLine.addEventListener('mousedown', () => { isDragging = true; });
    document.addEventListener('mousemove', (e) => {
      if (isDragging) { e.preventDefault(); updatePosition(e.clientX); }
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    handle.addEventListener('touchstart', () => { isDragging = true; });
    document.addEventListener('touchmove', (e) => {
      if (isDragging) { updatePosition(e.touches[0].clientX); }
    });
    document.addEventListener('touchend', () => { isDragging = false; });

    container.addEventListener('click', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
      if (e.target === handle || e.target === sliderLine) return;
      updatePosition(e.clientX);
    });
  }

  function updateDics() {
    initDics('dics-slider');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.getElementById('dics-object-tabs');
    if (tabs) {
      tabs.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          tabs.querySelectorAll('a').forEach((t) => t.classList.remove('active'));
          a.classList.add('active');
          selectedDicsObject = a.dataset.value;
          updateDics();
        });
      });
    }
    updateDics();
  });

  window.initDics = initDics;
})();
