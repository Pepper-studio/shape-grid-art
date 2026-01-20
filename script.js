// -----------------------------
// Shape Grid Art (V1.1)
// 10x10 grid • 2 shapes • 2 colors
// Placement: Layer toggle (OFF=Replace stack, ON=Add to stack)
// Click empty = place • Click filled = select
// Edit via buttons (acts on TOP layer): Rotate, Mirror ↔, Mirror ↕, Delete
// Export: tight-cropped SVG including stacked layers
// Rounded corner: 40% of cell size
// -----------------------------

// ----- Config -----
const GRID_SIZE = 10;
const CELL_PX = 64;        // export sizing (independent from CSS)
const ROUND_RATIO = 0.4;   // 40% corner radius based on cell size

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

// Placement toggle
const layerToggle = document.getElementById("layerToggle"); // checkbox

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
let currentColor = COLORS.blue;
let currentShapeType = "square"; // "square" | "rounded"
let selectedCell = null;

const cells = [];
const history = []; // snapshots (max 100)

// ----- Layer model -----
// Each cell stores a STACK of layers in DOM:
// <div class="shape" data-...></div> repeated
//
// A layer looks like:
// { shapeType, color, rotation, mirrorX, mirrorY, size }
//
// NOTE: size presets come later. For now, size=1 (all same),
// but we keep the field because it unlocks stacking rules cleanly.
const DEFAULT_SIZE = 1;

// Sorting rule (future-proof):
// Larger size below, smaller above. Same size: keep existing order (older below).
function sortLayersBySize(layers) {
  // stable sort: group by size ascending so smaller ends up later (on top)
  // We'll implement as: larger first (bottom) -> smaller last (top)
  // but preserve order within same size.
  return layers
    .map((l, idx) => ({ l, idx }))
    .sort((a, b) => {
      if (a.l.size !== b.l.size) return b.l.size - a.l.size; // larger first
      return a.idx - b.idx; // stable for same size
    })
    .map((x) => x.l);
}

// ----- Helpers: selection UI -----
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
  setEditEnabled(true);
  updateStatus();
}

function updateStatus() {
  if (!statusText) return;

  if (!selectedCell) {
    statusText.textContent = "No selection.";
    return;
  }

  const layers = readCellLayers(selectedCell);
  const row = parseInt(selectedCell.dataset.row, 10) + 1;
  const col = parseInt(selectedCell.dataset.col, 10) + 1;

  if (layers.length === 0) {
    statusText.textContent = `Selected cell (${row}, ${col}) is empty.`;
    return;
  }

  const top = layers[layers.length - 1];
  const shapeLabel = top.shapeType === "rounded" ? "Rounded corner" : "Square";
  const mx = top.mirrorX ? "on" : "off";
  const my = top.mirrorY ? "on" : "off";

  statusText.textContent =
    `Selected cell (${row}, ${col}) • layers ${layers.length} • top: ${shapeLabel} • rotation ${top.rotation}° • mirror ↔ ${mx} • mirror ↕ ${my}`;
}

// ----- History (Undo) -----
function pushState() {
  const snapshot = cells.map((cell) => readCellLayers(cell));
  history.push(snapshot);
  if (history.length > 100) history.shift();
}

function restoreState(snapshot) {
  cells.forEach((cell, i) => {
    writeCellLayers(cell, snapshot[i]);
  });
  clearSelection();
}

// ----- Layer serialization (read/write) -----
function readCellLayers(cell) {
  const nodes = Array.from(cell.querySelectorAll(".shape"));
  return nodes.map((shape) => ({
    shapeType: shape.dataset.shapeType || "square",
    color: shape.dataset.color || COLORS.blue,
    rotation: parseInt(shape.dataset.rotation || "0", 10) || 0,
    mirrorX: shape.dataset.mirrorX === "true",
    mirrorY: shape.dataset.mirrorY === "true",
    size: parseFloat(shape.dataset.size || String(DEFAULT_SIZE)) || DEFAULT_SIZE,
  }));
}

function clearCellDom(cell) {
  const nodes = cell.querySelectorAll(".shape");
  nodes.forEach((n) => n.remove());
}

function applyLayerToDomNode(node, layer) {
  node.dataset.shapeType = layer.shapeType;
  node.dataset.color = layer.color;
  node.dataset.rotation = String(layer.rotation);
  node.dataset.mirrorX = String(!!layer.mirrorX);
  node.dataset.mirrorY = String(!!layer.mirrorY);
  node.dataset.size = String(layer.size);

  node.style.backgroundColor = layer.color;

  // Geometry (rounded corner top-right at 40%)
  if (layer.shapeType === "rounded") {
    const r = `${ROUND_RATIO * 100}%`;
    node.style.borderRadius = `0 ${r} 0 0`;
  } else {
    node.style.borderRadius = "0";
  }

  // Transform: rotate + mirror around center
  const sx = layer.mirrorX ? -1 : 1;
  const sy = layer.mirrorY ? -1 : 1;
  node.style.transform = `rotate(${layer.rotation}deg) scaleX(${sx}) scaleY(${sy})`;

  // Size hook (future): keep it here so we can implement presets without refactor
  // For now, size=1 so it does nothing visually.
  node.style.transform += ` scale(${layer.size})`;
}

function writeCellLayers(cell, layers) {
  clearCellDom(cell);

  // Ensure consistent ordering before rendering:
  // bottom -> top (last is top)
  const sorted = sortLayersBySize(layers);

  sorted.forEach((layer) => {
    const node = document.createElement("div");
    node.classList.add("shape");
    // Important: allow selection outline to sit on top (outline is on cell)
    // Shapes stack naturally by DOM order.
    applyLayerToDomNode(node, layer);
    cell.appendChild(node);
  });
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

// ----- Click behavior (Replace vs Layer) -----
function handleCellClick(cell) {
  const layers = readCellLayers(cell);
  const hasShapes = layers.length > 0;

  // If empty: always place (and select)
  if (!hasShapes) {
    pushState();
    const newLayer = makeCurrentLayer();
    writeCellLayers(cell, [newLayer]);
    selectCell(cell);
    return;
  }

  // If filled: select always
  selectCell(cell);

  // Also place/replace depending on Layer toggle
  // - OFF (Replace): clear entire stack and place one layer
  // - ON  (Layer): add a layer to the stack
  pushState();

  if (layerToggle && layerToggle.checked) {
    // Layer mode: add
    const next = layers.concat([makeCurrentLayer()]);
    writeCellLayers(cell, next);
  } else {
    // Replace mode: replace entire stack with one
    writeCellLayers(cell, [makeCurrentLayer()]);
  }

  // selection remains on the cell
  updateStatus();
}

function makeCurrentLayer() {
  return {
    shapeType: currentShapeType,
    color: currentColor,
    rotation: 0,
    mirrorX: false,
    mirrorY: false,
    size: DEFAULT_SIZE,
  };
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

// ----- Edit actions (act on TOP layer only) -----
function updateTopLayer(cell, mutateFn) {
  const layers = readCellLayers(cell);
  if (layers.length === 0) return;

  const topIndex = layers.length - 1;
  const top = { ...layers[topIndex] };
  mutateFn(top);
  layers[topIndex] = top;

  writeCellLayers(cell, layers);
}

rotateBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  pushState();
  updateTopLayer(selectedCell, (top) => {
    top.rotation = (top.rotation + 90) % 360;
  });
  updateStatus();
});

mirrorXBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  pushState();
  updateTopLayer(selectedCell, (top) => {
    top.mirrorX = !top.mirrorX;
  });
  updateStatus();
});

mirrorYBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  pushState();
  updateTopLayer(selectedCell, (top) => {
    top.mirrorY = !top.mirrorY;
  });
  updateStatus();
});

deleteBtn.addEventListener("click", () => {
  if (!selectedCell) return;
  const layers = readCellLayers(selectedCell);
  if (layers.length === 0) return;

  pushState();

  // Delete removes TOP layer first (sensible for stacks)
  layers.pop();
  writeCellLayers(selectedCell, layers);

  // If stack emptied, clear selection (no edit target)
  if (layers.length === 0) {
    clearSelection();
  } else {
    updateStatus();
  }
});

// ----- Utility actions -----
clearBtn.addEventListener("click", () => {
  pushState();
  cells.forEach((cell) => writeCellLayers(cell, []));
  clearSelection();
});

undoBtn.addEventListener("click", () => {
  const last = history.pop();
  if (!last) return;
  restoreState(last);
});

// ----- Export (tight-cropped SVG incl. stacks) -----
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
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);

    const layers = readCellLayers(cell);
    if (layers.length === 0) return;

    const x = (col - minCol) * CELL_PX;
    const y = (row - minRow) * CELL_PX;

    // Ensure same ordering as on-screen (bottom -> top)
    const sorted = sortLayersBySize(layers);

    sorted.forEach((layer) => {
      const w = CELL_PX;
      const h = CELL_PX;

      // Shape markup in local coords (0..w/h)
      let shapeMarkup = "";

      if (layer.shapeType === "square") {
        shapeMarkup = `<rect x="0" y="0" width="${w}" height="${h}" fill="${layer.color}" />`;
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
        shapeMarkup = `<path d="${d}" fill="${layer.color}" />`;
      }

      // Apply rotate + mirror about center (plus size scaling)
      const cx = w / 2;
      const cy = h / 2;
      const sx = layer.mirrorX ? -1 : 1;
      const sy = layer.mirrorY ? -1 : 1;
      const a = layer.rotation;
      const s = layer.size || DEFAULT_SIZE;

      // Nested transforms for reliable Illustrator import
      const group = `
  <g transform="translate(${x} ${y})">
    <g transform="translate(${cx} ${cy})">
      <g transform="rotate(${a})">
        <g transform="scale(${sx} ${sy})">
          <g transform="scale(${s})">
            <g transform="translate(${-cx} ${-cy})">
              ${shapeMarkup}
            </g>
          </g>
        </g>
      </g>
    </g>
  </g>
      `.trim();

      shapesSvg.push(group);
    });
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

// ----- Bounds helper -----
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

// ----- Initial UI state -----
setEditEnabled(false);
updateStatus();
