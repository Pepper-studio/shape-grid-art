let currentColor = '#6490E8'; // default blue
const grid = document.getElementById('grid');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');

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
    shape.dataset.color = currentColor;
    shape.style.transform = 'rotate(0deg)';
    cell.appendChild(shape);
    cell.dataset.clickCount = '0';
    return;
  }

   // If there is already a shape, first check if colour changed
  const shapeColor = existingShape.dataset.color;

  if (shapeColor !== currentColor) {
    // Override colour but keep current rotation and click count
    existingShape.style.backgroundColor = currentColor;
    existingShape.dataset.color = currentColor;
    return;
  }


  // Same colour: rotate up to 3 times, then remove on 4th click
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

// Clear all shapes from the grid
clearBtn.addEventListener('click', () => {
  document.querySelectorAll('.cell').forEach((cell) => {
    const shape = cell.querySelector('.shape');
    if (shape) {
      shape.remove();
    }
    cell.dataset.clickCount = '0';
  });
});

// Download PNG with transparent background and no grid lines
downloadBtn.addEventListener('click', () => {
  // Check if html2canvas is loaded
  if (typeof html2canvas === 'undefined') {
    alert('Image export library failed to load. Please check your internet connection and try again.');
    return;
  }

  // Temporarily hide grid borders for clean export
  grid.classList.add('exporting');

  html2canvas(grid, {
    backgroundColor: null, // transparent background
    scale: 2               // higher resolution export
  })
    .then((canvas) => {
      grid.classList.remove('exporting');

      try {
        const link = document.createElement('a');
        link.download = 'grid-art.png';
        link.href = canvas.toDataURL('image/png');

        // Fallback for some browsers: append then click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Download failed, opening image in new tab instead.', err);
        window.open(canvas.toDataURL('image/png'), '_blank');
      }
    })
    .catch((error) => {
      grid.classList.remove('exporting');
      console.error('Error generating PNG:', error);
      alert('Something went wrong while generating the image.');
    });
});
