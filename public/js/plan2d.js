/**
 * plan2d.js - 건축/가구 제작용 실시간 2D 평면도 & 정면 입면도 CAD 엔진
 * - KS 건축 치수선 표기 (mm 단위, 도어 스윙 반경, 상부장 점선, 문짝 폭 자동 분할 표기)
 * - 평면도 상에서 모듈 경계선 드래그(50mm 스냅) 및 치수 클릭 편집 -> 즉시 3D & 견적 동기화
 * - 고해상도 PNG 도면 저장 지원
 */

class KitchenPlan2DEngine {
  constructor(containerElement, spec = {}, options = {}) {
    this.container = containerElement;
    this.isViewerMode = Boolean(options.isViewerMode);
    this.onSpecChange = typeof options.onSpecChange === 'function' ? options.onSpecChange : null;
    this.viewMode = options.viewMode || 'both'; // 'both' | 'plan' | 'elev'

    this.spec = {
      layoutType: 'straight', // 'straight' | 'l_left' | 'l_right'
      sideLength: 1800,
      wingHasUpper: false,
      totalWidth: 2700,
      lowerHeight: 860,
      lowerDepth: 600,
      plinthHeight: 120,
      topThickness: 40,
      sinkBayWidth: 1000,
      prepBayWidth: 800,
      cooktopBayWidth: 900,
      upperHeight: 700,
      upperDepth: 350,
      midwayHeight: 650,
      ceilingHeight: 2350,
      hasUpperCabinets: true,
      doorColor: '#fcfcfc',
      hoodType: 'hidden',
      cooktopType: 'black_ind',
      faucetType: 'gooseneck',
      ...spec
    };

    this.dragState = null;
    this.svgEl = null;
    this.editorPopover = null;
    this.initDOM();
    this.render();
  }

  initDOM() {
    this.container.innerHTML = '';
    this.container.classList.add('plan2d-wrapper');

    // 상단 도면 뷰 컨트롤 바
    const bar = document.createElement('div');
    bar.className = 'plan2d-topbar';

    const modeTabs = document.createElement('div');
    modeTabs.className = 'plan2d-mode-tabs';
    [
      { id: 'both', label: '통합 도면 (평면+정면)' },
      { id: 'plan', label: '평면도 (PLAN)' },
      { id: 'elev', label: '입면도 (ELEV)' }
    ].forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `plan2d-tab-btn ${this.viewMode === t.id ? 'active' : ''}`;
      b.dataset.mode = t.id;
      b.innerText = t.label;
      b.onclick = () => {
        this.viewMode = t.id;
        modeTabs.querySelectorAll('.plan2d-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.mode === t.id));
        this.render();
      };
      modeTabs.appendChild(b);
    });
    bar.appendChild(modeTabs);

    const rightControls = document.createElement('div');
    rightControls.style.cssText = 'display:flex; align-items:center; gap:6px; flex-wrap:wrap;';

    if (!this.isViewerMode) {
      const hint = document.createElement('span');
      hint.className = 'plan2d-hint';
      hint.innerText = '치수 클릭 또는 파란 경계선 드래그로 3D 즉시 수정';
      rightControls.appendChild(hint);
    }

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'btn-outline btn-sm';
    dlBtn.innerText = '도면 PNG 저장';
    dlBtn.onclick = () => this.downloadPNG();
    rightControls.appendChild(dlBtn);

    bar.appendChild(rightControls);
    this.container.appendChild(bar);

    this.stage = document.createElement('div');
    this.stage.className = 'plan2d-stage';
    this.container.appendChild(this.stage);

    // 인라인 치수 수정 팝오버
    this.popover = document.createElement('div');
    this.popover.className = 'plan2d-popover';
    this.popover.style.display = 'none';
    this.popover.innerHTML = `
      <div class="plan2d-popover-title" id="p2d-pop-label">치수 입력 (mm)</div>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="number" id="p2d-pop-input" class="input-control" step="10" style="width:96px; padding:6px 8px;">
        <button type="button" id="p2d-pop-apply" class="btn-primary btn-sm" style="width:auto; padding:6px 10px;">적용</button>
        <button type="button" id="p2d-pop-cancel" class="btn-outline btn-sm" style="padding:6px 8px;">취소</button>
      </div>
    `;
    this.container.appendChild(this.popover);

    const applyEdit = () => {
      if (!this._editingField) return;
      const val = parseInt(this.popover.querySelector('#p2d-pop-input').value, 10);
      if (!Number.isFinite(val) || val < 200) {
        this.popover.style.display = 'none';
        return;
      }
      this.applyFieldEdit(this._editingField, val);
      this.popover.style.display = 'none';
      this._editingField = null;
    };

    this.popover.querySelector('#p2d-pop-apply').onclick = applyEdit;
    this.popover.querySelector('#p2d-pop-cancel').onclick = () => {
      this.popover.style.display = 'none';
      this._editingField = null;
    };
    this.popover.querySelector('#p2d-pop-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') applyEdit();
      if (e.key === 'Escape') {
        this.popover.style.display = 'none';
        this._editingField = null;
      }
    });
  }

  updateSpec(newSpec) {
    this.spec = { ...this.spec, ...newSpec };
    this.render();
  }

  applyFieldEdit(field, val) {
    const next = { ...this.spec };
    if (field === 'totalWidth') {
      const clamped = Math.max(1500, Math.min(5000, val));
      const sW = Math.round((clamped * 0.37) / 50) * 50;
      const cW = Math.round((clamped * 0.33) / 50) * 50;
      const pW = Math.max(300, clamped - sW - cW);
      next.totalWidth = sW + pW + cW;
      next.sinkBayWidth = sW;
      next.prepBayWidth = pW;
      next.cooktopBayWidth = cW;
    } else if (field === 'sinkBayWidth') {
      next.sinkBayWidth = Math.max(600, Math.min(1800, val));
      next.totalWidth = next.sinkBayWidth + next.prepBayWidth + next.cooktopBayWidth;
    } else if (field === 'prepBayWidth') {
      next.prepBayWidth = Math.max(300, Math.min(2000, val));
      next.totalWidth = next.sinkBayWidth + next.prepBayWidth + next.cooktopBayWidth;
    } else if (field === 'cooktopBayWidth') {
      next.cooktopBayWidth = Math.max(550, Math.min(1600, val));
      next.totalWidth = next.sinkBayWidth + next.prepBayWidth + next.cooktopBayWidth;
    } else if (field === 'lowerDepth') {
      next.lowerDepth = Math.max(500, Math.min(800, val));
    } else if (field === 'sideLength') {
      next.sideLength = Math.max(1000, Math.min(3400, val));
    } else if (field === 'lowerHeight') {
      next.lowerHeight = Math.max(750, Math.min(950, val));
    } else if (field === 'upperHeight') {
      next.upperHeight = Math.max(400, Math.min(1100, val));
    }

    this.spec = next;
    this.render();
    if (this.onSpecChange) this.onSpecChange(next);
  }

  openDimensionPopover(field, label, currentVal, clientX, clientY) {
    if (this.isViewerMode) return;
    this._editingField = field;
    const pop = this.popover;
    pop.querySelector('#p2d-pop-label').innerText = `${label} (mm)`;
    const inp = pop.querySelector('#p2d-pop-input');
    inp.value = Math.round(currentVal);
    pop.style.display = 'block';

    const rect = this.container.getBoundingClientRect();
    let left = clientX - rect.left - 80;
    let top = clientY - rect.top + 12;
    left = Math.max(10, Math.min(rect.width - 230, left));
    top = Math.max(45, Math.min(rect.height - 95, top));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    inp.focus();
    inp.select();
  }

  render() {
    const s = this.spec;
    const tW = Number(s.totalWidth) || 2700;
    const sW = Number(s.sinkBayWidth) || 1000;
    const pW = Number(s.prepBayWidth) || 800;
    const cW = Number(s.cooktopBayWidth) || 900;
    const lD = Number(s.lowerDepth) || 600;
    const uD = Number(s.upperDepth) || 350;
    const lH = Number(s.lowerHeight) || 860;
    const uH = Number(s.upperHeight) || 700;
    const mH = Number(s.midwayHeight) || 650;
    const plinthH = Number(s.plinthHeight) || 120;
    const topT = Number(s.topThickness) || 40;
    const isL = s.layoutType === 'l_left' || s.layoutType === 'l_right';
    const sideL = isL ? Math.max(lD + 400, Number(s.sideLength) || 1800) : lD;
    const wingNet = isL ? Math.max(0, sideL - lD) : 0;

    // 1mm = 0.22 SVG unit
    const sc = 0.22;
    const padL = 56;
    const padR = 176;
    const drawW = tW * sc;
    const svgW = Math.max(820, padL + drawW + padR);
    const ox = padL + Math.max(0, (svgW - padL - padR - drawW) / 2);

    let planHeight = 0;
    let elevHeight = 0;
    const wallT = 26;

    const showPlan = this.viewMode === 'both' || this.viewMode === 'plan';
    const showElev = this.viewMode === 'both' || this.viewMode === 'elev';

    const planBodyH = Math.max(lD, sideL) * sc + (isL ? 110 : 120);
    if (showPlan) planHeight = 96 + planBodyH + 40;

    const totalStackH = (s.hasUpperCabinets ? (lH + mH + uH) : lH) * sc;
    if (showElev) elevHeight = 76 + totalStackH + 74;

    const gapY = (showPlan && showElev) ? 18 : 0;
    const svgH = planHeight + gapY + elevHeight;

    const parts = [];

    // Defs: 빗금 해치 & 도면 그리드 & 화살표 마커
    parts.push(`
      <defs>
        <pattern id="p2d-grid-sm" width="${100 * sc}" height="${100 * sc}" patternUnits="userSpaceOnUse">
          <path d="M ${100 * sc} 0 L 0 0 0 ${100 * sc}" fill="none" stroke="#EFEAE1" stroke-width="0.7"/>
        </pattern>
        <pattern id="p2d-grid-lg" width="${500 * sc}" height="${500 * sc}" patternUnits="userSpaceOnUse">
          <rect width="${500 * sc}" height="${500 * sc}" fill="url(#p2d-grid-sm)"/>
          <path d="M ${500 * sc} 0 L 0 0 0 ${500 * sc}" fill="none" stroke="#E4DDD0" stroke-width="1"/>
        </pattern>
        <pattern id="p2d-wall-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#DED6CB"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="#9D8E7E" stroke-width="2.2"/>
        </pattern>
        <pattern id="p2d-corner-hatch" width="10" height="10" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#B7AA9A" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="${svgW}" height="${svgH}" fill="#FCFBF8"/>
      <rect width="${svgW}" height="${svgH}" fill="url(#p2d-grid-lg)"/>
    `);

    const fmt = n => Math.round(n).toLocaleString();

    const dimChip = (cx, cy, text, field, label, rawVal, accent = false) => {
      const w = Math.max(54, text.length * 6.8 + 14);
      const cls = (!this.isViewerMode && field) ? 'p2d-dim-click' : '';
      const bg = accent ? '#8C6239' : '#FFFFFF';
      const fg = accent ? '#FFFFFF' : '#2A211B';
      const bd = accent ? '#8C6239' : '#B9AA96';
      return `
        <g class="${cls}" data-field="${field || ''}" data-label="${label || ''}" data-val="${rawVal || 0}">
          <rect x="${cx - w / 2}" y="${cy - 9.5}" width="${w}" height="19" rx="3.5" fill="${bg}" stroke="${bd}" stroke-width="1"/>
          <text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${fg}" font-family="'Pretendard', sans-serif">${text}</text>
        </g>
      `;
    };

    const hDimLine = (x1, x2, y, label, field, editLabel, rawVal, accent = false) => {
      const mx = (x1 + x2) / 2;
      return `
        <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${accent ? '#8C6239' : '#7D6F61'}" stroke-width="${accent ? 1.4 : 1}"/>
        <line x1="${x1}" y1="${y - 4.5}" x2="${x1}" y2="${y + 4.5}" stroke="${accent ? '#8C6239' : '#7D6F61'}" stroke-width="1.2"/>
        <line x1="${x2}" y1="${y - 4.5}" x2="${x2}" y2="${y + 4.5}" stroke="${accent ? '#8C6239' : '#7D6F61'}" stroke-width="1.2"/>
        ${dimChip(mx, y, label, field, editLabel, rawVal, accent)}
      `;
    };

    const vDimLine = (x, y1, y2, label, field, editLabel, rawVal, accent = false) => {
      const my = (y1 + y2) / 2;
      return `
        <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${accent ? '#8C6239' : '#7D6F61'}" stroke-width="${accent ? 1.4 : 1}"/>
        <line x1="${x - 4.5}" y1="${y1}" x2="${x + 4.5}" y2="${y1}" stroke="${accent ? '#8C6239' : '#7D6F61'}" stroke-width="1.2"/>
        <line x1="${x - 4.5}" y1="${y2}" x2="${x + 4.5}" y2="${y2}" stroke="${accent ? '#8C6239' : '#7D6F61'}" stroke-width="1.2"/>
        ${dimChip(x, my, label, field, editLabel, rawVal, accent)}
      `;
    };

    // =========================================================
    // 1. 평면도 (PLAN VIEW · TOP)
    // =========================================================
    if (showPlan) {
      const wy = 92; // 내벽 상단선 (캐비닛 뒷선)
      const px0 = ox;
      const pxSinkEnd = ox + sW * sc;
      const pxPrepEnd = pxSinkEnd + pW * sc;
      const pxEnd = ox + drawW;
      const depthPx = lD * sc;
      const upperDPx = uD * sc;

      // 섹션 타이틀
      const layoutName = s.layoutType === 'l_left' ? 'ㄱ자형 (좌코너)' : (s.layoutType === 'l_right' ? 'ㄱ자형 (우코너)' : '일자형 (I-Type)');
      parts.push(`
        <text x="18" y="24" font-size="13" font-weight="800" fill="#2A211B">01. 평면도 (FLOOR PLAN · TOP VIEW)</text>
        <text x="${svgW - 18}" y="24" text-anchor="end" font-size="11" font-weight="700" fill="#8C6239">${layoutName} · 단위 mm</text>
      `);

      // 건축 벽체 (뒷벽 + ㄱ자 선택 시 좌/우 측벽)
      const wallLeftExt = s.layoutType === 'l_left' ? wallT : 16;
      const wallRightExt = s.layoutType === 'l_right' ? wallT : 16;
      parts.push(`
        <rect x="${px0 - wallLeftExt}" y="${wy - wallT}" width="${drawW + wallLeftExt + wallRightExt}" height="${wallT}" fill="url(#p2d-wall-hatch)" stroke="#4A3423" stroke-width="1.6"/>
      `);
      if (s.layoutType === 'l_left') {
        parts.push(`<rect x="${px0 - wallT}" y="${wy}" width="${wallT}" height="${sideL * sc + 16}" fill="url(#p2d-wall-hatch)" stroke="#4A3423" stroke-width="1.6"/>`);
      } else if (s.layoutType === 'l_right') {
        parts.push(`<rect x="${pxEnd}" y="${wy}" width="${wallT}" height="${sideL * sc + 16}" fill="url(#p2d-wall-hatch)" stroke="#4A3423" stroke-width="1.6"/>`);
      }

      // 주방 하부장 외곽 본체
      parts.push(`
        <rect x="${px0}" y="${wy}" width="${drawW}" height="${depthPx}" fill="#FFFFFF" stroke="#2A211B" stroke-width="1.8"/>
      `);

      // 모듈 경계선 & 라벨
      parts.push(`
        <line x1="${pxSinkEnd}" y1="${wy}" x2="${pxSinkEnd}" y2="${wy + depthPx}" stroke="#5C4D42" stroke-width="1.1"/>
        <line x1="${pxPrepEnd}" y1="${wy}" x2="${pxPrepEnd}" y2="${wy + depthPx}" stroke="#5C4D42" stroke-width="1.1"/>
      `);

      // 싱크볼 CAD 기호 (개수대)
      const sinkCx = (px0 + pxSinkEnd) / 2;
      const sinkWpx = Math.min(760, sW - 140) * sc;
      const sinkDpx = 430 * sc;
      const sinkTopY = wy + 75 * sc;
      const drainX = sinkCx + sinkWpx * 0.16;
      const drainY = sinkTopY + sinkDpx * 0.36;
      parts.push(`
        <rect x="${sinkCx - sinkWpx / 2}" y="${sinkTopY}" width="${sinkWpx}" height="${sinkDpx}" rx="5" fill="#F3F5F7" stroke="#334155" stroke-width="1.4"/>
        <rect x="${sinkCx - sinkWpx / 2 + 5}" y="${sinkTopY + 5}" width="${sinkWpx - 10}" height="${sinkDpx - 10}" rx="3" fill="none" stroke="#64748B" stroke-width="0.9"/>
        <circle cx="${drainX}" cy="${drainY}" r="5.5" fill="#FFFFFF" stroke="#475569" stroke-width="1.1"/>
        <line x1="${drainX - 7}" y1="${drainY}" x2="${drainX + 7}" y2="${drainY}" stroke="#475569" stroke-width="0.8"/>
        <line x1="${drainX}" y1="${drainY - 7}" x2="${drainX}" y2="${drainY + 7}" stroke="#475569" stroke-width="0.8"/>
        <circle cx="${sinkCx}" cy="${wy + 36 * sc}" r="4.5" fill="#2A211B"/>
        <line x1="${sinkCx}" y1="${wy + 36 * sc}" x2="${sinkCx}" y2="${sinkTopY + 26 * sc}" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round"/>
        <text x="${sinkCx}" y="${wy + depthPx - 10}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#475569">개수대 (SINK)</text>
      `);

      // 3단 서랍장 (조리대)
      const prepCx = (pxSinkEnd + pxPrepEnd) / 2;
      parts.push(`
        <text x="${prepCx}" y="${wy + depthPx / 2 - 2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#4A3423">조리대</text>
        <text x="${prepCx}" y="${wy + depthPx / 2 + 12}" text-anchor="middle" font-size="9" fill="#6E6157">3단 서랍</text>
        <line x1="${pxSinkEnd + 8}" y1="${wy + depthPx + 14}" x2="${pxPrepEnd - 8}" y2="${wy + depthPx + 14}" stroke="#8C6239" stroke-width="1" stroke-dasharray="3,2"/>
      `);

      // 쿡탑 CAD 기호 (가열대)
      const cookCx = (pxPrepEnd + pxEnd) / 2;
      const ckW = Math.min(590, cW - 100) * sc;
      const ckD = 510 * sc;
      const ckCy = wy + depthPx / 2 + 4;
      const ckColor = s.cooktopType === 'white_ind' ? '#F8FAFC' : (s.cooktopType === 'gas_3' ? '#E2E8F0' : '#1E293B');
      const ckRing = s.cooktopType === 'black_ind' ? '#94A3B8' : '#334155';
      parts.push(`
        <rect x="${cookCx - ckW / 2}" y="${ckCy - ckD / 2}" width="${ckW}" height="${ckD}" rx="3" fill="${ckColor}" stroke="#334155" stroke-width="1.3"/>
        <circle cx="${cookCx - ckW * 0.24}" cy="${ckCy}" r="${12}" fill="none" stroke="${ckRing}" stroke-width="1.2"/>
        <circle cx="${cookCx + ckW * 0.22}" cy="${ckCy - ckD * 0.16}" r="${13.5}" fill="none" stroke="${ckRing}" stroke-width="1.2"/>
        <circle cx="${cookCx + ckW * 0.22}" cy="${ckCy + ckD * 0.2}" r="${9}" fill="none" stroke="${ckRing}" stroke-width="1.2"/>
        <text x="${cookCx}" y="${wy + depthPx - 8}" text-anchor="middle" font-size="9" font-weight="700" fill="${s.cooktopType === 'black_ind' ? '#CBD5E1' : '#334155'}">${s.cooktopType === 'gas_3' ? '가스 3구' : '3구 인덕션'}</text>
      `);

      // ㄱ자형 코너 날개장 렌더링
      if (isL && wingNet > 0) {
        const wingX = s.layoutType === 'l_left' ? px0 : (pxEnd - depthPx);
        const cornerTop = wy + depthPx;
        const wingHpx = wingNet * sc;

        // 코너 데드스페이스 표시
        const blindX = s.layoutType === 'l_left' ? px0 : (pxEnd - depthPx);
        parts.push(`
          <rect x="${blindX}" y="${wy}" width="${depthPx}" height="${depthPx}" fill="url(#p2d-corner-hatch)" fill-opacity="0.35" stroke="#8C6239" stroke-width="0.9" stroke-dasharray="3,3"/>
          <rect x="${wingX}" y="${cornerTop}" width="${depthPx}" height="${wingHpx}" fill="#FFFFFF" stroke="#2A211B" stroke-width="1.8"/>
          <text x="${wingX + depthPx / 2}" y="${cornerTop + wingHpx / 2 - 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#4A3423">코너 보조날개</text>
          <text x="${wingX + depthPx / 2}" y="${cornerTop + wingHpx / 2 + 10}" text-anchor="middle" font-size="9.5" fill="#6E6157">${fmt(wingNet)} mm</text>
        `);

        // 날개장 안쪽 문짝 스윙 반경 (90도 호)
        const swingR = Math.min(48, Math.max(26, wingHpx * 0.45));
        const hingeEdgeX = s.layoutType === 'l_left' ? (wingX + depthPx) : wingX;
        const swingDir = s.layoutType === 'l_left' ? 1 : -1;
        parts.push(`
          <line x1="${hingeEdgeX}" y1="${cornerTop + 10}" x2="${hingeEdgeX + swingDir * swingR}" y2="${cornerTop + 10}" stroke="#9C8F82" stroke-width="0.9" stroke-dasharray="3,2"/>
          <path d="M ${hingeEdgeX + swingDir * swingR} ${cornerTop + 10} A ${swingR} ${swingR} 0 0 ${swingDir > 0 ? 1 : 0} ${hingeEdgeX} ${cornerTop + 10 + swingR}" fill="none" stroke="#9C8F82" stroke-width="0.9" stroke-dasharray="3,2"/>
        `);

        // 드래그 가능한 ㄱ자 세로 길이 핸들 (편집 모드)
        if (!this.isViewerMode) {
          const wyEnd = cornerTop + wingHpx;
          parts.push(`
            <g class="p2d-drag-wing" data-drag="wing">
              <line x1="${wingX}" y1="${wyEnd}" x2="${wingX + depthPx}" y2="${wyEnd}" stroke="#2563EB" stroke-width="3" stroke-dasharray="4,2"/>
              <circle cx="${wingX + depthPx / 2}" cy="${wyEnd}" r="6" fill="#2563EB" stroke="#FFFFFF" stroke-width="1.5"/>
            </g>
          `);
        }
      }

      // 90도 여닫이 도어 스윙 아크 (개수대 & 가열대)
      const drawSwingArcPair = (xStart, xEnd, yFront) => {
        const leafW = (xEnd - xStart) / 2;
        const r = Math.min(leafW * 0.86, 56);
        parts.push(`
          <line x1="${xStart}" y1="${yFront}" x2="${xStart}" y2="${yFront + r}" stroke="#9C8F82" stroke-width="0.9" stroke-dasharray="3,2"/>
          <path d="M ${xStart} ${yFront + r} A ${r} ${r} 0 0 0 ${xStart + r} ${yFront}" fill="none" stroke="#9C8F82" stroke-width="0.9" stroke-dasharray="3,2"/>
          <line x1="${xEnd}" y1="${yFront}" x2="${xEnd}" y2="${yFront + r}" stroke="#9C8F82" stroke-width="0.9" stroke-dasharray="3,2"/>
          <path d="M ${xEnd} ${yFront + r} A ${r} ${r} 0 0 1 ${xEnd - r} ${yFront}" fill="none" stroke="#9C8F82" stroke-width="0.9" stroke-dasharray="3,2"/>
        `);
      };
      drawSwingArcPair(px0, pxSinkEnd, wy + depthPx);
      drawSwingArcPair(pxPrepEnd, pxEnd, wy + depthPx);

      // 상부장 점선 투영선 (D:350)
      if (s.hasUpperCabinets) {
        if (s.hoodType === 'chimney') {
          const upperSpan = (sW + pW) * sc;
          parts.push(`
            <rect x="${px0}" y="${wy}" width="${upperSpan}" height="${upperDPx}" fill="none" stroke="#8C6239" stroke-width="1.2" stroke-dasharray="5,3"/>
            <rect x="${cookCx - (Math.min(880, cW - 40) * sc) / 2}" y="${wy}" width="${Math.min(880, cW - 40) * sc}" height="${460 * sc}" fill="none" stroke="#64748B" stroke-width="1.2" stroke-dasharray="4,2"/>
          `);
        } else {
          parts.push(`
            <rect x="${px0}" y="${wy}" width="${drawW}" height="${upperDPx}" fill="none" stroke="#8C6239" stroke-width="1.2" stroke-dasharray="5,3"/>
          `);
        }
        parts.push(`<text x="${px0 + 8}" y="${wy + upperDPx - 5}" font-size="8.5" font-weight="600" fill="#8C6239">상부장 라인 (점선 D:${uD})</text>`);
      }

      // 드래그 가능한 모듈 경계 핸들 (평면도 -> 3D 즉시 수정)
      if (!this.isViewerMode) {
        parts.push(`
          <g class="p2d-drag-handle" data-drag="split1">
            <line x1="${pxSinkEnd}" y1="${wy}" x2="${pxSinkEnd}" y2="${wy + depthPx}" stroke="#2563EB" stroke-width="2.5"/>
            <circle cx="${pxSinkEnd}" cy="${wy + depthPx / 2}" r="6.5" fill="#2563EB" stroke="#FFFFFF" stroke-width="1.5"/>
          </g>
          <g class="p2d-drag-handle" data-drag="split2">
            <line x1="${pxPrepEnd}" y1="${wy}" x2="${pxPrepEnd}" y2="${wy + depthPx}" stroke="#2563EB" stroke-width="2.5"/>
            <circle cx="${pxPrepEnd}" cy="${wy + depthPx / 2}" r="6.5" fill="#2563EB" stroke="#FFFFFF" stroke-width="1.5"/>
          </g>
        `);
      }

      // 평면도 상단 2중 치수선
      parts.push(`
        <line x1="${px0}" y1="${wy - wallT}" x2="${px0}" y2="${wy - wallT - 34}" stroke="#BDB1A3" stroke-width="0.8"/>
        <line x1="${pxSinkEnd}" y1="${wy}" x2="${pxSinkEnd}" y2="${wy - wallT - 18}" stroke="#BDB1A3" stroke-width="0.8"/>
        <line x1="${pxPrepEnd}" y1="${wy}" x2="${pxPrepEnd}" y2="${wy - wallT - 18}" stroke="#BDB1A3" stroke-width="0.8"/>
        <line x1="${pxEnd}" y1="${wy - wallT}" x2="${pxEnd}" y2="${wy - wallT - 34}" stroke="#BDB1A3" stroke-width="0.8"/>
      `);
      parts.push(hDimLine(px0, pxEnd, wy - wallT - 32, `전체 폭 ${fmt(tW)}`, 'totalWidth', '전체 폭', tW, true));
      parts.push(hDimLine(px0, pxSinkEnd, wy - wallT - 10, `개수대 ${fmt(sW)}`, 'sinkBayWidth', '개수대 폭', sW));
      parts.push(hDimLine(pxSinkEnd, pxPrepEnd, wy - wallT - 10, `조리대 ${fmt(pW)}`, 'prepBayWidth', '조리대 폭', pW));
      parts.push(hDimLine(pxPrepEnd, pxEnd, wy - wallT - 10, `가열대 ${fmt(cW)}`, 'cooktopBayWidth', '가열대 폭', cW));

      // 평면도 우측 세로 치수선 (하부장 깊이 + ㄱ자 날개 총 세로 길이)
      const rightDimX = pxEnd + (s.layoutType === 'l_right' ? wallT + 36 : 38);
      parts.push(vDimLine(rightDimX, wy, wy + depthPx, `D:${fmt(lD)}`, 'lowerDepth', '하부장 깊이', lD));
      if (isL && wingNet > 0) {
        parts.push(vDimLine(rightDimX + 54, wy, wy + sideL * sc, `세로 ${fmt(sideL)}`, 'sideLength', 'ㄱ자 세로 전체길이', sideL, true));
      }
    }

    // =========================================================
    // 2. 정면 입면도 (FRONT ELEVATION VIEW)
    // =========================================================
    if (showElev) {
      const elevTopOffset = planHeight + gapY;
      const totalElHpx = (s.hasUpperCabinets ? (lH + mH + uH) : lH) * sc;
      const floorY = elevTopOffset + 48 + totalElHpx;
      const counterTopY = floorY - lH * sc;
      const bodyTopY = counterTopY + topT * sc;
      const plinthTopY = floorY - plinthH * sc;
      const uBotY = counterTopY - mH * sc;
      const uTopY = uBotY - uH * sc;

      const px0 = ox;
      const pxSinkEnd = ox + sW * sc;
      const pxPrepEnd = pxSinkEnd + pW * sc;
      const pxEnd = ox + drawW;

      parts.push(`
        <text x="18" y="${elevTopOffset + 22}" font-size="13" font-weight="800" fill="#2A211B">02. 정면 입면도 (FRONT ELEVATION)</text>
        <text x="${svgW - 18}" y="${elevTopOffset + 22}" text-anchor="end" font-size="11" font-weight="600" fill="#6E6157">문짝 분할 폭 · 걸레받이 ${plinthH} / 상판 ${topT}mm</text>
      `);

      // 바닥 기준선
      parts.push(`
        <line x1="${px0 - 24}" y1="${floorY}" x2="${pxEnd + 24}" y2="${floorY}" stroke="#2A211B" stroke-width="2"/>
      `);

      // 걸레받이 (Plinth)
      parts.push(`
        <rect x="${px0 + 4}" y="${plinthTopY}" width="${drawW - 8}" height="${plinthH * sc}" fill="#4A3B31" stroke="#2A211B" stroke-width="1"/>
      `);

      // 하부장 몸통 & 도어/서랍 분할
      const bodyPxH = plinthTopY - bodyTopY;
      const doorFill = s.doorColor || '#FFFFFF';

      const drawDoorLeaf = (x, y, w, h, hingeSide) => {
        const midY = y + h / 2;
        const vx = hingeSide === 'left' ? x : x + w;
        const oxEdge = hingeSide === 'left' ? x + w : x;
        return `
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${doorFill}" stroke="#3B3027" stroke-width="1.2"/>
          <polyline points="${oxEdge},${y} ${vx},${midY} ${oxEdge},${y + h}" fill="none" stroke="#B6A897" stroke-width="0.85" stroke-dasharray="3,2"/>
        `;
      };

      // 개수대 2도어 + 조리대 3단서랍 + 가열대 2도어
      const leafS = (sW / 2) * sc;
      parts.push(drawDoorLeaf(px0, bodyTopY, leafS, bodyPxH, 'left'));
      parts.push(drawDoorLeaf(px0 + leafS, bodyTopY, leafS, bodyPxH, 'right'));

      // 3단 서랍
      const drH = bodyPxH / 3;
      for (let i = 0; i < 3; i++) {
        const dy = bodyTopY + i * drH;
        parts.push(`
          <rect x="${pxSinkEnd}" y="${dy}" width="${pW * sc}" height="${drH}" fill="${doorFill}" stroke="#3B3027" stroke-width="1.2"/>
          <line x1="${(pxSinkEnd + pxPrepEnd) / 2 - 14}" y1="${dy + 7}" x2="${(pxSinkEnd + pxPrepEnd) / 2 + 14}" y2="${dy + 7}" stroke="#6E6157" stroke-width="1.8" stroke-linecap="round"/>
        `);
      }

      const leafC = (cW / 2) * sc;
      parts.push(drawDoorLeaf(pxPrepEnd, bodyTopY, leafC, bodyPxH, 'left'));
      parts.push(drawDoorLeaf(pxPrepEnd + leafC, bodyTopY, leafC, bodyPxH, 'right'));

      // 인조대리석 상판
      parts.push(`
        <rect x="${px0 - 2}" y="${counterTopY}" width="${drawW + 4}" height="${topT * sc}" fill="#EDE7DF" stroke="#2A211B" stroke-width="1.4"/>
      `);

      // 수전 입면 실루엣 (거위목 vs 직각 L)
      const faucetX = (px0 + pxSinkEnd) / 2;
      if (s.faucetType === 'square_l') {
        parts.push(`<polyline points="${faucetX},${counterTopY} ${faucetX},${counterTopY - 46} ${faucetX + 26},${counterTopY - 46} ${faucetX + 26},${counterTopY - 38}" fill="none" stroke="#475569" stroke-width="2.4"/>`);
      } else {
        parts.push(`<path d="M ${faucetX} ${counterTopY} L ${faucetX} ${counterTopY - 36} Q ${faucetX + 14} ${counterTopY - 62} ${faucetX + 26} ${counterTopY - 34}" fill="none" stroke="#475569" stroke-width="2.4" stroke-linecap="round"/>`);
      }

      // 미드웨이 타일 영역 표시
      if (s.hasUpperCabinets) {
        parts.push(`
          <rect x="${px0}" y="${uBotY}" width="${drawW}" height="${mH * sc}" fill="#FAF7F2" fill-opacity="0.55" stroke="#D4C8B8" stroke-width="0.9" stroke-dasharray="4,3"/>
        `);

        // 상부장 (히든 vs 침니 후드)
        const uPxH = uH * sc;
        parts.push(drawDoorLeaf(px0, uTopY, leafS, uPxH, 'left'));
        parts.push(drawDoorLeaf(px0 + leafS, uTopY, leafS, uPxH, 'right'));

        const leafP = (pW / 2) * sc;
        parts.push(drawDoorLeaf(pxSinkEnd, uTopY, leafP, uPxH, 'left'));
        parts.push(drawDoorLeaf(pxSinkEnd + leafP, uTopY, leafP, uPxH, 'right'));

        if (s.hoodType === 'chimney') {
          const cookCx = (pxPrepEnd + pxEnd) / 2;
          const hoodWpx = Math.min(880, cW - 40) * sc;
          parts.push(`
            <rect x="${cookCx - hoodWpx / 2}" y="${uBotY - 12}" width="${hoodWpx}" height="12" fill="#CBD5E1" stroke="#334155" stroke-width="1.3"/>
            <rect x="${cookCx - 28 * sc * 10 / 2}" y="${uTopY - 8}" width="${280 * sc}" height="${uPxH - 4}" fill="#E2E8F0" stroke="#334155" stroke-width="1.3"/>
          `);
        } else {
          parts.push(drawDoorLeaf(pxPrepEnd, uTopY, leafC, uPxH, 'left'));
          parts.push(drawDoorLeaf(pxPrepEnd + leafC, uTopY, leafC, uPxH, 'right'));
          parts.push(`<rect x="${pxPrepEnd + 4}" y="${uBotY - 6}" width="${cW * sc - 8}" height="6" fill="#94A3B8"/>`);
        }
      }

      // 하단 문짝 개별 폭 치수표 (공장 재단/발주 핵심 치수)
      const leafDimY = floorY + 22;
      const leaves = [
        { x1: px0, x2: px0 + leafS, w: sW / 2 },
        { x1: px0 + leafS, x2: pxSinkEnd, w: sW / 2 },
        { x1: pxSinkEnd, x2: pxPrepEnd, w: pW },
        { x1: pxPrepEnd, x2: pxPrepEnd + leafC, w: cW / 2 },
        { x1: pxPrepEnd + leafC, x2: pxEnd, w: cW / 2 }
      ];
      parts.push(`<line x1="${px0}" y1="${leafDimY}" x2="${pxEnd}" y2="${leafDimY}" stroke="#8C6239" stroke-width="1"/>`);
      leaves.forEach(lf => {
        const mx = (lf.x1 + lf.x2) / 2;
        parts.push(`
          <line x1="${lf.x1}" y1="${floorY + 3}" x2="${lf.x1}" y2="${leafDimY + 4}" stroke="#8C6239" stroke-width="1"/>
          <rect x="${mx - 18}" y="${leafDimY - 8}" width="36" height="16" rx="2.5" fill="#FFFFFF" stroke="#D4C8B8"/>
          <text x="${mx}" y="${leafDimY + 3.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#4A3423">${Math.round(lf.w)}</text>
        `);
      });
      parts.push(`<line x1="${pxEnd}" y1="${floorY + 3}" x2="${pxEnd}" y2="${leafDimY + 4}" stroke="#8C6239" stroke-width="1"/>`);

      // 우측 수직 높이 치수선 (하부장 H, 미드웨이 H, 상부장 H)
      const rvX = pxEnd + 42;
      parts.push(vDimLine(rvX, counterTopY, floorY, `하부 H:${lH}`, 'lowerHeight', '하부장 높이', lH));
      if (s.hasUpperCabinets) {
        parts.push(vDimLine(rvX, uBotY, counterTopY, `벽 ${mH}`, '', '', 0));
        parts.push(vDimLine(rvX, uTopY, uBotY, `상부 H:${uH}`, 'upperHeight', '상부장 높이', uH));
        parts.push(vDimLine(rvX + 54, uTopY, floorY, `총고 ${fmt(lH + mH + uH)}`, '', '', 0, true));
      }
    }

    this.stage.innerHTML = `<svg id="plan2d-svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
    this.svgEl = this.stage.querySelector('#plan2d-svg');
    this.bindSvgInteractions(ox, sc, tW);
  }

  bindSvgInteractions(ox, sc, tW) {
    if (!this.svgEl || this.isViewerMode) return;

    // 1. 치수 배지 클릭 -> 인라인 입력
    this.svgEl.querySelectorAll('.p2d-dim-click').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', e => {
        e.stopPropagation();
        const field = el.dataset.field;
        const label = el.dataset.label;
        const val = parseFloat(el.dataset.val);
        if (field) this.openDimensionPopover(field, label, val, e.clientX, e.clientY);
      });
    });

    // 2. 파란 경계선 드래그 (50mm 스냅 -> 즉시 3D 반영)
    const getSvgPoint = (e) => {
      const pt = this.svgEl.createSVGPoint();
      pt.x = e.touches ? e.touches[0].clientX : e.clientX;
      pt.y = e.touches ? e.touches[0].clientY : e.clientY;
      return pt.matrixTransform(this.svgEl.getScreenCTM().inverse());
    };

    const startDrag = (type, e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragState = {
        type,
        startSpec: { ...this.spec },
        startPt: getSvgPoint(e)
      };
    };

    this.svgEl.querySelectorAll('[data-drag]').forEach(handle => {
      handle.style.cursor = handle.dataset.drag === 'wing' ? 'ns-resize' : 'ew-resize';
      handle.addEventListener('mousedown', e => startDrag(handle.dataset.drag, e));
      handle.addEventListener('touchstart', e => startDrag(handle.dataset.drag, e), { passive: false });
    });

    const onMove = (e) => {
      if (!this.dragState) return;
      e.preventDefault();
      const pt = getSvgPoint(e);
      const { type, startSpec } = this.dragState;
      const snap50 = mm => Math.round(mm / 50) * 50;

      if (type === 'split1') {
        const minSink = 650;
        const minPrep = 350;
        const maxSink = (startSpec.sinkBayWidth + startSpec.prepBayWidth) - minPrep;
        const targetSink = snap50((pt.x - ox) / sc);
        const clampedSink = Math.max(minSink, Math.min(maxSink, targetSink));
        const nextPrep = (startSpec.sinkBayWidth + startSpec.prepBayWidth) - clampedSink;
        if (clampedSink !== this.spec.sinkBayWidth) {
          this.spec.sinkBayWidth = clampedSink;
          this.spec.prepBayWidth = nextPrep;
          this.render();
          if (this.onSpecChange) this.onSpecChange({ ...this.spec });
        }
      } else if (type === 'split2') {
        const minPrep = 350;
        const minCook = 600;
        const maxPrep = (startSpec.prepBayWidth + startSpec.cooktopBayWidth) - minCook;
        const splitXmm = (pt.x - ox) / sc;
        const targetPrep = snap50(splitXmm - startSpec.sinkBayWidth);
        const clampedPrep = Math.max(minPrep, Math.min(maxPrep, targetPrep));
        const nextCook = (startSpec.prepBayWidth + startSpec.cooktopBayWidth) - clampedPrep;
        if (clampedPrep !== this.spec.prepBayWidth) {
          this.spec.prepBayWidth = clampedPrep;
          this.spec.cooktopBayWidth = nextCook;
          this.render();
          if (this.onSpecChange) this.onSpecChange({ ...this.spec });
        }
      } else if (type === 'wing') {
        const wy = 92;
        const targetSide = snap50((pt.y - wy) / sc);
        const clampedSide = Math.max((startSpec.lowerDepth || 600) + 400, Math.min(3400, targetSide));
        if (clampedSide !== this.spec.sideLength) {
          this.spec.sideLength = clampedSide;
          this.render();
          if (this.onSpecChange) this.onSpecChange({ ...this.spec });
        }
      }
    };

    const endDrag = () => { this.dragState = null; };

    this._activeOnMove = onMove;
    this._activeEndDrag = endDrag;

    if (!this._boundWindowDrag) {
      this._boundWindowDrag = true;
      window.addEventListener('mousemove', e => { if (this._activeOnMove) this._activeOnMove(e); });
      window.addEventListener('mouseup', () => { if (this._activeEndDrag) this._activeEndDrag(); });
      window.addEventListener('touchmove', e => { if (this._activeOnMove) this._activeOnMove(e); }, { passive: false });
      window.addEventListener('touchend', () => { if (this._activeEndDrag) this._activeEndDrag(); });
    }
  }

  downloadPNG() {
    if (!this.svgEl) return;
    const vb = this.svgEl.viewBox.baseVal;
    const clone = this.svgEl.cloneNode(true);
    clone.setAttribute('width', vb.width * 2);
    clone.setAttribute('height', vb.height * 2);

    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = vb.width * 2;
      canvas.height = vb.height * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FCFBF8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `싱크대-평면입면도-${this.spec.totalWidth}mm-${Date.now()}.png`;
      a.click();
    };
    img.src = url;
  }
}

window.KitchenPlan2DEngine = KitchenPlan2DEngine;
