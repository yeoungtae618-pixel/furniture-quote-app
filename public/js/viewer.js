/**
 * viewer.js - 소비자 전용 3D 도면 뷰어 & 정식 공급계약서(전자서명 포함)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = urlParams.get('id');

  if (!quoteId) {
    alert('유효하지 않은 계약서 링크입니다.');
    return;
  }

  let quoteData = null;
  let settingsData = null;

  try {
    const res = await fetch(`/api/quotes/${quoteId}`);
    const data = await res.json();
    if (!data.success) {
      alert('계약서 정보를 찾을 수 없습니다.');
      return;
    }
    quoteData = data.quote;
    settingsData = data.settings || {};
    renderContract(quoteData, settingsData);
  } catch (err) {
    alert('계약서 로딩 오류: ' + err.message);
    return;
  }

  // 인쇄 / PDF 저장 버튼
  const printFn = () => window.print();
  const printBtnTop = document.getElementById('btn-print-contract');
  const printBtnSigned = document.getElementById('btn-print-signed');
  if (printBtnTop) printBtnTop.addEventListener('click', printFn);
  if (printBtnSigned) printBtnSigned.addEventListener('click', printFn);

  // 3D 뷰어 + 2D 치수 평면도 초기화 (구버전 견적 필드 호환 fallback 적용)
  const spec = quoteData.spec || {};
  const totalW = spec.totalWidth || spec.width || 2700;
  const sinkW = spec.sinkBayWidth || Math.round(totalW * 0.37);
  const cookW = spec.cooktopBayWidth || Math.round(totalW * 0.33);
  const prepW = spec.prepBayWidth || (totalW - sinkW - cookW);

  const normalizedSpec = {
    layoutType: spec.layoutType || 'straight',
    sideLength: spec.sideLength || 1800,
    wingHasUpper: Boolean(spec.wingHasUpper),
    totalWidth: totalW,
    ceilingHeight: spec.ceilingHeight || 2350,
    lowerHeight: spec.lowerHeight || 860,
    lowerDepth: spec.lowerDepth || 600,
    sinkBayWidth: sinkW,
    prepBayWidth: prepW,
    cooktopBayWidth: cookW,
    upperHeight: spec.upperHeight || 700,
    upperDepth: spec.upperDepth || 350,
    midwayHeight: spec.midwayHeight || 650,
    hasUpperCabinets: spec.hasUpperCabinets !== false,
    doorColor: spec.doorColor || '#fcfcfc',
    doorStyle: spec.doorStyle || 'flat',
    countertopType: spec.countertopType || 'white_marble',
    handleType: spec.handleType || 'j_channel',
    handleColor: spec.handleColor || 'matte_black',
    wallDesign: spec.wallDesign || 'warm_greige',
    tileDesign: spec.tileDesign || 'white_subway',
    floorDesign: spec.floorDesign || 'natural_oak',
    underlightTemp: spec.underlightTemp || 'warm',
    hoodType: spec.hoodType || 'hidden',
    cooktopType: spec.cooktopType || 'black_ind',
    faucetType: spec.faucetType || 'gooseneck',
    showDimensions: true,
    isViewerMode: true
  };

  const canvasContainer = document.getElementById('viewer-canvas');
  const planContainer = document.getElementById('viewer-plan2d');
  const engine = new Furniture3DEngine(canvasContainer, normalizedSpec);
  const plan2d = (planContainer && typeof KitchenPlan2DEngine !== 'undefined')
    ? new KitchenPlan2DEngine(planContainer, normalizedSpec, { isViewerMode: true })
    : null;

  // 3D 모델뷰 <-> 2D 치수 평면도 전환
  document.querySelectorAll('[data-viewer-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewerMode;
      document.querySelectorAll('[data-viewer-mode]').forEach(b => b.classList.toggle('active', b.dataset.viewerMode === mode));
      if (mode === '2d') {
        canvasContainer.style.display = 'none';
        if (planContainer) planContainer.style.display = 'block';
        if (plan2d) plan2d.updateSpec(normalizedSpec);
      } else {
        if (planContainer) planContainer.style.display = 'none';
        canvasContainer.style.display = 'block';
        engine.resize();
      }
    });
  });

  // 카메라 뷰 프리셋 (투시도 / 정면 / 항공)
  document.querySelectorAll('[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('active', b === btn));
      engine.setCameraPreset(btn.dataset.cam);
    });
  });

  // 뷰어 툴바
  const doorBtn = document.getElementById('btn-door-toggle');
  doorBtn.addEventListener('click', () => {
    const isOpen = engine.toggleDoors();
    doorBtn.classList.toggle('active', isOpen);
    doorBtn.querySelector('span').innerText = isOpen ? '도어 닫기' : '도어 열기';
  });

  const dimBtn = document.getElementById('btn-dim-toggle');
  dimBtn.addEventListener('click', () => {
    const isShow = engine.toggleDimensions();
    dimBtn.classList.toggle('active', isShow);
  });

  // 모바일 전자서명 패드 (미서명 시 활성화)
  const signCanvas = document.getElementById('sign-pad');
  const ctx = signCanvas.getContext('2d');
  let isDrawing = false;
  let hasSigned = false;

  function resizeCanvas() {
    const rect = signCanvas.getBoundingClientRect();
    if (rect.width === 0) return;
    signCanvas.width = rect.width * 2;
    signCanvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2A211B';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function getPos(e) {
    const rect = signCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function start(e) {
    isDrawing = true;
    hasSigned = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() { isDrawing = false; }

  signCanvas.addEventListener('mousedown', start);
  signCanvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  signCanvas.addEventListener('touchstart', start, { passive: false });
  signCanvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end);

  document.getElementById('btn-clear-sign').onclick = () => {
    ctx.clearRect(0, 0, signCanvas.width, signCanvas.height);
    hasSigned = false;
  };

  document.getElementById('btn-submit-sign').onclick = async () => {
    if (!hasSigned) {
      alert('서명란에 먼저 서명(날인)을 진행해 주세요.');
      return;
    }

    const sigData = signCanvas.toDataURL('image/png');
    const btn = document.getElementById('btn-submit-sign');
    btn.innerText = '계약서 날인 처리 중...';
    btn.disabled = true;

    try {
      const res = await fetch(`/api/quotes/${quoteId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: sigData })
      });
      const result = await res.json();
      if (result.success) {
        alert('공급계약서 전자서명이 완료되었습니다. 안내 계좌로 계약금을 입금해 주시면 원목 재단 및 제작 일정이 확정됩니다.');
        location.reload();
      }
    } catch (err) {
      alert('오류: ' + err.message);
      btn.disabled = false;
      btn.innerText = '공급계약서 전자서명 및 주문 확정하기';
    }
  };

  function esc(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatKoreanDate(isoStr) {
    const d = isoStr ? new Date(isoStr) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString('ko-KR');
    return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  }

  function renderContract(q, settings) {
    const s = q.spec || {};
    const cust = q.customer || {};
    const tW = s.totalWidth || s.width || 2700;
    const sW = s.sinkBayWidth || Math.round(tW * 0.37);
    const cW = s.cooktopBayWidth || Math.round(tW * 0.33);
    const pW = s.prepBayWidth || (tW - sW - cW);
    const upperDesc = s.hasUpperCabinets === false ? '상부장 제외(하부장 단독)' : `상부장 포함 (H ${s.upperHeight || 700}mm)`;

    const hoodMap = { hidden: '빌트인 히든후드', chimney: 'T자 침니후드' };
    const cookMap = { black_ind: '블랙 3구 인덕션', white_ind: '화이트 인덕션', gas_3: '3구 가스레인지' };
    const faucetMap = { gooseneck: '거위목 수전', square_l: '모던 직각 L형 수전' };

    const hoodName = s.hoodLabel || hoodMap[s.hoodType] || '빌트인 히든후드';
    const cookName = s.cooktopLabel || cookMap[s.cooktopType] || '블랙 3구 인덕션';
    const faucetName = s.faucetLabel || faucetMap[s.faucetType] || '거위목 수전';

    const woodName = s.woodBodyName || settings.woodBodyName || '친환경 E0 자작합판 18T 원목 몸통';
    const doorName = s.selectedDoorName || '기성 18T MDF 도어';
    const topName = s.countertopName || settings.countertopName || '인조대리석 상판';

    const includedList = Array.isArray(s.includedItems) && s.includedItems.length > 0
      ? s.includedItems
      : (settings.fixedItems || []).filter(i => i.enabled).map(i => i.name);

    const supName = settings.companyName || 'WOODCRAFT STUDIO';
    const supOwner = settings.companyOwner || '대표이사';
    const supPhone = settings.companyPhone || '-';
    const supBizNo = settings.companyBizNo || '-';
    const supAddr = settings.companyAddress || '-';

    // 상단 헤더 & 문서 기본정보
    setText('view-company-name', supName);
    setText('view-cust-name', cust.name || '고객');
    setText('doc-quote-id', q.id);
    setText('doc-created-date', formatKoreanDate(q.createdAt));
    setText('doc-sign-date', formatKoreanDate(q.signedAt || q.createdAt));

    // 당사자 표 & 하단 날인 박스
    setText('doc-cust-name', cust.name || '고객님');
    setText('doc-cust-phone', cust.phone || '미기재');
    setText('doc-cust-address', cust.address || '현장 실측지 기준');
    setText('doc-sup-name', supName);
    setText('doc-sup-owner', supOwner);
    setText('doc-sup-phone', supPhone);
    setText('doc-sup-bizno', supBizNo);
    setText('doc-sup-address', supAddr);

    setText('sign-box-cust-name', cust.name || '고객님');
    setText('sign-box-cust-phone', cust.phone || '-');
    setText('sign-box-cust-addr', cust.address || '현장 실측지 기준');
    setText('sign-box-sup-name', supName);
    setText('sign-box-sup-bizno', supBizNo);
    setText('sign-box-sup-addr', supAddr);
    setText('sign-box-sup-owner', supOwner);

    // 2. 공급 품목 명세표 (간략 사양 자동 반영)
    const layoutNote = (s.layoutType === 'l_left' || s.layoutType === 'l_right')
      ? `ㄱ자형 (${s.layoutType === 'l_left' ? '좌코너' : '우코너'}) ${tW.toLocaleString()} × ${(s.sideLength || 1800).toLocaleString()}mm`
      : `일자형 전체 폭 ${tW.toLocaleString()}mm`;

    const rows = [
      {
        item: '맞춤 가구 몸통 (원목)',
        detail: `${woodName} · ${layoutNote} (개수대 ${sW.toLocaleString()} / 조리대 ${pW.toLocaleString()} / 가열대 ${cW.toLocaleString()}mm · ${upperDesc})`,
        basis: '1식 (직영제작)'
      },
      {
        item: '도어 외주 사양',
        detail: `${doorName}${s.selectedDoorFinish ? ` (${s.selectedDoorFinish})` : ''}`,
        basis: '기성 도어'
      },
      {
        item: '상판 제작 및 가공',
        detail: `${topName} (개수대 · 쿡탑 타공 및 접합 가공 포함)`,
        basis: '1식'
      },
      {
        item: '주방 기기 및 수전 구성',
        detail: `${hoodName} · ${cookName} · ${faucetName}`,
        basis: '지정 사양'
      },
      {
        item: '하드웨어 및 현장 시공',
        detail: includedList.length > 0 ? `${includedList.join(', ')} 및 전문 시공` : '기본 하드웨어 및 전문 현장 시공',
        basis: '포함 (1식)'
      }
    ];

    const tbody = document.getElementById('doc-items-tbody');
    if (tbody) {
      tbody.innerHTML = rows.map(r => `
        <tr>
          <th>${esc(r.item)}</th>
          <td>${esc(r.detail)}</td>
          <td class="center">${esc(r.basis)}</td>
        </tr>
      `).join('');
    }

    // 3. 계약 공급가액 (000,000원 단위 포맷 및 계약금/잔금 합산 일치)
    const totalPrice = Number(q.pricing?.totalPrice || 0);
    const depositPrice = Number(q.pricing?.depositPrice || 0);
    const balancePrice = q.pricing?.balancePrice !== undefined
      ? Number(q.pricing.balancePrice)
      : Math.max(0, totalPrice - depositPrice);

    setText('doc-deposit-pct', settings.depositPercent || 10);
    setText('view-total-price', `${totalPrice.toLocaleString()}원`);
    setText('view-deposit-price', `${depositPrice.toLocaleString()}원`);
    setText('view-balance-price', `${balancePrice.toLocaleString()}원`);

    const bankStr = `${settings.bankName || '국민은행'} ${settings.bankAccount || '123402-04-567890'} (예금주: ${settings.bankHolder || supOwner})`;
    setText('view-bank-info', bankStr);

    // 4. 서명/결제 상태 반영
    const statusBadge = document.getElementById('view-status-badge');
    const signSec = document.getElementById('sign-section');
    const signedCard = document.getElementById('signed-complete-card');
    const buyerSlot = document.getElementById('doc-buyer-sign-slot');

    if (q.status === 'paid' || q.status === 'signed') {
      if (q.status === 'paid') {
        statusBadge.innerHTML = '<span class="badge badge-paid">입금 확인 (제작중)</span>';
      } else {
        statusBadge.innerHTML = '<span class="badge badge-signed">서명 완료 (입금 대기)</span>';
      }
      signSec.style.display = 'none';
      signedCard.style.display = 'block';

      if (q.signatureImage && buyerSlot) {
        buyerSlot.innerHTML = `<img src="${q.signatureImage}" alt="구매자 전자서명" style="max-height:48px; max-width:150px; vertical-align:middle;">`;
      }
    } else {
      statusBadge.innerHTML = '<span class="badge badge-pending">서명 대기중</span>';
      signSec.style.display = 'block';
      signedCard.style.display = 'none';
    }
  }
});
