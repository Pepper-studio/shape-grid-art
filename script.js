// -----------------------------
// Shape Grid Art (V5)
// 5x5 grid • 100x100 cells
// Modes:
//  - Stamp: click any cell to place/replace
//  - Select: click filled cell to select; drag to move (snap)
// Multi-select:
//  - Select all (Select mode only): selects all filled cells
//  - Dragging any selected shape moves the whole group together
//  - If any part would go out of bounds, drop is blocked (no partial moves)
// Deselect:
//  - Clears single + multi selection (Select mode only)
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
const deselectBtn = document.getElementById("deselectBtn"); // NEW
const rotateBtn = document.getElementById("rotateBtn");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const deleteBtn = document.getElementById("deleteBtn");

// Utility
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

// ----- State -----
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

function countFilledCells() {
  let n = 0;
  cells.forEach((c) => {
    if (c.querySelector(".shape")) n++;
  });
  return n;
}

function hasAnySelection() {
  return !!selectedCell || multiSelected.size > 0;
}

function setEditEnabled(editEnabledForSingle) {
  // Single-edit tools
  rotateBtn.disabled = !editEnabledForSingle;
  mirrorXBtn.disabled = !editEnabledForSingle;
  mirrorYBtn.disabled = !editEnabledForSingle;
  deleteBtn.disabled = !(currentMode === "select" && hasAnySelection()); // single OR group

  // Select all: Select mode + at least 1 shape on grid
  if (selectAllBtn) {
    selectAllBtn.disabled = !(currentMode === "select" && countFilledCells() > 0);
  }

  // Deselect: Select mode + anything selected (single or multi)
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

  setEditEnabled(false);
  updateDraggableCursors();
  updateStatus();
}

function selectCell(cell) {
  if (selectedCell) selectedCell.classList.remove("selected");
  selectedCell = cell;
  selectedCell.classList.add("selected");

  // single-select clears multi
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

    // No editing/selecting UX in stamp
    setEditEnabled(false);
    updateDraggableCursors();
    updateStatus();
    return;
  }

  // Select mode
  setActiveButton([modeStampBtn, modeSelectBtn], modeSelectBtn);

  // Enable single-edit only when a single filled cell is selected
  const canEditSingle = !!selectedCell && !!readCellData(selectedCell) && multiSelected.size === 0;
  setEditEnabled(canEditSingle);

  updateDraggableCursors();
  updateStatus();
}

function updateStatus() {
  if (!statusText) return;

  if (currentMode === "stamp") {
    statusText.textContent = "Mode: Stamp — click any cell to place/replace.";
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
  // Clear previous
  cells.forEach((cell) => {
    const shape = cell.querySelector(".shape");
    if (shape) shape.classList.remove("draggable");
  });

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

    // Clear previous selection state first
    if (selectedCell) selectedCell.classList.remove("selected");
    selectedCell = null;
    clearMultiSelection();

    // Add every filled cell to multi-selection
    cells.forEach((cell) => {
      if (cell.querySelector(".shape")) {
        multiSelected.add(cell);
        cell.classList.add("multi-selected");
      }
    });

    // Add a primary anchor highlight (first selected)
    const first = multiSelected.values().next().value || null;
    if (first) {
      selectedCell = first;
      selectedCell.classList.add("selected");
    }

    setEditEnabled(false); // single-edit tools off while group selected
    updateDraggableCursors();
    updateStatus();
  });
}

// ---------- Deselect (NEW) ----------
if (deselectBtn) {
  deselectBtn.addEventListener("click", () => {
    if (currentMode !== "select") return;
    clearSelection();
  });
}

// ---------- Edit actions (single selection only) ----------
function requireEditableSingleSelection() {
  if (currentMode !== "select") return null;
  if (multiSelected.size > 0) return null; // keep edits simple: single only
  if (!selectedCell) return null;
  const data = readCellData(selectedCell);
  if (!data) return null;
  return data;
}

rotateBtn.addEventListener("click", () => {
  const data = requireEditableSingleSelection();
  if (!data) return;

  pushState();
  data.rotation = (data.rotation + 90) % 360;
  writeCellData(selectedCell, data);

  setEditEnabled(true);
  updateStatus();
});

mirrorXBtn.addEventListener("click", () => {
  const data = requireEditableSingleSelection();
  if (!data) return;

  pushState();
  data.mirrorX = !data.mirrorX;
  writeCellData(selectedCell, data);

  setEditEnabled(true);
  updateStatus();
});

mirrorYBtn.addEventListener("click", () => {
  const data = requireEditableSingleSelection();
  if (!data) return;

  pushState();
  data.mirrorY = !data.mirrorY;
  writeCellData(selectedCell, data);

  setEditEnabled(true);
  updateStatus();
});

deleteBtn.addEventListener("click", () => {
  if (currentMode !== "select") return;

  // If group selected: delete all
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
  setMode(currentMode); // refresh enable/disable states
});

// ---------- Drag & snap (single + group) ----------
grid.addEventListener("pointerdown", (e) => {
  if (currentMode !== "select") return;

  const target = e.target;
  if (!target || !target.classList || !target.classList.contains("shape")) return;

  const cell = target.closest(".cell");
  if (!cell) return;

  // Group drag: must start from a member of the group
  if (multiSelected.size > 0) {
    if (!multiSelected.has(cell)) return;
  } else {
    // Single drag: must be the selected cell
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

  // Anchor delta (grid units)
  const fromAnchor = dragFromCell;
  const fromRow = parseInt(fromAnchor.dataset.row, 10);
  const fromCol = parseInt(fromAnchor.dataset.col, 10);
  const toRow = parseInt(toCell.dataset.row, 10);
  const toCol = parseInt(toCell.dataset.col, 10);

  const dRow = toRow - fromRow;
  const dCol = toCol - fromCol;

  if (dRow === 0 && dCol === 0) {
    dragFromCell = null;
    return;
  }

  // Plan move + bounds check
  const plan = [];
  for (const cell of moveCells) {
    const data = readCellData(cell);
    if (!data) continue;

    const r = parseInt(cell.dataset.row, 10) + dRow;
    const c = parseInt(cell.dataset.col, 10) + dCol;

    // Block if any out of bounds
    if (r < 0 || c < 0 || r >= GRID_SIZE || c >= GRID_SIZE) {
      dragFromCell = null;
      return;
    }

    const dest = cells[r * GRID_SIZE + c];
    plan.push({ src: cell, dest, data });
  }

  // Execute atomically
  pushState();

  // clear sources first
  plan.forEach(({ src }) => writeCellData(src, null));
  // then place at destinations (replacement behavior)
  plan.forEach(({ dest, data }) => writeCellData(dest, data));

  // rebuild selection on new locations
  const movedTo = plan.map((p) => p.dest);

  // If group move
  if (moveCells.length > 1) {
    // reset current selection visuals
    if (selectedCell) selectedCell.classList.remove("selected");
    selectedCell = null;
    clearMultiSelection();

    movedTo.forEach((cell) => {
      multiSelected.add(cell);
      cell.classList.add("multi-selected");
    });

    selectedCell = movedTo[0];
    selectedCell.classList.add("selected");

    setEditEnabled(false);
  } else {
    selectCell(movedTo[0]);
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
  link.download = "grid-art.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
});

function findUsedBounds() {
  let minRow = Infinity,
    maxRow = -Infinity,
    minCol = Infinity,
    maxCol = -Infinity;

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
