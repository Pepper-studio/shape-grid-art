// -----------------------------
// Shape Grid Art (V2 - simplified for clients)
// 10x10 grid • 2 shapes • 2 colors
// Modes:
//  - Stamp (default): click any cell to place/REPLACE
//  - Select: click filled cell to select, then Rotate/Mirror/Delete
// Selection highlight is handled by CSS ::after overlay (always on top)
// Rounded corner: 40% of cell size
// Export: tight-cropped SVG
// -----------------------------

// ----- Config -----
const GRID_SIZE = 10;
const CELL_PX = 64;        // export sizing (independent from CSS)
const ROUND_RATIO = 0.4;   // 40% rounded corner based on cell size

const COLORS = {
  blue: "#6396fc",
  yellow: "#ffdd35",
};

// ----- DOM -----
const grid = document.getElementById("grid");
const statusText = document.getElementById("statusText");

// Mode buttons
const modeStampBtn = document.getElementById("modeStampBtn");
const modeSelectBtn = document.getElementById("modeSelectBtn");

// Shape buttons
const shapeSquareBtn = document.getElementById("shapeSquareBtn");
const shapeRoundedBtn = document.getElementById("shapeRoundedBtn");

// Color buttons
const colorBlueBtn = document.getElementById("colorBlueBtn");
const colorYellowBtn = document.getElementById("colorYellowBtn");

// Edit buttons
const rotateBtn = document.getElementById("rotateBtn");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const deleteBtn = document.getElementById("deleteBtn");

// Utility
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

// ----- State -----
let currentMode = "stamp";          // "stamp" | "select"
let currentColor = COLORS.blue;
let currentShapeType = "square";    // "square" | "rounded"
let selectedCell = null;            // HTMLElement | null

const cells = [];
const history = [];                 // undo snapshots (max 100)

// ----- Helpers (UI) -----
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
  updateStatus();
}

function selectCell(cell) {
  if (selectedCell === cell) return;
  clearSelection();
  selectedCell = cell;
  selectedCell.classList.add("selected");

  // Edit buttons only enabled in Select mode
  setEditEnabled(currentMode === "select");
  updateStatus();
}

function setMode(mode) {
  currentMode = mode;
  if (mode === "stamp") {
    setActiveButton([modeStampBtn, modeSelectBtn], modeStampBtn);
    // In Stamp mode, selection is optional; edit buttons disabled
    setEditEnabled(false);
    updateStatus();
  } else {
    setActiveButton([modeStampBtn, modeSelectBtn], modeSelectBtn);
    // Enable edit only if something is selected
    const hasSelection = !!selectedCell && !!readCellData(selectedCell);
    setEditEnabled(hasSelection);
    updateStatus();
  }
}

function updateStatus() {
  if (!statusText) return;

  if (currentMode === "stamp") {
    statusText.textContent = "Mode: Stamp — click any cell to place/replace.";
    return;
  }

  // Select mode
  if (!selectedCell) {
    statusText.textContent = "Mode: Select — click a filled cell to select.";
    return;
  }

  const data = readCellData(selectedCell);
  const row = parseInt(selectedCell.dataset.row, 10) + 1;
  const col = parseInt(selectedCell.dataset.col, 10) + 1;

  if (!data) {
    statusText.textContent = `Mode: Select — cell (${row}, ${col}) is empty. Click a filled cell.`;
    return;
  }

  const shapeLabel = data.shapeType === "rounded" ? "Rounded corner" : "Square";
  const mx = data.mirrorX ? "on" : "off";
  const my = data.mirrorY ? "on" : "off";

  statusText.textContent =
    `Selected cell (${row}, ${col}) • ${shapeLabel} • rotation ${data.rotation}° • mirror ↔ ${mx} • mirror ↕ ${my}`;
}

// ----- History (Undo) -----
function pushState() {
  const snapshot = cells.map((cell) => {
    const data = readCellData(cell);
    return data ? { ...data } : null;
  });
  history.push(snapshot);
  if (history.length > 100) history.shift();
}

function restoreState(snapshot) {
  cells.forEach((cell, i) => {
    writeCellData(cell, snapshot[i]);
  });
  clearSelection();
}

// ----- Cell data read/write -----
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

function applyShapeStyles(node, data) {
  node.style.backgroundColor = data.color;

  // Rounded top-right at 40% of cell size
  if (data.shapeType === "rounded") {
    const r = `${ROUND_RATIO * 100}%`;
    node.style.borderRadius = `0 ${r} 0 0`;
  } else {
    node.style.borderRadius = "0";
  }

  // Transform: rotate + mirror around center
  const sx = data.mirrorX ? -1 : 1;
  const sy = data.mirrorY ? -1 : 1;
  node.style.transform = `rotate(${data.rotation}deg) scaleX(${sx}) scaleY(${sy})`;
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

  applyShapeStyles(shape, data);
}

// ----- Build grid -----
for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
  const cell = document.createElement("div");
  cell.classList.add("cell");
  cell.dataset.row = String(Math.floor(i / GRID_SIZE));
  cell.dataset.col = String(i % GRID_SIZE);

  cell.addEventListener("click", () => handleCellClick(cell));

  grid.appendChild(cell);
  cells.push(cell);
}

// ----- Click behavior -----
// Stamp mode: click ANY cell to place/replace (always writes)
// Select mode: click filled cell selects; click empty clears selection
function handleCellClick(cell) {
  const existing = readCellData(cell);

  if (currentMode === "stamp") {
    pushState();

    const next = {
      shapeType: currentShapeType,
      color: currentColor,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
    };

    // Always replace if filled
    writeCellData(cell, next);

    // Optional: keep selection visual out of stamp mode
    clearSelection();
    return;
  }

  // Select mode
  if (!existing) {
    // Clicking empty cell clears selection (keeps it obvious)
    clearSelection();
    return;
  }

  selectCell(cell);

  // Enable edit buttons now that selection exists
  setEditEnabled(true);
}

// ----- Mode switching -----
modeStampBtn.addEventListener("click", () => setMode("stamp"));
modeSelectBtn.addEventListener("click", () => setMode("select"));

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

// ----- Edit actions (Select mode only) -----
function requireEditableSelection() {
  if (currentMode !== "select") return null;
  if (!selectedCell) return null;
  const data = readCellData(selectedCell);
  if (!data) return null;
  return data;
}

rotateBtn.addEventListener("click", () => {
  const data = requireEditableSelection();
  if (!data) return;

  pushState();
  data.rotation = (data.rotation + 90) % 360;
  writeCellData(selectedCell, data);
  updateStatus();
});

mirrorXBtn.addEventListener("click", () => {
  const data = requireEditableSelection();
  if (!data) return;

  pushState();
  data.mirrorX = !data.mirrorX;
  writeCellData(selectedCell, data);
  updateStatus();
});

mirrorYBtn.addEventListener("click", () => {
  const data = requireEditableSelection();
  if (!data) return;

  pushState();
  data.mirrorY = !data.mirrorY;
  writeCellData(selectedCell, data);
  updateStatus();
});

deleteBtn.addEventListener("click", () => {
  const data = requireEditableSelection();
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
  updateStatus();
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

    // Shape in local coords (0..w/h)
    let shapeMarkup = "";
    if (data.shapeType === "square") {
      shapeMarkup = `<rect x="0" y="0" width="${w}" height="${h}" fill="${data.color}" />`;
    } else {
      const r = CELL_PX * ROUND_RATIO; // 40%
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

    // Apply rotate + mirror about center
    const cx = w / 2;
    const cy = h / 2;
    const sx = data.mirrorX ? -1 : 1;
    const sy = data.mirrorY ? -1 : 1;
    const a = data.rotation;

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

// ----- Init -----
setMode("stamp");
updateStatus();
