// Shape Builder (updated)
// - 5x5 board, fixed
// - Output size (2–5) controls a centered window used by Randomize
// - Randomize fills ALL cells in the chosen output window (no empties)
// - Select mode supports single + multi-select
// - Select all enables rotate/mirror/delete for the whole selection
// - Rotate/mirror apply as GROUP transforms (positions + orientations)
// - Rounded corner increased by +5px (now 60px on a 100px cell)
// - Drag moves selection; out-of-bounds blocks move
// - Export tight-cropped SVG of used bounds

(() => {
  // ---------- Constants ----------
  const GRID_SIZE = 5;
  const CELL_PX = 100;

  // Was ~55px (0.55 * 100). Increased by +5px per request.
  const ROUND_PX = 60;

  const COLORS = { blue: "#6396fc", yellow: "#ffdd35" };

  // ---------- DOM ----------
  const gridEl = document.getElementById("grid");
  if (!gridEl) return;

  const modeBar = document.querySelector(".mode-bar");
  const shapeGroup = document.querySelector('[aria-label="Shape"]');
  const colorGroup = document.querySelector('[aria-label="Colour"]');
  const outputRow = document.querySelector(".output-row");
  const editPanel = document.querySelector('[aria-label="Edit tools"]');

  // ---------- State ----------
  const state = {
    mode: "stamp", // "stamp" | "select"
    shapeType: "square", // "square" | "rounded"
    color: COLORS.blue,
    outputSize: 5, // 2..5
    selected: new Set(), // Set<cellEl>
    anchor: null, // primary selected cell
    history: [],
  };

  const cells = [];

  // Drag
  let isDragging = false;
  let currentDropCell = null;

  // ---------- Utilities ----------
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n | 0));

  function setActiveWithin(container, predicate) {
    if (!container) return;
    container.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-active", !!predicate(b));
    });
  }

  function getCellIndex(row, col) {
    return row * GRID_SIZE + col;
  }

  function getCellRC(cell) {
    return {
      row: parseInt(cell.dataset.row, 10),
      col: parseInt(cell.dataset.col, 10),
    };
  }

  function hasShape(cell) {
    return !!cell.querySelector(".shape");
  }

  function readCellData(cell) {
    const node = cell.querySelector(".shape");
    if (!node) return null;

    return {
      shapeType: node.dataset.shapeType || "square",
      color: node.dataset.color || COLORS.blue,
      rotation: parseInt(node.dataset.rotation || "0", 10) || 0,
      mirrorX: node.dataset.mirrorX === "true",
      mirrorY: node.dataset.mirrorY === "true",
    };
  }

  function applyShapeStyles(node, data) {
    node.style.backgroundColor = data.color;

    if (data.shapeType === "rounded") {
      node.style.borderRadius = `0 ${ROUND_PX}px 0 0`; // top-right rounded
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

    let node = cell.querySelector(".shape");
    if (!node) {
      node = document.createElement("div");
      node.className = "shape";
      cell.appendChild(node);
    }

    node.dataset.shapeType = data.shapeType;
    node.dataset.color = data.color;
    node.dataset.rotation = String(data.rotation);
    node.dataset.mirrorX = String(!!data.mirrorX);
    node.dataset.mirrorY = String(!!data.mirrorY);

    applyShapeStyles(node, data);
  }

  function countFilled() {
    let n = 0;
    for (const c of cells) if (hasShape(c)) n++;
    return n;
  }

  function getCenteredWindow(size) {
    const s = clampInt(size, 2, 5);
    const startRow = Math.floor((GRID_SIZE - s) / 2);
    const startCol = Math.floor((GRID_SIZE - s) / 2);
    return { startRow, startCol, endRow: startRow + s, endCol: startCol + s };
  }

  // ---------- History ----------
  function snapshot() {
    return cells.map((cell) => {
      const data = readCellData(cell);
      return data ? { ...data } : null;
    });
  }

  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 100) state.history.shift();
  }

  function restoreSnapshot(snap) {
    cells.forEach((cell, i) => writeCellData(cell, snap[i]));
    clearSelection();
  }

  // ---------- Selection UI ----------
  function clearDropTarget() {
    if (currentDropCell) currentDropCell.classList.remove("is-drop-target");
    currentDropCell = null;
  }

  function updateSelectionClasses() {
    cells.forEach((cell) => {
      cell.classList.remove("is-selected", "is-multi-selected");
    });

    if (state.selected.size === 0) return;

    if (state.anchor) state.anchor.classList.add("is-selected");

    state.selected.forEach((cell) => {
      if (cell !== state.anchor) cell.classList.add("is-multi-selected");
    });
  }

  function clearSelection() {
    state.selected.clear();
    state.anchor = null;
    updateSelectionClasses();
    syncEditEnabled();
  }

  function selectSingle(cell) {
    state.selected.clear();
    state.selected.add(cell);
    state.anchor = cell;
    updateSelectionClasses();
    syncEditEnabled();
  }

  function selectMany(cellList) {
    state.selected.clear();
    for (const c of cellList) if (hasShape(c)) state.selected.add(c);
    state.anchor = state.selected.values().next().value || null;
    updateSelectionClasses();
    syncEditEnabled();
  }

  // ---------- Edit enable/disable ----------
  function syncEditEnabled() {
    if (!editPanel) return;

    const inSelectMode = state.mode === "select";
    const anyFilled = countFilled() > 0;
    const hasSelection = state.selected.size > 0;

    const selectAllBtn = editPanel.querySelector('[data-edit="selectAll"]');
    const deselectBtn = editPanel.querySelector('[data-edit="deselect"]');
    const rotateBtn = editPanel.querySelector('[data-edit="rotate"]');
    const mirrorXBtn = editPanel.querySelector('[data-edit="mirrorX"]');
    const mirrorYBtn = editPanel.querySelector('[data-edit="mirrorY"]');
    const deleteBtn = editPanel.querySelector('[data-edit="delete"]');

    if (selectAllBtn) selectAllBtn.disabled = !(inSelectMode && anyFilled);
    if (deselectBtn) deselectBtn.disabled = !(inSelectMode && hasSelection);

    // Group selection enables all edit tools (per request)
    const enableEdits = inSelectMode && hasSelection;
    if (rotateBtn) rotateBtn.disabled = !enableEdits;
    if (mirrorXBtn) mirrorXBtn.disabled = !enableEdits;
    if (mirrorYBtn) mirrorYBtn.disabled = !enableEdits;
    if (deleteBtn) deleteBtn.disabled = !enableEdits;
  }

  // ---------- Mode ----------
  function setMode(mode) {
    state.mode = mode === "select" ? "select" : "stamp";
    setActiveWithin(modeBar, (b) => b.dataset.mode === state.mode);
    if (state.mode === "stamp") clearSelection();
    syncEditEnabled();
  }

  // ---------- Grid build ----------
  function buildGrid() {
    gridEl.innerHTML = "";
    cells.length = 0;

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(Math.floor(i / GRID_SIZE));
      cell.dataset.col = String(i % GRID_SIZE);
      gridEl.appendChild(cell);
      cells.push(cell);
    }
  }

  // ---------- Actions ----------
  function stampCell(cell) {
    pushHistory();
    writeCellData(cell, {
      shapeType: state.shapeType,
      color: state.color,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
    });
    clearSelection();
  }

  function randomRotation() {
    const choices = [0, 90, 180, 270];
    return choices[(Math.random() * choices.length) | 0];
  }

  function randomShapeType() {
    return Math.random() < 0.5 ? "square" : "rounded";
  }

  function randomColor() {
    return Math.random() < 0.5 ? COLORS.blue : COLORS.yellow;
  }

  function randomize() {
    pushHistory();
    clearSelection();

    // Clear entire board
    cells.forEach((c) => writeCellData(c, null));

    // Fill every cell in the centered output window
    const { startRow, startCol, endRow, endCol } = getCenteredWindow(state.outputSize);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        writeCellData(cells[getCellIndex(r, c)], {
          shapeType: randomShapeType(),
          color: randomColor(),
          rotation: randomRotation(),
          mirrorX: false,
          mirrorY: false,
        });
      }
    }

    syncEditEnabled();
  }

  function clearAll() {
    pushHistory();
    cells.forEach((c) => writeCellData(c, null));
    clearSelection();
  }

  function undo() {
    const last = state.history.pop();
    if (!last) return;
    restoreSnapshot(last);
    setMode(state.mode);
  }

  function deleteSelection() {
    if (state.mode !== "select") return;
    if (state.selected.size === 0) return;

    pushHistory();
    state.selected.forEach((cell) => writeCellData(cell, null));
    clearSelection();
  }

  // ---------- Group transforms (mirror/rotate as a GROUP) ----------
  function selectionBounds(selected) {
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;

    selected.forEach((cell) => {
      const { row, col } = getCellRC(cell);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    });

    return { minRow, maxRow, minCol, maxCol };
  }

  function normalizeAngle(deg) {
    return ((deg % 360) + 360) % 360;
  }

  // Reflection flips angle sign in our representation
  function reflectRotation(deg) {
    return normalizeAngle(360 - deg);
  }

  function applyGroupTransform(kind) {
    if (state.mode !== "select") return;
    if (state.selected.size === 0) return;

    const items = [];
    state.selected.forEach((cell) => {
      const data = readCellData(cell);
      if (data) items.push({ cell, data });
    });
    if (items.length === 0) return;

    const { minRow, maxRow, minCol, maxCol } = selectionBounds(state.selected);
    const height = maxRow - minRow + 1;
    const width = maxCol - minCol + 1;

    const destMap = new Map(); // "r,c" -> data

    for (const { cell, data } of items) {
      const { row, col } = getCellRC(cell);
      const lr = row - minRow;
      const lc = col - minCol;

      let nr = lr;
      let nc = lc;

      const next = { ...data };

      if (kind === "mirrorX") {
        nc = (width - 1) - lc;
        next.mirrorX = !next.mirrorX;
        next.rotation = reflectRotation(next.rotation);
      } else if (kind === "mirrorY") {
        nr = (height - 1) - lr;
        next.mirrorY = !next.mirrorY;
        next.rotation = reflectRotation(next.rotation);
      } else if (kind === "rotate") {
        // Rotate 90° clockwise within the selection bounding box (anchored at top-left)
        nr = lc;
        nc = (height - 1) - lr;
        next.rotation = normalizeAngle(next.rotation + 90);
      }

      const destRow = minRow + nr;
      const destCol = minCol + nc;

      // If rotate, selection dims swap; ensure it fits the board
      if (kind === "rotate") {
        const newHeight = width;
        const newWidth = height;
        if (minRow + newHeight - 1 >= GRID_SIZE || minCol + newWidth - 1 >= GRID_SIZE) return;
      }

      destMap.set(`${destRow},${destCol}`, next);
    }

    pushHistory();

    // Clear sources first
    state.selected.forEach((cell) => writeCellData(cell, null));

    // Write destinations and reselect them
    const newSelected = [];
    destMap.forEach((data, key) => {
      const [r, c] = key.split(",").map(Number);
      const dest = cells[getCellIndex(r, c)];
      writeCellData(dest, data);
      newSelected.push(dest);
    });

    selectMany(newSelected);
  }

  // ---------- Drag & snap ----------
  function cellFromPointer(clientX, clientY) {
    const rect = gridEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    const cellW = rect.width / GRID_SIZE;
    const cellH = rect.height / GRID_SIZE;

    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);

    return cells[getCellIndex(row, col)] || null;
  }

  function planMove(toCell) {
    if (!state.anchor || state.selected.size === 0) return null;

    const { row: fromRow, col: fromCol } = getCellRC(state.anchor);
    const { row: toRow, col: toCol } = getCellRC(toCell);

    const dRow = toRow - fromRow;
    const dCol = toCol - fromCol;
    if (dRow === 0 && dCol === 0) return null;

    const plan = [];
    for (const cell of state.selected) {
      const data = readCellData(cell);
      if (!data) continue;

      const { row: srcRow, col: srcCol } = getCellRC(cell);
      const destRow = srcRow + dRow;
      const destCol = srcCol + dCol;

      if (destRow < 0 || destCol < 0 || destRow >= GRID_SIZE || destCol >= GRID_SIZE) {
        return null; // block whole move
      }

      plan.push({ srcRow, srcCol, destRow, destCol, data });
    }

    return plan.length ? plan : null;
  }

  function commitMove(plan) {
    pushHistory();

    // Clear sources
    const srcKeys = new Set(plan.map((p) => `${p.srcRow},${p.srcCol}`));
    srcKeys.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      writeCellData(cells[getCellIndex(r, c)], null);
    });

    // Write destinations (replacement behavior)
    const newSelected = [];
    plan.forEach((p) => {
      const dest = cells[getCellIndex(p.destRow, p.destCol)];
      writeCellData(dest, p.data);
      newSelected.push(dest);
    });

    selectMany(newSelected);
  }

  // ---------- Export ----------
  function findUsedBounds() {
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;

    cells.forEach((cell) => {
      if (!hasShape(cell)) return;
      const { row, col } = getCellRC(cell);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    });

    return { minRow, maxRow, minCol, maxCol };
  }

  function exportSVG() {
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

      const { row, col } = getCellRC(cell);
      const x = (col - minCol) * CELL_PX;
      const y = (row - minRow) * CELL_PX;

      const w = CELL_PX;
      const h = CELL_PX;

      let shapeMarkup = "";
      if (data.shapeType === "square") {
        shapeMarkup = `<rect x="0" y="0" width="${w}" height="${h}" fill="${data.color}" />`;
      } else {
        const r = ROUND_PX;
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

      const cx = w / 2;
      const cy = h / 2;
      const sx = data.mirrorX ? -1 : 1;
      const sy = data.mirrorY ? -1 : 1;
      const a = data.rotation;

      shapesSvg.push(
        `<g transform="translate(${x} ${y})">
          <g transform="translate(${cx} ${cy}) rotate(${a}) scale(${sx} ${sy}) translate(${-cx} ${-cy})">
            ${shapeMarkup}
          </g>
        </g>`
      );
    });

    const svgContent =
`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
${shapesSvg.join("\n")}
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "shape-builder.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  // ---------- Events ----------
  // Grid click
  gridEl.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;

    const data = readCellData(cell);

    if (state.mode === "stamp") {
      stampCell(cell);
      return;
    }

    // select mode
    if (!data) {
      clearSelection();
      return;
    }

    selectSingle(cell);
  });

  // Pointer drag (select mode)
  gridEl.addEventListener("pointerdown", (e) => {
    if (state.mode !== "select") return;

    const shape = e.target.closest(".shape");
    if (!shape) return;

    const cell = shape.closest(".cell");
    if (!cell) return;

    if (!state.selected.has(cell)) return;

    isDragging = true;
    gridEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  gridEl.addEventListener("pointermove", (e) => {
    if (!isDragging) return;

    const cell = cellFromPointer(e.clientX, e.clientY);
    if (!cell) {
      clearDropTarget();
      return;
    }

    if (currentDropCell !== cell) {
      clearDropTarget();
      currentDropCell = cell;
      currentDropCell.classList.add("is-drop-target");
    }
  });

  gridEl.addEventListener("pointerup", (e) => {
    if (!isDragging) return;

    isDragging = false;
    const toCell = cellFromPointer(e.clientX, e.clientY);
    clearDropTarget();

    if (!toCell) return;

    const plan = planMove(toCell);
    if (!plan) return;

    commitMove(plan);
  });

  gridEl.addEventListener("pointercancel", () => {
    if (!isDragging) return;
    isDragging = false;
    clearDropTarget();
  });

  // Delegated button handling (modes, picks, outputs, actions, edit)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // Mode
    if (btn.dataset.mode) {
      setMode(btn.dataset.mode);
      return;
    }

    // Shape
    if (btn.dataset.shape) {
      state.shapeType = btn.dataset.shape;
      setActiveWithin(shapeGroup, (b) => b.dataset.shape === state.shapeType);
      return;
    }

    // Color
    if (btn.dataset.color) {
      state.color = COLORS[btn.dataset.color] || state.color;
      setActiveWithin(colorGroup, (b) => (COLORS[b.dataset.color] || "") === state.color);
      return;
    }

    // Output size
    if (btn.dataset.output) {
      state.outputSize = clampInt(parseInt(btn.dataset.output, 10), 2, 5);
      setActiveWithin(outputRow, (b) => Number(b.dataset.output) === state.outputSize);
      return;
    }

    // Left/bottom actions
    if (btn.dataset.action) {
      switch (btn.dataset.action) {
        case "randomize": randomize(); return;
        case "back": setMode("stamp"); return;
        case "undo": undo(); return;
        case "clear": clearAll(); return;
        case "download": exportSVG(); return;
        default: return;
      }
    }

    // Edit tools
    if (btn.dataset.edit) {
      switch (btn.dataset.edit) {
        case "selectAll": {
          if (state.mode !== "select") return;
          const filledCells = cells.filter(hasShape);
          if (filledCells.length === 0) return;
          selectMany(filledCells);
          return;
        }
        case "deselect":
          clearSelection();
          return;
        case "rotate":
          applyGroupTransform("rotate");
          return;
        case "mirrorX":
          applyGroupTransform("mirrorX");
          return;
        case "mirrorY":
          applyGroupTransform("mirrorY");
          return;
        case "delete":
          deleteSelection();
          return;
        default:
          return;
      }
    }
  });

  // ---------- Init ----------
  buildGrid();
  setMode("stamp");
  syncEditEnabled();

  // Reflect defaults in UI
  setActiveWithin(shapeGroup, (b) => b.dataset.shape === state.shapeType);
  setActiveWithin(colorGroup, (b) => (COLORS[b.dataset.color] || "") === state.color);
  setActiveWithin(outputRow, (b) => Number(b.dataset.output) === state.outputSize);
})();
