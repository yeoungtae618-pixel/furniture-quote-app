/**
 * 피앙세가구 (Fiance Furniture) - 공장 가구 산출식 및 원장(2220x2440mm) 자투리 극대화 절단 네스팅 엔진
 * 
 * [가구 산출식 핵심 공식]
 * 1. 붙박이장, 신발장: 높이 무관 자(300mm) 당 120,000원 (VAT 별도)
 * 2. 씽크대: m(1000mm) 당 250,000원 (VAT 별도), 상부장/하부장 별도 계산, 코너 중복(하부 600mm, 상부 350mm) 제외
 *    - EP (측면 마감판): 양끝 노출면 약 5장, 장당 50,000원
 * 3. 몰딩: 평균 3개, 개당 50,000원 / 걸레받이: 개당 30,000원 (일자 1개, 코너마다 1개씩 추가)
 * 4. 시공비:
 *    - 일반 가구(씽크대, 키큰장, 신발장): 실연장 m당 50,000원 (VAT 별도)
 *    - 붙박이장 시공비: 자(300mm)당 20,000원 (VAT 별도)
 * 5. 키큰장: 3개 장 복합 모듈, 폭 m 기준 적용, EP 1~2장(장당 100,000원)
 * 6. 상판 (인조대리석): m당 220,000원 (VAT 별도)
 * 7. 문짝 (도어): 개당 35,000원 (VAT 별도), 보통 600mm당 1개씩 적용
 * 8. 붙박이장 슬라이딩 도어: 선택 시 자당 추가 비용 (기본 자당 20,000원)
 * 
 * [원장(Raw Board) 네스팅 & 공장 원가 계산 규칙]
 * - 원목원장 규격: 2220 x 2440 mm (장당 보통 50,000원으로 계산)
 * - 원목원장으로는 문짝, EP, 몰딩을 만들지 않음! 오직 순수 가구 몸통(Carcase) 부재만 재단!
 * - 문짝은 완제품으로 별도 구매(사입)하며 원가 개당 약 20,000원(2만원)으로 계산
 * - EP 및 몰딩도 완제품 사입 자재로 원가 계산에 포함
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
    plinthCount: 2,
    tallW: 600,
    tallEpCount: 1,
    closetW: 3000, // 10자 (3000mm)
    closetInstallCostPerJa: 20000,
    closetIsSliding: false,
    closetSlidingExtraPerJa: 20000,
    shoeW: 0,
    hasCountertop: true,
    countertopPricePerM: 220000,
    doorPricePerPiece: 35000,
    rawBoardPrice: 50000, // 원장은 보통 5만원으로 계산
    doorPurchasePrice: 20000 // 문짝 별도 구매 원가 개당 2만원
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
    closetInstallCostPerJa: 20000,
    closetIsSliding: false,
    closetSlidingExtraPerJa: 20000,
    shoeW: 900,
    hasCountertop: true,
    countertopPricePerM: 220000,
    doorPricePerPiece: 35000,
    rawBoardPrice: 50000,
    doorPurchasePrice: 20000
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
    plinthCount: 3,
    tallW: 1200,
    tallEpCount: 2,
    closetW: 3600,
    closetInstallCostPerJa: 20000,
    closetIsSliding: true,
    closetSlidingExtraPerJa: 20000,
    shoeW: 1200,
    hasCountertop: true,
    countertopPricePerM: 220000,
    doorPricePerPiece: 35000,
    rawBoardPrice: 50000,
    doorPurchasePrice: 20000
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
  closetInstallCostPerJa: 20000,
  closetIsSliding: false,
  closetSlidingExtraPerJa: 20000,
  shoeW: 0,
  hasCountertop: true,
  countertopM: null,
  countertopPricePerM: 220000,
  doorCount: null,
  doorPricePerPiece: 35000,
  rawBoardPrice: 50000,        // 원장 보통 5만원
  doorPurchasePrice: 20000,    // 문짝 별도 구매 원가 개당 2만원
  edgeCostPerM: 800,
  hardwareBaseCost: 150000,
  installCostPerM: 50000
};

let currentNestingResult = null;
let currentActiveSheetIndex = 0;

/**
 * 1. 현장 표준 가구 산출식 계산 (규칙 1~8)
 */
function calculateStandardFormula(state) {
  // 1) 붙박이장 & 신발장 (자 당 120,000원, 1자 = 300mm)
  const closetJa = (state.closetW || 0) / 300;
  const closetCost = Math.round(closetJa * 120000);

  const shoeJa = (state.shoeW || 0) / 300;
  const shoeCost = Math.round(shoeJa * 120000);

  // 붙박이장 슬라이딩 도어 추가 비용
  const closetIsSliding = !!state.closetIsSliding;
  const closetSlidingExtraPerJa = state.closetSlidingExtraPerJa !== undefined ? state.closetSlidingExtraPerJa : 20000;
  const closetSlidingCost = (state.closetW > 0 && closetIsSliding) ? Math.round(closetJa * closetSlidingExtraPerJa) : 0;

  // 2) 씽크대 (m당 250,000원, 코너 중복 제외, 상부/하부 별도)
  let lowerM = 0;
  let upperM = 0;
  const mainM = (state.sinkMainW || 0) / 1000;
  const subM = (state.sinkSubW || 0) / 1000;
  const sub2M = (state.sinkSub2W || 0) / 1000;

  if (state.sinkShape === 'I') {
    lowerM = mainM;
    upperM = state.hasUpper ? mainM : 0;
  } else if (state.sinkShape === 'L') {
    lowerM = Math.max(0, mainM + Math.max(0, subM - 0.6));
    upperM = state.hasUpper ? Math.max(0, mainM + Math.max(0, subM - 0.35)) : 0;
  } else if (state.sinkShape === 'U') {
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

  // 5) 시공비 분리 산출
  const closetInstallCostPerJa = state.closetInstallCostPerJa !== undefined ? state.closetInstallCostPerJa : 20000;
  const closetInstallCost = (state.closetW > 0) ? Math.round(closetJa * closetInstallCostPerJa) : 0;

  const shoeM = (state.shoeW || 0) / 1000;
  const generalFurnitureM = lowerM + tallM + shoeM;
  const generalInstallCost = Math.round(generalFurnitureM * (state.installCostPerM || 50000));

  const totalInstallCost = generalInstallCost + closetInstallCost;
  const totalFurnitureM = generalFurnitureM + (closetJa * 0.3);

  // 6) 상판 (인조대리석): m당 220,000원 (VAT 별도)
  const hasCountertop = state.hasCountertop !== false;
  const countertopM = (state.countertopM !== null && state.countertopM !== undefined && state.countertopM >= 0) ? 
                      state.countertopM : lowerM;
  const countertopPricePerM = state.countertopPricePerM || 220000;
  const countertopCost = hasCountertop ? Math.round(countertopM * countertopPricePerM) : 0;

  // 7) 문짝 (도어): 개당 35,000원 (VAT 별도) - 보통 600mm당 1개씩 들어감
  const lowerDoors = Math.max(0, Math.round((lowerM * 1000) / 600));
  const upperDoors = state.hasUpper ? Math.max(0, Math.round((upperM * 1000) / 600)) : 0;
  const tallDoors = (state.tallW || 0) > 0 ? Math.max(1, Math.round((state.tallW || 0) / 600) * 3) : 0;
  const closetDoors = (state.closetW || 0) > 0 ? 
                      (closetIsSliding ? Math.max(2, Math.round((state.closetW || 0) / 1000)) : Math.max(1, Math.round((state.closetW || 0) / 600))) : 0;
  const shoeDoors = (state.shoeW || 0) > 0 ? Math.max(1, Math.round((state.shoeW || 0) / 600)) : 0;
  const autoCalculatedDoors = lowerDoors + upperDoors + tallDoors + closetDoors + shoeDoors;

  const doorCount = (state.doorCount !== null && state.doorCount !== undefined && state.doorCount >= 0) ?
                    state.doorCount : autoCalculatedDoors;
  const doorPricePerPiece = state.doorPricePerPiece || 35000;
  const doorCost = Math.round(doorCount * doorPricePerPiece);

  // 품목별 합산 (공급가액, VAT 별도)
  const supplyTotal = closetCost + shoeCost + sinkBaseCost + epCost + moldingCost + plinthCost + tallCost + 
                      generalInstallCost + closetInstallCost + closetSlidingCost + countertopCost + doorCost;
  const vat = Math.round(supplyTotal * 0.1);
  const grandTotal = supplyTotal + vat;

  return {
    closetJa,
    closetCost,
    closetIsSliding,
    closetSlidingExtraPerJa,
    closetSlidingCost,
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
    generalFurnitureM,
    generalInstallCost,
    closetInstallCostPerJa,
    closetInstallCost,
    totalFurnitureM,
    installCost: totalInstallCost,
    totalInstallCost,
    hasCountertop,
    countertopM,
    countertopPricePerM,
    countertopCost,
    autoCalculatedDoors,
    lowerDoors,
    upperDoors,
    tallDoors,
    closetDoors,
    shoeDoors,
    doorCount,
    doorPricePerPiece,
    doorCost,
    supplyTotal,
    vat,
    grandTotal
  };
}

/**
 * 2. 원장(2220 x 2440 mm) 기준 가구 부재 목록 생성
 * ★ 사용자 규칙: 원목원장으로 문짝, EP, 몰딩은 만들지 않음! 오직 순수 몸통(Carcase) 부재만 재단!
 */
function generateFurnitureParts(state) {
  const parts = [];

  const COLORS = {
    carcase: '#3B82F6',   // 측판/천지판 (파랑)
    shelf: '#10B981',     // 선반/인출판 (초록)
    back: '#8B5CF6',      // 백패널 (보라)
    filler: '#6B7280'     // 보강대/자투리활용 쫄대 (회색)
  };

  // 1) 씽크대 하부장 몸통 부재 (문짝, EP 제외)
  const lowerLen = (state.sinkShape === 'I') ? state.sinkMainW :
                   (state.sinkShape === 'L') ? (state.sinkMainW + Math.max(0, state.sinkSubW - 600)) :
                   (state.sinkMainW + Math.max(0, state.sinkSubW - 600) + Math.max(0, (state.sinkSub2W || 1200) - 600));
  
  const lowerBoxCount = Math.max(1, Math.round(lowerLen / 800));
  const boxW = Math.round(lowerLen / lowerBoxCount);

  for (let i = 0; i < lowerBoxCount; i++) {
    parts.push({ name: `하부장[${i+1}] 측판L`, w: 820, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `하부장[${i+1}] 측판R`, w: 820, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `하부장[${i+1}] 지판`, w: Math.min(boxW, 1100), h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `하부장[${i+1}] 선반`, w: Math.min(boxW, 1100), h: 540, color: COLORS.shelf, type: 'shelf' });
    parts.push({ name: `하부[${i+1}] 백패널`, w: 720, h: Math.min(boxW, 1100), color: COLORS.back, type: 'back' });
    parts.push({ name: `하부[${i+1}] 상부보강대1`, w: Math.min(boxW, 1100), h: 100, color: COLORS.filler, type: 'filler' });
    parts.push({ name: `하부[${i+1}] 상부보강대2`, w: Math.min(boxW, 1100), h: 100, color: COLORS.filler, type: 'filler' });
  }

  // 2) 씽크대 상부장 몸통 부재 (문짝, 몰딩 제외)
  if (state.hasUpper) {
    const upperBoxCount = lowerBoxCount;
    const uBoxW = boxW;
    for (let i = 0; i < upperBoxCount; i++) {
      parts.push({ name: `상부장[${i+1}] 측판L`, w: 700, h: 330, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `상부장[${i+1}] 측판R`, w: 700, h: 330, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `상부장[${i+1}] 천판`, w: Math.min(uBoxW, 1100), h: 330, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `상부장[${i+1}] 지판`, w: Math.min(uBoxW, 1100), h: 330, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `상부장[${i+1}] 선반`, w: Math.min(uBoxW, 1100), h: 310, color: COLORS.shelf, type: 'shelf' });
      parts.push({ name: `상부[${i+1}] 백패널`, w: 680, h: Math.min(uBoxW, 1100), color: COLORS.back, type: 'back' });
    }
  }

  // 3) 키큰장 몸통 부재 (문짝, 전장EP 제외)
  if (state.tallW > 0) {
    const tW = state.tallW;
    parts.push({ name: `키큰장 측판L`, w: 2150, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `키큰장 측판R`, w: 2150, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `키큰장 천판`, w: tW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `키큰장 지판`, w: tW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
    for (let s = 1; s <= 3; s++) {
      parts.push({ name: `키큰장 고정선반${s}`, w: tW - 36, h: 560, color: COLORS.shelf, type: 'shelf' });
    }
    parts.push({ name: `키큰장 밥솥인출판`, w: tW - 40, h: 450, color: COLORS.shelf, type: 'shelf' });
    parts.push({ name: `키큰장 백패널`, w: 2100, h: tW - 4, color: COLORS.back, type: 'back' });
  }

  // 4) 붙박이장 몸통 부재 (문짝 제외, 레일목만 포함)
  if (state.closetW > 0) {
    const isSliding = !!state.closetIsSliding;
    const cBoxCount = Math.max(1, Math.round(state.closetW / 900));
    const cBoxW = Math.round(state.closetW / cBoxCount);
    for (let i = 0; i < cBoxCount; i++) {
      parts.push({ name: `붙박이[${i+1}] 측판L`, w: 2300, h: 580, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `붙박이[${i+1}] 측판R`, w: 2300, h: 580, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `붙박이[${i+1}] 천판`, w: cBoxW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `붙박이[${i+1}] 지판`, w: cBoxW - 36, h: 580, color: COLORS.carcase, type: 'carcase' });
      parts.push({ name: `붙박이[${i+1}] 중선반`, w: cBoxW - 36, h: 560, color: COLORS.shelf, type: 'shelf' });
      parts.push({ name: `붙박이[${i+1}] 하선반`, w: cBoxW - 36, h: 560, color: COLORS.shelf, type: 'shelf' });
      parts.push({ name: `붙박이[${i+1}] 백패널`, w: 2260, h: cBoxW - 4, color: COLORS.back, type: 'back' });
    }

    if (isSliding) {
      // 슬라이딩 레일 지지 상하부 가이드목만 몸통 원장 재단
      parts.push({ name: `슬라이딩 상부 레일목`, w: state.closetW, h: 100, color: COLORS.filler, type: 'filler' });
      parts.push({ name: `슬라이딩 하부 레일목`, w: state.closetW, h: 100, color: COLORS.filler, type: 'filler' });
    }
  }

  // 5) 신발장 몸통 부재 (문짝 제외)
  if (state.shoeW > 0) {
    const sBoxW = state.shoeW;
    parts.push({ name: `신발장 측판L`, w: 2200, h: 350, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `신발장 측판R`, w: 2200, h: 350, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `신발장 천판`, w: sBoxW - 36, h: 350, color: COLORS.carcase, type: 'carcase' });
    parts.push({ name: `신발장 지판`, w: sBoxW - 36, h: 350, color: COLORS.carcase, type: 'carcase' });
    for (let k = 1; k <= 5; k++) {
      parts.push({ name: `신발장 선반${k}`, w: sBoxW - 36, h: 330, color: COLORS.shelf, type: 'shelf' });
    }
    parts.push({ name: `신발장 백패널`, w: 2160, h: sBoxW - 4, color: COLORS.back, type: 'back' });
  }

  // 6) 몸통 결합용 코너 보강 쫄대들 (원장 자투리 틈새 알뜰 활용)
  const fillerCount = Math.max(4, Math.round(lowerLen / 500));
  for (let f = 1; f <= fillerCount; f++) {
    parts.push({ name: `몸통 코너보강재${f}`, w: 600, h: 80, color: COLORS.filler, type: 'filler' });
    parts.push({ name: `하부 수평지지대${f}`, w: 450, h: 80, color: COLORS.filler, type: 'filler' });
  }

  return parts;
}

/**
 * 3. 2220 x 2440 mm 원장 2D 네스팅 알고리즘
 */
function nestPartsOnRawBoards(partsList, boardW = RAW_BOARD_WIDTH, boardH = RAW_BOARD_HEIGHT, kerf = SAW_KERF) {
  if (!partsList || partsList.length === 0) {
    const singleSheetArea = boardW * boardH;
    return {
      boardWidth: boardW,
      boardHeight: boardH,
      sheets: [{
        index: 1,
        width: boardW,
        height: boardH,
        placedParts: [],
        freeRects: [{ x: 0, y: 0, w: boardW, h: boardH }],
        usedArea: 0,
        yieldRate: 0,
        scrapArea: singleSheetArea,
        scrapRate: 0
      }],
      sheetCount: 0,
      singleSheetAreaM2: (singleSheetArea / 1000000).toFixed(4),
      totalRawBoardAreaM2: '0.00',
      totalPartsAreaM2: '0.00',
      overallYield: '0.0',
      overallScrapRate: '0.0'
    };
  }
  const sortedParts = [...partsList].map(p => {
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
      freeRects: [{ x: 0, y: 0, w: boardW, h: boardH }]
    };
  }

  sheets.push(createNewSheet());

  sortedParts.forEach(part => {
    let placed = false;

    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const sheet = sheets[sIdx];
      let bestRectIdx = -1;
      let bestShortSideFit = Infinity;
      let bestRotate = false;

      for (let rIdx = 0; rIdx < sheet.freeRects.length; rIdx++) {
        const fr = sheet.freeRects[rIdx];

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

        sheet.placedParts.push({
          ...part,
          x: fr.x,
          y: fr.y,
          placedW: pw,
          placedH: ph,
          rotated: bestRotate
        });

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
 * ★ 원장 보통 5만원 계산 + 문짝 별도 구매(개당 2만원) + EP/몰딩 외주비 포함
 */
function calculateRawBoardCostComparison(standardQuote, nestingResult, state) {
  const sheetCount = nestingResult.sheetCount || 0;
  const boardUnitCost = state.rawBoardPrice || 50000; // 원장 보통 5만원
  const totalBoardCost = sheetCount * boardUnitCost;

  // 1) 문짝(도어) 완제품 별도 구매(사입) 비용: 개당 약 20,000원 (2만원)
  const doorPurchasePrice = state.doorPurchasePrice || 20000;
  const doorPurchaseCost = Math.round((standardQuote.doorCount || 0) * doorPurchasePrice);

  // 2) EP 및 몰딩/걸레받이 완제품 사입 비용 (원목원장 미제작 품목)
  const epUnitPurchase = 25000; // EP 장당 약 2.5만 매입
  const epPurchaseCost = ((standardQuote.epCount || 0) + (standardQuote.tallEpCount || 0)) * epUnitPurchase;
  const moldingUnitPurchase = 15000; // 몰딩/걸레받이 개당 약 1.5만 매입
  const moldingPurchaseCost = ((standardQuote.moldingCount || 0) + (standardQuote.plinthCount || 0)) * moldingUnitPurchase;
  const finishMaterialCost = epPurchaseCost + moldingPurchaseCost;

  // 3) 엣지 밴딩 비용 (몸통 부재 둘레 기준 m x 800원)
  const totalPartsArea = parseFloat(nestingResult.totalPartsAreaM2 || 0);
  const totalEdgeLenM = Math.round(totalPartsArea * 3.5);
  const totalEdgeCost = totalEdgeLenM * (state.edgeCostPerM || 800);

  // 4) 재단 및 가공 인건비 (원장 장당 약 20,000원)
  const cutProcessCost = sheetCount * 20000;

  // 5) 하드웨어 및 기본 부자재 (경첩, 볼레일, 피스 등)
  let hardwareCost = (sheetCount > 0 || (standardQuote.supplyTotal || 0) > 0) ? (state.hardwareBaseCost || 150000) : 0;
  if (standardQuote.closetIsSliding && (standardQuote.closetCost || 0) > 0) {
    hardwareCost += 60000; // 슬라이딩 댐퍼/알루미늄 레일 하드웨어 원가
  }

  // 6) 현장 시공비 (붙박이장 자당 2만 + 일반 가구 m당 5만)
  const installCost = standardQuote.totalInstallCost || 0;

  // 7) 외주 대리석 상판 납품 원가 (m당 약 130,000원)
  const countertopRawCost = (standardQuote.hasCountertop && (standardQuote.countertopM || 0) > 0) ? Math.round(standardQuote.countertopM * 130000) : 0;

  // 원장 기준 총 순제조 원가 (공급가 기준)
  const rawManufactureCost = (sheetCount === 0 && (standardQuote.supplyTotal || 0) === 0) ? 0 :
    (totalBoardCost + doorPurchaseCost + finishMaterialCost + totalEdgeCost + cutProcessCost + hardwareCost + installCost + countertopRawCost);
  const rawManufactureVat = Math.round(rawManufactureCost * 0.1);
  const rawManufactureTotal = rawManufactureCost + rawManufactureVat;

  // 표준 산출 견적가 (소비자 판매 공급가)
  const standardSupplyTotal = standardQuote.supplyTotal || 0;

  // 공장 이익(마진) 및 절감액 비교
  const profitAmount = (standardSupplyTotal > 0 || rawManufactureCost > 0) ? (standardSupplyTotal - rawManufactureCost) : 0;
  const profitMarginPercent = (standardSupplyTotal > 0 && rawManufactureCost > 0) ? ((profitAmount / standardSupplyTotal) * 100).toFixed(1) : 0;
  
  // 자투리 알뜰 활용으로 아낀 절감액
  const savedSheets = sheetCount > 0 ? Math.max(1, Math.round(sheetCount * (parseFloat(nestingResult.overallYield) / 100 > 0.85 ? 0.2 : 0.1))) : 0;
  const savedMaterialCost = savedSheets * boardUnitCost;

  return {
    sheetCount,
    boardUnitCost,
    totalBoardCost,
    doorPurchaseCost,
    doorPurchasePrice,
    finishMaterialCost,
    epPurchaseCost,
    moldingPurchaseCost,
    totalEdgeLenM,
    totalEdgeCost,
    cutProcessCost,
    hardwareCost,
    installCost,
    countertopRawCost,
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

  ctx.clearRect(0, 0, width, height);

  const margin = 24;
  const availW = width - margin * 2;
  const availH = height - margin * 2;
  const scale = Math.min(availW / RAW_BOARD_WIDTH, availH / RAW_BOARD_HEIGHT);

  const boardDrawW = RAW_BOARD_WIDTH * scale;
  const boardDrawH = RAW_BOARD_HEIGHT * scale;
  const startX = (width - boardDrawW) / 2;
  const startY = (height - boardDrawH) / 2;

  ctx.save();
  ctx.fillStyle = '#FEF3C7';
  ctx.fillRect(startX, startY, boardDrawW, boardDrawH);
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, boardDrawW, boardDrawH);

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

  if (!sheet.placedParts || sheet.placedParts.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('현재 배치할 가구 부재가 없습니다.', startX + boardDrawW / 2, startY + boardDrawH / 2 - 12);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('좌측에서 가구 규격을 입력하거나 프리셋 버튼을 클릭해주세요.', startX + boardDrawW / 2, startY + boardDrawH / 2 + 12);
  }

  sheet.placedParts.forEach((part, idx) => {
    const px = startX + part.x * scale;
    const py = startY + part.y * scale;
    const pw = part.placedW * scale;
    const ph = part.placedH * scale;

    ctx.fillStyle = part.color || '#3B82F6';
    ctx.fillRect(px, py, pw, ph);

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    if (pw > 35 && ph > 18) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

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

/**
 * 6-1. 공장 산출식 전체 입력값 초기화
 */
function resetFormulaState() {
  currentFormulaState = {
    sinkShape: 'I',
    sinkMainW: 0,
    sinkSubW: 0,
    sinkSub2W: 0,
    hasUpper: false,
    sinkEpCount: 0,
    moldingCount: 0,
    plinthCount: 0,
    tallW: 0,
    tallEpCount: 0,
    closetW: 0,
    closetInstallCostPerJa: 20000,
    closetIsSliding: false,
    closetSlidingExtraPerJa: 20000,
    shoeW: 0,
    hasCountertop: false,
    countertopM: 0,
    countertopPricePerM: 220000,
    doorCount: 0,
    doorPricePerPiece: 35000,
    rawBoardPrice: 50000,
    doorPurchasePrice: 20000
  };

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('formula-sink-shape', 'I');
  setVal('formula-sink-main-w', 0);
  setVal('formula-sink-sub-w', 0);
  setVal('formula-sink-sub2-w', 0);
  setVal('formula-sink-ep', 0);
  setVal('formula-molding-count', 0);
  setVal('formula-plinth-count', 0);
  setVal('formula-tall-w', 0);
  setVal('formula-tall-ep', 0);
  setVal('formula-closet-w', 0);
  setVal('formula-closet-install-price', 20000);
  setVal('formula-closet-sliding-extra', 20000);
  setVal('formula-shoe-w', 0);
  setVal('formula-rawboard-price', 50000);
  setVal('formula-countertop-price', 220000);
  setVal('formula-door-price', 35000);
  setVal('formula-countertop-m', '0.00');
  setVal('formula-door-count', '0');

  const upperCheck = document.getElementById('formula-has-upper');
  if (upperCheck) upperCheck.checked = false;

  const ctCheck = document.getElementById('formula-has-countertop');
  if (ctCheck) ctCheck.checked = false;

  const slidingCheck = document.getElementById('formula-closet-is-sliding');
  if (slidingCheck) slidingCheck.checked = false;

  const subBox = document.getElementById('box-formula-sub-w');
  const sub2Box = document.getElementById('box-formula-sub2-w');
  if (subBox) subBox.style.display = 'none';
  if (sub2Box) sub2Box.style.display = 'none';

  const slidingExtraBox = document.getElementById('box-closet-sliding-extra');
  if (slidingExtraBox) slidingExtraBox.style.display = 'none';

  currentActiveSheetIndex = 0;
  updateFormulaSimulation();

  if (typeof showToast === 'function') {
    showToast('공장 산출식 입력값이 모두 초기화되었습니다.');
  }
}

function initFormulaEngine() {
  const container = document.getElementById('view-formula');
  if (!container) return;

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

  bindInput('formula-closet-install-price', 'closetInstallCostPerJa', parseInt);
  bindInput('formula-closet-sliding-extra', 'closetSlidingExtraPerJa', parseInt);

  bindInput('formula-countertop-m', 'countertopM', parseFloat);
  bindInput('formula-countertop-price', 'countertopPricePerM', parseInt);
  bindInput('formula-door-count', 'doorCount', parseInt);
  bindInput('formula-door-price', 'doorPricePerPiece', parseInt);

  const upperCheck = document.getElementById('formula-has-upper');
  if (upperCheck) {
    upperCheck.addEventListener('change', (e) => {
      currentFormulaState.hasUpper = e.target.checked;
      updateFormulaSimulation();
    });
  }

  const countertopCheck = document.getElementById('formula-has-countertop');
  if (countertopCheck) {
    countertopCheck.addEventListener('change', (e) => {
      currentFormulaState.hasCountertop = e.target.checked;
      updateFormulaSimulation();
    });
  }

  const slidingCheck = document.getElementById('formula-closet-is-sliding');
  if (slidingCheck) {
    slidingCheck.addEventListener('change', (e) => {
      currentFormulaState.closetIsSliding = e.target.checked;
      updateFormulaSimulation();
    });
  }

  const btnResetDoor600 = document.getElementById('btn-reset-door-600');
  if (btnResetDoor600) {
    btnResetDoor600.addEventListener('click', () => {
      currentFormulaState.doorCount = null;
      updateFormulaSimulation();
      if (typeof showToast === 'function') showToast('문짝 수량을 600mm당 1개 기준으로 자동 재계산했습니다.');
    });
  }

  const btnResetCountertopM = document.getElementById('btn-reset-countertop-m');
  if (btnResetCountertopM) {
    btnResetCountertopM.addEventListener('click', () => {
      currentFormulaState.countertopM = null;
      updateFormulaSimulation();
      if (typeof showToast === 'function') showToast('상판 연장을 하부장 실연장과 동일하게 자동 동기화했습니다.');
    });
  }

  document.querySelectorAll('[data-formula-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pKey = btn.dataset.formulaPreset;
      if (FORMULA_PRESETS[pKey]) {
        applyFormulaPreset(FORMULA_PRESETS[pKey]);
      }
    });
  });

  // 초기화 버튼 이벤트 바인딩
  const handleResetFormula = () => {
    if (confirm('공장 산출식에 입력된 모든 가구 규격과 수량을 초기화하시겠습니까?')) {
      resetFormulaState();
    }
  };

  const btnResetFormula = document.getElementById('btn-reset-formula');
  if (btnResetFormula) {
    btnResetFormula.addEventListener('click', handleResetFormula);
  }

  const btnResetFormulaCard = document.getElementById('btn-reset-formula-card');
  if (btnResetFormulaCard) {
    btnResetFormulaCard.addEventListener('click', handleResetFormula);
  }

  const btnSyncStudio = document.getElementById('btn-sync-formula-from-studio');
  if (btnSyncStudio) {
    btnSyncStudio.addEventListener('click', syncFormulaFromCurrentStudio);
  }

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

  window.addEventListener('resize', () => {
    if (document.getElementById('view-formula')?.style.display !== 'none') {
      updateNestingCanvasView();
    }
  });

  applyFormulaPreset(FORMULA_PRESETS.preset34);
}

/**
 * 프리셋 적용
 */
function applyFormulaPreset(preset) {
  currentFormulaState = { ...currentFormulaState, ...preset };
  currentFormulaState.countertopM = null;
  currentFormulaState.doorCount = null;

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
  setVal('formula-closet-install-price', currentFormulaState.closetInstallCostPerJa || 20000);
  setVal('formula-closet-sliding-extra', currentFormulaState.closetSlidingExtraPerJa || 20000);
  setVal('formula-shoe-w', currentFormulaState.shoeW);
  setVal('formula-rawboard-price', currentFormulaState.rawBoardPrice || 50000); // 5만원 기본
  setVal('formula-countertop-price', currentFormulaState.countertopPricePerM || 220000);
  setVal('formula-door-price', currentFormulaState.doorPricePerPiece || 35000);

  const upperCheck = document.getElementById('formula-has-upper');
  if (upperCheck) upperCheck.checked = !!currentFormulaState.hasUpper;

  const ctCheck = document.getElementById('formula-has-countertop');
  if (ctCheck) ctCheck.checked = currentFormulaState.hasCountertop !== false;

  const slidingCheck = document.getElementById('formula-closet-is-sliding');
  if (slidingCheck) slidingCheck.checked = !!currentFormulaState.closetIsSliding;

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
  let closetIsSliding = false;
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
      if (item.closetDoorType === 'sliding' || item.doorType === 'sliding') {
        closetIsSliding = true;
      }
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
  currentFormulaState.closetIsSliding = closetIsSliding;
  currentFormulaState.shoeW = shoeW;
  currentFormulaState.tallW = tallW;
  currentFormulaState.countertopM = null;
  currentFormulaState.doorCount = null;

  applyFormulaPreset(currentFormulaState);
  if (typeof showToast === 'function') showToast('3D 도면의 가구 치수 및 슬라이딩 도어 설정을 산출식으로 가져왔습니다.');
}

/**
 * 실시간 시뮬레이션 계산 및 결과 UI 업데이트
 */
function updateFormulaSimulation() {
  const subBox = document.getElementById('box-formula-sub-w');
  const sub2Box = document.getElementById('box-formula-sub2-w');
  if (subBox) subBox.style.display = (currentFormulaState.sinkShape !== 'I') ? 'block' : 'none';
  if (sub2Box) sub2Box.style.display = (currentFormulaState.sinkShape === 'U') ? 'block' : 'none';

  const slidingExtraBox = document.getElementById('box-closet-sliding-extra');
  if (slidingExtraBox) {
    slidingExtraBox.style.display = currentFormulaState.closetIsSliding ? 'block' : 'none';
  }

  // 1. 표준 산출식 계산
  const stdQuote = calculateStandardFormula(currentFormulaState);

  const ctInput = document.getElementById('formula-countertop-m');
  if (ctInput && document.activeElement !== ctInput) {
    ctInput.value = stdQuote.countertopM.toFixed(2);
  }

  const doorInput = document.getElementById('formula-door-count');
  if (doorInput && document.activeElement !== doorInput) {
    doorInput.value = stdQuote.doorCount;
  }

  // 2. 순수 가구 몸통(Carcase) 부재 리스트 및 2220x2440 원장 네스팅
  const parts = generateFurnitureParts(currentFormulaState);
  const nestingResult = nestPartsOnRawBoards(parts, RAW_BOARD_WIDTH, RAW_BOARD_HEIGHT, SAW_KERF);
  currentNestingResult = nestingResult;

  // 3. 원장 기준 원가 및 마진 비교 (문짝 2만/개 사입비, EP/몰딩 사입비 반영)
  const comp = calculateRawBoardCostComparison(stdQuote, nestingResult, currentFormulaState);

  // 4. UI 텍스트 업데이트
  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  // 표준 견적 행별 표시
  setText('val-closet-calc', `${currentFormulaState.closetW}mm (${stdQuote.closetJa.toFixed(1)}자) → ${stdQuote.closetCost.toLocaleString()}원`);
  setText('val-closet-sliding-calc', stdQuote.closetIsSliding ? 
    `${stdQuote.closetJa.toFixed(1)}자 × ${stdQuote.closetSlidingExtraPerJa.toLocaleString()}원 = ${stdQuote.closetSlidingCost.toLocaleString()}원 (슬라이딩)` : 
    '여닫이 도어 (추가비 없음, 0원)');
  setText('val-shoe-calc', `${currentFormulaState.shoeW}mm (${stdQuote.shoeJa.toFixed(1)}자) → ${stdQuote.shoeCost.toLocaleString()}원`);
  setText('val-sink-lower-calc', `실연장 ${stdQuote.lowerM.toFixed(2)}m (코너제외) → ${stdQuote.lowerCost.toLocaleString()}원`);
  setText('val-sink-upper-calc', currentFormulaState.hasUpper ? `실연장 ${stdQuote.upperM.toFixed(2)}m → ${stdQuote.upperCost.toLocaleString()}원` : '상부장 없음 (0원)');
  setText('val-ep-calc', `${stdQuote.epCount}장 × 5만원 = ${stdQuote.epCost.toLocaleString()}원`);
  setText('val-molding-calc', `${stdQuote.moldingCount}개 × 5만원 = ${stdQuote.moldingCost.toLocaleString()}원`);
  setText('val-plinth-calc', `${stdQuote.plinthCount}개 × 3만원 = ${stdQuote.plinthCost.toLocaleString()}원`);
  setText('val-tall-calc', `${currentFormulaState.tallW}mm (${stdQuote.tallM.toFixed(2)}m) + EP ${stdQuote.tallEpCount}장 = ${stdQuote.tallCost.toLocaleString()}원`);
  
  // 시공비 분리 표시
  setText('val-closet-install-calc', `${stdQuote.closetJa.toFixed(1)}자 × ${stdQuote.closetInstallCostPerJa.toLocaleString()}원 = ${stdQuote.closetInstallCost.toLocaleString()}원`);
  setText('val-install-calc', `일반 가구 ${stdQuote.generalFurnitureM.toFixed(2)}m × 5만원 = ${stdQuote.generalInstallCost.toLocaleString()}원 (합계: ${stdQuote.totalInstallCost.toLocaleString()}원)`);

  // 상판 및 문짝 견적 표시
  setText('val-countertop-calc', stdQuote.hasCountertop ? 
    `${stdQuote.countertopM.toFixed(2)}m × ${stdQuote.countertopPricePerM.toLocaleString()}원 = ${stdQuote.countertopCost.toLocaleString()}원` : 
    '상판 미적용 (0원)');
  setText('val-door-calc', `총 ${stdQuote.doorCount}개 (600mm당1개) × ${stdQuote.doorPricePerPiece.toLocaleString()}원 = ${stdQuote.doorCost.toLocaleString()}원`);

  // 합계
  setText('std-supply-total', `${stdQuote.supplyTotal.toLocaleString()}원`);
  setText('std-vat-amount', `${stdQuote.vat.toLocaleString()}원`);
  setText('std-grand-total', `${stdQuote.grandTotal.toLocaleString()}원`);

  // 원장 네스팅 분석 수치 표시 (순수 몸통 전용)
  setText('nesting-sheet-count', `${nestingResult.sheetCount}장 (몸통 전용)`);
  setText('nesting-overall-yield', `${nestingResult.overallYield}%`);
  setText('nesting-scrap-rate', `${nestingResult.overallScrapRate}% (초절감)`);
  setText('nesting-parts-count', `${parts.length}개 몸통부재`);
  setText('nesting-parts-area', `${nestingResult.totalPartsAreaM2} m²`);

  // 비교 분석 카드 (원장 5만원 + 문짝 2만/개 사입 + EP/몰딩 완제품 사입)
  setText('comp-raw-sheet-cost', `${nestingResult.sheetCount}장 × ${(currentFormulaState.rawBoardPrice || 50000).toLocaleString()}원 = ${comp.totalBoardCost.toLocaleString()}원 (몸통 전용)`);
  setText('comp-raw-door-cost', `총 ${stdQuote.doorCount}개 × ${comp.doorPurchasePrice.toLocaleString()}원 = ${comp.doorPurchaseCost.toLocaleString()}원 (완제품 별도구매)`);
  setText('comp-raw-finish-cost', `${comp.finishMaterialCost.toLocaleString()}원 (EP ${stdQuote.epCount}장 + 몰딩/걸레받이 ${stdQuote.moldingCount + stdQuote.plinthCount}개 사입)`);
  setText('comp-raw-process-cost', `${comp.cutProcessCost.toLocaleString()}원 (원장 재단/가공)`);
  setText('comp-raw-edge-cost', `${comp.totalEdgeCost.toLocaleString()}원 (엣지 ${comp.totalEdgeLenM}m)`);
  setText('comp-raw-hardware-cost', `${comp.hardwareCost.toLocaleString()}원`);
  setText('comp-raw-install-cost', `${comp.installCost.toLocaleString()}원 (붙박이 자당 2만+일반 m당 5만)`);
  setText('comp-raw-countertop-cost', `${comp.countertopRawCost.toLocaleString()}원 (상판 외주납품원가)`);
  setText('comp-raw-total-cost', `${comp.rawManufactureCost.toLocaleString()}원 (VAT별도)`);
  setText('comp-raw-grand-total', `${comp.rawManufactureTotal.toLocaleString()}원`);

  // 공장 마진 및 절감액
  setText('comp-profit-amount', `+${comp.profitAmount.toLocaleString()}원`);
  setText('comp-profit-margin', `${comp.profitMarginPercent}%`);
  setText('comp-saved-sheets', `${comp.savedSheets}장 세이브 (${comp.savedMaterialCost.toLocaleString()}원 절감)`);

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

  const indicator = document.getElementById('raw-sheet-indicator');
  if (indicator) {
    if (currentNestingResult.sheetCount === 0 || sheet.placedParts.length === 0) {
      indicator.innerText = '원장 [0 / 0] (입력 대기 중 — 좌측에서 가구 치수를 입력해주세요)';
    } else {
      indicator.innerText = `원장 [${sheet.index} / ${currentNestingResult.sheetCount || currentNestingResult.sheets.length}] (2220 × 2440 mm 몸통 전용 — 수율: ${sheet.yieldRate.toFixed(1)}%, 자투리: ${sheet.scrapRate.toFixed(1)}%)`;
    }
  }

  renderNestingCanvas(canvas, sheet);
}

// 전역 및 모듈 내보내기
if (typeof window !== 'undefined') {
  window.initFormulaEngine = initFormulaEngine;
  window.calculateStandardFormula = calculateStandardFormula;
  window.nestPartsOnRawBoards = nestPartsOnRawBoards;
  window.calculateRawBoardCostComparison = calculateRawBoardCostComparison;
  window.resetFormulaState = resetFormulaState;
  window.applyFormulaPreset = applyFormulaPreset;
  window.FORMULA_PRESETS = FORMULA_PRESETS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initFormulaEngine,
    calculateStandardFormula,
    nestPartsOnRawBoards,
    calculateRawBoardCostComparison,
    resetFormulaState,
    applyFormulaPreset,
    FORMULA_PRESETS
  };
}
