// Galerie des objets : clic → fenêtre avec une planche MVS (8 vues autour de l'objet) et MVPS
// (8 des 30 éclairages d'une même vue). Images : assets/images/gallery/<id>/{mvs,mvps}_<k>.webp,
// générées par scripts/gallery_previews.py, chargées seulement à l'ouverture.
(function () {
  const N = 8;
  const dlg = document.getElementById('object-preview');
  const grid = document.getElementById('object-gallery');
  if (!dlg || !grid || typeof dlg.showModal !== 'function') return;

  const title = dlg.querySelector('.op-title');
  const rows = { mvs: dlg.querySelector('[data-kind="mvs"]'), mvps: dlg.querySelector('[data-kind="mvps"]') };
  for (const kind in rows) {
    for (let k = 0; k < N; k++) {
      const img = document.createElement('img');
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.remove('is-loading'));
      rows[kind].appendChild(img);
    }
  }

  function open(item) {
    const img = item.querySelector('img');
    const id = img.getAttribute('src').split('/').pop().replace(/\.\w+$/, '');
    const name = item.querySelector('.name').textContent.trim();
    title.textContent = name;
    for (const kind in rows) {
      rows[kind].querySelectorAll('img').forEach((im, k) => {
        im.classList.add('is-loading');
        im.alt = `${name}, ${kind.toUpperCase()} image ${k + 1} of ${N}`;
        im.src = `assets/images/gallery/${id}/${kind}_${k}.webp`;
      });
    }
    dlg.showModal();
  }

  grid.querySelectorAll('.gallery-item').forEach((item) => {
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Preview the ${item.querySelector('.name').textContent.trim()} images`);
    item.addEventListener('click', () => open(item));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(item); }
    });
  });
  dlg.querySelector('.op-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // clic sur le fond
})();
