let currentColor = 'red';
const grid = document.getElementById('grid');
const downloadBtn = document.getElementById('downloadBtn');

// Create 4x4 grid cells
for (let i = 0; i < 16; i++) {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.addEventListener('click', () => {
    cell.style.backgroundColor = currentColor;
  });
  grid.appendChild(cell);
}

// Color buttons
document.querySelectorAll('button[data-color]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentColor = btn.getAttribute('data-color');
  });
});

// Download PNG
downloadBtn.addEventListener('click', () => {
  html2canvas(grid).then(canvas => {
    const link = document.createElement('a');
    link.download = 'grid-art.png';
    link.href = canvas.toDataURL();
    link.click();
  });
});

// Load html2canvas
const script = document.createElement('script');
script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
document.body.appendChild(script);
