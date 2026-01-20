// -----------------------------
// Shape Grid Art (V4)
// 5x5 grid • 100x100 cells
// Modes:
//  - Stamp: click any cell to place/replace
//  - Select: click filled cell to select; drag to move (snap)
// Multi-select:
//  - Select all (Select mode only): selects all filled cells
//  - Dragging any selected shape moves the whole group together
//  - If any part would go out of bounds, drop is blocked
// Rounded corner: 40% of cell size
// Export: tight-cropped SVG
// -----------------------------

const GRID_SIZE = 5;
const CELL_PX = 100;
const ROUND_RATIO = 0.4;

const COLORS = { blue: "#6396fc", yellow: "#ffdd35" };

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

// Edit
const selectAllBtn = document.getElementById("selectAllBtn");
const rotateBtn = document.getElementById("rotateBtn");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const deleteBtn = document.getElementById("deleteBtn");

// Utility
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

let currentMode = "stamp";
let currentColor = COLORS.blue;
let currentShapeType = "square";

let selectedCell = null;
const multiSelected = new Set(); // Set<HTMLElement>

const cells = [];
const history = [];

// Drag state
let isDragging = false;
let dragFromCell = null;
let currentDropCell = null;

// ---------- UI helpers ----------
function setActiveButton(groupButtons, activeBtn) {
  groupButtons.forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

function setEditEnabled(enabled) {
  // Edit buttons
  rotateBtn.disabled = !enabled;
  mirrorXBtn.disabled = !enabled;
  mirrorYBtn.disabled = !enabled;
  deleteBtn.disabled = !enabled;
  // Select all should be available in Select mode regardless of selection,
  // but we only enable it when there is at least 1 filled cell.
  if (selectAllBtn) selectAllBtn.disabled = !(currentMode === "select" && countFilledCells() > 0);
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
  setEditEnabled(false);
  updateDraggableCursors();
  updateStatus();
}

function selectCell(cell) {
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = cell;
  selectedCell.classList.add("selected");

  // In single-select, multi-selection clears
  clearMultiSelection();

  const hasData = !!readCellData(cell);
  setEditEnabled(currentMode === "select" && hasData);
  updateDraggableCursors();
  updateStatus();
}

function setMode(mode) {
  currentMode = mode;

  if (mode === "stamp") {
    setActiveButton([modeStampBtn, modeSelectBtn], modeStampBtn);
    setEditEnabled(false);
    updateDraggableCursors();
    updateStatus();
  } else {
    setActiveButton([modeStampBtn, modeSelectBtn], modeSelectBtn);
    const hasSelection = !!selectedCell && !!readCellData(selectedCell);
    setEditEnabled(hasSelection);
    updateDraggableCursors();
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
  const filled = countFilledCells();
  if (multiSelected.size > 0) {
    statusText.textContent = `Mode: Select — ${multiSelected.size} selected • drag to move group.`;
    return;
  }

  if (!selectedCell) {
    statusText.textContent = filled > 0
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
  cells.forEach((cell) => {
    const shape = cell.querySelector(".shape");
    if (!shape) return;
    shape.classList.remove("draggable");
  });

  if (currentMode !== "select") return;

  // Group drag: any selected member shows grab cursor (practically, you drag from one)
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

function countFilledCells() {
  let n = 0;
  cells.forEach((c) => { if (c.querySelector(".shape")) n++; });
  return n;
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
    node.style.borderRadius = `0 ${r} 0 0`;
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

// ---------- Build grid ----------
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

// ---------- Select all ----------
if (selectAllBtn) {
  selectAllBtn.addEventListener("click", () => {
    if (currentMode !== "select") return;

    clearSelection(); // clears single + multi first
    // Rebuild multi-selection from filled cells
    cells.forEach((cell) => {
      if (cell.querySelector(".shape")) {
        multiSelected.add(cell);
        cell.classList.add("multi-selected");
      }
    });

    // Pick a primary selected cell (first in set)
    const first = multiSelected.values().next().value || null;
    if (first) {
      selectedCell = first;
      selectedCell.classList.add("selected");
    }

    setEditEnabled(multiSelected.size > 0);
    updateDraggableCursors();
    updateStatus();
  });
}

// ---------- Edit actions (single selection only) ----------
function requireEditableSelection() {
  if (currentMode !== "select") return null;
  if (multiSelected.size > 0) return null; // keep edits simple for now
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
  if (currentMode !== "select") return;

  // If multi-selected: delete all selected
  if (multiSelected.size > 0) {
    pushState();
    multiSelected.forEach((cell) => writeCellData(cell, null));
    clearSelection();
    updateStatus();
    return;
  }

  // Otherwise single
  const data = requireEditableSelection();
  if (!data) return;
  pushState();
  writeCellData(selectedCell, null);
  clearSelection();
  updateStatus();
});

// ---------- Utility ----------
clearBtn.addEventListener("click", () => {
  pushState();
  cells.forEach((cell) => writeCellData(cell, null));
  clearSelection();
});

undoBtn.addEventListener("click", () => {
  const last = history.pop();
  if (!last) return;
  restoreState(last);
  updateStatus();
});

// ---------- Drag & snap (single + group) ----------
grid.addEventListener("pointerdown", (e) => {
  if (currentMode !== "select") return;

  // Determine if pointer is down on a draggable shape
  const target = e.target;
  if (!target || !target.classList || !target.classList.contains("shape")) return;

  // Determine which cell this shape belongs to
  const cell = target.closest(".cell");
  if (!cell) return;

  // If multi-selected: only allow drag if clicked shape belongs to the group
  if (multiSelected.size > 0) {
    if (!multiSelected.has(cell)) return;
  } else {
    // Single selection: must be the selected cell
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

  // Cleanup drag visuals
  const fromShape = dragFromCell?.querySelector(".shape");
  if (fromShape) fromShape.classList.remove("dragging");
  clearDropTarget();

  isDragging = false;

  // Dropped outside grid or invalid
  if (!toCell) {
    dragFromCell = null;
    updateStatus();
    return;
  }

  // Determine selection set for move
  const moveCells = (multiSelected.size > 0)
    ? Array.from(multiSelected)
    : (selectedCell ? [selectedCell] : []);

  if (moveCells.length === 0) {
    dragFromCell = null;
    return;
  }

  // Compute delta in grid units between the drag origin cell and drop target cell
  // We anchor the move to the cell the user started dragging from.
  const fromAnchor = dragFromCell;
  const fromRow = parseInt(fromAnchor.dataset.row, 10);
  const fromCol = parseInt(fromAnchor.dataset.col, 10);
  const toRow = parseInt(toCell.dataset.row, 10);
  const toCol = parseInt(toCell.dataset.col, 10);

  const dRow = toRow - fromRow;
  const dCol = toCol - fromCol;

  // If no movement, keep selection as-is
  if (dRow === 0 && dCol === 0) {
    dragFromCell = null;
    updateStatus();
    return;
  }

  // Build move plan: map from source -> destination
  const plan = [];
  for (const cell of moveCells) {
    const data = readCellData(cell);
    if (!data) continue;

    const r = parseInt(cell.dataset.row, 10) + dRow;
    const c = parseInt(cell.dataset.col, 10) + dCol;

    // Block drop if any would go out of bounds
    if (r < 0 || c < 0 || r >= GRID_SIZE || c >= GRID_SIZE) {
      dragFromCell = null;
      updateStatus();
      return;
    }

    const dest = cells[r * GRID_SIZE + c];
    plan.push({ src: cell, dest, data });
  }

  // Execute move atomically (so we don’t overwrite mid-move)
  pushState();

  // Clear all sources first
  plan.forEach(({ src }) => writeCellData(src, null));

  // Then write to destinations
  plan.forEach(({ dest, data }) => writeCellData(dest, data));

  // Rebuild selection on new locations
  clearMultiSelection();
  if (multiSelected.size > 0) {
    // This branch won't hit because we cleared set, but keep pattern simple
  }

  if (plan.length > 1) {
    plan.forEach(({ dest }) => {
      multiSelected.add(dest);
      dest.classList.add("multi-selected");
    });
    selectedCell = plan[0].dest;
    selectedCell.classList.add("selected");
  } else {
    selectCell(plan[0].dest);
  }

  updateDraggableCursors();
  updateStatus();
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

  const idx = row * GRID_SIZE + col;
  return cells[idx] || null;
}

// ---------- Export (unchanged) ----------
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
  link.download = "grid-art.svg";
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
updateStatus();
