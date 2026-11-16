/**
 * drawingCad.js - 피앙세가구 인터랙티브 2D CAD 평면 도면 드로잉 엔진
 * - 사용자가 방 크기를 지정하고 벽체 및 맞춤 가구 모듈을 마우스로 자유롭게 배치
 * - 실시간 mm 건축 치수선, 90도 회전, 리사이즈, 벽체/가구 자석 스냅 지원
 * - [⚡ 3D 시뮬레이션 및 견적서로 즉시 변환] 버튼으로 3D 스튜디오 및 견적서에 자동 연동
 */

class DrawingCadEngine {
  constructor(canvasContainerId, options = {}) {
    this.container = typeof canvasContainerId === 'string'
      ? document.getElementById(canvasContainerId)
      : canvasContainerId;
    this.onConvertTo3D = typeof options.onConvertTo3D === 'function' ? options.onConvertTo3D : null;

    // 공간 기본 설정 (mm)
    this.roomW = options.roomW || 3600;
    this.roomD = options.roomD || 3000;
    this.wallLayout = options.wallLayout || 'l_left'; // 'straight' | 'l_left' | 'l_right' | 'u_shape' | 'box'
    this.wallThickness = 150; // mm

    // 뷰포트 (Pan & Zoom)
    this.zoom = 0.22; // scale factor
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // 가구 및 벽체 데이터
    this.items = [];
    this.customWalls = [];
    this.selectedItemId = null;
    this.activeTool = 'select'; // 'select' | 'wall_pen'
    this.isDrawingWall = false;
    this.wallDrawStart = null;
    this.snapToGrid = true;
    this.gridStep = 100; // mm

    // 마우스 드래그 상태
    this.dragTarget = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isDraggingItem = false;

    this.initDOM();
    this.setupEvents();
    this.loadDefaultLayout();
    this.fitToScreen();
    this.render();
  }

  initDOM() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.userSelect = 'none';
    this.container.style.overflow = 'hidden';

    // HTML5 Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cad-drawing-canvas';
    this.canvas.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; cursor:crosshair;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // 플로팅 가구 속성 편집 팝오버
    this.propertyBar = document.createElement('div');
    this.propertyBar.className = 'cad-property-bar';
    this.propertyBar.style.cssText = `
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(25, 23, 21, 0.94); color: #fff; padding: 10px 18px;
      border-radius: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      display: none; align-items: center; gap: 14px; font-size: 13px; z-index: 20;
      backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15);
    `;
    this.container.appendChild(this.propertyBar);

    this.resizeCanvas();
  }

  resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvasW = w;
    this.canvasH = h;
    this.dpr = dpr;
    this.render();
  }

  fitToScreen() {
    const pad = 120;
    const availW = Math.max(300, this.canvasW - pad);
    const availH = Math.max(300, this.canvasH - pad);
    const scaleX = availW / (this.roomW + 400);
    const scaleY = availH / (this.roomD + 400);
    this.zoom = Math.min(scaleX, scaleY, 0.28);
    this.panX = this.canvasW / 2;
    this.panY = this.canvasH / 2;
    this.render();
  }

  loadDefaultLayout() {
    this.items = [];
    this.customWalls = [];

    // 기본 L자형 주방 씽크대 & 아일랜드 모듈 배치
    const startX = -this.roomW / 2 + 100;
    const startY = -this.roomD / 2 + 100;

    // 1. 싱크볼 하부장 (1000mm)
    this.addItem({
      type: 'sink_base',
      name: '개수대(싱크볼) 하부장',
      category: 'sink',
      w: 1000,
      d: 600,
      x: startX + 500,
      y: startY + 300,
      rot: 0
    });

    // 2. 조리대 수납장 (800mm)
    this.addItem({
      type: 'prep_base',
      name: '조리대 3단서랍 하부장',
      category: 'sink',
      w: 800,
      d: 600,
      x: startX + 1400,
      y: startY + 300,
      rot: 0
    });

    // 3. 인덕션/쿡탑장 (900mm)
    this.addItem({
      type: 'cook_base',
      name: '인덕션/쿡탑 하부장',
      category: 'sink',
      w: 900,
      d: 600,
      x: startX + 2250,
      y: startY + 300,
      rot: 0
    });

    // 4. 키큰 가전수납장 (600mm)
    this.addItem({
      type: 'tall_pantry',
      name: '키큰 밥솥·오븐장',
      category: 'sink',
      w: 600,
      d: 600,
      x: startX + 3000,
      y: startY + 300,
      rot: 0
    });

    // 5. 아일랜드 식탁 (1600mm)
    this.addItem({
      type: 'island_table',
      name: '반도형 아일랜드 식탁',
      category: 'island',
      w: 1500,
      d: 750,
      x: startX + 1800,
      y: startY + 1600,
      rot: 0
    });
  }

  addItem(spec) {
    const id = 'cad_item_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const item = {
      id,
      type: spec.type || 'prep_base',
      name: spec.name || '맞춤 수납장',
      category: spec.category || 'sink',
      w: spec.w || 900,
      d: spec.d || 600,
      x: spec.x !== undefined ? spec.x : 0,
      y: spec.y !== undefined ? spec.y : 0,
      rot: spec.rot || 0, // 0, 90, 180, 270
      color: spec.color || '#f7f4ee'
    };
    this.items.push(item);
    this.selectedItemId = item.id;
    this.updatePropertyBar();
    this.render();
    return item;
  }

  // -------------------------------------------------------------
  // 이벤트 바인딩
  // -------------------------------------------------------------
  setupEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // 터치 지원 (모바일/태블릿)
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this.onMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0 });
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this.onMouseMove({ clientX: t.clientX, clientY: t.clientY });
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      this.onMouseUp({ button: 0 });
    });
  }

  screenToWorld(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (sx - rect.left - this.panX) / this.zoom;
    const y = (sy - rect.top - this.panY) / this.zoom;
    return { x, y };
  }

  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.panX,
      y: wy * this.zoom + this.panY
    };
  }

  onMouseDown(e) {
    const pt = this.screenToWorld(e.clientX, e.clientY);

    // 우클릭 또는 스페이스바 -> 뷰포트 Pan
    if (e.button === 1 || e.button === 2 || e.altKey) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      return;
    }

    // 벽체 그리기 툴 활성 시
    if (this.activeTool === 'wall_pen') {
      const snapX = this.snapToGrid ? Math.round(pt.x / this.gridStep) * this.gridStep : pt.x;
      const snapY = this.snapToGrid ? Math.round(pt.y / this.gridStep) * this.gridStep : pt.y;
      this.isDrawingWall = true;
      this.wallDrawStart = { x: snapX, y: snapY };
      this.wallDrawCurrent = { x: snapX, y: snapY };
      this.render();
      return;
    }

    // 1. 가구 아이템 클릭 검사 (역순)
    let hitItem = null;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const isRot = (it.rot === 90 || it.rot === 270);
      const halfW = (isRot ? it.d : it.w) / 2;
      const halfH = (isRot ? it.w : it.d) / 2;
      if (pt.x >= it.x - halfW && pt.x <= it.x + halfW &&
          pt.y >= it.y - halfH && pt.y <= it.y + halfH) {
        hitItem = it;
        break;
      }
    }

    if (hitItem) {
      this.selectedItemId = hitItem.id;
      this.isDraggingItem = true;
      this.dragTarget = hitItem;
      this.dragOffset = { x: pt.x - hitItem.x, y: pt.y - hitItem.y };
      this.updatePropertyBar();
      this.render();
    } else {
      // 빈 공간 클릭 시 드래그 팬 또는 선택 해제
      this.selectedItemId = null;
      this.updatePropertyBar();
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.render();
    }
  }

  onMouseMove(e) {
    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.panX += dx;
      this.panY += dy;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.render();
      return;
    }

    if (this.isDrawingWall && this.wallDrawStart) {
      const pt = this.screenToWorld(e.clientX, e.clientY);
      let snapX = this.snapToGrid ? Math.round(pt.x / this.gridStep) * this.gridStep : pt.x;
      let snapY = this.snapToGrid ? Math.round(pt.y / this.gridStep) * this.gridStep : pt.y;

      // 직교 구속 (수평 or 수직)
      const dx = Math.abs(snapX - this.wallDrawStart.x);
      const dy = Math.abs(snapY - this.wallDrawStart.y);
      if (dx > dy) {
        snapY = this.wallDrawStart.y;
      } else {
        snapX = this.wallDrawStart.x;
      }

      this.wallDrawCurrent = { x: snapX, y: snapY };
      this.render();
      return;
    }

    if (this.isDraggingItem && this.dragTarget) {
      const pt = this.screenToWorld(e.clientX, e.clientY);
      let targetX = pt.x - this.dragOffset.x;
      let targetY = pt.y - this.dragOffset.y;

      if (this.snapToGrid) {
        targetX = Math.round(targetX / (this.gridStep / 2)) * (this.gridStep / 2);
        targetY = Math.round(targetY / (this.gridStep / 2)) * (this.gridStep / 2);
      }

      // 다른 가구와 벽면에 자석 스냅
      targetX = this.snapToNeighborsX(this.dragTarget, targetX);
      targetY = this.snapToNeighborsY(this.dragTarget, targetY);

      this.dragTarget.x = targetX;
      this.dragTarget.y = targetY;
      this.updatePropertyBar();
      this.render();
    }
  }

  snapToNeighborsX(item, curX) {
    const isRot = (item.rot === 90 || item.rot === 270);
    const myHalfW = (isRot ? item.d : item.w) / 2;
    const snapThreshold = 30 / this.zoom;

    // 벽체 안쪽 스냅
    const wallLeft = -this.roomW / 2 + this.wallThickness / 2 + myHalfW;
    const wallRight = this.roomW / 2 - this.wallThickness / 2 - myHalfW;
    if (Math.abs(curX - wallLeft) < snapThreshold) return wallLeft;
    if (Math.abs(curX - wallRight) < snapThreshold) return wallRight;

    // 다른 가구 외곽 스냅
    for (const other of this.items) {
      if (other.id === item.id) continue;
      const otherRot = (other.rot === 90 || other.rot === 270);
      const otherHalfW = (otherRot ? other.d : other.w) / 2;

      // other 우측에 밀착
      const snapRight = other.x + otherHalfW + myHalfW;
      if (Math.abs(curX - snapRight) < snapThreshold) return snapRight;

      // other 좌측에 밀착
      const snapLeft = other.x - otherHalfW - myHalfW;
      if (Math.abs(curX - snapLeft) < snapThreshold) return snapLeft;
    }
    return curX;
  }

  snapToNeighborsY(item, curY) {
    const isRot = (item.rot === 90 || item.rot === 270);
    const myHalfH = (isRot ? item.w : item.d) / 2;
    const snapThreshold = 30 / this.zoom;

    // 뒷벽 안쪽 스냅
    const wallTop = -this.roomD / 2 + this.wallThickness / 2 + myHalfH;
    const wallBottom = this.roomD / 2 - this.wallThickness / 2 - myHalfH;
    if (Math.abs(curY - wallTop) < snapThreshold) return wallTop;
    if (Math.abs(curY - wallBottom) < snapThreshold) return wallBottom;

    for (const other of this.items) {
      if (other.id === item.id) continue;
      const otherRot = (other.rot === 90 || other.rot === 270);
      const otherHalfH = (otherRot ? other.w : other.d) / 2;

      const snapBelow = other.y + otherHalfH + myHalfH;
      if (Math.abs(curY - snapBelow) < snapThreshold) return snapBelow;

      const snapAbove = other.y - otherHalfH - myHalfH;
      if (Math.abs(curY - snapAbove) < snapThreshold) return snapAbove;
    }
    return curY;
  }

  onMouseUp(e) {
    this.isPanning = false;
    this.isDraggingItem = false;
    this.dragTarget = null;

    if (this.isDrawingWall && this.wallDrawStart && this.wallDrawCurrent) {
      const len = Math.hypot(this.wallDrawCurrent.x - this.wallDrawStart.x, this.wallDrawCurrent.y - this.wallDrawStart.y);
      if (len >= 300) {
        this.customWalls.push({
          x1: this.wallDrawStart.x,
          y1: this.wallDrawStart.y,
          x2: this.wallDrawCurrent.x,
          y2: this.wallDrawCurrent.y,
          t: this.wallThickness
        });
      }
      this.isDrawingWall = false;
      this.wallDrawStart = null;
      this.wallDrawCurrent = null;
      this.render();
    }
  }

  onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const mousePt = this.screenToWorld(e.clientX, e.clientY);

    const newZoom = Math.max(0.06, Math.min(0.85, this.zoom * zoomFactor));
    this.panX = e.clientX - this.canvas.getBoundingClientRect().left - mousePt.x * newZoom;
    this.panY = e.clientY - this.canvas.getBoundingClientRect().top - mousePt.y * newZoom;
    this.zoom = newZoom;
    this.render();
  }

  // -------------------------------------------------------------
  // 렌더링 루프
  // -------------------------------------------------------------
  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvasW;
    const h = this.canvasH;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, w, h);

    // 1. 방 바닥 및 그리드 렌더링
    this.renderGrid(ctx);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 2. 방 바닥 슬라브
    this.renderRoomFloor(ctx);

    // 3. 건축 벽체 (메인 룸 벽 + 커스텀 벽체)
    this.renderWalls(ctx);

    // 4. 가구 모듈 렌더링
    this.renderFurnitureItems(ctx);

    // 5. 사용자가 실시간 드로잉 중인 임시 벽체
    if (this.isDrawingWall && this.wallDrawStart && this.wallDrawCurrent) {
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = this.wallThickness;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(this.wallDrawStart.x, this.wallDrawStart.y);
      ctx.lineTo(this.wallDrawCurrent.x, this.wallDrawCurrent.y);
      ctx.stroke();

      // 치수선 미리보기
      const d = Math.hypot(this.wallDrawCurrent.x - this.wallDrawStart.x, this.wallDrawCurrent.y - this.wallDrawStart.y);
      const mx = (this.wallDrawStart.x + this.wallDrawCurrent.x) / 2;
      const my = (this.wallDrawStart.y + this.wallDrawCurrent.y) / 2;
      this.drawDimensionBadge(ctx, `${Math.round(d)} mm`, mx, my - 20);
    }

    ctx.restore();
    ctx.restore();
  }

  renderGrid(ctx) {
    // 배경 그리드 (100mm 서브그리드, 500mm 메인그리드)
    ctx.fillStyle = '#f6f4ee';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    const step = 500 * this.zoom;
    if (step < 12) return;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;

    const startX = this.panX % step;
    const startY = this.panY % step;

    ctx.beginPath();
    for (let x = startX; x < this.canvasW; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvasH);
    }
    for (let y = startY; y < this.canvasH; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvasW, y);
    }
    ctx.stroke();
  }

  renderRoomFloor(ctx) {
    const rx = -this.roomW / 2;
    const ry = -this.roomD / 2;

    // 바닥 채우기 (따뜻한 오크/마루 톤)
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(rx, ry, this.roomW, this.roomD);

    // 바닥 테두리
    ctx.strokeStyle = '#e0d8cc';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, this.roomW, this.roomD);

    // 룸 외곽 전체 치수선 (상단 & 좌측)
    this.drawCadDimension(ctx, rx, ry - 70, rx + this.roomW, ry - 70, `전체 가로: ${this.roomW.toLocaleString()} mm`);
    this.drawCadDimension(ctx, rx - 70, ry, rx - 70, ry + this.roomD, `전체 세로: ${this.roomD.toLocaleString()} mm`, true);
  }

  renderWalls(ctx) {
    const rx = -this.roomW / 2;
    const ry = -this.roomD / 2;
    const t = this.wallThickness;

    ctx.fillStyle = '#4a443d';
    ctx.strokeStyle = '#26221e';
    ctx.lineWidth = 2;

    // 뒷벽 (Back Wall) - 항상 존재
    ctx.fillRect(rx, ry - t, this.roomW, t);
    ctx.strokeRect(rx, ry - t, this.roomW, t);

    // 좌측벽
    if (this.wallLayout === 'l_left' || this.wallLayout === 'u_shape' || this.wallLayout === 'box') {
      ctx.fillRect(rx - t, ry - t, t, this.roomD + t);
      ctx.strokeRect(rx - t, ry - t, t, this.roomD + t);
    }

    // 우측벽
    if (this.wallLayout === 'l_right' || this.wallLayout === 'u_shape' || this.wallLayout === 'box') {
      ctx.fillRect(rx + this.roomW, ry - t, t, this.roomD + t);
      ctx.strokeRect(rx + this.roomW, ry - t, t, this.roomD + t);
    }

    // 하부 앞벽 (밀폐 룸일 때)
    if (this.wallLayout === 'box') {
      ctx.fillRect(rx - t, ry + this.roomD, this.roomW + t * 2, t);
      ctx.strokeRect(rx - t, ry + this.roomD, this.roomW + t * 2, t);
    }

    // 사용자 추가 벽체들
    for (const w of this.customWalls) {
      ctx.strokeStyle = '#4a443d';
      ctx.lineWidth = w.t;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();

      const d = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      const mx = (w.x1 + w.x2) / 2;
      const my = (w.y1 + w.y2) / 2;
      this.drawDimensionBadge(ctx, `${Math.round(d)} mm`, mx, my - 15);
    }
  }

  renderFurnitureItems(ctx) {
    for (const item of this.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate((item.rot * Math.PI) / 180);

      const halfW = item.w / 2;
      const halfD = item.d / 2;
      const isSelected = item.id === this.selectedItemId;

      // 1. 가구 몸체 본체 (CAD 플랜 뷰)
      ctx.fillStyle = isSelected ? '#fffdf7' : (item.color || '#fcfbf9');
      ctx.fillRect(-halfW, -halfD, item.w, item.d);

      ctx.strokeStyle = isSelected ? '#b58d3d' : '#2b2621';
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.strokeRect(-halfW, -halfD, item.w, item.d);

      // 2. 가구 품목별 고유 CAD 심볼 및 디테일
      this.renderItemSymbol(ctx, item, halfW, halfD);

      // 3. 치수 라벨 (중앙)
      ctx.fillStyle = '#222';
      ctx.font = 'bold 18px "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${item.name}`, 0, -8);

      ctx.font = '14px "Pretendard", monospace';
      ctx.fillStyle = '#6b5e51';
      ctx.fillText(`${item.w} × ${item.d} mm`, 0, 14);

      // 4. 선택 테두리 앵커 핀
      if (isSelected) {
        ctx.fillStyle = '#c5a059';
        [[-halfW, -halfD], [halfW, -halfD], [-halfW, halfD], [halfW, halfD]].forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    }
  }

  renderItemSymbol(ctx, item, hw, hd) {
    ctx.save();
    ctx.strokeStyle = '#8a7a6a';
    ctx.lineWidth = 1.5;

    if (item.type === 'sink_base') {
      // 싱크볼 타공 사각형 및 수전 원
      const bw = hw * 1.35;
      const bd = hd * 1.25;
      ctx.strokeRect(-bw / 2, -bd / 2, bw, bd);

      // 수전 심볼
      ctx.fillStyle = '#a69076';
      ctx.beginPath();
      ctx.arc(0, -bd / 2 + 18, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'cook_base') {
      // 인덕션 화구 3구 심볼
      ctx.beginPath();
      ctx.arc(-hw * 0.35, 0, 28, 0, Math.PI * 2);
      ctx.arc(hw * 0.35, -hd * 0.25, 22, 0, Math.PI * 2);
      ctx.arc(hw * 0.35, hd * 0.25, 22, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'island_table') {
      // 아일랜드 식탁 무릎 오버행 점선
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#c5a059';
      ctx.beginPath();
      ctx.moveTo(-hw, hd - 40);
      ctx.lineTo(hw, hd - 40);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (item.type === 'wardrobe') {
      // 붙박이장 옷걸이 봉 심볼 (양 대각선 X 또는 슬라이딩 도어 겹침)
      ctx.beginPath();
      ctx.moveTo(-hw + 30, -hd + 30);
      ctx.lineTo(hw - 30, hd - 30);
      ctx.moveTo(hw - 30, -hd + 30);
      ctx.lineTo(-hw + 30, hd - 30);
      ctx.stroke();
    } else if (item.type === 'drawers') {
      // 서랍 분할 가로선 3단
      ctx.beginPath();
      ctx.moveTo(-hw, -hd * 0.33);
      ctx.lineTo(hw, -hd * 0.33);
      ctx.moveTo(-hw, hd * 0.33);
      ctx.lineTo(hw, hd * 0.33);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCadDimension(ctx, x1, y1, x2, y2, label, isVertical = false) {
    ctx.save();
    ctx.strokeStyle = '#8a7968';
    ctx.lineWidth = 1.5;

    // 본 치수선
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 45° 건축 사선 틱 (Architectural slash ticks)
    const tickLen = 14;
    [ [x1, y1], [x2, y2] ].forEach(([tx, ty]) => {
      ctx.beginPath();
      ctx.moveTo(tx - tickLen, ty - tickLen);
      ctx.lineTo(tx + tickLen, ty + tickLen);
      ctx.stroke();
    });

    // 텍스트 라벨
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    this.drawDimensionBadge(ctx, label, mx, my + (isVertical ? 0 : -14));

    ctx.restore();
  }

  drawDimensionBadge(ctx, text, x, y) {
    ctx.save();
    ctx.font = 'bold 13px "Pretendard", monospace';
    const textW = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(x - textW / 2 - 8, y - 10, textW + 16, 20);
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - textW / 2 - 8, y - 10, textW + 16, 20);

    ctx.fillStyle = '#2d261e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 가구 속성 팝오버 업데이트 (회전, 크기, 삭제)
  // -------------------------------------------------------------
  updatePropertyBar() {
    if (!this.propertyBar) return;
    const item = this.items.find(i => i.id === this.selectedItemId);
    if (!item) {
      this.propertyBar.style.display = 'none';
      return;
    }

    this.propertyBar.style.display = 'flex';
    this.propertyBar.innerHTML = `
      <div style="font-weight:700; color:#e0c48e; margin-right:4px;">${item.name}</div>
      <div style="display:flex; align-items:center; gap:6px;">
        <label style="font-size:12px; color:#aaa;">폭(W):</label>
        <input type="number" id="prop-item-w" value="${item.w}" step="50" min="300" max="4500"
          style="width:68px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:3px 6px; font-size:12px;">
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <label style="font-size:12px; color:#aaa;">깊이(D):</label>
        <input type="number" id="prop-item-d" value="${item.d}" step="50" min="300" max="1200"
          style="width:62px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; padding:3px 6px; font-size:12px;">
      </div>
      <button id="btn-prop-rotate" style="background:#443b32; color:#e0c48e; border:1px solid #6b5c46; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px; font-weight:600;">
        🔄 90° 회전
      </button>
      <button id="btn-prop-delete" style="background:#5c2424; color:#ffb0b0; border:1px solid #853737; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px; font-weight:600;">
        🗑️ 삭제
      </button>
    `;

    document.getElementById('prop-item-w').addEventListener('change', (e) => {
      item.w = parseInt(e.target.value) || item.w;
      this.render();
    });
    document.getElementById('prop-item-d').addEventListener('change', (e) => {
      item.d = parseInt(e.target.value) || item.d;
      this.render();
    });
    document.getElementById('btn-prop-rotate').addEventListener('click', () => {
      item.rot = (item.rot + 90) % 360;
      this.render();
    });
    document.getElementById('btn-prop-delete').addEventListener('click', () => {
      this.items = this.items.filter(i => i.id !== item.id);
      this.selectedItemId = null;
      this.updatePropertyBar();
      this.render();
    });
  }

  // -------------------------------------------------------------
  // 방 크기 & 프리셋 제어
  // -------------------------------------------------------------
  setRoomSize(w, d, layout = 'l_left') {
    this.roomW = Math.max(1800, Math.min(12000, parseInt(w) || 3600));
    this.roomD = Math.max(1800, Math.min(10000, parseInt(d) || 3000));
    this.wallLayout = layout;
    this.fitToScreen();
  }

  clearCanvas() {
    this.items = [];
    this.customWalls = [];
    this.selectedItemId = null;
    this.updatePropertyBar();
    this.render();
  }

  // -------------------------------------------------------------
  // [⚡ 3D 시뮬레이션 및 견적서로 즉시 변환] 로직
  // -------------------------------------------------------------
  exportTo3DAndQuote() {
    if (this.items.length === 0) {
      alert('도면 위에 최소 1개 이상의 가구 모듈을 배치해 주세요.');
      return null;
    }

    // 1. 주방 씽크대 품목 분류 (sink_base, prep_base, cook_base, tall_pantry, corner_base)
    const kitchenItems = this.items.filter(i =>
      i.type === 'sink_base' || i.type === 'prep_base' || i.type === 'cook_base' ||
      i.type === 'tall_pantry' || i.type === 'corner_base'
    );

    let totalKitchenW = 0;
    let sinkW = 1000;
    let cookW = 900;
    let prepW = 800;
    let hasTall = 'none';
    let tallW = 600;

    kitchenItems.forEach(it => {
      if (it.type === 'sink_base') sinkW = it.w;
      else if (it.type === 'cook_base') cookW = it.w;
      else if (it.type === 'prep_base') prepW = it.w;
      else if (it.type === 'tall_pantry') {
        hasTall = 'right';
        tallW = it.w;
      }
      totalKitchenW += it.w;
    });

    if (totalKitchenW < 1800) totalKitchenW = 2700;

    // 주방 레이아웃 판단 (L자, U자, 일자, 식탁형 ㄷ자)
    let layoutType = 'straight';
    const islandItem = this.items.find(i => i.type === 'island_table' || i.category === 'island');
    if (islandItem && this.wallLayout === 'l_left') {
      layoutType = 'u_peninsula'; // ㄱ자 주방 + 아일랜드 식탁 일체형
    } else if (this.wallLayout === 'u_shape') {
      layoutType = 'u_shape';
    } else if (this.wallLayout === 'l_left') {
      layoutType = 'l_left';
    } else if (this.wallLayout === 'l_right') {
      layoutType = 'l_right';
    }

    // 2. 기타 맞춤 가구 품목 (붙박이장, 신발장, 아일랜드, TV장, 서랍장)
    const orderItems = [];

    // 주방 씽크대 등록
    orderItems.push({
      id: 'item_kitchen_' + Date.now(),
      name: '맞춤 주방 씽크대',
      category: 'sink',
      spec: {
        category: 'sink',
        layoutType,
        totalWidth: totalKitchenW,
        sideLength: 1800,
        sinkBayWidth: sinkW,
        cooktopBayWidth: cookW,
        prepBayWidth: prepW,
        tallCabinet: hasTall,
        tallCabinetWidth: tallW,
        lowerHeight: 860,
        lowerDepth: 600,
        upperHeight: 700,
        ceilingHeight: 2350
      }
    });

    // 기타 배치된 가구들 발주 항목으로 자동 추가
    const otherItems = this.items.filter(i =>
      i.type === 'wardrobe' || i.type === 'shoe_rack' || i.type === 'island_table' ||
      i.type === 'tv_console' || i.type === 'drawers' || i.type === 'storage_unit'
    );

    otherItems.forEach(it => {
      let cat = 'storage';
      let name = it.name;
      if (it.type === 'wardrobe') { cat = 'wardrobe'; name = '맞춤 슬라이딩 붙박이장'; }
      else if (it.type === 'shoe_rack') { cat = 'shoe_cabinet'; name = '현관 키큰 신발장'; }
      else if (it.type === 'island_table') { cat = 'island'; name = '대면형 아일랜드 식탁'; }
      else if (it.type === 'tv_console') { cat = 'tv_console'; name = '거실 프리미엄 TV장'; }
      else if (it.type === 'drawers') { cat = 'drawers'; name = '3단 와이드 서랍장'; }

      orderItems.push({
        id: 'item_' + cat + '_' + Date.now() + Math.floor(Math.random() * 100),
        name,
        category: cat,
        spec: {
          category: cat,
          totalWidth: it.w,
          wardrobeDepth: it.d,
          islandDepth: it.d,
          ceilingHeight: 2350
        }
      });
    });

    return {
      kitchenSpec: orderItems[0].spec,
      allItems: orderItems,
      roomW: this.roomW,
      roomD: this.roomD,
      wallLayout: this.wallLayout
    };
  }

  // 고해상도 PNG 도면 이미지 저장
  exportAsPNG() {
    if (!this.canvas) return;
    const link = document.createElement('a');
    link.download = `피앙세가구_평면도면_${new Date().toISOString().slice(0,10)}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
}

window.DrawingCadEngine = DrawingCadEngine;
