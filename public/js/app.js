/**
 * app.js - 우드크래프트 스튜디오 통합 관리자 & 현장 실측 앱 로직
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 전역 상태
  let settings = {};
  let doorCatalog = [];
  let serverInfo = { localIp: window.location.hostname, port: window.location.port || 3000 };
  let engine = null;
  let plan2dEngine = null;

  const state = {
    spec: {
      layoutType: 'straight',
      sideLength: 1800,
      wingHasUpper: false,
      totalWidth: 2700,
      ceilingHeight: 2350,
      lowerHeight: 860,
      lowerDepth: 600,
      sinkBayWidth: 1000,
      prepBayWidth: 800,
      cooktopBayWidth: 900,
      upperHeight: 700,
      upperDepth: 350,
      midwayHeight: 650,
      hasUpperCabinets: true,
      doorColor: '#fcfcfc',
      doorStyle: 'flat',
      countertopType: 'white_marble',
      countertopLabel: '',
      handleType: 'j_channel',
      handleColor: 'matte_black',
      wallDesign: 'warm_greige',
      tileDesign: 'white_subway',
      floorDesign: 'natural_oak',
      underlightTemp: 'warm',
      hoodType: 'hidden',
      cooktopType: 'black_ind',
      faucetType: 'gooseneck',
      showDimensions: true
    },
    selectedDoor: null,
    pricing: {
      woodBodyCost: 0,
      doorVendorCost: 0,
      countertopCost: 0,
      fixedItemsCost: 0,
      installCost: 0,
      totalPrice: 0,
      depositPrice: 0
    }
  };

  // 토스트 알림 헬퍼
  function showToast(msg) {
    const el = document.getElementById('toast-box');
    el.innerText = msg;
    el.style.display = 'block';
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      el.style.display = 'none';
    }, 2600);
  }

  // 1. 서버 초기 데이터 로드 (설정, 도어목록, 서버IP)
  async function loadInitialData() {
    try {
      const [setRes, doorRes, infoRes] = await Promise.all([
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/doors').then(r => r.json()),
        fetch('/api/server-info').then(r => r.json())
      ]);

      if (setRes.success) settings = setRes.settings;
      if (doorRes.success) doorCatalog = doorRes.doors;
      if (infoRes.success) serverInfo = infoRes;

      if (doorCatalog.length > 0) {
        state.selectedDoor = doorCatalog[0];
        state.spec.doorColor = state.selectedDoor.colorHex;
        state.spec.doorStyle = state.selectedDoor.style === 'shaker' ? 'shaker' : 'flat';
        updateSelectedDoorCard();
      }

      // 사이드바 모바일 접속 IP 표시
      const mobileUrl = `http://${serverInfo.localIp}:${serverInfo.port}`;
      const ipDisplay = document.getElementById('sidebar-mobile-url');
      if (ipDisplay) ipDisplay.innerText = mobileUrl;

      // 설정 폼 채우기
      populateSettingsForm();
      renderDoorAdminTable();

      // 3D 엔진 초기화
      init3DEngine();
      calculateQuote();
    } catch (err) {
      console.error('Initial load error:', err);
      showToast('서버 데이터 로딩 중 오류가 발생했습니다.');
    }
  }

  // 2. 3D + 2D 통합 도면 엔진 초기화
  function init3DEngine() {
    const container = document.getElementById('canvas-container');
    engine = new Furniture3DEngine(container, state.spec);

    const planContainer = document.getElementById('plan2d-container');
    if (planContainer && typeof KitchenPlan2DEngine !== 'undefined') {
      plan2dEngine = new KitchenPlan2DEngine(planContainer, state.spec, {
        onSpecChange: handlePlan2DSync
      });
    }
  }

  function syncVisualEngines() {
    if (engine) engine.updateSpec(state.spec);
    if (plan2dEngine) plan2dEngine.updateSpec(state.spec);
  }

  function handlePlan2DSync(updatedSpec) {
    Object.assign(state.spec, updatedSpec);
    document.getElementById('slider-total-w').value = state.spec.totalWidth;
    document.getElementById('input-total-w').value = state.spec.totalWidth;
    document.getElementById('val-total-w').innerText = `${state.spec.totalWidth.toLocaleString()} mm`;
    document.getElementById('input-sink-w').value = state.spec.sinkBayWidth;
    document.getElementById('input-prep-w').value = state.spec.prepBayWidth;
    document.getElementById('input-cook-w').value = state.spec.cooktopBayWidth;
    document.getElementById('input-lower-h').value = state.spec.lowerHeight;
    document.getElementById('input-lower-d').value = state.spec.lowerDepth;
    document.getElementById('input-upper-h').value = state.spec.upperHeight;
    const sideInp = document.getElementById('input-side-len');
    if (sideInp) sideInp.value = state.spec.sideLength;

    if (engine) engine.updateSpec(state.spec);
    calculateQuote();
  }

  // 3. 동적 견적 산출 (웹에서 수정한 고정 단가표 기반 + 만원/천원 단위 깔끔한 절사·반올림)
  function roundThousand(val) {
    return Math.round((Number(val) || 0) / 1000) * 1000;
  }

  function calculateQuote() {
    if (!settings || !state.selectedDoor) return;

    const isL = state.spec.layoutType === 'l_left' || state.spec.layoutType === 'l_right';
    const wingNet = isL ? Math.max(0, (state.spec.sideLength || 1800) - (state.spec.lowerDepth || 600)) : 0;
    const totalM = (state.spec.totalWidth + wingNet) / 1000;
    const upperM = (state.spec.totalWidth + (state.spec.wingHasUpper ? wingNet : 0)) / 1000;

    // A. 공장 직영 원목 몸통 (천원 단위 반올림)
    const bodyCost = roundThousand(totalM * (settings.woodBodyPerMeter || 230000));

    // B. 기성 도어 외주 매입비 (천원 단위 반올림)
    const lowerDoorArea = totalM * 0.74;
    const upperDoorArea = state.spec.hasUpperCabinets ? (upperM * (state.spec.upperHeight / 1000)) : 0;
    const doorVendorCost = roundThousand((lowerDoorArea + upperDoorArea) * (state.selectedDoor.sqmPrice || 42000));

    // C. 인조대리석 상판 (천원 단위 반올림)
    const countertopCost = roundThousand(
      totalM * (settings.countertopPerMeter || 180000) + (settings.countertopHoleCut || 60000)
    );

    // D. 고정 부자재/하드웨어 항목 합산 (enabled === true 인 항목만)
    const fixedItemsCost = roundThousand(
      (settings.fixedItems || [])
        .filter(item => item.enabled)
        .reduce((sum, item) => sum + (parseInt(item.price) || 0), 0)
    );

    // E. 시공 및 물류비 (천원 단위 반올림)
    const installCost = roundThousand(
      (settings.installBase || 250000) + totalM * (settings.installPerMeter || 40000)
    );

    // F. 마진율 적용 후 최종 견적 총액 및 계약금(10,000원 단위 '000,000' 깔끔하게 절사·반올림)
    const marginMultiplier = 1 + ((settings.marginPercent || 25) / 100);
    const rawTotal = bodyCost + doorVendorCost + countertopCost + fixedItemsCost + installCost;
    const totalPrice = Math.max(10000, Math.round((rawTotal * marginMultiplier) / 10000) * 10000);
    const depositPrice = Math.round((totalPrice * ((settings.depositPercent || 10) / 100)) / 10000) * 10000;
    const balancePrice = Math.max(0, totalPrice - depositPrice);

    state.pricing = {
      woodBodyCost: bodyCost,
      doorVendorCost,
      countertopCost,
      fixedItemsCost,
      installCost,
      totalPrice,
      depositPrice,
      balancePrice
    };

    updateQuoteUI();
  }

  function updateQuoteUI() {
    document.getElementById('cost-wood-body').innerText = state.pricing.woodBodyCost.toLocaleString() + '원';
    document.getElementById('cost-door-vendor').innerText = state.pricing.doorVendorCost.toLocaleString() + '원';
    document.getElementById('cost-countertop').innerText = state.pricing.countertopCost.toLocaleString() + '원';
    document.getElementById('cost-fixed-items').innerText = state.pricing.fixedItemsCost.toLocaleString() + '원';
    document.getElementById('cost-install').innerText = state.pricing.installCost.toLocaleString() + '원';

    document.getElementById('quote-margin-label').innerText = `영업/제작 마진 (${settings.marginPercent || 25}%) 포함`;
    document.getElementById('quote-total-price').innerText = state.pricing.totalPrice.toLocaleString() + '원';
    document.getElementById('quote-deposit-label').innerText = `발주 확정 계약금 (${settings.depositPercent || 10}%)`;
    document.getElementById('quote-deposit-price').innerText = state.pricing.depositPrice.toLocaleString() + '원';

    // 고정 항목 체크리스트도 실측 패널에 요약 표시
    renderActiveFixedSummary();
  }

  function renderActiveFixedSummary() {
    const box = document.getElementById('active-fixed-summary');
    if (!box || !settings.fixedItems) return;
    box.innerHTML = '';
    settings.fixedItems.forEach((item, idx) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:12px; padding:6px 8px; background:var(--bg-subtle); border-radius:6px; cursor:pointer; margin-bottom:4px;';
      label.innerHTML = `
        <span style="display:flex; align-items:center; gap:6px; color:var(--text-primary);">
          <input type="checkbox" ${item.enabled ? 'checked' : ''} data-idx="${idx}">
          <span>${item.name}</span>
        </span>
        <span style="font-weight:600; color:var(--text-secondary);">${parseInt(item.price).toLocaleString()}원</span>
      `;
      label.querySelector('input').addEventListener('change', (e) => {
        settings.fixedItems[idx].enabled = e.target.checked;
        calculateQuote();
      });
      box.appendChild(label);
    });
  }

  // 4. 네비게이션 뷰 전환 (PC 사이드바 + 모바일 하단 바)
  const navViews = ['studio', 'orders', 'settings', 'doors'];
  const pageTitles = {
    studio: { title: '3D 도면 설계 및 현장 실측', desc: '주방 모듈별 치수 입력 및 실시간 3D 시뮬레이션과 견적을 산출합니다.' },
    orders: { title: '수주 및 고객 견적 관리', desc: '발송된 견적 현황과 계약서 서명, 입금 완료 및 누적 매출을 관리합니다.' },
    settings: { title: '고정 단가표 및 회사 설정', desc: '견적서에 들어가는 고정 항목과 단가, 마진율, 입금 계좌를 웹에서 직접 수정합니다.' },
    doors: { title: '기성품 도어 카탈로그 관리', desc: '외주 도어 업체별 모델과 헤베(m²)당 단가를 등록하고 수정합니다.' }
  };

  function switchView(viewName) {
    navViews.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = (v === viewName) ? 'block' : 'none';
    });

    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === viewName);
    });

    const info = pageTitles[viewName];
    if (info) {
      document.getElementById('pc-page-title').innerText = info.title;
      document.getElementById('pc-page-desc').innerText = info.desc;
    }

    if (viewName === 'orders') loadOrdersTable();
    if (viewName === 'doors') renderDoorAdminTable();
  }

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.nav));
  });

  // 5. 실측 치수 컨트롤 바인딩
  const sliderTotalW = document.getElementById('slider-total-w');
  const inputTotalW = document.getElementById('input-total-w');
  const inputSinkW = document.getElementById('input-sink-w');
  const inputPrepW = document.getElementById('input-prep-w');
  const inputCookW = document.getElementById('input-cook-w');
  const inputLowerH = document.getElementById('input-lower-h');
  const inputLowerD = document.getElementById('input-lower-d');
  const inputUpperH = document.getElementById('input-upper-h');

  function syncWidths(newTotal) {
    state.spec.totalWidth = parseInt(newTotal) || 2700;
    state.spec.sinkBayWidth = Math.round(state.spec.totalWidth * 0.37 / 50) * 50;
    state.spec.cooktopBayWidth = Math.round(state.spec.totalWidth * 0.33 / 50) * 50;
    state.spec.prepBayWidth = state.spec.totalWidth - (state.spec.sinkBayWidth + state.spec.cooktopBayWidth);

    sliderTotalW.value = state.spec.totalWidth;
    inputTotalW.value = state.spec.totalWidth;
    inputSinkW.value = state.spec.sinkBayWidth;
    inputPrepW.value = state.spec.prepBayWidth;
    inputCookW.value = state.spec.cooktopBayWidth;
    document.getElementById('val-total-w').innerText = `${state.spec.totalWidth.toLocaleString()} mm`;

    syncVisualEngines();
    calculateQuote();
  }

  sliderTotalW.addEventListener('input', e => syncWidths(e.target.value));
  inputTotalW.addEventListener('change', e => syncWidths(e.target.value));

  function onModuleChanged() {
    state.spec.sinkBayWidth = parseInt(inputSinkW.value) || 900;
    state.spec.prepBayWidth = parseInt(inputPrepW.value) || 800;
    state.spec.cooktopBayWidth = parseInt(inputCookW.value) || 900;
    state.spec.totalWidth = state.spec.sinkBayWidth + state.spec.prepBayWidth + state.spec.cooktopBayWidth;

    sliderTotalW.value = state.spec.totalWidth;
    inputTotalW.value = state.spec.totalWidth;
    document.getElementById('val-total-w').innerText = `${state.spec.totalWidth.toLocaleString()} mm`;

    syncVisualEngines();
    calculateQuote();
  }

  [inputSinkW, inputPrepW, inputCookW].forEach(el => el.addEventListener('change', onModuleChanged));

  inputLowerH.addEventListener('change', e => {
    state.spec.lowerHeight = parseInt(e.target.value) || 860;
    syncVisualEngines();
  });
  inputLowerD.addEventListener('change', e => {
    state.spec.lowerDepth = parseInt(e.target.value) || 600;
    syncVisualEngines();
    calculateQuote();
  });
  inputUpperH.addEventListener('change', e => {
    state.spec.upperHeight = parseInt(e.target.value) || 700;
    syncVisualEngines();
    calculateQuote();
  });

  document.querySelectorAll('.preset-pill[data-w]').forEach(btn => {
    btn.addEventListener('click', () => syncWidths(btn.dataset.w));
  });

  document.getElementById('check-upper-cabinets').addEventListener('change', e => {
    state.spec.hasUpperCabinets = e.target.checked;
    syncVisualEngines();
    calculateQuote();
  });

  // 5-0. 주방 구조 레이아웃 (일자형 / ㄱ자 좌·우 코너)
  const wingBox = document.getElementById('wing-config-box');
  const inputSideLen = document.getElementById('input-side-len');
  document.querySelectorAll('[data-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b === btn));
      state.spec.layoutType = btn.dataset.layout;
      if (wingBox) {
        wingBox.style.display = (state.spec.layoutType === 'straight') ? 'none' : 'block';
      }
      syncVisualEngines();
      calculateQuote();
    });
  });

  if (inputSideLen) {
    inputSideLen.addEventListener('change', e => {
      state.spec.sideLength = Math.max(1000, parseInt(e.target.value, 10) || 1800);
      inputSideLen.value = state.spec.sideLength;
      syncVisualEngines();
      calculateQuote();
    });
  }

  document.querySelectorAll('.side-preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.spec.sideLength = parseInt(btn.dataset.side, 10) || 1800;
      if (inputSideLen) inputSideLen.value = state.spec.sideLength;
      syncVisualEngines();
      calculateQuote();
    });
  });

  const checkWingUpper = document.getElementById('check-wing-upper');
  if (checkWingUpper) {
    checkWingUpper.addEventListener('change', e => {
      state.spec.wingHasUpper = e.target.checked;
      syncVisualEngines();
      calculateQuote();
    });
  }

  // 5-1. 3D 모델뷰 <-> 2D 평면/입면도 전환
  const canvasBoxEl = document.getElementById('canvas-container');
  const planBoxEl = document.getElementById('plan2d-container');
  document.querySelectorAll('[data-viewmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewmode;
      document.querySelectorAll('[data-viewmode]').forEach(b => b.classList.toggle('active', b.dataset.viewmode === mode));
      if (mode === '2d') {
        if (canvasBoxEl) canvasBoxEl.style.display = 'none';
        if (planBoxEl) planBoxEl.style.display = 'block';
        if (plan2dEngine) plan2dEngine.updateSpec(state.spec);
      } else {
        if (planBoxEl) planBoxEl.style.display = 'none';
        if (canvasBoxEl) canvasBoxEl.style.display = 'block';
        if (engine) engine.resize();
      }
    });
  });

  // 5-2. 우측 스튜디오 탭 전환 (실측·자재·견적 vs 벽면·바닥·공간 디자인)
  const panelSpecEl = document.getElementById('tab-panel-spec');
  const panelSpaceEl = document.getElementById('tab-panel-space');
  document.querySelectorAll('[data-studiotab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.studiotab;
      document.querySelectorAll('[data-studiotab]').forEach(b => b.classList.toggle('active', b.dataset.studiotab === tab));
      if (panelSpecEl) panelSpecEl.style.display = (tab === 'spec') ? 'block' : 'none';
      if (panelSpaceEl) panelSpaceEl.style.display = (tab === 'space') ? 'block' : 'none';
    });
  });

  // 5-3. 벽면/타일/상판/바닥/손잡이/조명 디자인 컨트롤
  function bindSwatchGroup(attrName, specKey, labelKey = null) {
    document.querySelectorAll(`[data-${attrName}]`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`[data-${attrName}]`).forEach(b => b.classList.toggle('active', b === btn));
        state.spec[specKey] = btn.dataset[attrName];
        if (labelKey && btn.dataset.label) state.spec[labelKey] = btn.dataset.label;
        syncVisualEngines();
      });
    });
  }
  bindSwatchGroup('wall', 'wallDesign');
  bindSwatchGroup('tile', 'tileDesign');
  bindSwatchGroup('countertop', 'countertopType', 'countertopLabel');
  bindSwatchGroup('floor', 'floorDesign');

  const handleSel = document.getElementById('select-handle-type');
  if (handleSel) {
    handleSel.addEventListener('change', e => {
      state.spec.handleType = e.target.value;
      syncVisualEngines();
    });
  }
  const lightSel = document.getElementById('select-underlight-temp');
  if (lightSel) {
    lightSel.addEventListener('change', e => {
      state.spec.underlightTemp = e.target.value;
      syncVisualEngines();
    });
  }
  const ceilInp = document.getElementById('input-ceiling-h');
  if (ceilInp) {
    ceilInp.addEventListener('change', e => {
      state.spec.ceilingHeight = Math.max(2150, Math.min(3200, parseInt(e.target.value, 10) || 2350));
      ceilInp.value = state.spec.ceilingHeight;
      syncVisualEngines();
    });
  }

  // 주방 기기 및 수전 모델 선택 (카탈로그 모델 실시간 3D/2D 반영)
  document.getElementById('select-hood-type').addEventListener('change', e => {
    state.spec.hoodType = e.target.value;
    syncVisualEngines();
  });
  document.getElementById('select-cooktop-type').addEventListener('change', e => {
    state.spec.cooktopType = e.target.value;
    syncVisualEngines();
  });
  document.getElementById('select-faucet-type').addEventListener('change', e => {
    state.spec.faucetType = e.target.value;
    syncVisualEngines();
  });

  // 카메라 뷰 프리셋 (투시도 / 정면 / 항공)
  document.querySelectorAll('[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('active', b === btn));
      if (engine) engine.setCameraPreset(btn.dataset.cam);
    });
  });

  // 3D 뷰어 툴바
  const btnDoorToggle = document.getElementById('btn-door-toggle');
  btnDoorToggle.addEventListener('click', () => {
    if (!engine) return;
    const isOpen = engine.toggleDoors();
    btnDoorToggle.classList.toggle('active', isOpen);
    btnDoorToggle.querySelector('span').innerText = isOpen ? '도어 닫기' : '도어 열기';
  });

  const btnDimToggle = document.getElementById('btn-dim-toggle');
  btnDimToggle.addEventListener('click', () => {
    if (!engine) return;
    const isShow = engine.toggleDimensions();
    btnDimToggle.classList.toggle('active', isShow);
  });

  document.getElementById('btn-capture-3d').addEventListener('click', () => {
    if (!engine) return;
    const url = engine.captureImage(2);
    const a = document.createElement('a');
    a.href = url;
    a.download = `싱크대-3D도면-${Date.now()}.jpg`;
    a.click();
    showToast('고화질 3D 도면 이미지가 저장되었습니다.');
  });

  // 6. 기성 도어 선택 모달
  const doorModal = document.getElementById('door-modal');
  function updateSelectedDoorCard() {
    if (!state.selectedDoor) return;
    document.getElementById('cur-door-swatch').style.background = state.selectedDoor.colorHex;
    document.getElementById('cur-door-name').innerText = state.selectedDoor.name;
    document.getElementById('cur-door-meta').innerText = `${state.selectedDoor.vendor} · ${state.selectedDoor.finish} · 헤베당 ${parseInt(state.selectedDoor.sqmPrice).toLocaleString()}원`;
  }

  function renderDoorPicker(filter = '전체') {
    const grid = document.getElementById('door-picker-grid');
    grid.innerHTML = '';
    const list = filter === '전체' ? doorCatalog : doorCatalog.filter(d => d.vendor === filter);

    list.forEach(d => {
      const card = document.createElement('div');
      card.className = `door-card ${state.selectedDoor?.id === d.id ? 'selected' : ''}`;
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <div class="swatch-box" style="width:26px; height:26px; background:${d.colorHex};"></div>
          <div style="overflow:hidden;">
            <div style="font-size:10px; color:var(--brand); font-weight:700;">${d.vendor}</div>
            <div style="font-size:12px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.name}</div>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">${d.finish}</div>
        <div style="font-size:12px; font-weight:700; color:var(--brand-dark);">헤베당 ${parseInt(d.sqmPrice).toLocaleString()}원</div>
      `;
      card.onclick = () => {
        state.selectedDoor = d;
        state.spec.doorColor = d.colorHex;
        state.spec.doorStyle = d.style === 'shaker' ? 'shaker' : 'flat';
        syncVisualEngines();
        updateSelectedDoorCard();
        calculateQuote();
        doorModal.style.display = 'none';
      };
      grid.appendChild(card);
    });
  }

  document.getElementById('door-selected-trigger').addEventListener('click', () => {
    renderDoorPicker('전체');
    doorModal.style.display = 'flex';
  });
  document.getElementById('btn-close-door-modal').addEventListener('click', () => {
    doorModal.style.display = 'none';
  });
  document.querySelectorAll('.door-vendor-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.door-vendor-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDoorPicker(btn.dataset.vendor);
    });
  });

  // 7. 견적 저장 & 고객 전송 모달 (모바일 접속 IP 자동 매핑 & QR코드)
  const submitModal = document.getElementById('submit-modal');
  const resultModal = document.getElementById('link-result-modal');

  function getLayoutLabel(specObj = state.spec) {
    if (specObj.layoutType === 'l_left' || specObj.layoutType === 'l_right') {
      const dir = specObj.layoutType === 'l_left' ? '좌코너' : '우코너';
      return `ㄱ자(${dir}) ${Number(specObj.totalWidth).toLocaleString()} × ${Number(specObj.sideLength || 1800).toLocaleString()}mm`;
    }
    return `일자형 전체 폭 ${Number(specObj.totalWidth).toLocaleString()}mm`;
  }

  document.getElementById('btn-open-submit').addEventListener('click', () => {
    const thumb = engine ? engine.captureImage(1.5) : '';
    document.getElementById('submit-thumb').src = thumb;
    document.getElementById('submit-spec-summary').innerText =
      `${getLayoutLabel()} (개수대 ${state.spec.sinkBayWidth} / 조리대 ${state.spec.prepBayWidth} / 가열대 ${state.spec.cooktopBayWidth})`;
    document.getElementById('submit-door-summary').innerText = state.selectedDoor?.name || '';
    document.getElementById('submit-total-summary').innerText = `${state.pricing.totalPrice.toLocaleString()}원 (계약금 ${state.pricing.depositPrice.toLocaleString()}원)`;
    submitModal.style.display = 'flex';
  });

  document.getElementById('btn-close-submit').addEventListener('click', () => submitModal.style.display = 'none');

  document.getElementById('btn-confirm-save-quote').addEventListener('click', async () => {
    const name = document.getElementById('cust-name').value.trim() || '고객님';
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const thumb = engine ? engine.captureImage(1.5) : null;

    const btn = document.getElementById('btn-confirm-save-quote');
    btn.disabled = true;
    btn.innerText = '저장 중...';

    const hoodSel = document.getElementById('select-hood-type');
    const cookSel = document.getElementById('select-cooktop-type');
    const faucetSel = document.getElementById('select-faucet-type');
    const getSelectedText = sel => (sel && sel.options[sel.selectedIndex]) ? sel.options[sel.selectedIndex].text : '';
    const includedItems = (settings.fixedItems || [])
      .filter(item => item.enabled)
      .map(item => item.name);

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          customerAddress: address,
          spec: {
            ...state.spec,
            layoutLabel: getLayoutLabel(),
            selectedDoorName: state.selectedDoor?.name,
            selectedDoorFinish: state.selectedDoor?.finish,
            woodBodyName: settings.woodBodyName,
            countertopName: state.spec.countertopLabel || settings.countertopName,
            hoodLabel: getSelectedText(hoodSel),
            cooktopLabel: getSelectedText(cookSel),
            faucetLabel: getSelectedText(faucetSel),
            includedItems
          },
          pricing: state.pricing,
          capturedImage: thumb
        })
      });
      const data = await res.json();
      if (data.success) {
        submitModal.style.display = 'none';
        openLinkResultModal(data.quote, data.localIp, data.port);
      } else {
        alert('저장 실패: ' + data.message);
      }
    } catch (err) {
      alert('저장 오류: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = '견적 확정 및 고객 링크 생성';
    }
  });

  function openLinkResultModal(quote, localIp, port) {
    // PC에서 localhost로 열었을 때도 스마트폰 접속 가능하도록 LAN IP URL 생성!
    const hostOrigin = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? `http://${localIp}:${port}`
      : window.location.origin;

    const mobileViewerUrl = `${hostOrigin}/viewer.html?id=${quote.id}`;
    const localViewerUrl = `${window.location.origin}/viewer.html?id=${quote.id}`;

    document.getElementById('result-mobile-url').value = mobileViewerUrl;

    // QR 코드 생성 (스마트폰 카메라로 바로 스캔 테스트!)
    const qrBox = document.getElementById('result-qr-code');
    qrBox.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrBox, {
        text: mobileViewerUrl,
        width: 130,
        height: 130,
        colorDark: '#2A211B',
        colorLight: '#FFFFFF'
      });
    }

    // 발송될 문자 내용 미리보기
    const smsText =
      `[${settings.companyName || '우드크래프트'} 맞춤 씽크대 공급계약]\n` +
      `${quote.customer.name}님, 실측 3D · 2D 평면 도면 및 정식 공급계약서가 도착했습니다.\n\n` +
      `• 규격: ${quote.spec.layoutLabel || getLayoutLabel(quote.spec)}\n` +
      `• 몸통: ${quote.spec.woodBodyName || '친환경 자작합판 원목'}\n` +
      `• 도어: ${quote.spec.selectedDoorName}\n` +
      `• 계약 공급가액: ${quote.pricing.totalPrice.toLocaleString()}원\n` +
      `• 계약금(${settings.depositPercent || 10}%): ${quote.pricing.depositPrice.toLocaleString()}원\n\n` +
      `스마트폰으로 3D/평면 도면 확인 및 전자서명:\n${mobileViewerUrl}`;

    document.getElementById('sms-preview-text').innerText = smsText;

    // 버튼 동작
    document.getElementById('btn-copy-sms').onclick = () => {
      navigator.clipboard.writeText(smsText);
      showToast('문자 안내 문구와 링크가 복사되었습니다.');
    };

    const smsBtn = document.getElementById('btn-trigger-sms');
    smsBtn.href = `sms:${quote.customer.phone || ''}?body=${encodeURIComponent(smsText)}`;
    smsBtn.onclick = (e) => {
      // 데스크톱 환경 안내
      if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        e.preventDefault();
        navigator.clipboard.writeText(smsText);
        showToast('PC에서는 문자 앱 대신 문구가 클립보드에 복사되었습니다. QR코드로 폰에서 확인하세요.');
      }
    };

    document.getElementById('btn-open-customer-view').onclick = () => {
      window.open(localViewerUrl, '_blank');
    };

    resultModal.style.display = 'flex';
  }

  document.getElementById('btn-close-result').onclick = () => resultModal.style.display = 'none';

  // 8. 관리자 - 수주 및 고객 관리 테이블 로드
  async function loadOrdersTable() {
    const tbody = document.getElementById('orders-table-body');
    const mobileCards = document.getElementById('orders-mobile-cards');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">불러오는 중...</td></tr>';
    mobileCards.innerHTML = '';

    try {
      const res = await fetch('/api/quotes');
      const data = await res.json();
      if (!data.success) return;

      document.getElementById('kpi-total').innerText = `${data.stats.totalCount}건`;
      document.getElementById('kpi-signed').innerText = `${data.stats.signedCount}건`;
      document.getElementById('kpi-paid').innerText = `${data.stats.paidCount}건`;
      document.getElementById('kpi-revenue').innerText = `${data.stats.totalRevenue.toLocaleString()}원`;

      if (data.quotes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-tertiary);">등록된 견적 데이터가 없습니다.</td></tr>';
        mobileCards.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-tertiary); font-size:13px;">등록된 견적 데이터가 없습니다.</div>';
        return;
      }

      tbody.innerHTML = '';
      data.quotes.forEach(q => {
        const badgeHtml = q.status === 'paid'
          ? '<span class="badge badge-paid">입금 완료</span>'
          : (q.status === 'signed'
            ? '<span class="badge badge-signed">서명/계약 완료</span>'
            : '<span class="badge badge-pending">견적 대기</span>');

        const dateStr = new Date(q.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const widthDisplay = q.spec.totalWidth || q.spec.width || 2700;

        // PC 테이블 행
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="font-weight:700;">${q.customer.name}</div>
            <div style="font-size:11px; color:var(--text-secondary);">${q.customer.phone || '-'}</div>
          </td>
          <td>
            <div style="font-weight:600;">전체 폭 ${widthDisplay.toLocaleString()}mm</div>
            <div style="font-size:11px; color:var(--text-secondary);">${q.spec.selectedDoorName || '표준 도어'}</div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--brand-dark);">${(q.pricing?.totalPrice || 0).toLocaleString()}원</div>
            <div style="font-size:11px; color:var(--text-secondary);">계약금 ${(q.pricing?.depositPrice || 0).toLocaleString()}원</div>
          </td>
          <td>${badgeHtml}</td>
          <td style="font-size:12px; color:var(--text-secondary);">${dateStr}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn-outline btn-sm btn-view-3d">도면/계약서</button>
              ${q.status !== 'paid' ? '<button class="btn-primary btn-sm btn-mark-paid" style="width:auto; padding:6px 10px;">입금확인</button>' : ''}
              <button class="btn-outline btn-sm btn-del-quote" style="color:#B91C1C;">삭제</button>
            </div>
          </td>
        `;

        tr.querySelector('.btn-view-3d').onclick = () => window.open(`/viewer.html?id=${q.id}`, '_blank');
        const payBtn = tr.querySelector('.btn-mark-paid');
        if (payBtn) {
          payBtn.onclick = async () => {
            if (confirm(`[${q.customer.name}] 님의 계약금 입금을 확인 처리하시겠습니까?`)) {
              await fetch(`/api/quotes/${q.id}/payment`, { method: 'POST' });
              loadOrdersTable();
              showToast('입금 확인 처리가 완료되었습니다.');
            }
          };
        }
        tr.querySelector('.btn-del-quote').onclick = async () => {
          if (confirm(`[${q.customer.name}] 견적 내역을 삭제하시겠습니까?`)) {
            await fetch(`/api/quotes/${q.id}`, { method: 'DELETE' });
            loadOrdersTable();
          }
        };
        tbody.appendChild(tr);

        // 모바일용 간결 카드
        const mCard = document.createElement('div');
        mCard.className = 'card';
        mCard.style.marginBottom = '10px';
        mCard.innerHTML = `
          <div class="card-body" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:14px;">${q.customer.name}</span>
              ${badgeHtml}
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">
              규격 ${widthDisplay.toLocaleString()}mm · ${q.spec.selectedDoorName || '표준 도어'}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:15px; color:var(--brand-dark);">${(q.pricing?.totalPrice || 0).toLocaleString()}원</strong>
              <div style="display:flex; gap:6px;">
                <button class="btn-outline btn-sm m-btn-view">3D 확인</button>
                ${q.status !== 'paid' ? '<button class="btn-primary btn-sm m-btn-pay" style="width:auto;">입금확인</button>' : ''}
              </div>
            </div>
          </div>
        `;
        mCard.querySelector('.m-btn-view').onclick = () => window.open(`/viewer.html?id=${q.id}`, '_blank');
        const mPayBtn = mCard.querySelector('.m-btn-pay');
        if (mPayBtn) {
          mPayBtn.onclick = async () => {
            if (confirm('입금 확인 처리하시겠습니까?')) {
              await fetch(`/api/quotes/${q.id}/payment`, { method: 'POST' });
              loadOrdersTable();
            }
          };
        }
        mobileCards.appendChild(mCard);
      });
    } catch (err) {
      console.error(err);
    }
  }

  // 9. 관리자 - 고정 단가표 및 회사 설정 관리 (웹페이지에서 바로 수정!)
  function populateSettingsForm() {
    if (!settings) return;
    document.getElementById('set-company-name').value = settings.companyName || '';
    const ownerEl = document.getElementById('set-company-owner');
    const bizEl = document.getElementById('set-company-bizno');
    const addrEl = document.getElementById('set-company-address');
    if (ownerEl) ownerEl.value = settings.companyOwner || '';
    if (bizEl) bizEl.value = settings.companyBizNo || '';
    if (addrEl) addrEl.value = settings.companyAddress || '';
    document.getElementById('set-company-phone').value = settings.companyPhone || '';
    document.getElementById('set-bank-name').value = settings.bankName || '';
    document.getElementById('set-bank-account').value = settings.bankAccount || '';
    document.getElementById('set-bank-holder').value = settings.bankHolder || '';

    document.getElementById('set-wood-name').value = settings.woodBodyName || '';
    document.getElementById('set-wood-price').value = settings.woodBodyPerMeter || 230000;
    document.getElementById('set-top-name').value = settings.countertopName || '';
    document.getElementById('set-top-price').value = settings.countertopPerMeter || 180000;
    document.getElementById('set-top-hole').value = settings.countertopHoleCut || 60000;
    document.getElementById('set-install-base').value = settings.installBase || 250000;
    document.getElementById('set-install-meter').value = settings.installPerMeter || 40000;
    document.getElementById('set-margin').value = settings.marginPercent || 25;
    document.getElementById('set-deposit').value = settings.depositPercent || 10;

    renderFixedItemsEditor();
  }

  function renderFixedItemsEditor() {
    const container = document.getElementById('fixed-items-editor-list');
    container.innerHTML = '';

    (settings.fixedItems || []).forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'fixed-item-row';
      row.innerHTML = `
        <input type="checkbox" class="f-enabled" ${item.enabled ? 'checked' : ''} title="기본 포함 여부">
        <input type="text" class="input-control f-name" value="${item.name}" placeholder="항목명">
        <input type="number" class="input-control f-price" value="${item.price}" placeholder="금액">
        <button class="btn-outline btn-sm f-del" style="color:#B91C1C;">삭제</button>
      `;

      row.querySelector('.f-enabled').onchange = e => settings.fixedItems[idx].enabled = e.target.checked;
      row.querySelector('.f-name').onchange = e => settings.fixedItems[idx].name = e.target.value;
      row.querySelector('.f-price').onchange = e => settings.fixedItems[idx].price = parseInt(e.target.value) || 0;
      row.querySelector('.f-del').onclick = () => {
        settings.fixedItems.splice(idx, 1);
        renderFixedItemsEditor();
      };

      container.appendChild(row);
    });
  }

  // 고정 부자재 항목 추가 버튼
  document.getElementById('btn-add-fixed-item').addEventListener('click', () => {
    if (!settings.fixedItems) settings.fixedItems = [];
    settings.fixedItems.push({
      id: 'item-' + Date.now().toString(36),
      name: '신규 고정 부자재 / 옵션',
      price: 50000,
      enabled: true
    });
    renderFixedItemsEditor();
  });

  // 설정 전체 저장 버튼
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const ownerEl = document.getElementById('set-company-owner');
    const bizEl = document.getElementById('set-company-bizno');
    const addrEl = document.getElementById('set-company-address');

    const updated = {
      ...settings,
      companyName: document.getElementById('set-company-name').value.trim(),
      companyOwner: ownerEl ? ownerEl.value.trim() : (settings.companyOwner || ''),
      companyBizNo: bizEl ? bizEl.value.trim() : (settings.companyBizNo || ''),
      companyAddress: addrEl ? addrEl.value.trim() : (settings.companyAddress || ''),
      companyPhone: document.getElementById('set-company-phone').value.trim(),
      bankName: document.getElementById('set-bank-name').value.trim(),
      bankAccount: document.getElementById('set-bank-account').value.trim(),
      bankHolder: document.getElementById('set-bank-holder').value.trim(),
      woodBodyName: document.getElementById('set-wood-name').value.trim(),
      woodBodyPerMeter: parseInt(document.getElementById('set-wood-price').value) || 230000,
      countertopName: document.getElementById('set-top-name').value.trim(),
      countertopPerMeter: parseInt(document.getElementById('set-top-price').value) || 180000,
      countertopHoleCut: parseInt(document.getElementById('set-top-hole').value) || 60000,
      installBase: parseInt(document.getElementById('set-install-base').value) || 250000,
      installPerMeter: parseInt(document.getElementById('set-install-meter').value) || 40000,
      marginPercent: parseFloat(document.getElementById('set-margin').value) || 25,
      depositPercent: parseFloat(document.getElementById('set-deposit').value) || 10
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (data.success) {
        settings = data.settings;
        calculateQuote();
        showToast('고정 단가표 및 계좌 설정이 저장되어 견적에 즉시 반영되었습니다.');
      }
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  });

  // 10. 관리자 - 기성 도어 카탈로그 관리 (웹에서 단가 수정 & 신규 등록)
  function renderDoorAdminTable() {
    const tbody = document.getElementById('doors-admin-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    doorCatalog.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${d.vendor}</strong></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:18px; height:18px; border-radius:4px; background:${d.colorHex}; border:1px solid var(--border-strong);"></span>
            <span style="font-weight:600;">${d.name}</span>
          </div>
        </td>
        <td style="font-size:12px; color:var(--text-secondary);">${d.finish}</td>
        <td>
          <input type="number" class="input-control door-price-inp" value="${d.sqmPrice}" style="width:110px;">
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn-primary btn-sm btn-save-door-price" style="width:auto;">수정저장</button>
            <button class="btn-outline btn-sm btn-del-door" style="color:#B91C1C;">삭제</button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-save-door-price').onclick = async () => {
        const newPrice = parseInt(tr.querySelector('.door-price-inp').value) || d.sqmPrice;
        const res = await fetch('/api/doors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...d, sqmPrice: newPrice })
        });
        const data = await res.json();
        if (data.success) {
          doorCatalog = data.doors;
          if (state.selectedDoor?.id === d.id) {
            state.selectedDoor.sqmPrice = newPrice;
            updateSelectedDoorCard();
            calculateQuote();
          }
          showToast(`[${d.name}] 단가가 저장되었습니다.`);
        }
      };

      tr.querySelector('.btn-del-door').onclick = async () => {
        if (confirm(`[${d.name}] 도어 모델을 삭제하시겠습니까?`)) {
          const res = await fetch(`/api/doors/${d.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            doorCatalog = data.doors;
            renderDoorAdminTable();
          }
        }
      };

      tbody.appendChild(tr);
    });
  }

  // 신규 기성 도어 등록
  document.getElementById('btn-add-new-door').addEventListener('click', async () => {
    const vendor = document.getElementById('new-door-vendor').value;
    const style = document.getElementById('new-door-style').value;
    const name = document.getElementById('new-door-name').value.trim();
    const finish = document.getElementById('new-door-finish').value.trim();
    const colorHex = document.getElementById('new-door-color').value;
    const sqmPrice = parseInt(document.getElementById('new-door-price').value) || 45000;

    if (!name) {
      alert('도어 모델명을 입력해 주세요.');
      return;
    }

    const res = await fetch('/api/doors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor, style, name, finish, colorHex, sqmPrice })
    });
    const data = await res.json();
    if (data.success) {
      doorCatalog = data.doors;
      document.getElementById('new-door-name').value = '';
      renderDoorAdminTable();
      showToast('신규 기성 도어 모델이 카탈로그에 등록되었습니다.');
    }
  });

  // 초기 구동
  loadInitialData();
});
