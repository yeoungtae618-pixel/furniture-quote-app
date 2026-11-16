/**
 * app.js - 피앙세가구 통합 관리자 & 현장 실측 앱 로직
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 전역 상태
  let settings = {};
  let doorCatalog = [];
  let serverInfo = { localIp: window.location.hostname, port: window.location.port || 3000 };
  let engine = null;
  let plan2dEngine = null;
  let drawingEngine = null;

  const FURNITURE_CATEGORIES = [
    { id: 'sink', name: '맞춤 씽크대 (주방)', icon: '🍳', desc: '일자/ㄱ자/ㄴ자/ㄷ자 일체형 코너장 연결 (상부·하부 코너장 일체화 시공)', defaultW: 2700, defaultH: 860, defaultD: 600, hasCountertop: true, hasUpper: true },
    { id: 'wardrobe', name: '붙박이장', icon: '🚪', desc: '천장 마감 슬라이딩/여닫이, 내부 서랍 및 옷걸이봉', defaultW: 3000, defaultH: 2350, defaultD: 650, hasCountertop: false, hasUpper: false },
    { id: 'shoe_cabinet', name: '신발장', icon: '👞', desc: '하부 200mm 띄움 시공 & T5 조명 & 중간 오픈 니치', defaultW: 1200, defaultH: 2300, defaultD: 380, hasCountertop: false, hasUpper: false },
    { id: 'storage', name: '수납장(팬트리)', icon: '📦', desc: '다목적 5단 이동 선반 다용도실/팬트리 수납', defaultW: 900, defaultH: 2100, defaultD: 450, hasCountertop: false, hasUpper: false },
    { id: 'drawers', name: '서랍장', icon: '🗄️', desc: '3단/4단/5단 와이드 볼레일 레일 서랍장', defaultW: 900, defaultH: 950, defaultD: 500, hasCountertop: false, hasUpper: false },
    { id: 'island', name: '아일랜드 식탁', icon: '🍽️', desc: '인조대리석 상판 오버행(무릎공간) & 가전 인출 수납', defaultW: 1800, defaultH: 860, defaultD: 850, hasCountertop: true, hasUpper: false },
    { id: 'display_glass', name: '장식장(유리문)', icon: '✨', desc: '슬림 알루미늄 프레임, 8T 강화유리 & 세로 LED 조명', defaultW: 900, defaultH: 2100, defaultD: 400, hasCountertop: false, hasUpper: false },
    { id: 'prep_counter', name: '조리대', icon: '🔪', desc: '인조대리석 상판 수납 서랍 독립 조리 작업대', defaultW: 1000, defaultH: 860, defaultD: 600, hasCountertop: true, hasUpper: false },
    { id: 'tall_cabinet', name: '키큰장(가전)', icon: '⚡', desc: '밥솥 인출 레일 & 광파오븐 수납 단독 키큰장', defaultW: 600, defaultH: 2350, defaultD: 600, hasCountertop: false, hasUpper: false },
    { id: 'tv_console', name: '티비다이', icon: '📺', desc: '거실 모던 로우보드, 오픈 AV 니치 & 배선홀', defaultW: 2000, defaultH: 450, defaultD: 420, hasCountertop: false, hasUpper: false },
    { id: 'hood_cabinet', name: '후드장', icon: '💨', desc: '빌트인 하이드 후드 & 상부 은색 배기 연통 덕트', defaultW: 800, defaultH: 700, defaultD: 350, hasCountertop: false, hasUpper: false }
  ];

  const state = {
    items: [],
    activeItemIndex: 0,
    spec: {
      category: 'sink',
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
      tallCabinet: 'none',
      tallCabinetWidth: 600,
      tallCabinetType: 'appliance',
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
      sinkFaucetCombo: 'square_gooseneck',
      hardwareCombo: 'damper_3ball',
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
      depositPrice: 0,
      balancePrice: 0
    },
    orderGrandTotal: 0,
    orderGrandDeposit: 0,
    orderGrandBalance: 0
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

      if (setRes.success) {
        settings = setRes.settings;
        updateAppBrandHeaders(settings.companyName);
      }
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

      // 설정 및 사업자 정보 폼 채우기
      populateCompanyForm();
      populateSettingsForm();
      renderDoorAdminTable();

      // 3D 엔진 초기화
      init3DEngine();
      initCategoryModalEvents();
      calculateQuote();

      // 영업사원 실측 워크벤치 바인딩 및 동기화
      bindFieldFormEvents();
      syncFieldFormFromState();
      setupHouseAuthorityControls();
    } catch (err) {
      console.error('Initial load error:', err);
      showToast('서버 데이터 로딩 중 오류가 발생했습니다.');
    }
  }

  function initCategoryModalEvents() {
    const btnAddModal = document.getElementById('btn-add-item-modal');
    if (btnAddModal) {
      btnAddModal.addEventListener('click', () => openCategoryModal('add'));
    }

    const btnChangeCat = document.getElementById('btn-change-category');
    if (btnChangeCat) {
      btnChangeCat.addEventListener('click', () => openCategoryModal('change'));
    }

    const btnCloseCat = document.getElementById('btn-close-cat-modal');
    const catModal = document.getElementById('modal-add-category');
    if (btnCloseCat && catModal) {
      btnCloseCat.addEventListener('click', () => {
        catModal.style.display = 'none';
      });
      catModal.addEventListener('click', (e) => {
        if (e.target === catModal) catModal.style.display = 'none';
      });
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

    // 모바일 터치 슬라이드 & 마우스 휠 가로 스크롤 최적화
    const toolbar = container ? container.querySelector('.viewer-toolbar') : null;
    if (toolbar) {
      ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove'].forEach(ev => {
        toolbar.addEventListener(ev, e => e.stopPropagation(), { passive: true });
      });
      toolbar.addEventListener('wheel', e => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          toolbar.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    const pillsBar = document.getElementById('order-items-pills');
    if (pillsBar) {
      pillsBar.addEventListener('wheel', e => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          pillsBar.scrollLeft += e.deltaY;
        }
      }, { passive: false });
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

  // 3. 다중 맞춤 가구 품목별 정밀 견적 산출 (카테고리별 공장 원가 + 기성 도어 + 부자재 + 시공비 + 마진)
  function roundThousand(val) {
    return Math.round((Number(val) || 0) / 1000) * 1000;
  }

  function calculateSingleItemPricing(item) {
    if (!settings) return;
    const s = item.spec || state.spec;
    const door = item.selectedDoor || state.selectedDoor || { sqmPrice: 42000 };
    const cat = item.category || 'sink';
    const doorPrice = Number(door.sqmPrice) || 42000;
    const woodRate = Number(settings.woodBodyPerMeter) || 230000;
    const topRate = Number(settings.countertopPerMeter) || 180000;

    let bodyCost = 0;
    let doorCost = 0;
    let topCost = 0;
    let hardwareCost = 0;
    let installCost = 0;

    const W_m = (Number(s.totalWidth) || 2700) / 1000;
    const H_m = (Number(s.lowerHeight || s.ceilingHeight) || 860) / 1000;
    const CH_m = (Number(s.ceilingHeight) || 2350) / 1000;

    if (cat === 'wardrobe') {
      bodyCost = roundThousand(W_m * (CH_m / 2.3) * woodRate * 1.35);
      doorCost = roundThousand(W_m * (CH_m - 0.12) * doorPrice);
      hardwareCost = 150000;
      installCost = roundThousand((settings.installBase || 250000) * 0.7 + W_m * 45000);
    } else if (cat === 'shoe_cabinet') {
      bodyCost = roundThousand(W_m * (CH_m / 2.3) * woodRate * 1.1);
      doorCost = roundThousand(W_m * (CH_m - 0.55) * doorPrice);
      hardwareCost = 140000;
      installCost = roundThousand(160000 + W_m * 35000);
    } else if (cat === 'island') {
      const islandD_m = (Number(s.islandDepth) || 850) / 1000;
      bodyCost = roundThousand(W_m * (islandD_m / 0.8) * woodRate * 1.2);
      doorCost = roundThousand(W_m * 0.75 * doorPrice);
      topCost = roundThousand(W_m * (islandD_m / 0.6) * topRate + 90000);
      hardwareCost = 180000;
      installCost = roundThousand(180000 + W_m * 30000);
    } else if (cat === 'display_glass') {
      bodyCost = roundThousand(W_m * (CH_m / 2.1) * woodRate * 1.15);
      doorCost = roundThousand(W_m * CH_m * (doorPrice * 1.8 + 65000));
      hardwareCost = 180000;
      installCost = roundThousand(170000 + W_m * 30000);
    } else if (cat === 'drawers') {
      bodyCost = roundThousand(W_m * woodRate * 0.95);
      doorCost = roundThousand(W_m * H_m * doorPrice);
      hardwareCost = 130000;
      installCost = roundThousand(90000 + W_m * 25000);
    } else if (cat === 'tv_console') {
      bodyCost = roundThousand(W_m * woodRate * 0.85);
      doorCost = roundThousand(W_m * H_m * doorPrice);
      hardwareCost = 80000;
      installCost = roundThousand(100000 + W_m * 20000);
    } else if (cat === 'storage') {
      bodyCost = roundThousand(W_m * (CH_m / 2.1) * woodRate * 1.05);
      doorCost = roundThousand(W_m * (CH_m - 0.1) * doorPrice);
      hardwareCost = 110000;
      installCost = roundThousand(140000 + W_m * 30000);
    } else if (cat === 'prep_counter') {
      bodyCost = roundThousand(W_m * woodRate * 0.85);
      doorCost = roundThousand(W_m * 0.74 * doorPrice);
      topCost = roundThousand(W_m * topRate);
      hardwareCost = 90000;
      installCost = roundThousand(110000 + W_m * 25000);
    } else if (cat === 'tall_cabinet') {
      bodyCost = roundThousand(W_m * 1.65 * woodRate);
      doorCost = roundThousand(W_m * 2.2 * doorPrice);
      hardwareCost = 140000;
      installCost = roundThousand(130000 + W_m * 30000);
    } else if (cat === 'hood_cabinet') {
      bodyCost = roundThousand(W_m * woodRate * 0.55);
      doorCost = roundThousand(W_m * 0.7 * doorPrice);
      hardwareCost = 150000;
      installCost = roundThousand(70000);
    } else {
      // 씽크대 (주방 가구)
      const isL = s.layoutType === 'l_left' || s.layoutType === 'l_right';
      const isU = s.layoutType === 'u_shape';
      const isP = s.layoutType === 'u_peninsula';
      const wingMult = (isU || isP) ? 2 : (isL ? 1 : 0);
      const wingNet = wingMult * Math.max(0, (Number(s.sideLength) || 1800) - (Number(s.lowerDepth) || 600));
      const totalM = (Number(s.totalWidth) + wingNet) / 1000;
      const upperWingNet = isP ? (Math.max(0, (Number(s.sideLength) || 1800) - (Number(s.lowerDepth) || 600)) * (s.wingHasUpper ? 1 : 0)) : (s.wingHasUpper ? wingNet : 0);
      const upperM = (Number(s.totalWidth) + upperWingNet) / 1000;

      const hasTall = Boolean(s.tallCabinet && s.tallCabinet !== 'none');
      const tallW = hasTall ? (Number(s.tallCabinetWidth) || 600) / 1000 : 0;
      const tallBodyExtra = hasTall ? roundThousand(tallW * woodRate * 1.5) : 0;
      const tallDoorExtra = hasTall ? roundThousand(tallW * 2.2 * doorPrice) : 0;

      // ㄱ자/ㄴ자/ㄷ자 일체형 코너장 연결 가공 및 코너 대리석 접합 보강비
      const cornerCount = (isU || isP) ? 2 : (isL ? 1 : 0);
      const cornerExtra = cornerCount * 120000;

      bodyCost = roundThousand(totalM * woodRate) + tallBodyExtra + cornerExtra;

      const lowerDoorArea = totalM * 0.74;
      const upperDoorArea = s.hasUpperCabinets ? (upperM * ((Number(s.upperHeight) || 700) / 1000)) : 0;
      doorCost = roundThousand((lowerDoorArea + upperDoorArea) * doorPrice) + tallDoorExtra;

      topCost = roundThousand(
        totalM * topRate + (Number(settings.countertopHoleCut) || 60000)
      );

      // 사용자가 품목에서 직접 조정한 싱크볼 & 수전 조합 단가
      const sfCombo = s.sinkFaucetCombo || 'square_gooseneck';
      let sfPrice = 210000;
      const fixedSink = (settings.fixedItems || []).find(fi => fi.id === 'item-sink');
      const baseSinkPrice = fixedSink ? (parseInt(fixedSink.price) || 210000) : 210000;
      if (sfCombo === 'square_gooseneck') sfPrice = baseSinkPrice;
      else if (sfCombo === 'round_standard') sfPrice = 120000;
      else if (sfCombo === 'emboss_waterfall') sfPrice = 320000;
      else if (sfCombo === 'none') sfPrice = 0;

      // 사용자가 품목에서 직접 조정한 경첩 & 볼레일 하드웨어 조합 단가
      const hwCombo = s.hardwareCombo || 'damper_3ball';
      let hwPrice = 130000;
      const fixedHinge = (settings.fixedItems || []).find(fi => fi.id === 'item-hinge');
      const baseHingePrice = fixedHinge ? (parseInt(fixedHinge.price) || 130000) : 130000;
      if (hwCombo === 'damper_3ball') hwPrice = baseHingePrice;
      else if (hwCombo === 'standard_2ball') hwPrice = 70000;
      else if (hwCombo === 'hafele_under') hwPrice = 210000;
      else if (hwCombo === 'blum_tandem') hwPrice = 350000;

      // T5 LED 간접조명 (설정에서 활성 시)
      const fixedLed = (settings.fixedItems || []).find(fi => fi.id === 'item-led');
      const ledPrice = (fixedLed && fixedLed.enabled) ? (parseInt(fixedLed.price) || 60000) : 0;

      hardwareCost = sfPrice + hwPrice + ledPrice;

      installCost = roundThousand(
        (settings.installBase || 250000) + totalM * (settings.installPerMeter || 40000)
      );
    }

    const marginMultiplier = 1 + ((settings.marginPercent || 25) / 100);
    const rawTotal = bodyCost + doorCost + topCost + hardwareCost + installCost;
    const totalPrice = Math.max(10000, Math.round((rawTotal * marginMultiplier) / 10000) * 10000);
    const depositPrice = Math.round((totalPrice * ((settings.depositPercent || 10) / 100)) / 10000) * 10000;
    const balancePrice = Math.max(0, totalPrice - depositPrice);

    item.pricing = {
      woodBodyCost: bodyCost,
      doorVendorCost: doorCost,
      countertopCost: topCost,
      fixedItemsCost: hardwareCost,
      installCost: installCost,
      totalPrice,
      depositPrice,
      balancePrice
    };
  }

  // --- 다중 품목 일괄 발주 관리 시스템 ---

  function initOrderItems() {
    if (!state.items || state.items.length === 0) {
      const catMeta = FURNITURE_CATEGORIES.find(c => c.id === (state.spec.category || 'sink')) || FURNITURE_CATEGORIES[0];
      state.items = [{
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: `${catMeta.name} 1`,
        category: catMeta.id,
        spec: JSON.parse(JSON.stringify(state.spec)),
        selectedDoor: state.selectedDoor,
        pricing: { ...state.pricing }
      }];
      state.activeItemIndex = 0;
    }
  }

  function renderOrderItemsBar() {
    const pillsContainer = document.getElementById('order-items-pills');
    if (!pillsContainer) return;
    pillsContainer.innerHTML = '';

    state.items.forEach((item, idx) => {
      const catMeta = FURNITURE_CATEGORIES.find(c => c.id === item.category) || FURNITURE_CATEGORIES[0];
      const isActive = idx === state.activeItemIndex;
      const chip = document.createElement('div');
      chip.className = `order-item-chip ${isActive ? 'active' : ''}`;

      const priceText = item.pricing ? `${(item.pricing.totalPrice || 0).toLocaleString()}원` : '-';
      const widthVal = item.spec ? (item.spec.totalWidth || 2700) : 2700;

      chip.innerHTML = `
        <span class="chip-cat-icon">${catMeta.icon}</span>
        <div class="chip-meta">
          <div class="chip-name">${idx + 1}. ${item.name}</div>
          <div class="chip-sub">W${Number(widthVal).toLocaleString()} · ${priceText}</div>
        </div>
        ${state.items.length > 1 ? `<button type="button" class="chip-delete-btn" title="품목 삭제" data-idx="${idx}">&times;</button>` : ''}
      `;

      chip.addEventListener('click', (e) => {
        if (e.target.closest('.chip-delete-btn')) return;
        switchActiveItem(idx);
      });

      const delBtn = chip.querySelector('.chip-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteOrderItem(idx);
        });
      }

      pillsContainer.appendChild(chip);
    });

    // 상단 요약 뱃지 갱신
    const grandCountEl = document.getElementById('order-grand-count');
    if (grandCountEl) grandCountEl.innerText = state.items.length;
    const grandTotalEl = document.getElementById('order-grand-total');
    if (grandTotalEl) grandTotalEl.innerText = (state.orderGrandTotal || 0).toLocaleString() + '원';

    // 현재 활성 카테고리 뱃지 표시
    const activeItem = state.items[state.activeItemIndex] || state.items[0];
    if (activeItem) {
      const curCat = FURNITURE_CATEGORIES.find(c => c.id === activeItem.category) || FURNITURE_CATEGORIES[0];
      const badgeEl = document.getElementById('badge-current-cat');
      if (badgeEl) badgeEl.innerText = `${curCat.icon} ${activeItem.name}`;
      const titleEl = document.getElementById('label-active-cat-title');
      if (titleEl) titleEl.innerText = `0. 맞춤 품목: ${activeItem.name} (${curCat.name})`;
    }
  }

  function switchActiveItem(index) {
    if (index < 0 || index >= state.items.length) return;

    // 현재 작업 중이던 아이템 상태 저장
    if (state.items[state.activeItemIndex]) {
      state.items[state.activeItemIndex].spec = JSON.parse(JSON.stringify(state.spec));
      state.items[state.activeItemIndex].selectedDoor = state.selectedDoor;
    }

    state.activeItemIndex = index;
    const nextItem = state.items[index];
    state.spec = JSON.parse(JSON.stringify(nextItem.spec));
    if (nextItem.selectedDoor) state.selectedDoor = nextItem.selectedDoor;

    syncFormInputsFromSpec();
    syncVisualEngines();
    calculateQuote();
  }

  function syncFormInputsFromSpec() {
    const s = state.spec;
    const cat = s.category || 'sink';
    const catMeta = FURNITURE_CATEGORIES.find(c => c.id === cat) || FURNITURE_CATEGORIES[0];

    // 가로 폭
    if (sliderTotalW) sliderTotalW.value = s.totalWidth;
    if (inputTotalW) inputTotalW.value = s.totalWidth;
    const valTotalW = document.getElementById('val-total-w');
    if (valTotalW) valTotalW.innerText = `${Number(s.totalWidth).toLocaleString()} mm`;

    // 하부 분할
    if (inputSinkW) inputSinkW.value = s.sinkBayWidth || 1000;
    if (inputPrepW) inputPrepW.value = s.prepBayWidth || 800;
    if (inputCookW) inputCookW.value = s.cooktopBayWidth || 900;
    if (inputLowerH) inputLowerH.value = s.lowerHeight || 860;
    if (inputLowerD) inputLowerD.value = s.lowerDepth || 600;
    if (inputUpperH) inputUpperH.value = s.upperHeight || 700;

    // 날개 길이
    const sideInp = document.getElementById('input-side-len');
    if (sideInp) sideInp.value = s.sideLength || 1800;

    // 레이아웃 버튼 활성화
    const activeLayout = s.layoutType || 'straight';
    document.querySelectorAll('#studio-layout-group .layout-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === activeLayout);
    });
    const wingBox = document.getElementById('wing-config-box');
    if (wingBox) {
      wingBox.style.display = (activeLayout === 'straight') ? 'none' : 'block';
    }

    // 도어 카드 갱신
    updateSelectedDoorCard();

    // 붙박이장 전용 도어 방식 동기화
    const wardrobeBox = document.getElementById('wardrobe-config-box');
    if (wardrobeBox) {
      wardrobeBox.style.display = (cat === 'wardrobe') ? 'block' : 'none';
      const doorType = s.wardrobeDoorType || 'sliding';
      wardrobeBox.querySelectorAll('[data-wardrobe-door]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.wardrobeDoor === doorType);
      });
    }
  }

  function addNewOrderItem(categoryId) {
    const catMeta = FURNITURE_CATEGORIES.find(c => c.id === categoryId) || FURNITURE_CATEGORIES[0];
    const sameCount = state.items.filter(i => i.category === categoryId).length;
    const itemName = `${catMeta.name} ${sameCount + 1}`;

    const newSpec = {
      ...state.spec,
      category: categoryId,
      layoutType: 'straight',
      totalWidth: catMeta.defaultW || 1800,
      lowerHeight: catMeta.defaultH || 860,
      lowerDepth: catMeta.defaultD || 600,
      sinkBayWidth: Math.round((catMeta.defaultW || 1800) * 0.37),
      cooktopBayWidth: Math.round((catMeta.defaultW || 1800) * 0.33),
      prepBayWidth: (catMeta.defaultW || 1800) - Math.round((catMeta.defaultW || 1800) * 0.37) - Math.round((catMeta.defaultW || 1800) * 0.33),
      hasUpperCabinets: catMeta.hasUpper !== false
    };

    if (categoryId === 'wardrobe') {
      newSpec.wardrobeDepth = catMeta.defaultD || 650;
      newSpec.ceilingHeight = 2350;
      newSpec.wardrobeDoorType = 'sliding'; // 기본값: 프리미엄 슬라이딩 미닫이 도어
    } else if (categoryId === 'island') {
      newSpec.islandDepth = catMeta.defaultD || 850;
    }

    const newItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: itemName,
      category: categoryId,
      spec: newSpec,
      selectedDoor: state.selectedDoor,
      pricing: {}
    };

    calculateSingleItemPricing(newItem);
    state.items.push(newItem);
    switchActiveItem(state.items.length - 1);

    const modal = document.getElementById('modal-add-category');
    if (modal) modal.style.display = 'none';
    showToast(`신규 품목 [${itemName}]이(가) 발주 목록에 추가되었습니다.`);
  }

  function changeCurrentItemCategory(categoryId) {
    const curItem = state.items[state.activeItemIndex];
    if (!curItem) return;
    const catMeta = FURNITURE_CATEGORIES.find(c => c.id === categoryId) || FURNITURE_CATEGORIES[0];
    curItem.category = categoryId;
    curItem.name = `${catMeta.name} ${state.activeItemIndex + 1}`;

    state.spec.category = categoryId;
    state.spec.totalWidth = catMeta.defaultW || state.spec.totalWidth;
    state.spec.lowerHeight = catMeta.defaultH || state.spec.lowerHeight;
    state.spec.lowerDepth = catMeta.defaultD || state.spec.lowerDepth;
    state.spec.hasUpperCabinets = catMeta.hasUpper !== false;
    if (categoryId !== 'sink' && categoryId !== 'prep_counter' && categoryId !== 'base_corner') {
      state.spec.layoutType = 'straight';
    }

    curItem.spec = JSON.parse(JSON.stringify(state.spec));

    syncFormInputsFromSpec();
    syncVisualEngines();
    calculateQuote();

    const modal = document.getElementById('modal-add-category');
    if (modal) modal.style.display = 'none';
    showToast(`현재 가구 품목이 [${catMeta.name}](으)로 변경되었습니다.`);
  }

  function deleteOrderItem(index) {
    if (state.items.length <= 1) {
      alert('발주 목록에는 최소 1개 이상의 맞춤 가구 품목이 필요합니다.');
      return;
    }
    const target = state.items[index];
    if (!confirm(`[${target.name}] 품목을 발주 목록에서 삭제하시겠습니까?`)) return;

    state.items.splice(index, 1);
    if (state.activeItemIndex >= state.items.length) {
      state.activeItemIndex = state.items.length - 1;
    }

    const cur = state.items[state.activeItemIndex];
    state.spec = JSON.parse(JSON.stringify(cur.spec));
    if (cur.selectedDoor) state.selectedDoor = cur.selectedDoor;

    syncFormInputsFromSpec();
    syncVisualEngines();
    calculateQuote();
    showToast(`[${target.name}] 품목이 발주 목록에서 삭제되었습니다.`);
  }

  let currentCategoryModalMode = 'add'; // 'add' or 'change'

  function openCategoryModal(mode = 'add') {
    currentCategoryModalMode = mode;
    const modal = document.getElementById('modal-add-category');
    const grid = document.getElementById('category-picker-grid');
    if (!modal || !grid) return;

    const modalTitle = modal.querySelector('.modal-title');
    if (modalTitle) {
      modalTitle.innerText = mode === 'add' ? '➕ 신규 맞춤 가구 품목 추가' : '🔄 맞춤 가구 종류 변경';
    }

    grid.innerHTML = '';
    FURNITURE_CATEGORIES.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-card';
      const isSelected = (mode === 'change' && state.spec.category === cat.id);
      if (isSelected) card.style.borderColor = 'var(--brand)';

      card.innerHTML = `
        <div class="cat-card-icon">${cat.icon}</div>
        <div class="cat-card-title">${cat.name}</div>
        <div class="cat-card-desc">${cat.desc}</div>
        <div class="cat-card-spec">기본: W${cat.defaultW} × D${cat.defaultD} × H${cat.defaultH}mm</div>
      `;

      card.addEventListener('click', () => {
        if (currentCategoryModalMode === 'add') {
          addNewOrderItem(cat.id);
        } else {
          changeCurrentItemCategory(cat.id);
        }
      });

      grid.appendChild(card);
    });

    modal.style.display = 'flex';
  }

  function calculateQuote() {
    if (!settings) return;

    if (!state.items || state.items.length === 0) {
      initOrderItems();
    }

    const curItem = state.items[state.activeItemIndex] || state.items[0];
    if (curItem) {
      curItem.spec = { ...state.spec };
      curItem.selectedDoor = state.selectedDoor;
    }

    let grandTotal = 0;
    let grandDeposit = 0;
    let grandBalance = 0;

    state.items.forEach(item => {
      calculateSingleItemPricing(item);
      grandTotal += item.pricing.totalPrice;
      grandDeposit += item.pricing.depositPrice;
      grandBalance += item.pricing.balancePrice;
    });

    if (curItem && curItem.pricing) {
      state.pricing = curItem.pricing;
    }
    state.orderGrandTotal = grandTotal;
    state.orderGrandDeposit = grandDeposit;
    state.orderGrandBalance = grandBalance;

    updateQuoteUI();
    renderOrderItemsBar();
  }

  function updateQuoteUI() {
    if (!state.pricing) return;
    document.getElementById('cost-wood-body').innerText = (state.pricing.woodBodyCost || 0).toLocaleString() + '원';
    document.getElementById('cost-door-vendor').innerText = (state.pricing.doorVendorCost || 0).toLocaleString() + '원';
    document.getElementById('cost-countertop').innerText = (state.pricing.countertopCost || 0).toLocaleString() + '원';
    document.getElementById('cost-fixed-items').innerText = (state.pricing.fixedItemsCost || 0).toLocaleString() + '원';
    document.getElementById('cost-install').innerText = (state.pricing.installCost || 0).toLocaleString() + '원';

    document.getElementById('quote-margin-label').innerText = `영업/제작 마진 (${settings.marginPercent || 25}%) 포함`;
    document.getElementById('quote-total-price').innerText = (state.pricing.totalPrice || 0).toLocaleString() + '원';
    document.getElementById('quote-deposit-label').innerText = `발주 확정 계약금 (${settings.depositPercent || 10}%)`;
    document.getElementById('quote-deposit-price').innerText = (state.pricing.depositPrice || 0).toLocaleString() + '원';

    const grandCountEl = document.getElementById('order-grand-count');
    if (grandCountEl) grandCountEl.innerText = state.items.length;
    const grandTotalEl = document.getElementById('order-grand-total');
    if (grandTotalEl) grandTotalEl.innerText = state.orderGrandTotal.toLocaleString() + '원';

    // 영업사원 실측 워크벤치 요약도 함께 실시간 갱신
    const fWood = document.getElementById('field-cost-wood');
    if (fWood) fWood.innerText = (state.pricing.woodBodyCost || 0).toLocaleString() + '원';
    const fDoor = document.getElementById('field-cost-door');
    if (fDoor) fDoor.innerText = (state.pricing.doorVendorCost || 0).toLocaleString() + '원';
    const fTop = document.getElementById('field-cost-top');
    if (fTop) fTop.innerText = state.pricing.countertopCost.toLocaleString() + '원';
    const fHw = document.getElementById('field-cost-hw');
    if (fHw) fHw.innerText = state.pricing.fixedItemsCost.toLocaleString() + '원';
    const fInst = document.getElementById('field-cost-install');
    if (fInst) fInst.innerText = state.pricing.installCost.toLocaleString() + '원';
    const fTot = document.getElementById('field-total-price');
    if (fTot) fTot.innerText = state.pricing.totalPrice.toLocaleString() + '원';
    const fDep = document.getElementById('field-deposit-price');
    if (fDep) fDep.innerText = state.pricing.depositPrice.toLocaleString() + '원';

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

  // 4. 네비게이션 뷰 전환 (PC 사이드바 + 모바일 상단/하단 전환)
  const navViews = ['studio', 'drawing', 'field', 'orders', 'company', 'settings', 'doors', 'dev'];
  const pageTitles = {
    studio: { title: '3D 도면 설계 및 현장 실측', desc: '주방 모듈별 치수 입력 및 실시간 3D 시뮬레이션과 견적을 산출합니다.' },
    drawing: { title: '📐 평면 도면 직접 드로잉 스튜디오', desc: '방 크기를 설정하고 마우스로 벽체와 맞춤 가구 모듈을 자유롭게 배치하여 3D 및 견적으로 즉시 변환합니다.' },
    field: { title: '영업사원 현장 실측 & 발주 관리 워크벤치', desc: '현장 실측 치수(전체길이, 천장고, 키큰장, 하부/상부 모듈, 배관위치, 체크리스트)를 정밀 입력하고 도면과 견적을 즉시 연동합니다.' },
    orders: { title: '수주 및 고객 견적 관리', desc: '발송된 견적 현황과 계약서 서명, 입금 완료 및 누적 매출을 관리합니다.' },
    company: { title: '피앙세가구 사업자 정보 관리', desc: '상호명, 대표자, 사업자등록번호, 주소, 입금 계좌 및 직인을 관리하며 계약서와 문자에 자동 연동됩니다.' },
    settings: { title: '자재별 고정 단가표 설정', desc: '원목 몸통, 대리석 상판 단가, 기본 시공비, 마진율 및 고정 부속품을 직접 수정합니다.' },
    doors: { title: '기성품 도어 카탈로그 관리', desc: '외주 도어 업체별 모델과 헤베(m²)당 단가를 등록하고 수정합니다.' },
    dev: { title: 'AI 개발자 실시간 수정 & 자율 반영 센터', desc: '요구사항을 등록하시면 별도의 채팅 없이도 AI가 10초마다 자동 감지하여 즉시 코드를 수정하고 배포합니다.' }
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

    if (viewName === 'drawing') initDrawingCadEngine();
    if (viewName === 'field') syncFieldFormFromState();
    if (viewName === 'orders') loadOrdersTable();
    if (viewName === 'company') populateCompanyForm();
    if (viewName === 'doors') renderDoorAdminTable();
    if (viewName === 'dev') loadDevRequests();
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

  // 5-0-B. 키큰장 / 가전수납장 스튜디오 컨트롤 바인딩
  const selTallPos = document.getElementById('select-tall-pos');
  const inpTallW = document.getElementById('input-tall-w');
  const selTallType = document.getElementById('select-tall-type');

  if (selTallPos) {
    selTallPos.addEventListener('change', e => {
      state.spec.tallCabinet = e.target.value;
      const fTall = document.getElementById('field-tall-pos');
      if (fTall) fTall.value = state.spec.tallCabinet;
      syncVisualEngines();
      calculateQuote();
    });
  }
  if (inpTallW) {
    inpTallW.addEventListener('change', e => {
      state.spec.tallCabinetWidth = Math.max(400, Math.min(1200, parseInt(e.target.value, 10) || 600));
      inpTallW.value = state.spec.tallCabinetWidth;
      const fTallW = document.getElementById('field-tall-w');
      if (fTallW) fTallW.value = state.spec.tallCabinetWidth;
      syncVisualEngines();
      calculateQuote();
    });
  }
  if (selTallType) {
    selTallType.addEventListener('change', e => {
      state.spec.tallCabinetType = e.target.value;
      const fTallT = document.getElementById('field-tall-type');
      if (fTallT) fTallT.value = state.spec.tallCabinetType;
      syncVisualEngines();
      calculateQuote();
    });
  }

  // 5-1. 3D 모델뷰 <-> 집안 전체 3D <-> 2D 평면/입면도 전환
  const canvasBoxEl = document.getElementById('canvas-container');
  const planBoxEl = document.getElementById('plan2d-container');
  const houseCamBtnIds = ['btn-cam-house', 'btn-cam-kitchen', 'btn-cam-bedroom', 'btn-cam-living'];

  document.querySelectorAll('[data-viewmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewmode;
      document.querySelectorAll('[data-viewmode]').forEach(b => b.classList.toggle('active', b.dataset.viewmode === mode));

      const stdCamBtns = document.querySelectorAll('.viewer-toolbar [data-cam="iso"], .viewer-toolbar [data-cam="cad_iso"], .viewer-toolbar [data-cam="front"], .viewer-toolbar [data-cam="top"]');

      if (mode === '2d') {
        if (canvasBoxEl) canvasBoxEl.style.display = 'none';
        if (planBoxEl) planBoxEl.style.display = 'block';
        if (plan2dEngine) plan2dEngine.updateSpec(state.spec);
      } else if (mode === 'full_house') {
        if (planBoxEl) planBoxEl.style.display = 'none';
        if (canvasBoxEl) canvasBoxEl.style.display = 'block';
        if (engine) {
          engine.resize();
          engine.setFullHouseMode(state.items, true);
        }
        houseCamBtnIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'inline-flex';
        });
        stdCamBtns.forEach(b => b.style.display = 'none');
        showToast('🏠 발주된 모든 가구를 가상 실내 하우스에 통합 배치했습니다!');
      } else {
        if (planBoxEl) planBoxEl.style.display = 'none';
        if (canvasBoxEl) canvasBoxEl.style.display = 'block';
        if (engine) {
          engine.resize();
          engine.setFullHouseMode(state.items, false);
        }
        houseCamBtnIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
        stdCamBtns.forEach(b => b.style.display = 'inline-flex');
      }
    });
  });

  // 상단 헤더 빠른 집안 전체 3D 바로가기 버튼
  const btnQuickHouse = document.getElementById('btn-quick-fullhouse');
  if (btnQuickHouse) {
    btnQuickHouse.addEventListener('click', () => {
      const fullHouseBtn = document.getElementById('btn-viewmode-fullhouse');
      if (fullHouseBtn) fullHouseBtn.click();
    });
  }

  // 5-1-B. 붙박이장 도어 방식 선택 (슬라이딩 미닫이 레일 vs 여닫이 스윙)
  document.querySelectorAll('[data-wardrobe-door]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.wardrobeDoor;
      document.querySelectorAll('[data-wardrobe-door]').forEach(b => b.classList.toggle('active', b === btn));
      state.spec.wardrobeDoorType = type;
      if (state.items && state.items[state.activeItemIndex]) {
        state.items[state.activeItemIndex].spec.wardrobeDoorType = type;
      }
      syncVisualEngines();
      showToast(`붙박이장 도어가 [${type === 'sliding' ? '슬라이딩 미닫이 레일' : '여닫이 스윙 도어'}](으)로 설정되었습니다.`);
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
  const selSinkFaucet = document.getElementById('select-sink-faucet-combo');
  if (selSinkFaucet) {
    selSinkFaucet.addEventListener('change', e => {
      state.spec.sinkFaucetCombo = e.target.value;
      const fS = document.getElementById('field-select-sink-faucet');
      if (fS) fS.value = state.spec.sinkFaucetCombo;
      calculateQuote();
      syncVisualEngines();
    });
  }
  const selHw = document.getElementById('select-hardware-combo');
  if (selHw) {
    selHw.addEventListener('change', e => {
      state.spec.hardwareCombo = e.target.value;
      const fH = document.getElementById('field-select-hardware');
      if (fH) fH.value = state.spec.hardwareCombo;
      calculateQuote();
    });
  }

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

  const btnCadToggle = document.getElementById('btn-cad-toggle');
  if (btnCadToggle) {
    btnCadToggle.addEventListener('click', () => {
      if (!engine) return;
      const isShow = engine.toggleCadEdges();
      btnCadToggle.classList.toggle('active', isShow);
    });
  }

  const btnCalloutToggle = document.getElementById('btn-callout-toggle');
  if (btnCalloutToggle) {
    btnCalloutToggle.addEventListener('click', () => {
      if (!engine) return;
      const isShow = engine.toggleCallouts();
      btnCalloutToggle.classList.toggle('active', isShow);
    });
  }

  document.getElementById('btn-capture-3d').addEventListener('click', () => {
    if (!engine) return;
    const url = engine.captureImage(2);
    const a = document.createElement('a');
    a.href = url;
    a.download = `싱크대-3D도면-${Date.now()}.jpg`;
    a.click();
    showToast('고화질 3D 도면 이미지가 저장되었습니다.');
  });

  // -------------------------------------------------------------
  // [신규] 🏠 집안 전체 공간 수정 권한 컨트롤러 (Full House Authority)
  // -------------------------------------------------------------
  function setupHouseAuthorityControls() {
    // 1. 구역별 가구 표시 토글
    document.querySelectorAll('.zone-vis-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const zone = e.target.dataset.zone;
        if (engine) engine.setZoneVisibility(zone, e.target.checked);
      });
    });

    // 2. 골조 투시 모드 (X-Ray)
    const btnXRay = document.getElementById('btn-toggle-xray');
    let isXRay = false;
    if (btnXRay) {
      btnXRay.addEventListener('click', () => {
        isXRay = !isXRay;
        btnXRay.classList.toggle('active', isXRay);
        btnXRay.style.background = isXRay ? 'var(--brand)' : '';
        btnXRay.style.color = isXRay ? '#fff' : '';
        if (engine) engine.toggleXRayMode(isXRay);
        showToast(isXRay ? '👻 골조 투시 모드(X-Ray)가 활성화되었습니다.' : '골조 투시 모드가 해제되었습니다.');
      });
    }

    // 3. 전체 조명 색온도
    const selKelvin = document.getElementById('select-house-kelvin');
    if (selKelvin) {
      selKelvin.addEventListener('change', (e) => {
        const k = parseInt(e.target.value) || 4000;
        if (engine) engine.setLightTemperature(k);
        showToast(`전체 조명 색온도가 ${k}K로 설정되었습니다.`);
      });
    }
  }

  // -------------------------------------------------------------
  // [신규] 📐 평면 도면 직접 드로잉 스튜디오 엔진 초기화 및 이벤트
  // -------------------------------------------------------------
  function initDrawingCadEngine() {
    if (!drawingEngine) {
      const container = document.getElementById('drawing-cad-container');
      if (container && typeof DrawingCadEngine !== 'undefined') {
        drawingEngine = new DrawingCadEngine(container);
        setupDrawingCadControls();
      }
    } else {
      setTimeout(() => drawingEngine.resizeCanvas(), 50);
    }
  }

  function setupDrawingCadControls() {
    // 1. 3D 변환 및 견적 산출 버튼
    const btnConvert = document.getElementById('btn-drawing-convert-3d');
    if (btnConvert) {
      btnConvert.addEventListener('click', () => {
        if (!drawingEngine) return;
        const res = drawingEngine.exportTo3DAndQuote();
        if (!res) return;

        // state.spec 갱신
        Object.assign(state.spec, res.kitchenSpec);
        // state.items 갱신
        state.items = res.allItems;
        state.activeItemIndex = 0;

        renderOrderItemTabs();
        syncFormInputsFromSpec();
        calculateQuote();

        // 3D 뷰로 전환 및 3D 렌더링
        switchView('studio');
        setTimeout(() => {
          if (engine) {
            if (state.items.length > 1) {
              const fullHouseBtn = document.getElementById('btn-viewmode-fullhouse');
              if (fullHouseBtn) fullHouseBtn.click();
            } else {
              engine.updateSpec(state.spec);
              engine.setCameraPreset('cad_iso');
            }
          }
          showToast(`🎉 드로잉 도면의 ${state.items.length}개 가구 모듈이 3D 시뮬레이션과 발주 견적으로 즉시 변환되었습니다!`);
        }, 120);
      });
    }

    // 2. 도면 PNG 내보내기
    const btnPng = document.getElementById('btn-drawing-export-png');
    if (btnPng) {
      btnPng.addEventListener('click', () => {
        if (drawingEngine) drawingEngine.exportAsPNG();
      });
    }

    // 3. 초기화
    const btnReset = document.getElementById('btn-drawing-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('평면 도면의 모든 가구 배치를 초기화하시겠습니까?')) {
          if (drawingEngine) drawingEngine.clearCanvas();
        }
      });
    }

    // 4. 방 크기 프리셋
    document.querySelectorAll('.cad-room-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cad-room-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const w = parseInt(btn.dataset.w);
        const d = parseInt(btn.dataset.d);
        const layout = btn.dataset.layout;
        const inpW = document.getElementById('input-cad-room-w');
        const inpD = document.getElementById('input-cad-room-d');
        if (inpW) inpW.value = w;
        if (inpD) inpD.value = d;
        if (drawingEngine) drawingEngine.setRoomSize(w, d, layout);
      });
    });

    // 5. 방 크기 직접 적용
    const btnApplyRoom = document.getElementById('btn-apply-cad-room');
    if (btnApplyRoom) {
      btnApplyRoom.addEventListener('click', () => {
        const w = parseInt(document.getElementById('input-cad-room-w').value);
        const d = parseInt(document.getElementById('input-cad-room-d').value);
        if (drawingEngine) drawingEngine.setRoomSize(w, d);
        showToast(`방 크기가 ${w.toLocaleString()} × ${d.toLocaleString()}mm로 설정되었습니다.`);
      });
    }

    // 6. 가구 스탬프 팔레트 버튼 클릭
    document.querySelectorAll('.cad-stamp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!drawingEngine) return;
        const type = btn.dataset.type;
        const name = btn.dataset.name;
        const w = parseInt(btn.dataset.w);
        const d = parseInt(btn.dataset.d);
        const category = btn.dataset.cat;
        drawingEngine.addItem({ type, name, w, d, category, x: 0, y: 0 });
        showToast(`[${name}] 모듈이 도면에 추가되었습니다.`);
      });
    });

    // 7. 툴 선택 (선택 vs 벽체 펜)
    const btnToolSelect = document.getElementById('btn-cad-tool-select');
    const btnToolWall = document.getElementById('btn-cad-tool-wall');
    if (btnToolSelect && btnToolWall) {
      btnToolSelect.addEventListener('click', () => {
        btnToolSelect.classList.add('active');
        btnToolWall.classList.remove('active');
        if (drawingEngine) drawingEngine.activeTool = 'select';
      });
      btnToolWall.addEventListener('click', () => {
        btnToolWall.classList.add('active');
        btnToolSelect.classList.remove('active');
        if (drawingEngine) drawingEngine.activeTool = 'wall_pen';
        showToast('벽체 그리기 모드: 마우스를 클릭하고 드래그하여 벽체를 그리세요.');
      });
    }

    // 8. 화면 맞춤
    const btnFit = document.getElementById('btn-cad-fit');
    if (btnFit) {
      btnFit.addEventListener('click', () => {
        if (drawingEngine) drawingEngine.fitToScreen();
      });
    }
  }

  // 5-5. 영업사원 현장 실측 워크벤치 양방향 동기화 및 이벤트
  function syncFieldFormFromState() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined ? val : '';
    };

    setVal('field-total-w', state.spec.totalWidth);
    setVal('field-side-len', state.spec.sideLength);
    setVal('field-ceiling-h', state.spec.ceilingHeight || 2350);
    setVal('field-lower-d', state.spec.lowerDepth);
    setVal('field-plinth-h', state.spec.plinthHeight || 120);
    setVal('field-top-t', state.spec.topThickness || 40);

    setVal('field-tall-pos', state.spec.tallCabinet || 'none');
    setVal('field-tall-w', state.spec.tallCabinetWidth || 600);
    setVal('field-tall-type', state.spec.tallCabinetType || 'appliance');

    setVal('field-sink-w', state.spec.sinkBayWidth);
    setVal('field-prep-w', state.spec.prepBayWidth);
    setVal('field-cook-w', state.spec.cooktopBayWidth);

    const chkUpper = document.getElementById('field-check-upper');
    if (chkUpper) chkUpper.checked = Boolean(state.spec.hasUpperCabinets);
    setVal('field-upper-h', state.spec.upperHeight);
    setVal('field-upper-d', state.spec.upperDepth);
    setVal('field-midway-h', state.spec.midwayHeight);

    setVal('field-select-hood', state.spec.hoodType);
    setVal('field-select-cooktop', state.spec.cooktopType);
    setVal('field-select-faucet', state.spec.faucetType);
    setVal('field-select-sink-faucet', state.spec.sinkFaucetCombo || 'square_gooseneck');
    setVal('field-select-hardware', state.spec.hardwareCombo || 'damper_3ball');

    const dateEl = document.getElementById('field-measure-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().slice(0, 10);
    }

    document.querySelectorAll('[data-field-layout]').forEach(b => {
      b.classList.toggle('active', b.dataset.fieldLayout === state.spec.layoutType);
    });
    const wingWrap = document.getElementById('field-wing-len-wrap');
    if (wingWrap) {
      wingWrap.style.display = (state.spec.layoutType === 'straight') ? 'none' : 'block';
    }

    updateQuoteUI();
  }

  function bindFieldFormEvents() {
    // 레이아웃 알약 버튼
    document.querySelectorAll('[data-field-layout]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-field-layout]').forEach(b => b.classList.toggle('active', b === btn));
        state.spec.layoutType = btn.dataset.fieldLayout;
        const studioBtn = document.querySelector(`[data-layout="${state.spec.layoutType}"]`);
        if (studioBtn) studioBtn.click();
        const wingWrap = document.getElementById('field-wing-len-wrap');
        if (wingWrap) wingWrap.style.display = (state.spec.layoutType === 'straight') ? 'none' : 'block';
        syncVisualEngines();
        calculateQuote();
      });
    });

    // 주벽 전체 길이
    const fTotalW = document.getElementById('field-total-w');
    if (fTotalW) {
      fTotalW.addEventListener('change', e => {
        syncWidths(e.target.value);
      });
    }

    // 날개벽 길이
    const fSideLen = document.getElementById('field-side-len');
    if (fSideLen) {
      fSideLen.addEventListener('change', e => {
        state.spec.sideLength = Math.max(1000, parseInt(e.target.value, 10) || 1800);
        if (inputSideLen) inputSideLen.value = state.spec.sideLength;
        syncVisualEngines();
        calculateQuote();
      });
    }

    // 천장고
    const fCeilH = document.getElementById('field-ceiling-h');
    if (fCeilH) {
      fCeilH.addEventListener('change', e => {
        state.spec.ceilingHeight = Math.max(2000, Math.min(3200, parseInt(e.target.value, 10) || 2350));
        const sCeil = document.getElementById('input-ceiling-h');
        if (sCeil) sCeil.value = state.spec.ceilingHeight;
        syncVisualEngines();
      });
    }

    // 하부 깊이 / 걸레받이 / 상판 두께
    const fLowerD = document.getElementById('field-lower-d');
    if (fLowerD) {
      fLowerD.addEventListener('change', e => {
        state.spec.lowerDepth = parseInt(e.target.value, 10) || 600;
        inputLowerD.value = state.spec.lowerDepth;
        syncVisualEngines();
        calculateQuote();
      });
    }
    const fPlinthH = document.getElementById('field-plinth-h');
    if (fPlinthH) {
      fPlinthH.addEventListener('change', e => {
        state.spec.plinthHeight = parseInt(e.target.value, 10) || 120;
        syncVisualEngines();
      });
    }
    const fTopT = document.getElementById('field-top-t');
    if (fTopT) {
      fTopT.addEventListener('change', e => {
        state.spec.topThickness = parseInt(e.target.value, 10) || 40;
        syncVisualEngines();
      });
    }

    // 키큰장
    const fTallPos = document.getElementById('field-tall-pos');
    if (fTallPos) {
      fTallPos.addEventListener('change', e => {
        state.spec.tallCabinet = e.target.value;
        if (selTallPos) selTallPos.value = state.spec.tallCabinet;
        syncVisualEngines();
        calculateQuote();
      });
    }
    const fTallW = document.getElementById('field-tall-w');
    if (fTallW) {
      fTallW.addEventListener('change', e => {
        state.spec.tallCabinetWidth = Math.max(400, Math.min(1200, parseInt(e.target.value, 10) || 600));
        if (inpTallW) inpTallW.value = state.spec.tallCabinetWidth;
        syncVisualEngines();
        calculateQuote();
      });
    }
    const fTallT = document.getElementById('field-tall-type');
    if (fTallT) {
      fTallT.addEventListener('change', e => {
        state.spec.tallCabinetType = e.target.value;
        if (selTallType) selTallType.value = state.spec.tallCabinetType;
        syncVisualEngines();
        calculateQuote();
      });
    }

    // 하부장 모듈 (개수대 / 조리대 / 가열대)
    const fSinkW = document.getElementById('field-sink-w');
    const fPrepW = document.getElementById('field-prep-w');
    const fCookW = document.getElementById('field-cook-w');
    [fSinkW, fPrepW, fCookW].forEach(el => {
      if (!el) return;
      el.addEventListener('change', () => {
        state.spec.sinkBayWidth = parseInt(fSinkW.value, 10) || 1000;
        state.spec.prepBayWidth = parseInt(fPrepW.value, 10) || 800;
        state.spec.cooktopBayWidth = parseInt(fCookW.value, 10) || 900;
        state.spec.totalWidth = state.spec.sinkBayWidth + state.spec.prepBayWidth + state.spec.cooktopBayWidth;
        sliderTotalW.value = state.spec.totalWidth;
        inputTotalW.value = state.spec.totalWidth;
        inputSinkW.value = state.spec.sinkBayWidth;
        inputPrepW.value = state.spec.prepBayWidth;
        inputCookW.value = state.spec.cooktopBayWidth;
        document.getElementById('val-total-w').innerText = `${state.spec.totalWidth.toLocaleString()} mm`;
        if (fTotalW) fTotalW.value = state.spec.totalWidth;
        syncVisualEngines();
        calculateQuote();
      });
    });

    // 상부장 토글 및 치수
    const fChkUpper = document.getElementById('field-check-upper');
    if (fChkUpper) {
      fChkUpper.addEventListener('change', e => {
        state.spec.hasUpperCabinets = e.target.checked;
        const chkBox = document.getElementById('check-upper-cabinets');
        if (chkBox) chkBox.checked = state.spec.hasUpperCabinets;
        const uBox = document.getElementById('field-upper-config-box');
        if (uBox) uBox.style.display = state.spec.hasUpperCabinets ? 'grid' : 'none';
        syncVisualEngines();
        calculateQuote();
      });
    }
    const fUpperH = document.getElementById('field-upper-h');
    if (fUpperH) {
      fUpperH.addEventListener('change', e => {
        state.spec.upperHeight = parseInt(e.target.value, 10) || 700;
        inputUpperH.value = state.spec.upperHeight;
        syncVisualEngines();
        calculateQuote();
      });
    }
    const fUpperD = document.getElementById('field-upper-d');
    if (fUpperD) {
      fUpperD.addEventListener('change', e => {
        state.spec.upperDepth = parseInt(e.target.value, 10) || 350;
        syncVisualEngines();
      });
    }
    const fMidH = document.getElementById('field-midway-h');
    if (fMidH) {
      fMidH.addEventListener('change', e => {
        state.spec.midwayHeight = parseInt(e.target.value, 10) || 650;
        syncVisualEngines();
      });
    }

    // 기기 선택
    const fHood = document.getElementById('field-select-hood');
    if (fHood) {
      fHood.addEventListener('change', e => {
        state.spec.hoodType = e.target.value;
        const sH = document.getElementById('select-hood-type');
        if (sH) sH.value = state.spec.hoodType;
        syncVisualEngines();
      });
    }
    const fCook = document.getElementById('field-select-cooktop');
    if (fCook) {
      fCook.addEventListener('change', e => {
        state.spec.cooktopType = e.target.value;
        const sC = document.getElementById('select-cooktop-type');
        if (sC) sC.value = state.spec.cooktopType;
        syncVisualEngines();
      });
    }
    const fFaucet = document.getElementById('field-select-faucet');
    if (fFaucet) {
      fFaucet.addEventListener('change', e => {
        state.spec.faucetType = e.target.value;
        const sF = document.getElementById('select-faucet-type');
        if (sF) sF.value = state.spec.faucetType;
        syncVisualEngines();
      });
    }
    const fSinkFaucet = document.getElementById('field-select-sink-faucet');
    if (fSinkFaucet) {
      fSinkFaucet.addEventListener('change', e => {
        state.spec.sinkFaucetCombo = e.target.value;
        const sS = document.getElementById('select-sink-faucet-combo');
        if (sS) sS.value = state.spec.sinkFaucetCombo;
        calculateQuote();
        syncVisualEngines();
      });
    }
    const fHw = document.getElementById('field-select-hardware');
    if (fHw) {
      fHw.addEventListener('change', e => {
        state.spec.hardwareCombo = e.target.value;
        const sH = document.getElementById('select-hardware-combo');
        if (sH) sH.value = state.spec.hardwareCombo;
        calculateQuote();
      });
    }

    // 우측 액션 버튼들
    const btnGoto3D = document.getElementById('btn-field-goto-3d');
    if (btnGoto3D) {
      btnGoto3D.addEventListener('click', () => {
        switchView('studio');
        setTimeout(() => {
          if (engine) engine.setCameraPreset('cad_iso');
          document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('active', b.dataset.cam === 'cad_iso'));
          showToast('3D 도면 뷰(아이소메트릭)로 이동했습니다.');
        }, 100);
      });
    }

    const btnPrintSheet = document.getElementById('btn-field-print-sheet');
    if (btnPrintSheet) {
      btnPrintSheet.addEventListener('click', openFieldPrintSheet);
    }
    const btnCloseSheet = document.getElementById('btn-close-field-sheet');
    if (btnCloseSheet) {
      btnCloseSheet.addEventListener('click', () => {
        document.getElementById('modal-field-sheet').style.display = 'none';
      });
    }
    const btnDoPrint = document.getElementById('btn-do-print-sheet');
    if (btnDoPrint) {
      btnDoPrint.addEventListener('click', () => {
        window.print();
      });
    }

    const btnOpenQuote = document.getElementById('btn-field-open-quote');
    if (btnOpenQuote) {
      btnOpenQuote.addEventListener('click', () => {
        const cName = document.getElementById('field-client-name').value;
        const cPhone = document.getElementById('field-client-phone').value;
        const sName = document.getElementById('field-site-name').value;
        if (cName) document.getElementById('cust-name').value = cName;
        if (cPhone) document.getElementById('cust-phone').value = cPhone;
        if (sName) document.getElementById('cust-address').value = sName;
        document.getElementById('btn-open-submit').click();
      });
    }
  }

  function openFieldPrintSheet() {
    const siteName = document.getElementById('field-site-name')?.value || '현장 정보 미입력';
    const clientName = document.getElementById('field-client-name')?.value || '고객님';
    const clientPhone = document.getElementById('field-client-phone')?.value || '-';
    const repName = document.getElementById('field-rep-name')?.value || '영업담당';
    const measureDate = document.getElementById('field-measure-date')?.value || new Date().toISOString().slice(0, 10);
    const drainPos = document.getElementById('field-drain-pos')?.value || '500';
    const gasPos = document.getElementById('field-gas-pos')?.value || '2250';
    const notes = document.getElementById('field-notes')?.value || '특이사항 없음';

    const chkManifold = document.getElementById('chk-field-manifold')?.checked;
    const chkGas = document.getElementById('chk-field-gas')?.checked;
    const chkElevator = document.getElementById('chk-field-elevator')?.checked;
    const chkDemo = document.getElementById('chk-field-demo')?.checked;

    const isL = state.spec.layoutType === 'l_left' || state.spec.layoutType === 'l_right';
    const isU = state.spec.layoutType === 'u_shape';
    const isP = state.spec.layoutType === 'u_peninsula';
    let layoutLabel = '일자형 (I-Type)';
    if (isP) layoutLabel = 'ㄷ자형 (반도형 식탁 일체형)';
    else if (isU) layoutLabel = 'ㄷ자형 (양측 코너)';
    else if (isL) layoutLabel = state.spec.layoutType === 'l_left' ? 'ㄱ자형 (좌측 코너)' : 'ㄴ자형 (우측 코너)';

    const hasTall = state.spec.tallCabinet && state.spec.tallCabinet !== 'none';
    const tallLabel = hasTall ? `W:${state.spec.tallCabinetWidth} (${state.spec.tallCabinet === 'left' ? '좌' : '우'}측)` : '설치 안함';

    const modal = document.getElementById('modal-field-sheet');
    const container = document.getElementById('field-print-content');
    if (!modal || !container) return;

    container.innerHTML = `
      <div style="border:2px solid #2A211B; padding:22px 24px; background:#fff; color:#1F1915;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #2A211B; padding-bottom:12px; margin-bottom:14px;">
          <div>
            <div style="font-size:19px; font-weight:800; color:#2A211B;">${settings.companyName || '피앙세가구'} 현장 실측 체크시트 및 시공 지시서</div>
            <div style="font-size:11px; color:#6E6157; margin-top:3px;">주방 맞춤 가구 제작 공장 전용 실측 도면 연동 시트</div>
          </div>
          <div style="text-align:right; font-size:11.5px; color:#4A3B31;">
            <div><strong>실측일자:</strong> ${measureDate}</div>
            <div><strong>실측담당:</strong> ${repName}</div>
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11.5px;">
          <tr>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; width:20%; text-align:left;">현장명(단지/동호수)</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px; width:30%; font-weight:700;">${siteName}</td>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; width:20%; text-align:left;">고객 성함</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px; width:30%;">${clientName}</td>
          </tr>
          <tr>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; text-align:left;">고객 연락처</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px;">${clientPhone}</td>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; text-align:left;">구조 형태</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px; font-weight:700; color:#8C6239;">${layoutLabel}</td>
          </tr>
        </table>

        <div style="font-size:12.5px; font-weight:800; color:#2A211B; margin-bottom:6px;">■ 부위별 정밀 실측 치수 (단위: mm)</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11.5px; text-align:center;">
          <thead>
            <tr style="background:#EFEAE1; color:#2A211B;">
              <th style="border:1px solid #C8BFB3; padding:6px;">전체 폭(W1)</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">날개벽(W2)</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">천장고(CH)</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">키큰장 폭</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">개수대장</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">조리대장</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">가열대장</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">하부고</th>
              <th style="border:1px solid #C8BFB3; padding:6px;">상부고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid #C8BFB3; padding:6px; font-weight:700;">${state.spec.totalWidth}</td>
              <td style="border:1px solid #C8BFB3; padding:6px;">${isL ? state.spec.sideLength : '-'}</td>
              <td style="border:1px solid #C8BFB3; padding:6px;">${state.spec.ceilingHeight}</td>
              <td style="border:1px solid #C8BFB3; padding:6px; font-weight:700; color:#8C6239;">${tallLabel}</td>
              <td style="border:1px solid #C8BFB3; padding:6px;">${state.spec.sinkBayWidth}</td>
              <td style="border:1px solid #C8BFB3; padding:6px;">${state.spec.prepBayWidth}</td>
              <td style="border:1px solid #C8BFB3; padding:6px;">${state.spec.cooktopBayWidth}</td>
              <td style="border:1px solid #C8BFB3; padding:6px;">${state.spec.lowerHeight}</td>
              <td style="border:1px solid #C8BFB3; padding:6px;">${state.spec.hasUpperCabinets ? state.spec.upperHeight : '무상부'}</td>
            </tr>
            <tr style="background:#FAF7F2; font-size:11px;">
              <td colspan="9" style="border:1px solid #C8BFB3; padding:6px; text-align:left;">
                <strong>상세 규격:</strong> 하부 깊이 ${state.spec.lowerDepth}mm | 상부 깊이 ${state.spec.upperDepth}mm | 걸레받이 ${state.spec.plinthHeight}mm | 상판 두께 ${state.spec.topThickness}mm | 미드웨이 ${state.spec.midwayHeight}mm | 배수구 위치: 벽면 기준 ${drainPos}mm | 가스관/콘센트: ${gasPos}mm
              </td>
            </tr>
          </tbody>
        </table>

        <div style="font-size:12.5px; font-weight:800; color:#2A211B; margin-bottom:6px;">■ 자재 및 기기 확정 스펙</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11.5px;">
          <tr>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; width:18%; text-align:left;">몸통 구조</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px; width:32%;">공장 직영 친환경 원목 합판</td>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; width:18%; text-align:left;">기성 도어</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px; width:32%; font-weight:700;">${state.selectedDoor ? state.selectedDoor.name : '영림 프리미엄 매트화이트 PET'}</td>
          </tr>
          <tr>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; text-align:left;">인조대리석 상판</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px;">${settings.countertopName || 'LG 하이막스 오로라 화이트 (T40)'}</td>
            <th style="background:#FAF7F2; border:1px solid #C8BFB3; padding:6px 10px; text-align:left;">하드웨어</th>
            <td style="border:1px solid #C8BFB3; padding:6px 10px;">문앤문 110° 댐핑 경첩 + 3단 볼레일 서랍</td>
          </tr>
        </table>

        <div style="font-size:12.5px; font-weight:800; color:#2A211B; margin-bottom:6px;">■ 발주 맞춤 가구 품목 일괄 명세 (총 ${state.items.length}건)</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11.5px; text-align:center;">
          <thead>
            <tr style="background:#EFEAE1; color:#2A211B;">
              <th style="border:1px solid #C8BFB3; padding:6px; width:8%;">No.</th>
              <th style="border:1px solid #C8BFB3; padding:6px; width:22%;">품목명</th>
              <th style="border:1px solid #C8BFB3; padding:6px; width:34%;">규격(W×D×H mm) 및 레이아웃</th>
              <th style="border:1px solid #C8BFB3; padding:6px; width:20%;">도어 / 마감</th>
              <th style="border:1px solid #C8BFB3; padding:6px; width:16%;">공급가액</th>
            </tr>
          </thead>
          <tbody>
            ${state.items.map((it, idx) => `
              <tr>
                <td style="border:1px solid #C8BFB3; padding:6px; font-weight:700;">${idx + 1}</td>
                <td style="border:1px solid #C8BFB3; padding:6px; font-weight:700; text-align:left;">${it.name}</td>
                <td style="border:1px solid #C8BFB3; padding:6px; font-size:11px; text-align:left;">${getLayoutLabel(it.spec)}</td>
                <td style="border:1px solid #C8BFB3; padding:6px; font-size:11px;">${it.selectedDoor?.name || state.selectedDoor?.name || '기성 도어'}</td>
                <td style="border:1px solid #C8BFB3; padding:6px; font-weight:700; color:#8C6239; text-align:right;">${(it.pricing?.totalPrice || 0).toLocaleString()}원</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="font-size:12.5px; font-weight:800; color:#2A211B; margin-bottom:6px;">■ 현장 시공 체크리스트 및 특이사항</div>
        <div style="background:#FAF7F2; border:1px solid #C8BFB3; padding:8px 12px; font-size:11px; line-height:1.6; margin-bottom:14px;">
          <div>• <strong>온수 분배기:</strong> ${chkManifold ? '확인 완료 (간섭 없음 / 바닥판 따내기 사전 조율)' : '미확인 (재확인 요망)'}</div>
          <div>• <strong>가스/전기 배선:</strong> ${chkGas ? '인덕션 전용선 확인 완료' : '확인 요망'}</div>
          <div>• <strong>엘리베이터 양중:</strong> ${chkElevator ? '엘리베이터 사용 가능' : '사다리차 이용 필수 협의'}</div>
          <div>• <strong>철거 및 폐기:</strong> ${chkDemo ? '기존 싱크대 철거 및 폐기 반출 포함 (+200,000원)' : '고객 직접 철거 또는 신축'}</div>
          <div>• <strong>현장 특이사항:</strong> ${notes}</div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#F4EFE6; border:1.5px solid #8C6239; padding:10px 16px; border-radius:6px; margin-bottom:14px;">
          <div>
            <div style="font-size:11px; color:#4A3B31;">총 발주 합계 금액 (부가세/마진/시공비 일체 포함 · 총 ${state.items.length}개 품목)</div>
            <div style="font-size:17px; font-weight:800; color:#8C6239;">${state.orderGrandTotal.toLocaleString()}원</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11.5px; color:#6E6157;">발주 계약금 (${settings.depositPercent || 10}%): <strong>${state.orderGrandDeposit.toLocaleString()}원</strong></div>
            <div style="font-size:10.5px; color:#6E6157;">입금계좌: ${settings.bankName || '국민은행'} ${settings.bankAccount || '123402-04-567890'} (${settings.bankHolder || '피앙세가구'})</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; font-size:11.5px; padding-top:6px;">
          <div>실측 담당자: <strong>${repName}</strong> (서명)</div>
          <div>고객 확인: <strong>${clientName}</strong> (서명 또는 날인)</div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

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
    const cat = specObj.category || 'sink';
    const catMeta = FURNITURE_CATEGORIES.find(c => c.id === cat) || FURNITURE_CATEGORIES[0];
    if (specObj.layoutType === 'u_peninsula') {
      return `ㄷ자(아일랜드식탁형) ${Number(specObj.totalWidth).toLocaleString()} × ${Number(specObj.sideLength || 1800).toLocaleString()}mm`;
    }
    if (specObj.layoutType === 'u_shape') {
      return `ㄷ자(양측코너) ${Number(specObj.totalWidth).toLocaleString()} × ${Number(specObj.sideLength || 1800).toLocaleString()}mm`;
    }
    if (specObj.layoutType === 'l_left' || specObj.layoutType === 'l_right') {
      const dir = specObj.layoutType === 'l_left' ? '좌코너' : '우코너';
      return `ㄱ자(${dir}) ${Number(specObj.totalWidth).toLocaleString()} × ${Number(specObj.sideLength || 1800).toLocaleString()}mm`;
    }
    if (cat === 'sink' || cat === 'prep_counter') {
      return `일자형 전체 폭 ${Number(specObj.totalWidth).toLocaleString()}mm`;
    }
    return `${catMeta.name} W${Number(specObj.totalWidth).toLocaleString()} × D${Number(specObj.lowerDepth || catMeta.defaultD).toLocaleString()} × H${Number(specObj.lowerHeight || catMeta.defaultH).toLocaleString()}mm`;
  }

  document.getElementById('btn-open-submit').addEventListener('click', () => {
    const thumb = engine ? engine.captureImage(1.5) : '';
    document.getElementById('submit-thumb').src = thumb;

    const count = (state.items && state.items.length) || 1;
    let specSummary = '';
    if (count > 1) {
      specSummary = `[총 ${count}개 맞춤 가구 일괄 발주] ` + state.items.map((it, idx) => `${idx + 1}. ${it.name}(${getLayoutLabel(it.spec)})`).join(' / ');
    } else {
      const cur = state.items ? (state.items[0] || state) : state;
      specSummary = `${cur.name || '주방 씽크대'} — ${getLayoutLabel(cur.spec || state.spec)}`;
    }

    document.getElementById('submit-spec-summary').innerText = specSummary;
    document.getElementById('submit-door-summary').innerText = state.selectedDoor?.name || '기성 도어';
    document.getElementById('submit-total-summary').innerText = `${state.orderGrandTotal.toLocaleString()}원 (계약금 ${state.orderGrandDeposit.toLocaleString()}원 · 총 ${count}개 품목)`;
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

    // 현재 활성 아이템 스펙 저장 동기화
    if (state.items && state.items[state.activeItemIndex]) {
      state.items[state.activeItemIndex].spec = { ...state.spec };
      state.items[state.activeItemIndex].selectedDoor = state.selectedDoor;
    }

    const payloadItems = (state.items && state.items.length > 0)
      ? state.items.map(it => ({
          id: it.id,
          name: it.name,
          category: it.category,
          spec: {
            ...it.spec,
            layoutLabel: getLayoutLabel(it.spec),
            selectedDoorName: it.selectedDoor?.name || state.selectedDoor?.name,
            selectedDoorFinish: it.selectedDoor?.finish || state.selectedDoor?.finish,
            countertopName: it.spec?.countertopLabel || settings.countertopName,
            hoodLabel: getSelectedText(hoodSel),
            cooktopLabel: getSelectedText(cookSel),
            faucetLabel: getSelectedText(faucetSel),
            includedItems
          },
          pricing: it.pricing
        }))
      : [];

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          customerAddress: address,
          items: payloadItems,
          orderGrandTotal: state.orderGrandTotal,
          orderGrandDeposit: state.orderGrandDeposit,
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
          pricing: {
            ...state.pricing,
            totalPrice: state.orderGrandTotal,
            depositPrice: state.orderGrandDeposit,
            balancePrice: state.orderGrandBalance
          },
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
    const smsCompany = settings.companyName || '피앙세가구';
    const smsBank = `${settings.bankName || '국민은행'} ${settings.bankAccount || '123402-04-567890'} (예금주: ${settings.bankHolder || smsCompany})`;

    let itemsText = '';
    if (quote.items && quote.items.length > 0) {
      itemsText = quote.items.map((it, idx) => `  ${idx + 1}. ${it.name} (${(it.pricing?.totalPrice || 0).toLocaleString()}원)`).join('\n');
    } else {
      itemsText = `  1. ${quote.spec.layoutLabel || getLayoutLabel(quote.spec)}`;
    }

    const grandTot = (quote.orderGrandTotal || quote.pricing.totalPrice || 0).toLocaleString();
    const grandDep = (quote.orderGrandDeposit || quote.pricing.depositPrice || 0).toLocaleString();

    const smsText =
      `[${smsCompany} 맞춤 가구 일괄 공급계약]\n` +
      `${quote.customer.name}님, 실측 3D · 2D 평면 도면 및 정식 공급계약서가 도착했습니다.\n\n` +
      `• 발주 품목 (총 ${quote.items?.length || 1}건):\n${itemsText}\n\n` +
      `• 총 계약 공급가액: ${grandTot}원\n` +
      `• 발주 계약금(${settings.depositPercent || 10}%): ${grandDep}원\n` +
      `• 입금 계좌: ${smsBank}\n` +
      (settings.companyPhone ? `• 문의/상담: ${settings.companyPhone}\n\n` : '\n') +
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

  // 9-1. 전체 앱 상단 / 사이드바 브랜드 헤더 업데이트
  function updateAppBrandHeaders(name) {
    const brand = name || '피앙세가구';
    const mark = brand.charAt(0);
    const pName = document.getElementById('portal-brand-name');
    const pMark = document.getElementById('portal-brand-mark');
    const mName = document.getElementById('mobile-brand-name');
    const mMark = document.getElementById('mobile-brand-mark');
    const htmlTitle = document.getElementById('html-page-title');

    if (pName) pName.innerText = brand;
    if (pMark) pMark.innerText = mark;
    if (mName) mName.innerText = brand;
    if (mMark) mMark.innerText = mark;
    if (htmlTitle) htmlTitle.innerText = `${brand} — 맞춤 씽크대 3D 견적 & 포털`;
    document.title = `${brand} — 맞춤 씽크대 3D 견적 & 포털`;
  }

  // 9-2. 피앙세가구 사업자 정보 관리 폼 채우기 및 실시간 미리보기 연동
  function populateCompanyForm() {
    if (!settings) return;
    const nameEl = document.getElementById('biz-company-name');
    const ownerEl = document.getElementById('biz-company-owner');
    const biznoEl = document.getElementById('biz-company-bizno');
    const phoneEl = document.getElementById('biz-company-phone');
    const addrEl = document.getElementById('biz-company-address');
    const bankEl = document.getElementById('biz-bank-name');
    const acctEl = document.getElementById('biz-bank-account');
    const holderEl = document.getElementById('biz-bank-holder');
    const sealTopEl = document.getElementById('biz-seal-top');
    const sealBotEl = document.getElementById('biz-seal-bot');

    if (nameEl) nameEl.value = settings.companyName || '피앙세가구';
    if (ownerEl) ownerEl.value = settings.companyOwner || '대표 홍길동';
    if (biznoEl) biznoEl.value = settings.companyBizNo || '123-45-67890';
    if (phoneEl) phoneEl.value = settings.companyPhone || '010-0000-0000';
    if (addrEl) addrEl.value = settings.companyAddress || '경기도 남양주시 가구공단로 123';
    if (bankEl) bankEl.value = settings.bankName || '국민은행';
    if (acctEl) acctEl.value = settings.bankAccount || '123402-04-567890';
    if (holderEl) holderEl.value = settings.bankHolder || '피앙세가구';
    if (sealTopEl) sealTopEl.value = settings.sealTextTop || '피앙세';
    if (sealBotEl) sealBotEl.value = settings.sealTextBot || '가구인';

    updateCompanyLivePreview();
  }

  function updateCompanyLivePreview() {
    const name = (document.getElementById('biz-company-name')?.value || settings.companyName || '피앙세가구').trim();
    const owner = (document.getElementById('biz-company-owner')?.value || settings.companyOwner || '대표 홍길동').trim();
    const bizno = (document.getElementById('biz-company-bizno')?.value || settings.companyBizNo || '123-45-67890').trim();
    const phone = (document.getElementById('biz-company-phone')?.value || settings.companyPhone || '010-0000-0000').trim();
    const addr = (document.getElementById('biz-company-address')?.value || settings.companyAddress || '경기도 남양주시 가구공단로 123').trim();
    const bank = (document.getElementById('biz-bank-name')?.value || settings.bankName || '국민은행').trim();
    const acct = (document.getElementById('biz-bank-account')?.value || settings.bankAccount || '123402-04-567890').trim();
    const holder = (document.getElementById('biz-bank-holder')?.value || settings.bankHolder || '피앙세가구').trim();
    const sealTop = (document.getElementById('biz-seal-top')?.value || settings.sealTextTop || '피앙세').trim();
    const sealBot = (document.getElementById('biz-seal-bot')?.value || settings.sealTextBot || '가구인').trim();

    // 계약서 공급자 날인 박스 미리보기
    const pvName = document.getElementById('pv-biz-name');
    const pvOwner = document.getElementById('pv-biz-owner');
    const pvNo = document.getElementById('pv-biz-no');
    const pvAddr = document.getElementById('pv-biz-addr');
    const pvBank = document.getElementById('pv-biz-bank');

    if (pvName) pvName.innerText = name;
    if (pvOwner) pvOwner.innerText = owner;
    if (pvNo) pvNo.innerText = bizno;
    if (pvAddr) pvAddr.innerText = addr;
    if (pvBank) pvBank.innerText = `${bank} ${acct} (${holder})`;

    // 문자(SMS) 미리보기
    const smsHeader = document.getElementById('pv-sms-header');
    const smsBank = document.getElementById('pv-sms-bank');
    const smsPhone = document.getElementById('pv-sms-phone');
    if (smsHeader) smsHeader.innerText = `[${name}] 맞춤 씽크대 공급계약`;
    if (smsBank) smsBank.innerText = `${bank} ${acct} (${holder})`;
    if (smsPhone) smsPhone.innerText = phone;

    // 직인 도장 미리보기
    const sTop = document.getElementById('biz-seal-preview-top');
    const sBot = document.getElementById('biz-seal-preview-bot');
    if (sTop) sTop.textContent = sealTop;
    if (sBot) sBot.textContent = sealBot;
  }

  // 실시간 입력 이벤트 리스너 등록
  [
    'biz-company-name', 'biz-company-owner', 'biz-company-bizno', 'biz-company-phone',
    'biz-company-address', 'biz-bank-name', 'biz-bank-account', 'biz-bank-holder',
    'biz-seal-top', 'biz-seal-bot'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateCompanyLivePreview);
    }
  });

  // 사업자 정보 저장 버튼
  const btnSaveBiz = document.getElementById('btn-save-biz-info');
  if (btnSaveBiz) {
    btnSaveBiz.addEventListener('click', async () => {
      const updated = {
        ...settings,
        companyName: document.getElementById('biz-company-name').value.trim() || '피앙세가구',
        companyOwner: document.getElementById('biz-company-owner').value.trim() || '대표 홍길동',
        companyBizNo: document.getElementById('biz-company-bizno').value.trim() || '123-45-67890',
        companyPhone: document.getElementById('biz-company-phone').value.trim() || '010-0000-0000',
        companyAddress: document.getElementById('biz-company-address').value.trim() || '경기도 남양주시 가구공단로 123',
        bankName: document.getElementById('biz-bank-name').value.trim() || '국민은행',
        bankAccount: document.getElementById('biz-bank-account').value.trim() || '123402-04-567890',
        bankHolder: document.getElementById('biz-bank-holder').value.trim() || '피앙세가구',
        sealTextTop: document.getElementById('biz-seal-top').value.trim() || '피앙세',
        sealTextBot: document.getElementById('biz-seal-bot').value.trim() || '가구인'
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
          updateAppBrandHeaders(settings.companyName);
          updateCompanyLivePreview();
          calculateQuote();
          showToast(`'${settings.companyName}' 사업자 정보가 정상 저장되었습니다. 계약서 및 발송 문자에 즉시 적용되었습니다.`);
        }
      } catch (err) {
        alert('사업자 정보 저장 실패: ' + err.message);
      }
    });
  }

  // 9-3. 관리자 - 고정 단가표 및 마진 설정 관리
  function populateSettingsForm() {
    if (!settings) return;
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
    const updated = {
      ...settings,
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
        showToast('자재별 기준 단가표 및 시공 마진이 저장되어 견적에 즉시 반영되었습니다.');
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

  // =========================================================================
  // 14. AI 실시간 개발 요청 관리 및 10초 자동 감지 루프 UI
  // =========================================================================
  let devRequestsCache = [];
  const knownRequestStatus = new Map();

  async function loadDevRequests() {
    try {
      const res = await fetch('/api/dev-requests');
      const data = await res.json();
      if (!data.success) return;

      const requests = data.requests || [];
      const pendingCount = data.pendingCount || 0;
      const processingCount = requests.filter(r => r.status === 'processing').length;
      const doneCount = requests.filter(r => r.status === 'done').length;

      // 신규 완료 감지 알림
      requests.forEach(r => {
        const prevStatus = knownRequestStatus.get(r.id);
        if (prevStatus && prevStatus !== 'done' && r.status === 'done') {
          showToast(`🎉 [${r.id}] 개발 요청이 반영 완료되었습니다!`);
        }
        knownRequestStatus.set(r.id, r.status);
      });

      devRequestsCache = requests;

      // 카운트 배지 갱신
      const statP = document.getElementById('dev-stat-pending');
      const statPr = document.getElementById('dev-stat-processing');
      const statD = document.getElementById('dev-stat-done');
      if (statP) statP.innerText = pendingCount;
      if (statPr) statPr.innerText = processingCount;
      if (statD) statD.innerText = doneCount;

      // 사이드바 및 하단 바 배지
      const navBadge = document.getElementById('nav-dev-badge');
      if (navBadge) {
        navBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        navBadge.innerText = pendingCount;
      }

      const barBadge = document.getElementById('dev-bar-pending-badge');
      if (barBadge) {
        barBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        barBadge.innerText = `대기 ${pendingCount}건`;
      }

      // 전체 탭 리스트 렌더링
      renderDevRequestsList(requests);

      // 하단 드로어 최근 요청 렌더링
      renderDevDrawerRecent(requests);
    } catch (err) {
      console.warn('개발 요청 로드 실패:', err);
    }
  }

  function getStatusBadgeHtml(status) {
    if (status === 'pending') {
      return `<span class="badge" style="background:#FFF3C4; color:#92400E; font-size:11px; padding:3px 8px; border-radius:10px;">🟡 대기중 (AI 감지 대기)</span>`;
    } else if (status === 'processing') {
      return `<span class="badge" style="background:#DBEAFE; color:#1E40AF; font-size:11px; padding:3px 8px; border-radius:10px;">🔵 AI 수정 처리중...</span>`;
    } else if (status === 'done') {
      return `<span class="badge" style="background:#D1FAE5; color:#065F46; font-size:11px; padding:3px 8px; border-radius:10px;">🟢 반영 완료</span>`;
    }
    return `<span class="badge" style="background:#F3ECE3; color:#6E6157; font-size:11px; padding:3px 8px; border-radius:10px;">${status}</span>`;
  }

  function renderDevRequestsList(requests) {
    const container = document.getElementById('dev-requests-list');
    if (!container) return;

    if (!requests || requests.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 16px; color:var(--text-tertiary); font-size:13px;">
          <div style="font-size:32px; margin-bottom:8px;">📝</div>
          아직 등록된 개발 요청이 없습니다.<br>
          원하시는 기능이나 수정사항을 좌측 폼에 입력하시면 AI가 자동으로 읽고 반영합니다.
        </div>`;
      return;
    }

    // 최신순 정렬
    const sorted = [...requests].reverse();
    container.innerHTML = sorted.map(req => {
      const createdStr = req.createdAt ? new Date(req.createdAt).toLocaleString('ko-KR') : '-';
      const completedStr = req.completedAt ? new Date(req.completedAt).toLocaleString('ko-KR') : '';

      return `
        <div class="dev-req-card status-${req.status || 'pending'}">
          <div class="dev-req-top">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="dev-req-id">${escapeHtml(req.id)}</span>
              <span style="font-size:11px; color:var(--text-tertiary);">${escapeHtml(req.author || '피앙세가구')}</span>
              <span style="font-size:11px; color:var(--text-tertiary);">${createdStr}</span>
            </div>
            <div>
              ${getStatusBadgeHtml(req.status)}
            </div>
          </div>
          <div class="dev-req-msg">${escapeHtml(req.message)}</div>
          ${req.response ? `
            <div class="dev-req-response-box">
              <div style="font-weight:700; font-size:11px; color:var(--brand-dark); margin-bottom:3px; display:flex; align-items:center; gap:4px;">
                <span>🤖 AI 개발자 반영 내역</span>
                ${completedStr ? `<span style="font-size:10px; color:var(--text-tertiary); font-weight:normal;">(${completedStr})</span>` : ''}
              </div>
              <div>${escapeHtml(req.response)}</div>
            </div>
          ` : (req.status === 'processing' ? `
            <div style="font-size:11px; color:#2563EB; display:flex; align-items:center; gap:6px; margin-top:4px;">
              <span class="pulse-dot" style="background:#3B82F6;"></span> AI가 코드를 분석 및 수정 중입니다...
            </div>
          ` : '')}
        </div>
      `;
    }).join('');
  }

  function renderDevDrawerRecent(requests) {
    const container = document.getElementById('dev-drawer-recent-list');
    if (!container) return;

    if (!requests || requests.length === 0) {
      container.innerHTML = `<div style="font-size:11.5px; color:var(--text-tertiary); text-align:center; padding:8px;">등록된 요청 없음</div>`;
      return;
    }

    const recent = [...requests].reverse().slice(0, 3);
    container.innerHTML = recent.map(req => {
      let icon = '🟡';
      if (req.status === 'processing') icon = '🔵';
      if (req.status === 'done') icon = '🟢';

      const shortMsg = req.message.length > 38 ? req.message.substring(0, 38) + '...' : req.message;

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:5px 8px; background:#FFFFFF; border:1px solid var(--border-color); border-radius:6px; font-size:11.5px;">
          <div style="display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <span>${icon}</span>
            <span style="color:var(--text-primary); font-weight:500;">${escapeHtml(shortMsg)}</span>
          </div>
          <span style="font-size:10px; color:var(--text-tertiary); white-space:nowrap;">${req.status === 'done' ? '완료' : (req.status === 'processing' ? '처리중' : '대기')}</span>
        </div>
      `;
    }).join('');
  }

  // 전체 탭 폼 제출
  const formDevReq = document.getElementById('form-dev-request');
  if (formDevReq) {
    formDevReq.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cat = document.getElementById('dev-req-category').value;
      const author = document.getElementById('dev-req-author').value.trim() || '피앙세가구 대표님';
      const msgInput = document.getElementById('dev-req-message');
      const msg = msgInput.value.trim();

      if (!msg) {
        alert('요청 내용을 입력해주세요.');
        return;
      }

      const fullMessage = `[${cat}] ${msg}`;

      try {
        const res = await fetch('/api/dev-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, message: fullMessage })
        });
        const data = await res.json();
        if (data.success) {
          msgInput.value = '';
          showToast('🛡️ 대기열에 등록되었습니다! (토큰 소모 0%) 대화창에 "개발 탭 반영해줘"라고 하시면 일괄 처리합니다.');
          loadDevRequests();
        } else {
          alert('전송 실패: ' + (data.message || '알 수 없는 오류'));
        }
      } catch (err) {
        alert('서버 통신 실패: ' + err.message);
      }
    });
  }

  // 새로고침 버튼
  const btnRefreshDev = document.getElementById('btn-refresh-dev-requests');
  if (btnRefreshDev) {
    btnRefreshDev.addEventListener('click', () => {
      loadDevRequests();
      showToast('개발 요청 목록을 새로고침했습니다.');
    });
  }

  // 대기 요청 클립보드 복사 함수
  function copyPendingRequestsToClipboard() {
    const pendings = devRequestsCache.filter(r => r.status === 'pending');
    if (pendings.length === 0) {
      showToast('현재 대기 중인 개발 요청이 없습니다.');
      return;
    }

    const textToCopy = `[피앙세가구 개발 요청 반영 지시]\n웹 개발 탭에 등록된 아래 ${pendings.length}건의 요청을 코드에 일괄 반영하고 배포해줘:\n\n` +
      pendings.map((r, i) => `${i + 1}. [${r.id}] ${r.message}`).join('\n\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`📋 대기 중인 ${pendings.length}건이 복사되었습니다! 대화창에 붙여넣기(Ctrl+V)하세요.`);
      }).catch(() => {
        prompt('아래 요청 내용을 복사하여 대화창에 붙여넣으세요:', textToCopy);
      });
    } else {
      prompt('아래 요청 내용을 복사하여 대화창에 붙여넣으세요:', textToCopy);
    }
  }

  const btnCopyDev = document.getElementById('btn-copy-dev-requests');
  if (btnCopyDev) btnCopyDev.addEventListener('click', copyPendingRequestsToClipboard);

  const btnQuickCopyDev = document.getElementById('btn-quick-copy-dev');
  if (btnQuickCopyDev) btnQuickCopyDev.addEventListener('click', copyPendingRequestsToClipboard);

  // 완료 내역 정리
  const btnClearDoneDev = document.getElementById('btn-clear-done-dev');
  if (btnClearDoneDev) {
    btnClearDoneDev.addEventListener('click', async () => {
      if (!confirm('반영 완료된 요청 내역을 목록에서 정리하시겠습니까? (대기 중인 요청은 유지됩니다)')) return;
      try {
        const res = await fetch('/api/dev-requests', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast('완료된 요청 내역을 정리했습니다.');
          loadDevRequests();
        }
      } catch (err) {
        alert('정리 실패: ' + err.message);
      }
    });
  }

  // 하단 플로팅 드로어 토글
  const dockedWidget = document.getElementById('dev-docked-widget');
  const dockedBar = document.getElementById('dev-docked-bar');
  const dockedPanel = document.getElementById('dev-docked-panel');
  const toggleIcon = document.getElementById('dev-toggle-icon');
  const toggleText = document.getElementById('dev-toggle-text');

  function toggleDevDrawer(forceOpen) {
    if (!dockedPanel) return;
    const isClosed = dockedPanel.style.display === 'none';
    const willOpen = (typeof forceOpen === 'boolean') ? forceOpen : isClosed;

    dockedPanel.style.display = willOpen ? 'block' : 'none';
    if (toggleIcon) toggleIcon.innerText = willOpen ? '▼' : '▲';
    if (toggleText) toggleText.innerText = willOpen ? '콘솔 닫기' : '요청창 열기';
  }

  if (dockedBar) {
    dockedBar.addEventListener('click', (e) => {
      toggleDevDrawer();
    });
  }

  // 하단 퀵 요청 전송
  const btnSendQuick = document.getElementById('btn-send-quick-req');
  const quickInput = document.getElementById('dev-quick-input');

  async function handleQuickDevSubmit() {
    if (!quickInput) return;
    const msg = quickInput.value.trim();
    if (!msg) {
      alert('요청 내용을 입력해주세요.');
      return;
    }

    try {
      const res = await fetch('/api/dev-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: '피앙세가구 대표님', message: `[⚡ 빠른요청] ${msg}` })
      });
      const data = await res.json();
      if (data.success) {
        quickInput.value = '';
        showToast('🛡️ 대기열에 등록되었습니다! (토큰 소모 0%) 대화창에 "개발 탭 반영해줘"라고 하시면 일괄 처리합니다.');
        loadDevRequests();
      } else {
        alert('전송 실패: ' + (data.message || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('서버 통신 실패: ' + err.message);
    }
  }

  if (btnSendQuick) {
    btnSendQuick.addEventListener('click', (e) => {
      e.stopPropagation();
      handleQuickDevSubmit();
    });
  }

  if (quickInput) {
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickDevSubmit();
      }
    });
  }

  // 초기 개발 요청 로드 및 6초 주기 폴링
  loadDevRequests();
  setInterval(loadDevRequests, 6000);

  // 초기 구동
  loadInitialData();
});
