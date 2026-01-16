// -----------------------------
// Shape Grid Art (V1)
// 10x10 grid • 2 shapes • 2 colors
// Click empty cell = place (and select)
// Click filled cell = select
// Edit via buttons: Rotate, Mirror ↔, Mirror ↕, Delete
// Export: tight-cropped SVG
// -----------------------------

// ----- Config -----
const GRID_SIZE = 10;           // 10x10
const CELL_PX = 64;             // export sizing (independent from CSS)
const ROUND_RATIO = 0.4;        // 40% rounded corner based on cell size

const COLORS = {
  blue: "#6396fc",
  yellow: "#ffdd35",
};

// ----- DOM -----
const grid = document.getElementById("grid");
const statusText = document.getElementById("statusText");

// Shape buttons
const shapeSquareBtn = document.getElementById("shapeSquareBtn");
const shapeRoundedBtn = document.getElementById("shapeRoundedBtn");

// Color buttons
const colorBlueBtn = document.getElementById("colorBlueBtn");
const colorYellowBtn = document.getElementById("colorYellowBtn");

// Edit buttons (disabled until selection)
const rotateBtn = document.getElementById("rotateBtn");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const deleteBtn = document.getElementById("deleteBtn");

// Utility
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

// ----- State -----
let currentColor = COLORS.blue;
let currentShapeType = "square"; // "square" | "rounded"
let selectedCell = null;         // HTMLElement | null

const cells = [];
const history = [];              // snapshots for undo (max 100)

// Each cell can have data or be empty:
// { shapeType, color, rotation, mirrorX, mirrorY }
function readCellData(cell) {
  const shape = cell.querySelector(".shape");
  if (!shape) return null;

  return {
    shapeType: shape.dataset.shapeType || "square",
    color: shape.dataset.color || COLORS.blue,
    rotation: parseInt(shape.dataset.rotation || "0", 10) || 0,
    mirrorX: shape.dataset.mirrorX === "true",
    mirrorY: shape.dataset.mirrorY === "true",
  };
}

function writeCellData(cell, data) {
  // Clear
  if (!data) {
    const existing = cell.querySelector(".shape");
    if (existing) existing.remove();
    return;
  }

  let shape = cell.querySelector(".shape");
  if (!shape) {
    shape = document.createElement("div");
    shape.classList.add("shape");
    cell.appendChild(shape);
  }

  shape.dataset.shapeType = data.shapeType;
  shape.dataset.color = data.color;
  shape.dataset.rotation = String(data.rotation);
  shape.dataset.mirrorX = String(!!data.mirrorX);
  shape.dataset.mirrorY = String(!!data.mirrorY);

  // Visuals
  shape.style.backgroundColor = data.color;

  // Base shape geometry:
  // - square: no rounding
  // - rounded: top-right corner rounded at 40%
  if (data.shapeType === "rounded") {
    const r = `${ROUND_RATIO * 100}%`;
    shape.style.borderRadius = `0 ${r} 0 0`; // top-right only
  } else {
    shape.style.borderRadius = "0";
  }

  // Transform (keep consistent across app + export logic)
  // We apply rotate + mirror about the center
  const sx = data.mirrorX ? -1 : 1;
  const sy = data.mirrorY ? -1 : 1;
  shape.style.transform = `rotate(${data.rotation}deg) scaleX(${sx}) scaleY(${sy})`;
}

function pushState() {
  const snapshot = cells.map((cell) => readCellData(cell));
  history.push(snapshot);
  if (history.length > 100) history.shift();
}

function restoreState(snapshot) {
  cells.forEach((cell, i) => {
    writeCellData(cell, snapshot[i]);
  });
  clearSelection();
  updateStatus();
}

// ----- UI helpers -----
function setActiveButton(groupButtons, activeBtn) {
  groupButtons.forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

function setEditEnabled(enabled) {
  rotateBtn.disabled = !enabled;
  mirrorXBtn.disabled = !enabled;
  mirrorYBtn.disabled = !enabled;
  deleteBtn.disabled = !enabled;
}

function clearSelection() {
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = null;
  setEditEnabled(false);
}

function selectCell(cell) {
  if (selectedCell === cell) return;
  clearSelection();
  selectedCell = cell;
  selectedCell.classList.add("selected");
  setEditEnabled(true);
  updateStatus();
}

function updateStatus() {
  if (!statusText) return;

  if (!selectedCell) {
    statusText.textContent = "No selection.";
    return;
  }

  const data = readCellData(selectedCell);
  const row = selectedCell.dataset.row;
  const col = selectedCell.dataset.col;

  if (!data) {
    statusText.textContent = `Selected cell (${parseInt(row, 10) + 1}, ${parseInt(col, 10) + 1}) is empty.`;
    return;
  }

  const shapeLabel = data.shapeType === "rounded" ? "Rounded corner" : "Square";
  const mx = data.mirrorX ? "on" : "off";
  const my = data.mirrorY ? "on" : "off";

  statusText.textContent =
    `Selected: ${shapeLabel} • rotation ${data.rotation}° • mirror ↔ ${mx} • mirror ↕ ${my}`;
}

// ----- Build grid (10x10) -----
for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
  const cell = document.createElement("div");
  cell.classList.add("cell");
  cell.dataset.row = String(Math.floor(i / GRID_SIZE));
  cell.dataset.col = String(i % GRID_SIZE);

  cell.addEventListener("click", () => handleCellClick(cell));

  grid.appendChild(cell);
  cells.push(cell);
}

// ----- Click behavior (Option A) -----
function handleCellClick(cell) {
  const existing = readCellData(cell);

  // Empty cell: place new shape, then select it
  if (!existing) {
    pushState();

    const data = {
      shapeType: currentShapeType,
      color: currentColor,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
    };

    writeCellData(cell, data);
    selectCell(cell);
    return;
  }

  // Filled cell: select only
  selectCell(cell);
}

// ----- Shape selection -----
shapeSquareBtn.addEventListener("click", () => {
  currentShapeType = "square";
  setActiveButton([shapeSquareBtn, shapeRoundedBtn], shapeSquareBtn);
});

shapeRoundedBtn.addEventListener("click", () => {
  currentShapeType = "rounded";
  setActiveButton([shapeSquareBtn, shapeRoundedBtn], shapeRoundedBtn);
});

// ----- Color selection -----
colorBlueBtn.addEventListener("click", () => {
  currentColor = COLORS.blue;
  setActiveButton([colorBlueBtn, colorYellowBtn], colorBlueBtn);
});

colorYellowBtn.addEventListener("click", () => {
  currentColor = COLORS.yellow;
  setActiveButton([colorBlueBtn, colorYellowBtn], colorYellowBtn);
});

// ----- Edit actions -----
rotateBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  const data = readCellData(selectedCell);
  if (!data) return;

  pushState();
  data.rotation = (data.rotation + 90) % 360;
  writeCellData(selectedCell, data);
  updateStatus();
});

mirrorXBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  const data = readCellData(selectedCell);
  if (!data) return;

  pushState();
  data.mirrorX = !data.mirrorX;
  writeCellData(selectedCell, data);
  updateStatus();
});

mirrorYBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  const data = readCellData(selectedCell);
  if (!data) return;

  pushState();
  data.mirrorY = !data.mirrorY;
  writeCellData(selectedCell, data);
  updateStatus();
});

deleteBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  const data = readCellData(selectedCell);
  if (!data) return;

  pushState();
  writeCellData(selectedCell, null);
  clearSelection();
  updateStatus();
});

// ----- Utility actions -----
clearBtn.addEventListener("click", () => {
  pushState();
  cells.forEach((cell) => writeCellData(cell, null));
  clearSelection();
  updateStatus();
});

undoBtn.addEventListener("click", () => {
  const last = history.pop();
  if (!last) return;
  restoreState(last);
});

// ----- Export (tight-cropped SVG) -----
downloadBtn.addEventListener("click", () => {
  const { minRow, maxRow, minCol, maxCol } = findUsedBounds();

  if (minRow === Infinity) {
    alert("No artwork found! Place shapes before exporting.");
    return;
  }

  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;
  const svgWidth = cols * CELL_PX;
  const svgHeight = rows * CELL_PX;

  const shapesSvg = [];

  cells.forEach((cell) => {
    const data = readCellData(cell);
    if (!data) return;

    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);

    const x = (col - minCol) * CELL_PX;
    const y = (row - minRow) * CELL_PX;

    const w = CELL_PX;
    const h = CELL_PX;

    // Paths
    let shapeMarkup = "";
    if (data.shapeType === "square") {
      shapeMarkup = `<rect x="0" y="0" width="${w}" height="${h}" fill="${data.color}" />`;
    } else {
      // Rounded top-right corner (40% of cell size)
      const r = CELL_PX * ROUND_RATIO;
      const d = [
        `M 0 0`,
        `H ${w - r}`,
        `Q ${w} 0 ${w} ${r}`,
        `V ${h}`,
        `H 0`,
        `Z`,
      ].join(" ");
      shapeMarkup = `<path d="${d}" fill="${data.color}" />`;
    }

    // Apply rotate + mirror around center
    const cx = w / 2;
    const cy = h / 2;
    const sx = data.mirrorX ? -1 : 1;
    const sy = data.mirrorY ? -1 : 1;
    const a = data.rotation;

    // Use nested transforms for reliability
    const group = `
      <g transform="translate(${x} ${y})">
        <g transform="translate(${cx} ${cy})">
          <g transform="rotate(${a})">
            <g transform="scale(${sx} ${sy})">
              <g transform="translate(${-cx} ${-cy})">
                ${shapeMarkup}
              </g>
            </g>
          </g>
        </g>
      </g>
    `.trim();

    shapesSvg.push(group);
  });

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="${svgWidth}" height="${svgHeight}"
     viewBox="0 0 ${svgWidth} ${svgHeight}">
${shapesSvg.join("\n")}
</svg>
  `.trim();

  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "grid-art.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
});

function findUsedBounds() {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  cells.forEach((cell) => {
    if (cell.querySelector(".shape")) {
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

// Initial UI state
setEditEnabled(false);
updateStatus();
