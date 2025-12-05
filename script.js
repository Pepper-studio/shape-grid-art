let currentColor = '#ff4b4b'; // default red
const grid = document.getElementById('grid');
const downloadBtn = document.getElementById('downloadBtn');

// Build 4x4 grid
for (let i = 0; i < 16; i++) {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.dataset.clickCount = '0';
  cell.addEventListener('click', () => handleCellClick(cell));
  grid.appendChild(cell);
}

// Handle colour selection
document.querySelectorAll('.color-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.color-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.getAttribute('data-color');
  });
});

function handleCellClick(cell) {
  const existingShape = cell.querySelector('.shape');
  let clickCount = parseInt(cell.dataset.clickCount || '0', 10);

  // If cell is empty, create a new shape in its original orientation
  if (!existingShape) {
    const shape = document.createElement('div');
    shape.classList.add('shape');
    shape.style.backgroundColor = currentColor;
    shape.style.transform = 'rotate(0deg)';
    cell.appendChild(shape);
    cell.dataset.clickCount = '0';
    return;
  }

  // If there is already a shape, rotate it up to 3 times, then remove it
  clickCount += 1;

  if (clickCount >= 4) {
    // After 4th click (0° → 90° → 180° → 270°), remove shape and reset
    existingShape.remove();
    cell.dataset.clickCount = '0';
  } else {
    const angle = clickCount * 90;
    existingShape.style.transform = `rotate(${angle}deg)`;
    cell.dataset.clickCount = String(clickCount);
  }
}

// Download PNG with transparent background and no grid lines
downloadBtn.addEventListener('click', () => {
  // Temporarily hide grid borders for clean export
  grid.classList.add('exporting');

  html2canvas(grid, {
    backgroundColor: null, // transparent background
    scale: 2             // higher resolution export
  })
    .then((canvas) => {
      grid.classList.remove('exporting');

      const link = document.createElement('a');
      link.download = 'grid-art.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    })
    .catch((error) => {
      grid.classList.remove('exporting');
      console.error('Error generating PNG:', error);
      alert('Something went wrong while generating the image.');
    });
});
