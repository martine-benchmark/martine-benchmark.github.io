(function () {
  'use strict';

  const FIXED_THRESHOLD = 0.5;

  // Methods checked by default: the article's set. Any other evaluated method
  // present in the data is listed but left unchecked (toggle it on to compare).
  // A method's meta may also carry `default: true/false` to override this.
  const ARTICLE_DEFAULTS = new Set([
    'realityscan', 'colmap', 'pgsr', 'neus2', 'neuralangelo', 'rnbneus2',
  ]);

  function isDefaultChecked(key, meta) {
    if (meta && typeof meta.default === 'boolean') return meta.default;
    return ARTICLE_DEFAULTS.has(key);
  }

  // matplotlib marker code (from the article's fig. 4 PRF spec) -> Chart.js
  // pointStyle. Chart.js has no hexagon, so SuperNormal's 'h' falls back to
  // 'star'; 'v' (triangle-down) is 'triangle' rotated 180deg.
  const MARKER_TO_POINTSTYLE = {
    s: 'rect', o: 'circle', D: 'rectRot', '^': 'triangle',
    v: 'triangle', P: 'cross', X: 'crossRot', h: 'star',
  };

  // Resolve a method's line/marker style. Prefer the explicit fig-4 fields
  // (linestyle/marker/hollow) shipped in the data; otherwise fall back to the
  // Palette-B heuristic (a repeated colour = 2nd family member, dashed/hollow).
  function methodStyle(meta, seenColors) {
    let dashed, hollow, marker, rotation = 0;
    const hasSpec = meta.linestyle || meta.marker || meta.hollow !== undefined;
    if (hasSpec) {
      dashed = meta.linestyle === 'dashed';
      hollow = !!meta.hollow;
      marker = MARKER_TO_POINTSTYLE[meta.marker] || 'circle';
      if (meta.marker === 'v') rotation = 180;
    } else {
      const isSecond = seenColors.has(meta.color);
      dashed = isSecond;
      hollow = isSecond;
      marker = 'circle';
    }
    seenColors.add(meta.color);
    return { dashed, hollow, marker, rotation };
  }

  let radarChart = null;
  let radarData = null;
  let isInitialized = false;

  async function loadRadarData() {
    try {
      const resp = await fetch('data/radar_data.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      radarData = await resp.json();
    } catch (e) {
      console.error('Failed to load radar data:', e);
      radarData = null;
    }
  }

  // Per-axis F-score, read from the data as the article aggregates it: the
  // point-to-surface distances of ALL objects annotated with a challenge are
  // pooled as a single mesh before scoring (objects that fail to reconstruct
  // count as missed). martine-radar ships this pre-pooled: category_objects[cat]
  // = ["pooled"] and scores[m]["pooled"][cat][thr] is the pooled F-score, so the
  // loop below reduces to reading that single value.
  function computeMethodScores(threshold) {
    const thresholdKey = String(threshold);
    const result = {};

    for (const methodKey of Object.keys(radarData.methods)) {
      const categoryScores = [];

      for (const cat of radarData.categories) {
        const catObjects = radarData.category_objects[cat] || [];

        let sum = 0;
        let count = 0;
        for (const obj of catObjects) {
          const score = radarData.scores[methodKey]?.[obj]?.[cat]?.[thresholdKey];
          if (score !== null && score !== undefined) {
            sum += score;
            count++;
          }
        }
        categoryScores.push(count > 0 ? sum / count : 0);
      }
      result[methodKey] = categoryScores;
    }
    return result;
  }

  function buildChart(ctx) {
    const labels = radarData.categories.map((c) => radarData.category_display[c]);
    const scores = computeMethodScores(FIXED_THRESHOLD);

    // Reproduce the article's fig. 4 (PRF) styling per method: exact colour,
    // line style (solid/dashed), marker shape, and filled/hollow marker.
    const seenColors = new Set();
    const datasets = Object.entries(radarData.methods).map(([key, meta]) => {
      const st = methodStyle(meta, seenColors);
      return {
        label: meta.label,
        data: scores[key],
        backgroundColor: st.hollow ? 'transparent' : meta.color + '26',
        borderColor: meta.color,
        borderWidth: 2,
        borderDash: st.dashed ? [6, 4] : [],
        pointStyle: st.marker,
        rotation: st.rotation,
        pointBackgroundColor: st.hollow ? '#fff' : meta.color,
        pointBorderColor: meta.color,
        pointBorderWidth: st.hollow ? 2 : 1,
        pointRadius: 3.6,
        pointHoverRadius: 5.5,
        pointHitRadius: 10,
        hidden: false,
      };
    });

    radarChart = new Chart(ctx, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 25, font: { size: 10 } },
            pointLabels: { font: { size: 12, weight: '600' } },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11 }, usePointStyle: true, padding: 10 },
          },
          tooltip: { enabled: true },
        },
      },
    });
  }

  // Show/hide method polygons based on the method checkboxes.
  function updateVisibility() {
    if (!radarChart || !radarData) return;

    const methodKeys = Object.keys(radarData.methods);
    const checked = new Set(
      Array.from(document.querySelectorAll('#method-checkboxes input[type="checkbox"]'))
        .filter((cb) => cb.checked)
        .map((cb) => cb.value)
    );

    methodKeys.forEach((key, i) => {
      radarChart.data.datasets[i].hidden = !checked.has(key);
    });
    radarChart.update();
  }

  function renderMethodCheckboxes() {
    const container = document.getElementById('method-checkboxes');
    if (!container) return;

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // Mirror the chart: a dashed/hollow method gets a white, dashed-outline
    // swatch; a solid filled one gets a solid colour swatch.
    const seenColors = new Set();
    for (const [key, meta] of Object.entries(radarData.methods)) {
      const st = methodStyle(meta, seenColors);

      const label = document.createElement('label');
      label.className = 'checkbox';
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '0.5rem';
      label.style.marginBottom = '0.25rem';

      const border = st.dashed ? `2px dashed ${meta.color}` : `1px solid ${meta.color}`;
      const bg = st.hollow ? '#fff' : meta.color;
      const swatch = `<span style="display:inline-block;width:0.9rem;height:0.9rem;border-radius:3px;background:${bg};border:${border}"></span>`;
      const checkedAttr = isDefaultChecked(key, meta) ? ' checked' : '';
      label.innerHTML = `<input type="checkbox" value="${key}"${checkedAttr}> ${swatch} ${meta.label}`;
      fragment.appendChild(label);
    }
    container.appendChild(fragment);
  }

  // --- Lazy init when the section scrolls into view ---
  document.addEventListener('DOMContentLoaded', () => {
    const section = document.getElementById('radar');
    if (!section) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting && !isInitialized) {
          isInitialized = true;
          await startRadar();
        }
      });
    }, { threshold: 0.1 });

    observer.observe(section);
  });

  async function startRadar() {
    await loadRadarData();
    if (!radarData) return;

    const ctx = document.getElementById('radar-chart');
    if (!ctx) return;

    renderMethodCheckboxes();
    buildChart(ctx);
    updateVisibility();

    document.getElementById('method-checkboxes').addEventListener('change', updateVisibility);

    document.getElementById('select-all-methods').addEventListener('click', () => {
      document.querySelectorAll('#method-checkboxes input').forEach((cb) => (cb.checked = true));
      updateVisibility();
    });

    document.getElementById('deselect-all-methods').addEventListener('click', () => {
      document.querySelectorAll('#method-checkboxes input').forEach((cb) => (cb.checked = false));
      updateVisibility();
    });
  }
})();
