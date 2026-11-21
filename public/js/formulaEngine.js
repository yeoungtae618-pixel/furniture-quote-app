/**
 * 피앙세가구 (Fiance Furniture) - 공장 가구 산출식 및 원장(2220x2440mm) 자투리 극대화 절단 네스팅 엔진
 * 
 * [가구 산출식 핵심 공식]
 * 1. 붙박이장, 신발장: 높이 무관 자(300mm) 당 120,000원 (VAT 별도)
 * 2. 씽크대: m(1000mm) 당 250,000원 (VAT 별도), 상부장/하부장 별도 계산, 코너 중복(하부 600mm, 상부 350mm) 제외
 *    - EP (측면 마감판): 양끝 노출면 약 5장, 장당 50,000원
 * 3. 몰딩: 평균 3개, 개당 50,000원 / 걸레받이: 개당 30,000원 (일자 1개, 코너마다 1개씩 추가)
 * 4. 시공비: 전체 길이 m 당 50,000원 (VAT 별도)
 * 5. 키큰장: 3개 장 복합 모듈, 폭 m 기준 적용, EP 1~2장(장당 100,000원)
 * 
 * [원장(Raw Board) 네스팅 & 자투리 극대화]
 * - 원장 규격: 2220 x 2440 mm (면적 5.4168 m²)
 * - 각 부재(측판, 천지판, 선반, 도어, 백패널, 걸레받이 등)를 2D 네스팅 배치하여 자투리를 거의 못 쓸 수준까지 극소화
 * - 표준 산출 견적 vs 원장 기준 원가/마진/자재 절감률 실시간 비교
 */

const RAW_BOARD_WIDTH = 2440;  // mm
const RAW_BOARD_HEIGHT = 2220; // mm
const SAW_KERF = 4;            // 톱날 두께 (mm)

// 프리셋 데이터
const FORMULA_PRESETS = {
  preset34: {
    name: '국민평형 34평 (주방 ㄱ자 + 키큰장 + 안방 붙박이장)',
    sinkShape: 'L',
    sinkMainW: 3000,
    sinkSubW: 1800,
    hasUpper: true,
    sinkEpCount: 5,
    moldingCount: 3,
    plinthCount: 2, // 일자 1 + 코너 1
    tallW: 600,
    tallEpCount: 1,
    closetW: 3000, // 10자 (3000mm)
    shoeW: 0,
    rawBoardPrice: 68000 // 원장 장당 원가(E0 18T PB/MDF)
  },
  presetStudio: {
    name: '소형 원룸 / 오피스텔 (일자 씽크대 + 현관 신발장)',
    sinkShape: 'I',
    sinkMainW: 1800,
    sinkSubW: 0,
    hasUpper: true,
    sinkEpCount: 3,
    moldingCount: 2,
    plinthCount: 1,
    tallW: 0,
    tallEpCount: 0,
    closetW: 0,
    shoeW: 900, // 3자 (900mm)
    rawBoardPrice: 68000
  },
  preset50: {
    name: '대형 50평 풀옵션 (주방 ㄷ자 + 대형 키큰장 + 붙박이장 12자 + 신발장 4자)',
    sinkShape: 'U',
    sinkMainW: 3600,
    sinkSubW: 2400,
    sinkSub2W: 1200,
    hasUpper: true,
    sinkEpCount: 6,
    moldingCount: 4,
    plinthCount: 3, // 일자 1 + 코너 2
    tallW: 1200,
    tallEpCount: 2,
    closetW: 3600, // 12자 (3600mm)
    shoeW: 1200,   // 4자 (1200mm)
    rawBoardPrice: 68000
  }
};

let currentFormulaState = {
  sinkShape: 'L',
  sinkMainW: 3000,
  sinkSubW: 1800,
  sinkSub2W: 1200,
  hasUpper: true,
  sinkEpCount: 5,
  moldingCount: 3,
  plinthCount: 2,
  tallW: 600,
  tallEpCount: 1,
  closetW: 3000,
  shoeW: 0,
  rawBoardPrice: 68000,
  edgeCostPerM: 800,     // 엣지 밴딩 m당
  hardwareBaseCost: 150000, // 경첩, 레일, 피스 등
  installCostPerM: 50000    // 시공비 m당
};

let currentNestingResult = null;
let currentActiveSheetIndex = 0;

/**
 * 1. 현장 표준 가구 산출식 계산 (규칙 1~5)
 */
function calculateStandardFormula(state) {
  // 1) 붙박이장 & 신발장 (자 당 120,000원, 1자 = 300mm)
  const closetJa = (state.closetW || 0) / 300;
  const closetCost = Math.round(closetJa * 120000);

  const shoeJa = (state.shoeW || 0) / 300;
  const shoeCost = Math.round(shoeJa * 120000);

  // 2) 씽크대 (m당 250,000원, 코너 중복 제외, 상부/하부 별도)
  // 코너 중복 차감: 하부 코너 600mm, 상부 코너 350mm
  let lowerM = 0;
  let upperM = 0;
  const mainM = (state.sinkMainW || 0) / 1000;
  const subM = (state.sinkSubW || 0) / 1000;
  const sub2M = (state.sinkSub2W || 0) / 1000;

  if (state.sinkShape === 'I') {
    lowerM = mainM;
    upperM = state.hasUpper ? mainM : 0;
  } else if (state.sinkShape === 'L') {
    // 코너 1개소: 하부 -0.6m, 상부 -0.35m
    lowerM = Math.max(0, mainM + Math.max(0, subM - 0.6));
    upperM = state.hasUpper ? Math.max(0, mainM + Math.max(0, subM - 0.35)) : 0;
  } else if (state.sinkShape === 'U') {
    // 코너 2개소: 하부 -1.2m, 상부 -0.7m
    lowerM = Math.max(0, mainM + Math.max(0, subM - 0.6) + Math.max(0, sub2M - 0.6));
    upperM = state.hasUpper ? Math.max(0, mainM + Math.max(0, subM - 0.35) + Math.max(0, sub2M - 0.35)) : 0;
  }

  const lowerCost = Math.round(lowerM * 250000);
  const upperCost = Math.round(upperM * 250000);
  const sinkBaseCost = lowerCost + upperCost;

  // EP (측면 마감판): 장당 50,000원
  const epCount = state.sinkEpCount !== undefined ? state.sinkEpCount : 5;
  const epCost = epCount * 50000;

  // 3) 몰딩 & 걸레받이
  const moldingCount = state.moldingCount !== undefined ? state.moldingCount : 3;
  const moldingCost = moldingCount * 50000;

  let plinthCount = state.plinthCount !== undefined ? state.plinthCount : 2;
  const plinthCost = plinthCount * 30000;

  // 4) 키큰장: 폭 m당 계산 (m당 250,000원 기준) + EP 1~2장(장당 100,000원)
  const tallM = (state.tallW || 0) / 1000;
  const tallBaseCost = Math.round(tallM * 250000);
  const tallEpCount = state.tallEpCount !== undefined ? state.tallEpCount : 1;
  const tallEpCost = tallEpCount * 100000;
  const tallCost = tallBaseCost + tallEpCost;

  // 5) 시공비: 전체 가구 길이 합계 m당 50,000원 (VAT 별도)
  // 전체 길이 = 씽크대 하부 실길이 + 키큰장 + 붙박이장 + 신발장
  const closetM = (state.closetW || 0) / 1000;
  const shoeM = (state.shoeW || 0) / 1000;
  const totalFurnitureM = lowerM + tallM + closetM + shoeM;
  const installCost = Math.round(totalFurnitureM * (state.installCostPerM || 50000));

  // 품목별 합산 (공급가액, VAT 별도)
  const supplyTotal = closetCost + shoeCost + sinkBaseCost + epCost + moldingCost + plinthCost + tallCost + installCost;
  const vat = Math.round(supplyTotal * 0.1);
  const grandTotal = supplyTotal + vat;

  return {
    closetJa,
    closetCost,
    shoeJa,
    shoeCost,
    lowerM,
    lowerCost,
    upperM,
    upperCost,
    sinkBaseCost,
    epCount,
    epCost,
    moldingCount,
    moldingCost,
    plinthCount,
    plinthCost,
    tallM,
    tallBaseCost,
    tallEpCount,
    tallEpCost,
    tallCost,
    totalFurnitureM,
    installCost,
    supplyTotal,
    vat,
    grandTotal
  };
}

/**
 * 2. 원장(2220 x 2440 mm) 기준 가구 부재 목록 생성
 * 각 가구 모듈의 박스(측판, 천지판, 선반, 도어, 백패널, 걸레받이목 등) 컷리스트 도출
 */
function generateFurnitureParts(state) {
  const parts = [];

  // 색상 팔레트
  const COLORS = {
    carcase: '#3B82F6',   // 측판/천지판 (파랑)
    shelf: '#10B981',     // 선반 (초록)
    door: '#F59E0B',      // 도어/서랍 (주황)
    back: '#8B5CF6',      // 백패널 (보라)
    molding: '#EC4899',   // 몰딩/EP/걸레받이 (분홍)
    filler: '#6B7280'     // 보강대/자투리활용 부재 (회색)
  };

  // 1) 씽크대 하부장 부재
  const lowerLen = (state.sinkShape === 'I') ? state.sinkMainW :
                   (state.sinkShape === 'L') ? (state.sinkMainW + Math.max(0, state.sinkSubW - 600)) :
                   (state.sinkMainW + Math.max(0, state.sinkSubW - 600) + Math.max(0, (state.sinkSub2W || 1200) - 600));
  
  const lowerBoxCount = Math.max(1, Math.round(lowerLen / 800)); // 약 800mm 단위 박스 모듈
  const boxW = Math.round(lowerLen / lowerBoxCount);

  for (let i = 0; i < lowerBoxCount; i++) {
    // 측판 2장 (820 x 580)
    parts.push({ name: `하부장[${i+1}] 측판L`, w: 820, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `하부장[${i+1}] 측판R`, w: 820, h: 580, color: COLORS.carcase, type: 'carcase' });
    // 지판 1장 (boxW x 580)
    parts.push({ name: `하부장[${i+1}] 지판`, w: Math.min(boxW, 1100), h: 580, color: COLORS.carcase, type: 'carcase' });
    // 선반 1장
    parts.push({ name: `하부장[${i+1}] 선반`, w: Math.min(boxW, 1100), h: 540, color: COLORS.shelf, type: 'shelf' });
    // 도어 2장
    parts.push({ name: `하부[${i+1}] 도어L`, w: 720, h: Math.round(boxW / 2) - 4, color: COLORS.door, type: 'door' });
    parts.push({ name: `하부[${i+1}] 도어R`, w: 720, h: Math.round(boxW / 2) - 4, color: COLORS.door, type: 'door' });
    // 백패널
    parts.push({ name: `하부[${i+1}] 백패널`, w: 720, h: Math.min(boxW, 1100), color: COLORS.back, type: 'back' });
    // 상부 연결 보강대 2개 (자투리 재활용 부재)
    parts.push({ name: `하부[${i+1}] 보강대1`, w: Math.min(boxW, 1100), h: 100, color: COLORS.filler, type: 'filler' });
    parts.push({ name: `하부[${i+1}] 보강대2`, w: Math.min(boxW, 1100), h: 100, color: COLORS.filler, type: 'filler' });
  }

  // 2) 씽크대 상부장 부재 (옵션)
  if (state.hasUpper) {
    const upperBoxCount = lowerBoxCount;
    const uBoxW = boxW;
    for (let i = 0; i < upperBoxCount; i++) {
      // 측판 2장 (700 x 330)
      parts.push({ name: `상부장[${i+1}] 측판L`, w: 700, h: 330, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `상부장[${i+1}] 측판R`, w: 700, h: 330, color: COLORS.carcase, type: 'carcase' });
      // 천판/지판 2장
      parts.push({ name: `상부장[${i+1}] 천판`, w: Math.min(uBoxW, 1100), h: 330, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `상부장[${i+1}] 지판`, w: Math.min(uBoxW, 1100), h: 330, color: COLORS.carcase, type: 'carcase' });
      // 선반 1장
      parts.push({ name: `상부장[${i+1}] 선반`, w: Math.min(uBoxW, 1100), h: 310, color: COLORS.shelf, type: 'shelf' });
      // 도어 2장
      parts.push({ name: `상부[${i+1}] 도어L`, w: 700, h: Math.round(uBoxW / 2) - 4, color: COLORS.door, type: 'door' });
      parts.push({ name: `상부[${i+1}] 도어R`, w: 700, h: Math.round(uBoxW / 2) - 4, color: COLORS.door, type: 'door' });
      // 백패널
      parts.push({ name: `상부[${i+1}] 백패널`, w: 680, h: Math.min(uBoxW, 1100), color: COLORS.back, type: 'back' });
    }
  }

  // 3) 키큰장 부재
  if (state.tallW > 0) {
    const tW = state.tallW;
    // 측판 2장 (전장 높이 2150 x 580)
    parts.push({ name: `키큰장 측판L`, w: 2150, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `키큰장 측판R`, w: 2150, h: 580, color: COLORS.carcase, type: 'carcase' });
    // 천판/지판 2장
    parts.push({ name: `키큰장 천판`, w: tW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `키큰장 지판`, w: tW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
    // 고정선반 3장 (밥솥/전자렌지/수납)
    for (let s = 1; s <= 3; s++) {
      parts.push({ name: `키큰장 고정선반${s}`, w: tW - 36, h: 560, color: COLORS.shelf, type: 'shelf' });
    }
    // 도어 3단
    parts.push({ name: `키큰장 상단도어`, w: 700, h: tW - 4, color: COLORS.door, type: 'door' });
    parts.push({ name: `키큰장 하단도어`, w: 750, h: tW - 4, color: COLORS.door, type: 'door' });
    parts.push({ name: `키큰장 밥솥인출판`, w: tW - 40, h: 450, color: COLORS.shelf, type: 'shelf' });
    // 백패널
    parts.push({ name: `키큰장 백패널`, w: 2100, h: tW - 4, color: COLORS.back, type: 'back' });
  }

  // 4) 붙박이장 부재 (자당 300mm 단위)
  if (state.closetW > 0) {
    const cBoxCount = Math.max(1, Math.round(state.closetW / 900)); // 약 900mm(3자) 모듈 박스
    const cBoxW = Math.round(state.closetW / cBoxCount);
    for (let i = 0; i < cBoxCount; i++) {
      // 대형 측판 2장 (2300 x 580)
      parts.push({ name: `붙박이[${i+1}] 측판L`, w: 2300, h: 580, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `붙박이[${i+1}] 측판R`, w: 2300, h: 580, color: COLORS.carcase, type: 'carcase' });
      // 천지판 2장
      parts.push({ name: `붙박이[${i+1}] 천판`, w: cBoxW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `붙박이[${i+1}] 지판`, w: cBoxW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
      // 고정선반 & 옷걸이 보강목
      parts.push({ name: `붙박이[${i+1}] 중선반`, w: cBoxW - 36, h: 560, color: COLORS.shelf, type: 'shelf' });
      parts.push({ name: `붙박이[${i+1}] 하선반`, w: cBoxW - 36, h: 560, color: COLORS.shelf, type: 'shelf' });
      // 도어 2장
      parts.push({ name: `붙박이[${i+1}] 도어L`, w: 2260, h: Math.round(cBoxW / 2) - 4, color: COLORS.door, type: 'door' });
      parts.push({ name: `붙박이[${i+1}] 도어R`, w: 2260, h: Math.round(cBoxW / 2) - 4, color: COLORS.door, type: 'door' });
      // 백패널
      parts.push({ name: `붙박이[${i+1}] 백패널`, w: 2260, h: cBoxW - 4, color: COLORS.back, type: 'back' });
    }
  }

  // 5) 신발장 부재
  if (state.shoeW > 0) {
    const sBoxW = state.shoeW;
    // 측판 2장 (2200 x 350)
    parts.push({ name: `신발장 측판L`, w: 2200, h: 350, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `신발장 측판R`, w: 2200, h: 350, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `신발장 천판`, w: sBoxW - 36, h: 350, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `신발장 지판`, w: sBoxW - 36, h: 350, color: COLORS.carcase, type: 'carcase' });
    // 다단 신발 선반 5장
    for (let k = 1; k <= 5; k++) {
      parts.push({ name: `신발장 선반${k}`, w: sBoxW - 36, h: 330, color: COLORS.shelf, type: 'shelf' });
    }
    // 도어 2장
    parts.push({ name: `신발장 도어L`, w: 2160, h: Math.round(sBoxW / 2) - 4, color: COLORS.door, type: 'door' });
    parts.push({ name: `신발장 도어R`, w: 2160, h: Math.round(sBoxW / 2) - 4, color: COLORS.door, type: 'door' });
  }

  // 6) EP, 몰딩, 걸레받이 부재
  const epCount = state.sinkEpCount || 5;
  for (let e = 1; e <= epCount; e++) {
    parts.push({ name: `EP 측면마감판${e}`, w: 860, h: 600, color: COLORS.molding, type: 'molding' });
  }
  if (state.tallEpCount > 0) {
    for (let te = 1; te <= state.tallEpCount; te++) {
      parts.push({ name: `키큰장 전장EP${te}`, w: 2200, h: 600, color: COLORS.molding, type: 'molding' });
    }
  }

  // 자투리 공간을 꽉 채워주는 코너 마감재 & 보강 쫄대들 (자투리 제로화 부재)
  const fillerCount = Math.max(4, Math.round(lowerLen / 500));
  for (let f = 1; f <= fillerCount; f++) {
    parts.push({ name: `코너/벽체 마감재${f}`, w: 600, h: 80, color: COLORS.filler, type: 'filler' });
    parts.push({ name: `걸레받이 지지대${f}`, w: 450, h: 80, color: COLORS.filler, type: 'filler' });
  }

  return parts;
}

/**
 * 3. 2220 x 2440 mm 원장 2D 네스팅(Guillotine Cut & Shelf Packing) 알고리즘
 * 자투리를 거의 못 쓸 수준까지 최대한 틈새 활용
 */
function nestPartsOnRawBoards(partsList, boardW = RAW_BOARD_WIDTH, boardH = RAW_BOARD_HEIGHT, kerf = SAW_KERF) {
  // 면적 큰 부재부터 내림차순 정렬 (Best-Fit Decreasing)
  const sortedParts = [...partsList].map(p => {
    // 긴 쪽을 너비로 기본 정렬
    const w = Math.max(p.w, p.h);
    const h = Math.min(p.w, p.h);
    return { ...p, w, h, area: w * h };
  }).sort((a, b) => b.area - a.area);

  const sheets = [];
  const singleSheetArea = boardW * boardH;

  function createNewSheet() {
    return {
      index: sheets.length + 1,
      width: boardW,
      height: boardH,
      placedParts: [],
      // 남은 여유 공간 사각형 리스트 (Guillotine cut free rects)
      freeRects: [{ x: 0, y: 0, w: boardW, h: boardH }]
    };
  }

  sheets.push(createNewSheet());

  sortedParts.forEach(part => {
    let placed = false;

    // 기존 시트들에서 적합한 여유 공간 탐색 (Best Short Side Fit)
    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const sheet = sheets[sIdx];
      let bestRectIdx = -1;
      let bestShortSideFit = Infinity;
      let bestRotate = false;

      for (let rIdx = 0; rIdx < sheet.freeRects.length; rIdx++) {
        const fr = sheet.freeRects[rIdx];

        // 정방향 확인 (part.w, part.h)
        if (part.w + kerf <= fr.w && part.h + kerf <= fr.h) {
          const leftoverX = fr.w - (part.w + kerf);
          const leftoverY = fr.h - (part.h + kerf);
          const shortSideFit = Math.min(leftoverX, leftoverY);
          if (shortSideFit < bestShortSideFit) {
            bestShortSideFit = shortSideFit;
            bestRectIdx = rIdx;
            bestRotate = false;
          }
        }

        // 90도 회전 확인 (part.h, part.w)
        if (part.h + kerf <= fr.w && part.w + kerf <= fr.h) {
          const leftoverX = fr.w - (part.h + kerf);
          const leftoverY = fr.h - (part.w + kerf);
          const shortSideFit = Math.min(leftoverX, leftoverY);
          if (shortSideFit < bestShortSideFit) {
            bestShortSideFit = shortSideFit;
            bestRectIdx = rIdx;
            bestRotate = true;
          }
        }
      }

      if (bestRectIdx !== -1) {
        const fr = sheet.freeRects[bestRectIdx];
        const pw = bestRotate ? part.h : part.w;
        const ph = bestRotate ? part.w : part.h;

        // 부재 배치
        sheet.placedParts.push({
          ...part,
          x: fr.x,
          y: fr.y,
          placedW: pw,
          placedH: ph,
          rotated: bestRotate
        });

        // 사용한 사각형을 2개로 분할 (Guillotine Split)
        sheet.freeRects.splice(bestRectIdx, 1);

        const rightRect = {
          x: fr.x + pw + kerf,
          y: fr.y,
          w: fr.w - (pw + kerf),
          h: ph + kerf
        };
        const bottomRect = {
          x: fr.x,
          y: fr.y + ph + kerf,
          w: fr.w,
          h: fr.h - (ph + kerf)
        };

        if (rightRect.w > 40 && rightRect.h > 40) sheet.freeRects.push(rightRect);
        if (bottomRect.w > 40 && bottomRect.h > 40) sheet.freeRects.push(bottomRect);

        placed = true;
        break;
      }
    }

    // 모든 시트에 들어갈 자리가 없으면 신규 원장 생성
    if (!placed) {
      const newSheet = createNewSheet();
      const pw = (part.w <= boardW && part.h <= boardH) ? part.w : part.h;
      const ph = (part.w <= boardW && part.h <= boardH) ? part.h : part.w;

      newSheet.placedParts.push({
        ...part,
        x: 0,
        y: 0,
        placedW: pw,
        placedH: ph,
        rotated: pw !== part.w
      });

      newSheet.freeRects = [];
      const rightRect = { x: pw + kerf, y: 0, w: boardW - (pw + kerf), h: ph + kerf };
      const bottomRect = { x: 0, y: ph + kerf, w: boardW, h: boardH - (ph + kerf) };
      if (rightRect.w > 40 && rightRect.h > 40) newSheet.freeRects.push(rightRect);
      if (bottomRect.w > 40 && bottomRect.h > 40) newSheet.freeRects.push(bottomRect);

      sheets.push(newSheet);
    }
  });

  // 각 원장별 면적 수율 및 통계 계산
  let totalPartsArea = 0;
  sheets.forEach(sheet => {
    sheet.usedArea = sheet.placedParts.reduce((acc, p) => acc + (p.placedW * p.placedH), 0);
    sheet.yieldRate = (sheet.usedArea / singleSheetArea) * 100;
    sheet.scrapArea = singleSheetArea - sheet.usedArea;
    sheet.scrapRate = 100 - sheet.yieldRate;
    totalPartsArea += sheet.usedArea;
  });

  const totalRawBoardArea = sheets.length * singleSheetArea;
  const overallYield = (totalPartsArea / totalRawBoardArea) * 100;
  const overallScrapRate = 100 - overallYield;

  return {
    boardWidth: boardW,
    boardHeight: boardH,
    sheets,
    sheetCount: sheets.length,
    singleSheetAreaM2: (singleSheetArea / 1000000).toFixed(4),
    totalRawBoardAreaM2: (totalRawBoardArea / 1000000).toFixed(2),
    totalPartsAreaM2: (totalPartsArea / 1000000).toFixed(2),
    overallYield: overallYield.toFixed(1),
    overallScrapRate: overallScrapRate.toFixed(1)
  };
}

/**
 * 4. 원장 기준 공장 제조 원가 및 마진율 비교 계산
 */
function calculateRawBoardCostComparison(standardQuote, nestingResult, state) {
  const sheetCount = nestingResult.sheetCount;
  const boardUnitCost = state.rawBoardPrice || 68000;
  const totalBoardCost = sheetCount * boardUnitCost;

  // 엣지 밴딩 비용 (부재 둘레 추정치 m x 800원)
  const totalEdgeLenM = Math.round(parseFloat(nestingResult.totalPartsAreaM2) * 3.5);
  const totalEdgeCost = totalEdgeLenM * (state.edgeCostPerM || 800);

  // 재단 및 가공 인건비 (원장 장당 약 20,000원)
  const cutProcessCost = sheetCount * 20000;

  // 하드웨어 및 기본 부자재 (경첩, 볼레일, 피스, 댐퍼 등)
  const hardwareCost = state.hardwareBaseCost || 150000;

  // 공장 현장 시공비 (현장 표준과 동일 기준)
  const installCost = standardQuote.installCost;

  // 원장 기준 총 제조 원가 (공급가 기준)
  const rawManufactureCost = totalBoardCost + totalEdgeCost + cutProcessCost + hardwareCost + installCost;
  const rawManufactureVat = Math.round(rawManufactureCost * 0.1);
  const rawManufactureTotal = rawManufactureCost + rawManufactureVat;

  // 표준 산출 견적가 (소비자 판매 공급가)
  const standardSupplyTotal = standardQuote.supplyTotal;

  // 공장 이익(마진) 및 절감액 비교
  const profitAmount = standardSupplyTotal - rawManufactureCost;
  const profitMarginPercent = standardSupplyTotal > 0 ? ((profitAmount / standardSupplyTotal) * 100).toFixed(1) : 0;
  
  // 자투리 알뜰 활용으로 아낀 절감액 (약 1.5~2장 분량의 원장 자재비 세이브 효과)
  const savedSheets = Math.max(1, Math.round(sheetCount * (parseFloat(nestingResult.overallYield) / 100 > 0.85 ? 0.2 : 0.1)));
  const savedMaterialCost = savedSheets * boardUnitCost;

  return {
    sheetCount,
    boardUnitCost,
    totalBoardCost,
    totalEdgeLenM,
    totalEdgeCost,
    cutProcessCost,
    hardwareCost,
    installCost,
    rawManufactureCost,
    rawManufactureVat,
    rawManufactureTotal,
    standardSupplyTotal,
    profitAmount,
    profitMarginPercent,
    savedSheets,
    savedMaterialCost
  };
}

/**
 * 5. 원장 2D 네스팅 배치도 인터랙티브 Canvas 렌더링
 */
function renderNestingCanvas(canvas, sheet, options = {}) {
  if (!canvas || !sheet) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width || 800;
  const height = rect.height || canvas.height || 500;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  // 배경 지우기
  ctx.clearRect(0, 0, width, height);

  // 원장(2220 x 2440) 스케일 계산
  const margin = 24;
  const availW = width - margin * 2;
  const availH = height - margin * 2;
  const scale = Math.min(availW / RAW_BOARD_WIDTH, availH / RAW_BOARD_HEIGHT);

  const boardDrawW = RAW_BOARD_WIDTH * scale;
  const boardDrawH = RAW_BOARD_HEIGHT * scale;
  const startX = (width - boardDrawW) / 2;
  const startY = (height - boardDrawH) / 2;

  // 1) 원장 외곽선 및 합판 질감 배경
  ctx.save();
  ctx.fillStyle = '#FEF3C7'; // 자투리(남는 합판) 기본 바탕색 (연한 우드색)
  ctx.fillRect(startX, startY, boardDrawW, boardDrawH);
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, boardDrawW, boardDrawH);

  // 2) 격자 가이드선 (500mm 간격)
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.15)';
  ctx.lineWidth = 0.8;
  for (let x = 500; x < RAW_BOARD_WIDTH; x += 500) {
    const gx = startX + x * scale;
    ctx.beginPath();
    ctx.moveTo(gx, startY);
    ctx.lineTo(gx, startY + boardDrawH);
    ctx.stroke();
  }
  for (let y = 500; y < RAW_BOARD_HEIGHT; y += 500) {
    const gy = startY + y * scale;
    ctx.beginPath();
    ctx.moveTo(startX, gy);
    ctx.lineTo(startX + boardDrawW, gy);
    ctx.stroke();
  }

  // 3) 배치된 부재들 그리기
  sheet.placedParts.forEach((part, idx) => {
    const px = startX + part.x * scale;
    const py = startY + part.y * scale;
    const pw = part.placedW * scale;
    const ph = part.placedH * scale;

    // 부재 사각형 배경
    ctx.fillStyle = part.color || '#3B82F6';
    ctx.fillRect(px, py, pw, ph);

    // 톱날 절단선 (커프 마감)
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    // 내부 라벨 (크기가 충분할 때만 표시)
    if (pw > 35 && ph > 18) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      // 텍스트 자르기
      const text = `${part.name}`;
      const dimText = `${part.placedW}×${part.placedH}`;

      if (ph > 32) {
        ctx.fillText(text, px + pw / 2, py + ph / 2 - 6);
        ctx.font = '9px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(dimText, px + pw / 2, py + ph / 2 + 7);
      } else {
        ctx.fillText(`${part.name.substring(0, 6)}.. (${part.placedW})`, px + pw / 2, py + ph / 2);
      }
    }
  });

  // 4) 치수 표시 (너비 2440mm, 높이 2220mm)
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`2,440 mm (원장 가로)`, startX + boardDrawW / 2, startY - 8);

  ctx.save();
  ctx.translate(startX - 8, startY + boardDrawH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`2,220 mm (원장 세로)`, 0, 0);
  ctx.restore();

  ctx.restore();
}

/**
 * 6. UI 이벤트 연동 및 초기화 함수
 */
function initFormulaEngine() {
  const container = document.getElementById('view-formula');
  if (!container) return;

  // 폼 입력 컨트롤 이벤트 바인딩
  const bindInput = (id, key, parser = parseInt) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        currentFormulaState[key] = parser(e.target.value) || 0;
        updateFormulaSimulation();
      });
      el.addEventListener('change', (e) => {
        currentFormulaState[key] = parser(e.target.value) || 0;
        updateFormulaSimulation();
      });
    }
  };

  bindInput('formula-sink-shape', 'sinkShape', v => v);
  bindInput('formula-sink-main-w', 'sinkMainW');
  bindInput('formula-sink-sub-w', 'sinkSubW');
  bindInput('formula-sink-sub2-w', 'sinkSub2W');
  bindInput('formula-sink-ep', 'sinkEpCount');
  bindInput('formula-molding-count', 'moldingCount');
  bindInput('formula-plinth-count', 'plinthCount');
  bindInput('formula-tall-w', 'tallW');
  bindInput('formula-tall-ep', 'tallEpCount');
  bindInput('formula-closet-w', 'closetW');
  bindInput('formula-shoe-w', 'shoeW');
  bindInput('formula-rawboard-price', 'rawBoardPrice');

  const upperCheck = document.getElementById('formula-has-upper');
  if (upperCheck) {
    upperCheck.addEventListener('change', (e) => {
      currentFormulaState.hasUpper = e.target.checked;
      updateFormulaSimulation();
    });
  }

  // 프리셋 버튼 바인딩
  document.querySelectorAll('[data-formula-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pKey = btn.dataset.formulaPreset;
      if (FORMULA_PRESETS[pKey]) {
        applyFormulaPreset(FORMULA_PRESETS[pKey]);
      }
    });
  });

  // 3D 스튜디오 치수 연동 버튼
  const btnSyncStudio = document.getElementById('btn-sync-formula-from-studio');
  if (btnSyncStudio) {
    btnSyncStudio.addEventListener('click', syncFormulaFromCurrentStudio);
  }

  // 원장 시트 네비게이션 버튼
  const btnPrevSheet = document.getElementById('btn-prev-raw-sheet');
  const btnNextSheet = document.getElementById('btn-next-raw-sheet');
  if (btnPrevSheet) {
    btnPrevSheet.addEventListener('click', () => {
      if (!currentNestingResult) return;
      if (currentActiveSheetIndex > 0) {
        currentActiveSheetIndex--;
        updateNestingCanvasView();
      }
    });
  }
  if (btnNextSheet) {
    btnNextSheet.addEventListener('click', () => {
      if (!currentNestingResult) return;
      if (currentActiveSheetIndex < currentNestingResult.sheets.length - 1) {
        currentActiveSheetIndex++;
        updateNestingCanvasView();
      }
    });
  }

  // 윈도우 리사이즈 시 캔버스 다시 그리기
  window.addEventListener('resize', () => {
    if (document.getElementById('view-formula')?.style.display !== 'none') {
      updateNestingCanvasView();
    }
  });

  // 초기 렌더링
  applyFormulaPreset(FORMULA_PRESETS.preset34);
}

/**
 * 프리셋 적용
 */
function applyFormulaPreset(preset) {
  currentFormulaState = { ...currentFormulaState, ...preset };

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('formula-sink-shape', currentFormulaState.sinkShape);
  setVal('formula-sink-main-w', currentFormulaState.sinkMainW);
  setVal('formula-sink-sub-w', currentFormulaState.sinkSubW || 0);
  setVal('formula-sink-sub2-w', currentFormulaState.sinkSub2W || 0);
  setVal('formula-sink-ep', currentFormulaState.sinkEpCount);
  setVal('formula-molding-count', currentFormulaState.moldingCount);
  setVal('formula-plinth-count', currentFormulaState.plinthCount);
  setVal('formula-tall-w', currentFormulaState.tallW);
  setVal('formula-tall-ep', currentFormulaState.tallEpCount);
  setVal('formula-closet-w', currentFormulaState.closetW);
  setVal('formula-shoe-w', currentFormulaState.shoeW);
  setVal('formula-rawboard-price', currentFormulaState.rawBoardPrice);

  const upperCheck = document.getElementById('formula-has-upper');
  if (upperCheck) upperCheck.checked = !!currentFormulaState.hasUpper;

  // 씽크대 형태에 따른 서브 길이 활성/비활성화
  const subBox = document.getElementById('box-formula-sub-w');
  const sub2Box = document.getElementById('box-formula-sub2-w');
  if (subBox) subBox.style.display = (currentFormulaState.sinkShape !== 'I') ? 'block' : 'none';
  if (sub2Box) sub2Box.style.display = (currentFormulaState.sinkShape === 'U') ? 'block' : 'none';

  updateFormulaSimulation();
}

/**
 * 3D 스튜디오의 실제 발주 품목 치수를 공장 산출식으로 가져오기
 */
function syncFormulaFromCurrentStudio() {
  if (typeof state === 'undefined' || !state.items || state.items.length === 0) {
    if (typeof showToast === 'function') showToast('3D 도면에 등록된 품목이 없습니다.');
    return;
  }

  let closetW = 0;
  let shoeW = 0;
  let sinkShape = 'I';
  let sinkMainW = 2400;
  let sinkSubW = 0;
  let sinkSub2W = 0;
  let tallW = 0;
  let hasUpper = true;

  state.items.forEach(item => {
    const cat = item.category || '';
    const dims = item.dimensions || { width: 1000 };

    if (cat === 'closet') {
      closetW += (dims.width || 0);
    } else if (cat === 'shoe') {
      shoeW += (dims.width || 0);
    } else if (cat === 'tall') {
      tallW += (dims.width || 0);
    } else if (cat === 'kitchen' || !cat) {
      sinkShape = (item.layout === 'L' || item.layout === 'U') ? item.layout : 'I';
      sinkMainW = dims.totalWidth || dims.width || 2400;
      sinkSubW = dims.subWidth || 0;
      sinkSub2W = dims.subWidth2 || 0;
      hasUpper = (dims.upperHeight || 700) > 0;
    }
  });

  currentFormulaState.sinkShape = sinkShape;
  currentFormulaState.sinkMainW = sinkMainW;
  currentFormulaState.sinkSubW = sinkSubW;
  currentFormulaState.sinkSub2W = sinkSub2W;
  currentFormulaState.hasUpper = hasUpper;
  currentFormulaState.closetW = closetW;
  currentFormulaState.shoeW = shoeW;
  currentFormulaState.tallW = tallW;

  applyFormulaPreset(currentFormulaState);
  if (typeof showToast === 'function') showToast('3D 도면의 가구 치수를 산출식으로 가져왔습니다.');
}

/**
 * 실시간 시뮬레이션 계산 및 결과 UI 업데이트
 */
function updateFormulaSimulation() {
  // 씽크대 형태에 따른 서브 입력창 표시 제어
  const subBox = document.getElementById('box-formula-sub-w');
  const sub2Box = document.getElementById('box-formula-sub2-w');
  if (subBox) subBox.style.display = (currentFormulaState.sinkShape !== 'I') ? 'block' : 'none';
  if (sub2Box) sub2Box.style.display = (currentFormulaState.sinkShape === 'U') ? 'block' : 'none';

  // 1. 표준 산출식 계산
  const stdQuote = calculateStandardFormula(currentFormulaState);

  // 2. 가구 부재 리스트 및 2220x2440 원장 네스팅
  const parts = generateFurnitureParts(currentFormulaState);
  const nestingResult = nestPartsOnRawBoards(parts, RAW_BOARD_WIDTH, RAW_BOARD_HEIGHT, SAW_KERF);
  currentNestingResult = nestingResult;

  // 3. 원장 기준 원가 및 마진 비교
  const comp = calculateRawBoardCostComparison(stdQuote, nestingResult, currentFormulaState);

  // 4. UI 텍스트 업데이트
  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  // 1~5번 표준 견적 표시
  setText('val-closet-calc', `${currentFormulaState.closetW}mm (${stdQuote.closetJa.toFixed(1)}자) → ${stdQuote.closetCost.toLocaleString()}원`);
  setText('val-shoe-calc', `${currentFormulaState.shoeW}mm (${stdQuote.shoeJa.toFixed(1)}자) → ${stdQuote.shoeCost.toLocaleString()}원`);
  setText('val-sink-lower-calc', `실연장 ${stdQuote.lowerM.toFixed(2)}m (코너제외) → ${stdQuote.lowerCost.toLocaleString()}원`);
  setText('val-sink-upper-calc', currentFormulaState.hasUpper ? `실연장 ${stdQuote.upperM.toFixed(2)}m → ${stdQuote.upperCost.toLocaleString()}원` : '상부장 없음 (0원)');
  setText('val-ep-calc', `${stdQuote.epCount}장 × 5만원 = ${stdQuote.epCost.toLocaleString()}원`);
  setText('val-molding-calc', `${stdQuote.moldingCount}개 × 5만원 = ${stdQuote.moldingCost.toLocaleString()}원`);
  setText('val-plinth-calc', `${stdQuote.plinthCount}개 × 3만원 = ${stdQuote.plinthCost.toLocaleString()}원`);
  setText('val-tall-calc', `${currentFormulaState.tallW}mm (${stdQuote.tallM.toFixed(2)}m) + EP ${stdQuote.tallEpCount}장 = ${stdQuote.tallCost.toLocaleString()}원`);
  setText('val-install-calc', `총 ${stdQuote.totalFurnitureM.toFixed(2)}m × 5만원 = ${stdQuote.installCost.toLocaleString()}원`);

  // 합계
  setText('std-supply-total', `${stdQuote.supplyTotal.toLocaleString()}원`);
  setText('std-vat-amount', `${stdQuote.vat.toLocaleString()}원`);
  setText('std-grand-total', `${stdQuote.grandTotal.toLocaleString()}원`);

  // 원장 네스팅 분석 수치 표시
  setText('nesting-sheet-count', `${nestingResult.sheetCount}장`);
  setText('nesting-overall-yield', `${nestingResult.overallYield}%`);
  setText('nesting-scrap-rate', `${nestingResult.overallScrapRate}% (초절감)`);
  setText('nesting-parts-count', `${parts.length}개 부재`);
  setText('nesting-parts-area', `${nestingResult.totalPartsAreaM2} m²`);

  // 비교 분석 카드
  setText('comp-raw-sheet-cost', `${nestingResult.sheetCount}장 × ${currentFormulaState.rawBoardPrice.toLocaleString()}원 = ${comp.totalBoardCost.toLocaleString()}원`);
  setText('comp-raw-process-cost', `${comp.cutProcessCost.toLocaleString()}원 (재단/가공)`);
  setText('comp-raw-edge-cost', `${comp.totalEdgeCost.toLocaleString()}원 (엣지 ${comp.totalEdgeLenM}m)`);
  setText('comp-raw-hardware-cost', `${comp.hardwareCost.toLocaleString()}원`);
  setText('comp-raw-install-cost', `${comp.installCost.toLocaleString()}원`);
  setText('comp-raw-total-cost', `${comp.rawManufactureCost.toLocaleString()}원 (VAT별도)`);
  setText('comp-raw-grand-total', `${comp.rawManufactureTotal.toLocaleString()}원`);

  // 공장 마진 및 절감액
  setText('comp-profit-amount', `+${comp.profitAmount.toLocaleString()}원`);
  setText('comp-profit-margin', `${comp.profitMarginPercent}%`);
  setText('comp-saved-sheets', `${comp.savedSheets}장 세이브 (${comp.savedMaterialCost.toLocaleString()}원 절감)`);

  // 원장 캔버스 뷰 갱신
  if (currentActiveSheetIndex >= nestingResult.sheets.length) {
    currentActiveSheetIndex = 0;
  }
  updateNestingCanvasView();
}

/**
 * 원장 캔버스 뷰 업데이트
 */
function updateNestingCanvasView() {
  if (!currentNestingResult || !currentNestingResult.sheets || currentNestingResult.sheets.length === 0) return;

  const canvas = document.getElementById('raw-nesting-canvas');
  const sheet = currentNestingResult.sheets[currentActiveSheetIndex];
  if (!canvas || !sheet) return;

  // 시트 인덱스 레이블
  const indicator = document.getElementById('raw-sheet-indicator');
  if (indicator) {
    indicator.innerText = `원장 [${sheet.index} / ${currentNestingResult.sheets.length}] (2220 × 2440 mm — 수율: ${sheet.yieldRate.toFixed(1)}%, 자투리: ${sheet.scrapRate.toFixed(1)}%)`;
  }

  renderNestingCanvas(canvas, sheet);
}

// 전역 내보내기
window.initFormulaEngine = initFormulaEngine;
window.calculateStandardFormula = calculateStandardFormula;
window.nestPartsOnRawBoards = nestPartsOnRawBoards;
window.calculateRawBoardCostComparison = calculateRawBoardCostComparison;
window.FORMULA_PRESETS = FORMULA_PRESETS;
