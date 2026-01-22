// -----------------------------
// Shape Builder (V9)
// Board: fixed 5x5 grid • 100x100 cells
// NEW: Output size selector (2x2, 3x3, 4x4, 5x5)
//  - Randomize fills ONLY the selected output matrix
//  - The matrix is centered within the 5x5 board
// Modes:
//  - Stamp: click any cell to place/replace
//  - Select: click filled cell to select; drag to move (snap)
// Multi-select:
//  - Select all (Select mode only): selects all filled cells
//  - Dragging any selected shape moves the whole group together
//  - If any part would go out of bounds, drop is blocked (no partial moves)
// Deselect clears selection
// Rounded corner: ROUND_RATIO of cell size
// Export: tight-cropped SVG of used bounds
// -----------------------------

const GRID_SIZE = 5;        // Board is always 5x5
const CELL_PX = 100;

// Adjust rounding here (e.g. 0.40 = 40% of cell size)
const ROUND_RATIO = 0.55;

const COLORS = { blue: "#6396fc", yellow: "#ffdd35" };

// ---------- DOM ----------
const grid = document.getElementById("grid");
const statusText = document.getElementById("statusText");

// Mode
const modeStampBtn = document.getElementById("modeStampBtn");
const modeSelectBtn = document.getElementById("modeSelectBtn");

// Shape
const shapeSquareBtn = document.getElementById("shapeSquareBtn");
const shapeRoundedBtn = document.getElementById("shapeRoundedBtn");

// Color
const colorBlueBtn = document.getElementById("colorBlueBtn");
const colorYellowBtn = document.getElementById("colorYellowBtn");

// Output size (NEW)
const grid2Btn = document.getElementById("grid2Btn");
const grid3Btn = document.getElementById("grid3Btn");
const grid4Btn = document.getElementById("grid4Btn");
const grid5Btn = document.getElementById("grid5Btn");

// Picker actions
const randomizeBtn = document.getElementById("randomizeBtn");
const backBtn = document.getElementById("backBtn");

// Edit
const selectAllBtn = document.getElementById("selectAllBtn");
const deselectBtn = document.getElementById("deselectBtn");
const rotateBtn = document.getElementById("rotateBtn");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const deleteBtn = document.getElementById("deleteBtn");

// Actions
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

// ---------- State ----------
let currentMode = "stamp";
let currentColor = COLORS.blue;
let currentShapeType = "square";

// Output size state (NEW) - default 5x5
let currentOutputSize = 5;

let selectedCell = null;           // primary selection (anchor when group-selected)
const multiSelected = new Set();   // Set<HTMLElement> (group selection)
const cells = [];
const history = [];

// Drag
let isDragging = false;
let dragFromCell = null;
let currentDropCell = null;

// ---------- UI helpers ----------
function setActiveButton(groupButtons, activeBtn) {
  groupButtons.forEach((b) => b && b.classList.remove("active"));
  activeBtn && activeBtn.classList.add("active");
}

function countFilledCells() {
  let n = 0;
  for (const c of cells) if (c.querySelector(".shape")) n++;
  return n;
}

function hasAnySelection() {
  return !!selectedCell || multiSelected.size > 0;
}

function hasSingleSelectionWithData() {
  return (
    currentMode === "select" &&
    !!selectedCell &&
    !!readCellData(selectedCell) &&
    multiSelected.size === 0
  );
}

function setEditEnabled() {
  const singleEditable = hasSingleSelectionWithData();

  // Single tools
  rotateBtn.disabled = !singleEditable;
  mirrorXBtn.disabled = !singleEditable;
  mirrorYBtn.disabled = !singleEditable;

  // Delete: single OR group (select mode only)
  deleteBtn.disabled = !(currentMode === "select" && hasAnySelection());

  // Select all: select mode + at least one shape
  if (selectAllBtn) {
    selectAllBtn.disabled = !(currentMode === "select" && countFilledCells() > 0);
  }

  // Deselect: select mode + anything selected
  if (deselectBtn) {
    deselectBtn.disabled = !(currentMode === "select" && hasAnySelection());
  }
}

function clearDropTarget() {
  if (currentDropCell) currentDropCell.classList.remove("drop-target");
  currentDropCell = null;
}

function clearMultiSelection() {
  multiSelected.forEach((cell) => cell.classList.remove("multi-selected"));
  multiSelected.clear();
}

function clearSelection() {
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = null;
  clearMultiSelection();

  setEditEnabled();
  updateDraggableCursors();
  updateStatus();
}

function selectCell(cell) {
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = cell;
  selectedCell.classList.add("selected");

  // single-select clears multi
  clearMultiSelection();

  setEditEnabled();
  updateDraggableCursors();
  updateStatus();
}

function selectGroup(cellsToSelect) {
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = null;
  clearMultiSelection();

  for (const c of cellsToSelect) {
    if (c.querySelector(".shape")) {
      multiSelected.add(c);
      c.classList.add("multi-selected");
    }
  }

  const first = multiSelected.values().next().value || null;
  if (first) {
    selectedCell = first;
    selectedCell.classList.add("selected");
  }

  setEditEnabled();
  updateDraggableCursors();
  updateStatus();
}

function setMode(mode) {
  currentMode = mode;

  if (mode === "stamp") {
    setActiveButton([modeStampBtn, modeSelectBtn], modeStampBtn);
    clearSelection(); // keep stamp mode simple
    setEditEnabled();
    updateDraggableCursors();
    updateStatus();
    return;
  }

  setActiveButton([modeStampBtn, modeSelectBtn], modeSelectBtn);
  setEditEnabled();
  updateDraggableCursors();
  updateStatus();
}

function updateStatus() {
  if (!statusText) return;

  if (currentMode === "stamp") {
    statusText.textContent = `Mode: Stamp — click any cell to place/replace. Output grid: ${currentOutputSize}×${currentOutputSize}.`;
    return;
  }

  const filled = countFilledCells();

  if (multiSelected.size > 0) {
    statusText.textContent = `Mode: Select — ${multiSelected.size} selected • drag to move group • Delete removes all.`;
    return;
  }

  if (!selectedCell) {
    statusText.textContent =
      filled > 0
        ? "Mode: Select — click a filled cell to select (or use Select all)."
        : "Mode: Select — no shapes yet. Switch to Stamp to place shapes.";
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
    `Selected cell (${row}, ${col}) • ${shapeLabel} • rotation ${data.rotation}° • mirror ↔ ${mx} • mirror ↕ ${my} • drag to move`;
}

function updateDraggableCursors() {
  for (const cell of cells) {
    const shape = cell.querySelector(".shape");
    if (shape) shape.classList.remove("draggable");
  }

  if (currentMode !== "select") return;

  if (multiSelected.size > 0) {
    multiSelected.forEach((cell) => {
      const shape = cell.querySelector(".shape");
      if (shape) shape.classList.add("draggable");
    });
    return;
  }

  if (!selectedCell) return;
  const shape = selectedCell.querySelector(".shape");
  if (shape) shape.classList.add("draggable");
}

// ---------- History ----------
function pushState() {
  const snapshot = cells.map((cell) => {
    const data = readCellData(cell);
    return data ? { ...data } : null;
  });
  history.push(snapshot);
  if (history.length > 100) history.shift();
}

function restoreState(snapshot) {
  cells.forEach((cell, i) => writeCellData(cell, snapshot[i]));
  clearSelection();
  clearDropTarget();
  setEditEnabled();
  updateDraggableCursors();
  updateStatus();
}

// ---------- Cell data ----------
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

  if (data.shapeType === "rounded") {
    const r = `${ROUND_RATIO * 100}%`;
    node.style.borderRadius = `0 ${r} 0 0`; // top-right rounded
  } else {
    node.style.borderRadius = "0";
  }

  const sx = data.mirrorX ? -1 : 1;
  const sy = data.mirrorY ? -1 : 1;
  node.style.transform = `rotate(${data.rotation}deg) scaleX(${sx}) scaleY(${sy})`;
}

function writeCellData(cell, data) {
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

// ---------- Build board grid (5x5) ----------
for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
  const cell = document.createElement("div");
  cell.classList.add("cell");
  cell.dataset.row = String(Math.floor(i / GRID_SIZE));
  cell.dataset.col = String(i % GRID_SIZE);
  cell.addEventListener("click", () => handleCellClick(cell));
  grid.appendChild(cell);
  cells.push(cell);
}

// ---------- Click behavior ----------
function handleCellClick(cell) {
  const existing = readCellData(cell);

  if (currentMode === "stamp") {
    pushState();
    writeCellData(cell, {
      shapeType: currentShapeType,
      color: currentColor,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
    });
    clearSelection();
    return;
  }

  // Select mode
  if (!existing) {
    clearSelection();
    return;
  }
  selectCell(cell);
}

// ---------- Mode switching ----------
modeStampBtn.addEventListener("click", () => setMode("stamp"));
modeSelectBtn.addEventListener("click", () => setMode("select"));

// ---------- Shape selection ----------
shapeSquareBtn.addEventListener("click", () => {
  currentShapeType = "square";
  setActiveButton([shapeSquareBtn, shapeRoundedBtn], shapeSquareBtn);
});
shapeRoundedBtn.addEventListener("click", () => {
  currentShapeType = "rounded";
  setActiveButton([shapeSquareBtn, shapeRoundedBtn], shapeRoundedBtn);
});

// ---------- Color selection ----------
colorBlueBtn.addEventListener("click", () => {
  currentColor = COLORS.blue;
  setActiveButton([colorBlueBtn, colorYellowBtn], colorBlueBtn);
});
colorYellowBtn.addEventListener("click", () => {
  currentColor = COLORS.yellow;
  setActiveButton([colorBlueBtn, colorYellowBtn], colorYellowBtn);
});

// ---------- Output size selection (NEW) ----------
function setOutputSize(n) {
  currentOutputSize = n;

  // Highlight active
  setActiveButton([grid2Btn, grid3Btn, grid4Btn, grid5Btn], n === 2 ? grid2Btn : n === 3 ? grid3Btn : n === 4 ? grid4Btn : grid5Btn);

  updateStatus();
}

if (grid2Btn) grid2Btn.addEventListener("click", () => setOutputSize(2));
if (grid3Btn) grid3Btn.addEventListener("click", () => setOutputSize(3));
if (grid4Btn) grid4Btn.addEventListener("click", () => setOutputSize(4));
if (grid5Btn) grid5Btn.addEventListener("click", () => setOutputSize(5));

// ---------- Picker actions ----------
function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomRotation() {
  return [0, 90, 180, 270][randomInt(4)];
}

function randomShapeType() {
  return Math.random() < 0.5 ? "square" : "rounded";
}

function randomColor() {
  return Math.random() < 0.5 ? COLORS.blue : COLORS.yellow;
}

function getCenteredWindow(size) {
  // returns { startRow, startCol, endRowExclusive, endColExclusive }
  const startRow = Math.floor((GRID_SIZE - size) / 2);
  const startCol = Math.floor((GRID_SIZE - size) / 2);
  return {
    startRow,
    startCol,
    endRow: startRow + size,
    endCol: startCol + size,
  };
}

// Randomize fills ONLY the centered output size window
if (randomizeBtn) {
  randomizeBtn.addEventListener("click", () => {
    pushState();
    clearSelection();

    // Clear entire board first (simple + predictable)
    cells.forEach((cell) => writeCellData(cell, null));

    const { startRow, startCol, endRow, endCol } = getCenteredWindow(currentOutputSize);

    // Density scales slightly with size (smaller grids feel more "stamped")
    const densityBySize = { 2: 0.9, 3: 0.75, 4: 0.65, 5: 0.55 };
    const FILL_PROB = densityBySize[currentOutputSize] ?? 0.6;

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const idx = r * GRID_SIZE + c;

        if (Math.random() < FILL_PROB) {
          writeCellData(cells[idx], {
            shapeType: randomShapeType(),
            color: randomColor(),
            rotation: randomRotation(),
            mirrorX: false,
            mirrorY: false,
          });
        }
      }
    }

    setEditEnabled();
    updateStatus();
  });
}

// Back: returns to Stamp mode
if (backBtn) {
  backBtn.addEventListener("click", () => {
    setMode("stamp");
  });
}

// ---------- Select all ----------
if (selectAllBtn) {
  selectAllBtn.addEventListener("click", () => {
    if (currentMode !== "select") return;
    const filledCells = cells.filter((c) => c.querySelector(".shape"));
    if (filledCells.length === 0) {
      clearSelection();
      return;
    }
    selectGroup(filledCells);
  });
}

// ---------- Deselect ----------
if (deselectBtn) {
  deselectBtn.addEventListener("click", () => {
    if (currentMode !== "select") return;
    clearSelection();
  });
}

// ---------- Edit actions (single selection only) ----------
function requireEditableSingleSelection() {
  if (!hasSingleSelectionWithData()) return null;
  return readCellData(selectedCell);
}

rotateBtn.addEventListener("click", () => {
  const data = requireEditableSingleSelection();
  if (!data) return;

  pushState();
  data.rotation = (data.rotation + 90) % 360;
  writeCellData(selectedCell, data);

  setEditEnabled();
  updateStatus();
});

mirrorXBtn.addEventListener("click", () => {
  const data = requireEditableSingleSelection();
  if (!data) return;

  pushState();
  data.mirrorX = !data.mirrorX;
  writeCellData(selectedCell, data);

  setEditEnabled();
  updateStatus();
});

mirrorYBtn.addEventListener("click", () => {
  const data = requireEditableSingleSelection();
  if (!data) return;

  pushState();
  data.mirrorY = !data.mirrorY;
  writeCellData(selectedCell, data);

  setEditEnabled();
  updateStatus();
});

deleteBtn.addEventListener("click", () => {
  if (currentMode !== "select") return;

  // Group delete
  if (multiSelected.size > 0) {
    pushState();
    multiSelected.forEach((cell) => writeCellData(cell, null));
    clearSelection();
    return;
  }

  // Single delete
  const data = requireEditableSingleSelection();
  if (!data) return;

  pushState();
  writeCellData(selectedCell, null);
  clearSelection();
});

// ---------- Actions ----------
clearBtn.addEventListener("click", () => {
  pushState();
  cells.forEach((cell) => writeCellData(cell, null));
  clearSelection();
});

undoBtn.addEventListener("click", () => {
  const last = history.pop();
  if (!last) return;
  restoreState(last);
  setMode(currentMode);
});

// ---------- Drag & snap (single + group) ----------
grid.addEventListener("pointerdown", (e) => {
  if (currentMode !== "select") return;

  const target = e.target;
  if (!target || !target.classList || !target.classList.contains("shape")) return;

  const cell = target.closest(".cell");
  if (!cell) return;

  // Group drag must start from group member
  if (multiSelected.size > 0) {
    if (!multiSelected.has(cell)) return;
  } else {
    // Single drag must be selected cell
    if (!selectedCell || cell !== selectedCell) return;
  }

  isDragging = true;
  dragFromCell = cell;

  target.classList.add("dragging");
  grid.setPointerCapture(e.pointerId);
  e.preventDefault();
});

grid.addEventListener("pointermove", (e) => {
  if (!isDragging) return;

  const cell = cellFromPointer(e.clientX, e.clientY);
  if (!cell) {
    clearDropTarget();
    return;
  }

  if (currentDropCell !== cell) {
    clearDropTarget();
    currentDropCell = cell;
    currentDropCell.classList.add("drop-target");
  }
});

grid.addEventListener("pointerup", (e) => {
  if (!isDragging) return;

  const toCell = cellFromPointer(e.clientX, e.clientY);

  // Cleanup
  const fromShape = dragFromCell?.querySelector(".shape");
  if (fromShape) fromShape.classList.remove("dragging");
  clearDropTarget();

  isDragging = false;

  if (!toCell) {
    dragFromCell = null;
    return;
  }

  const moveCells =
    multiSelected.size > 0 ? Array.from(multiSelected) : selectedCell ? [selectedCell] : [];

  if (moveCells.length === 0) {
    dragFromCell = null;
    return;
  }

  // Anchor delta
  const fromRow = parseInt(dragFromCell.dataset.row, 10);
  const fromCol = parseInt(dragFromCell.dataset.col, 10);
  const toRow = parseInt(toCell.dataset.row, 10);
  const toCol = parseInt(toCell.dataset.col, 10);

  const dRow = toRow - fromRow;
  const dCol = toCol - fromCol;

  if (dRow === 0 && dCol === 0) {
    dragFromCell = null;
    return;
  }

  // Plan + bounds check
  const plan = [];
  for (const cell of moveCells) {
    const data = readCellData(cell);
    if (!data) continue;

    const srcRow = parseInt(cell.dataset.row, 10);
    const srcCol = parseInt(cell.dataset.col, 10);
    const destRow = srcRow + dRow;
    const destCol = srcCol + dCol;

    if (destRow < 0 || destCol < 0 || destRow >= GRID_SIZE || destCol >= GRID_SIZE) {
      dragFromCell = null;
      return; // block whole move
    }

    plan.push({ srcRow, srcCol, destRow, destCol, data });
  }

  if (plan.length === 0) {
    dragFromCell = null;
    return;
  }

  pushState();

  const srcKeys = new Set();
  const destMap = new Map();

  for (const p of plan) {
    srcKeys.add(`${p.srcRow},${p.srcCol}`);
    destMap.set(`${p.destRow},${p.destCol}`, p.data); // last write wins if overlap
  }

  // Clear sources
  srcKeys.forEach((key) => {
    const [r, c] = key.split(",").map(Number);
    writeCellData(cells[r * GRID_SIZE + c], null);
  });

  // Write destinations (replacement behavior)
  destMap.forEach((data, key) => {
    const [r, c] = key.split(",").map(Number);
    writeCellData(cells[r * GRID_SIZE + c], data);
  });

  // Rebuild selection
  const movedCells = [];
  destMap.forEach((_data, key) => {
    const [r, c] = key.split(",").map(Number);
    movedCells.push(cells[r * GRID_SIZE + c]);
  });

  if (moveCells.length > 1) {
    selectGroup(movedCells);
  } else {
    selectCell(movedCells[0]);
  }

  dragFromCell = null;
});

grid.addEventListener("pointercancel", () => {
  if (!isDragging) return;
  isDragging = false;

  const fromShape = dragFromCell?.querySelector(".shape");
  if (fromShape) fromShape.classList.remove("dragging");

  clearDropTarget();
  dragFromCell = null;
});

function cellFromPointer(clientX, clientY) {
  const rect = grid.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

  const cellW = rect.width / GRID_SIZE;
  const cellH = rect.height / GRID_SIZE;

  const col = Math.floor(x / cellW);
  const row = Math.floor(y / cellH);

  return cells[row * GRID_SIZE + col] || null;
}

// ---------- Export ----------
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

    let shapeMarkup = "";
    if (data.shapeType === "square") {
      shapeMarkup = `<rect x="0" y="0" width="${w}" height="${h}" fill="${data.color}" />`;
    } else {
      const r = CELL_PX * ROUND_RATIO;
      const d = [`M 0 0`, `H ${w - r}`, `Q ${w} 0 ${w} ${r}`, `V ${h}`, `H 0`, `Z`].join(" ");
      shapeMarkup = `<path d="${d}" fill="${data.color}" />`;
    }

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
  link.download = "shape-builder.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
});

function findUsedBounds() {
  let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;

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

// ---------- Init ----------
setMode("stamp");
setOutputSize(5); // default (also sets active UI)
setEditEnabled();
updateStatus();
