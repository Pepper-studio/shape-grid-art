let currentColor = '#6490E8'; // default main color
const grid = document.getElementById('grid');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');

const gridSize = 4;
const cellPx = 80; // 320px / 4

// Build 4x4 grid
const cells = [];
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

// Handle colour selection
document.querySelectorAll('.color-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach((b) =>
      b.classList.remove('active')
    );
    btn.classList.add('active');
    currentColor = btn.getAttribute('data-color');
  });
});

function handleCellClick(cell) {
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

// Clear grid button
clearBtn.addEventListener('click', () => {
  cells.forEach((cell) => {
    const shape = cell.querySelector('.shape');
    if (shape) shape.remove();
    cell.dataset.clickCount = '0';
  });
});

// Download cropped PNG
downloadBtn.addEventListener('click', () => {
  // Add exporting class (for hiding grid overlay / borders if needed)
  grid.classList.add('exporting');

  html2canvas(grid, {
    backgroundColor: null, // transparent background
    scale: 2               // higher-res export
  }).then((canvas) => {
    grid.classList.remove('exporting');

    const { minRow, maxRow, minCol, maxCol } = findUsedBounds();

    // No shapes at all
    if (minRow === Infinity) {
      alert('No artwork found! Place shapes before exporting.');
      return;
    }

    // Compute crop area in the full canvas (scaled)
    const cropX = minCol * cellPx * 2;
    const cropY = minRow * cellPx * 2;
    const cropW = (maxCol - minCol + 1) * cellPx * 2;
    const cropH = (maxRow - minRow + 1) * cellPx * 2;

    // Create a new canvas just for the cropped region
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const ctx = cropCanvas.getContext('2d');

    ctx.drawImage(
      canvas,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH
    );

    const link = document.createElement('a');
    link.download = 'grid-art.png';
    link.href = cropCanvas.toDataURL('image/png');
    link.click();
  });
});

// Find tight bounds (min/max row/col that contain shapes)
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
