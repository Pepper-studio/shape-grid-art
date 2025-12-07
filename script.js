let currentColor = '#6490E8'; // default main color

const grid = document.getElementById('grid');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');

// randomizer buttons
const rand3x3Btn = document.getElementById('rand3x3Btn');
const randBannerBtn = document.getElementById('randBannerBtn');
const randFullBtn = document.getElementById('randFullBtn');

// 🔹 GRID SETTINGS
const gridSize = 8;   // 8x8 grid
const cellPx = 80;    // 640px grid / 8 cells

const cells = [];
const history = [];

// ---------- Build grid ----------
for (let i = 0; i < gridSize * gridSize; i++) {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.dataset.clickCount = '0';
  cell.dataset.row = Math.floor(i / gridSize);
  cell.dataset.col = i % gridSize;
  cell.addEventListener('click', () => handleCellClick(cell));
  grid.appendChild(cell);
  cells.push(cell);
}

// ---------- Colour selection ----------
document.querySelectorAll('.color-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach((b) =>
      b.classList.remove('active')
    );
    btn.classList.add('active');
    currentColor = btn.getAttribute('data-color');
  });
});

// ---------- History helpers ----------
function pushState() {
  const snapshot = cells.map((cell) => {
    const shape = cell.querySelector('.shape');
    if (!shape) return null;
    return {
      color: shape.dataset.color,
      rotation: shape.style.transform || 'rotate(0deg)',
    };
  });

  const clickCounts = cells.map((cell) => cell.dataset.clickCount || '0');

  history.push({ snapshot, clickCounts });

  if (history.length > 100) {
    history.shift();
  }
}

function restoreState(state) {
  cells.forEach((cell, index) => {
    const info = state.snapshot[index];
    const clickCount = state.clickCounts[index] || '0';
    cell.dataset.clickCount = clickCount;

    const existing = cell.querySelector('.shape');
    if (info === null) {
      if (existing) existing.remove();
    } else {
      let shape = existing;
      if (!shape) {
        shape = document.createElement('div');
        shape.classList.add('shape');
        cell.appendChild(shape);
      }
      shape.style.backgroundColor = info.color;
      shape.dataset.color = info.color;
      shape.style.transform = info.rotation;
    }
  });
}

// ---------- Helpers ----------
function clearGridWithoutHistory() {
  cells.forEach((cell) => {
    const shape = cell.querySelector('.shape');
    if (shape) shape.remove();
    cell.dataset.clickCount = '0';
  });
}

function pickBrandColor() {
  // B60 : P15 : Y25
  const r = Math.random();
  if (r < 0.60) return '#6490E8';      // Blue
  if (r < 0.75) return '#DCC6EA';      // Purple
  return '#FDCF41';                    // Yellow
}

function randomRotation() {
  const angles = [0, 90, 180, 270];
  const idx = Math.floor(Math.random() * angles.length);
  return angles[idx];
}

function createShapeInCell(cell, color, angle) {
  let shape = cell.querySelector('.shape');
  if (!shape) {
    shape = document.createElement('div');
    shape.classList.add('shape');
    cell.appendChild(shape);
  }
  shape.style.backgroundColor = color;
  shape.dataset.color = color;
  shape.style.transform = `rotate(${angle}deg)`;

  const clicks = ((angle / 90) % 4 + 4) % 4; // normalize 0–3
  cell.dataset.clickCount = String(clicks);
}

// ---------- Cell click behaviour ----------
function handleCellClick(cell) {
  // Save state before any modification
  pushState();

  const existingShape = cell.querySelector('.shape');
  let clickCount = parseInt(cell.dataset.clickCount || '0', 10);

  // If cell empty → create shape
  if (!existingShape) {
    const shape = document.createElement('div');
    shape.classList.add('shape');
    shape.style.backgroundColor = currentColor;
    shape.dataset.color = currentColor;
    shape.style.transform = 'rotate(0deg)';
    cell.appendChild(shape);
    return;
  }

  // If colour changed → override colour only, keep rotation + clickCount
  const shapeColor = existingShape.dataset.color;
  if (shapeColor !== currentColor) {
    existingShape.style.backgroundColor = currentColor;
    existingShape.dataset.color = currentColor;
    return;
  }

  // Same colour → rotate, then remove after 4th click
  clickCount += 1;

  if (clickCount >= 4) {
    existingShape.remove();
    cell.dataset.clickCount = '0';
  } else {
    const angle = clickCount * 90;
    existingShape.style.transform = `rotate(${angle}deg)`;
    cell.dataset.clickCount = String(clickCount);
  }
}

// ---------- Clear grid ----------
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    pushState();
    clearGridWithoutHistory();
  });
}

// ---------- Undo ----------
if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    const last = history.pop();
    if (!last) return;
    restoreState(last);
  });
}

// ---------- Randomizers ----------

// moderate density ~ 50%
const FILL_PROB_MODERATE = 0.5;

// 3x3 centered, using 3 colours
if (rand3x3Btn) {
  rand3x3Btn.addEventListener('click', () => {
    pushState();
    clearGridWithoutHistory(); // Override A: clear first

    const areaSize = 3;
    const startRow = Math.floor((gridSize - areaSize) / 2); // (8-3)/2 = 2
    const startCol = Math.floor((gridSize - areaSize) / 2); // 2

    for (let r = startRow; r < startRow + areaSize; r++) {
      for (let c = startCol; c < startCol + areaSize; c++) {
        if (Math.random() < FILL_PROB_MODERATE) {
          const idx = r * gridSize + c;
          const cell = cells[idx];
          const color = pickBrandColor();
          const angle = randomRotation();
          createShapeInCell(cell, color, angle);
        }
      }
    }
  });
}

// 8x3 banner, centered vertically, full width
if (randBannerBtn) {
  randBannerBtn.addEventListener('click', () => {
    pushState();
    clearGridWithoutHistory(); // Override A: clear first

    const areaHeight = 3;
    const startRow = Math.floor((gridSize - areaHeight) / 2); // (8-3)/2 = 2
    const startCol = 0;
    const endCol = gridSize - 1;

    for (let r = startRow; r < startRow + areaHeight; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (Math.random() < FILL_PROB_MODERATE) {
          const idx = r * gridSize + c;
          const cell = cells[idx];
          const color = pickBrandColor();
          const angle = randomRotation();
          createShapeInCell(cell, color, angle);
        }
      }
    }
  });
}

// full 8x8 grid randomized
if (randFullBtn) {
  randFullBtn.addEventListener('click', () => {
    pushState();
    clearGridWithoutHistory(); // Override A: clear first

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (Math.random() < FILL_PROB_MODERATE) {
          const idx = r * gridSize + c;
          const cell = cells[idx];
          const color = pickBrandColor();
          const angle = randomRotation();
          createShapeInCell(cell, color, angle);
        }
      }
    }
  });
}

// ---------- Download as tight-cropped SVG ----------
downloadBtn.addEventListener('click', () => {
  const { minRow, maxRow, minCol, maxCol } = findUsedBounds();

  // No shapes at all
  if (minRow === Infinity) {
    alert('No artwork found! Place shapes before exporting.');
    return;
  }

  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;
  const svgWidth = cols * cellPx;
  const svgHeight = rows * cellPx;

  const shapesSvg = [];

  cells.forEach((cell) => {
    const shapeEl = cell.querySelector('.shape');
    if (!shapeEl) return;

    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    const color = shapeEl.dataset.color || currentColor;

    // Parse rotation angle from style.transform, e.g. "rotate(90deg)"
    let angle = 0;
    const transformVal = shapeEl.style.transform || '';
    const match = transformVal.match(/rotate\\(([-0-9.]+)deg\\)/);
    if (match) {
      angle = parseFloat(match[1]) || 0;
    }

    // Position of this cell inside the cropped area
    const x = (col - minCol) * cellPx;
    const y = (row - minRow) * cellPx;

    // Shape path: rectangle with one rounded corner (top-left in local coords)
    const r = cellPx / 2;
    const w = cellPx;
    const h = cellPx;

    const d = [
      `M 0 ${r}`,
      `A ${r} ${r} 0 0 1 ${r} 0`,
      `L ${w} 0`,
      `L ${w} ${h}`,
      `L 0 ${h}`,
      'Z',
    ].join(' ');

    // Center of the cell for rotation
    const cx = cellPx / 2;
    const cy = cellPx / 2;

    const pathSvg = `
      <g transform="translate(${x} ${y}) rotate(${angle} ${cx} ${cy})">
        <path d="${d}" fill="${color}" />
      </g>
    `;
    shapesSvg.push(pathSvg);
  });

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${svgWidth}" height="${svgHeight}"
         viewBox="0 0 ${svgWidth} ${svgHeight}">
      ${shapesSvg.join('\n')}
    </svg>
  `.trim();

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'grid-art.svg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
});

// ---------- Find tight bounds ----------
function findUsedBounds() {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  cells.forEach((cell) => {
    if (cell.querySelector('.shape')) {
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }
  });

  return { minRow, maxRow, minCol, maxCol };
}
