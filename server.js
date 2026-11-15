const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DOORS_FILE = path.join(DATA_DIR, 'doors.json');
const DEV_REQUESTS_FILE = path.join(DATA_DIR, 'dev_requests.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 초기 파일 보장
readJson(QUOTES_FILE, []);
readJson(DEV_REQUESTS_FILE, []);

// 기본 고정 단가표 및 회사 설정 초기값
const DEFAULT_SETTINGS = {
  companyName: '피앙세가구',
  companyOwner: '대표 홍길동',
  companyBizNo: '123-45-67890',
  companyAddress: '경기도 남양주시 가구공단로 123',
  companyPhone: '010-0000-0000',
  bankName: '국민은행',
  bankAccount: '123402-04-567890',
  bankHolder: '피앙세가구',
  sealTextTop: '피앙세',
  sealTextBot: '가구인',
  
  // 고정 단가 및 제작 기준
  woodBodyName: '친환경 E0 자작합판 18T 원목 몸통',
  woodBodyPerMeter: 230000,
  
  countertopName: 'LG/롯데 40T 오로라 비앙코 인조대리석',
  countertopPerMeter: 180000,
  countertopHoleCut: 60000,
  
  installBase: 250000,
  installPerMeter: 40000,
  
  marginPercent: 25,
  depositPercent: 10,

  // 견적서 고정 부자재/하드웨어 항목 (웹에서 직접 추가/수정/삭제 가능)
  fixedItems: [
    { id: 'item-sink', name: '백조 Grand 사각 싱크볼 + 거위목 수전 세트', price: 210000, enabled: true },
    { id: 'item-hinge', name: '독일식 댐퍼 경첩 & 3단 볼레일 하드웨어 일체', price: 130000, enabled: true },
    { id: 'item-hood', name: '히든 슬림 빌트인 후드 (기본형)', price: 150000, enabled: false },
    { id: 'item-led', name: '상부장 하단 T5 온백색 LED 간접조명 시공', price: 60000, enabled: true }
  ]
};

// 기본 기성품 도어 초기 카탈로그
const DEFAULT_DOORS = [
  { id: 'yl-pet-white', vendor: '영림도어', style: 'flat', name: '영림 프리미엄 매트화이트 PET', finish: '무광 친환경 PET (18T MDF)', colorHex: '#fcfcfc', sqmPrice: 42000 },
  { id: 'yl-pet-cashmere', vendor: '영림도어', style: 'flat', name: '영림 소프트 캐시미어 크림', finish: '무광 PET (18T MDF)', colorHex: '#ede5d8', sqmPrice: 43000 },
  { id: 'yl-shaker-fog', vendor: '영림도어', style: 'shaker', name: '영림 쉐이커 엣지 포그그레이', finish: '수성 도장 마감 (22T MDF 프레임)', colorHex: '#c8cbd0', sqmPrice: 58000 },
  { id: 'yr-pet-charcoal', vendor: '예림임업', style: 'flat', name: '예림 벨벳 차콜그레이', finish: '지문방지 하이퍼PET (18T MDF)', colorHex: '#30343f', sqmPrice: 45000 },
  { id: 'yr-classic-cream', vendor: '예림임업', style: 'shaker', name: '예림 로열 클래식 크림도어', finish: '우레탄 5회 도장 (20T MDF)', colorHex: '#f5f0e6', sqmPrice: 72000 },
  { id: 'yr-pet-sage', vendor: '예림임업', style: 'flat', name: '예림 세이지 올리브 그린', finish: '무광 실키PET (18T MDF)', colorHex: '#6b7a69', sqmPrice: 47000 },
  { id: 'hs-milan-white', vendor: '한샘제휴', style: 'flat', name: '한샘 밀란 퓨어화이트', finish: '친환경 ASA 무광 마감', colorHex: '#fafafa', sqmPrice: 49000 },
  { id: 'hs-euro-oak', vendor: '한샘제휴', style: 'flat', name: '한샘 유로 내추럴 오크우드', finish: '입체 동조 엠보 우드 (18T MDF)', colorHex: '#cbb08b', sqmPrice: 54000 },
  { id: 'dj-warm-taupe', vendor: '대진/동화', style: 'flat', name: '동화자연마루 웜 토프베이지', finish: '내지문 슈퍼E0 무광', colorHex: '#d8cbba', sqmPrice: 44000 },
  { id: 'dj-walnut-line', vendor: '대진/동화', style: 'flat', name: '대진 프리미엄 다크월넛', finish: '천연 질감 무늬목 래핑', colorHex: '#483526', sqmPrice: 59000 }
];

// JSON 파일 헬퍼
function readJson(filePath, defaultVal) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
      return defaultVal;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error('JSON read error:', filePath, err);
    return defaultVal;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('JSON write error:', filePath, err);
    return false;
  }
}

// 초기 파일 보장
readJson(QUOTES_FILE, []);
readJson(SETTINGS_FILE, DEFAULT_SETTINGS);
readJson(DOORS_FILE, DEFAULT_DOORS);

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// --- API 엔드포인트 ---

// 0. 서버 네트워크 정보
app.get('/api/server-info', (req, res) => {
  res.json({
    success: true,
    localIp: getLocalIpAddress(),
    port: PORT
  });
});

// 1. 설정 및 고정 단가표 조회/저장
app.get('/api/settings', (req, res) => {
  const settings = { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, DEFAULT_SETTINGS) };
  res.json({ success: true, settings });
});

app.post('/api/settings', (req, res) => {
  const current = readJson(SETTINGS_FILE, DEFAULT_SETTINGS);
  const updated = { ...current, ...req.body };
  writeJson(SETTINGS_FILE, updated);
  res.json({ success: true, settings: updated });
});

// 2. 기성 도어 카탈로그 조회/추가/수정/삭제
app.get('/api/doors', (req, res) => {
  const doors = readJson(DOORS_FILE, DEFAULT_DOORS);
  res.json({ success: true, doors });
});

app.post('/api/doors', (req, res) => {
  const doors = readJson(DOORS_FILE, DEFAULT_DOORS);
  const payload = req.body;
  if (payload.id) {
    const idx = doors.findIndex(d => d.id === payload.id);
    if (idx !== -1) {
      doors[idx] = { ...doors[idx], ...payload };
    } else {
      doors.push(payload);
    }
  } else {
    const newDoor = {
      id: 'door-' + Date.now().toString(36),
      vendor: payload.vendor || '자체등록',
      style: payload.style || 'flat',
      name: payload.name || '신규 도어',
      finish: payload.finish || '친환경 PET (18T MDF)',
      colorHex: payload.colorHex || '#f5f5f5',
      sqmPrice: parseInt(payload.sqmPrice) || 45000
    };
    doors.unshift(newDoor);
  }
  writeJson(DOORS_FILE, doors);
  res.json({ success: true, doors });
});

app.delete('/api/doors/:id', (req, res) => {
  let doors = readJson(DOORS_FILE, DEFAULT_DOORS);
  doors = doors.filter(d => d.id !== req.params.id);
  writeJson(DOORS_FILE, doors);
  res.json({ success: true, doors });
});

// 3. 견적 목록 및 통계
app.get('/api/quotes', (req, res) => {
  const quotes = readJson(QUOTES_FILE, []);
  const totalCount = quotes.length;
  const signedCount = quotes.filter(q => q.status === 'signed' || q.status === 'paid').length;
  const paidCount = quotes.filter(q => q.status === 'paid').length;
  const totalRevenue = quotes
    .filter(q => q.status === 'paid' || q.status === 'signed')
    .reduce((sum, q) => sum + (q.pricing?.totalPrice || 0), 0);

  res.json({
    success: true,
    stats: { totalCount, signedCount, paidCount, totalRevenue },
    quotes: quotes.slice().reverse()
  });
});

// 4. 단일 견적 조회 (소비자 뷰어용 + 현재 설정 정보 포함)
app.get('/api/quotes/:id', (req, res) => {
  const quotes = readJson(QUOTES_FILE, []);
  const quote = quotes.find(q => q.id === req.params.id);
  if (!quote) {
    return res.status(404).json({ success: false, message: '견적서를 찾을 수 없습니다.' });
  }
  const settings = { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, DEFAULT_SETTINGS) };
  res.json({ success: true, quote, settings });
});

// 5. 신규 견적 저장
app.post('/api/quotes', (req, res) => {
  try {
    const quotes = readJson(QUOTES_FILE, []);
    const newQuote = {
      id: 'QT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      customer: {
        name: req.body.customerName || '고객님',
        phone: req.body.customerPhone || '',
        address: req.body.customerAddress || ''
      },
      items: req.body.items || [],
      orderGrandTotal: req.body.orderGrandTotal || (req.body.pricing?.totalPrice || 0),
      orderGrandDeposit: req.body.orderGrandDeposit || (req.body.pricing?.depositPrice || 0),
      spec: req.body.spec || {},
      pricing: req.body.pricing || {},
      capturedImage: req.body.capturedImage || null,
      memo: req.body.memo || ''
    };

    quotes.push(newQuote);
    writeJson(QUOTES_FILE, quotes);

    res.json({
      success: true,
      quote: newQuote,
      localIp: getLocalIpAddress(),
      port: PORT
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. 견적 삭제 (관리자용)
app.delete('/api/quotes/:id', (req, res) => {
  let quotes = readJson(QUOTES_FILE, []);
  quotes = quotes.filter(q => q.id !== req.params.id);
  writeJson(QUOTES_FILE, quotes);
  res.json({ success: true });
});

// 7. 계약서 서명 날인
app.post('/api/quotes/:id/sign', (req, res) => {
  const quotes = readJson(QUOTES_FILE, []);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '견적서를 찾을 수 없습니다.' });

  quotes[idx].status = 'signed';
  quotes[idx].signedAt = new Date().toISOString();
  quotes[idx].signatureImage = req.body.signature;
  writeJson(QUOTES_FILE, quotes);

  res.json({ success: true, quote: quotes[idx] });
});

// 8. 입금 확인 처리
app.post('/api/quotes/:id/payment', (req, res) => {
  const quotes = readJson(QUOTES_FILE, []);
  const idx = quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '견적서를 찾을 수 없습니다.' });

  quotes[idx].status = 'paid';
  quotes[idx].paidAt = new Date().toISOString();
  quotes[idx].depositAmount = req.body.depositAmount || quotes[idx].pricing.depositPrice;
  writeJson(QUOTES_FILE, quotes);

  res.json({ success: true, quote: quotes[idx] });
});

// 9. AI 개발 요청 큐 (Dev Requests) — 사용자가 웹에서 보낸 요구사항 저장 및 조회
app.get('/api/dev-requests', (req, res) => {
  const requests = readJson(DEV_REQUESTS_FILE, []);
  res.json({
    success: true,
    requests: requests.slice().reverse(),
    pendingCount: requests.filter(r => r.status === 'pending').length
  });
});

app.post('/api/dev-requests', (req, res) => {
  const { message, author } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: '개발 요청 내용을 입력해주세요.' });
  }

  const requests = readJson(DEV_REQUESTS_FILE, []);
  const newReq = {
    id: 'REQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
    message: message.trim(),
    author: author || '관리자',
    createdAt: new Date().toISOString(),
    status: 'pending', // 'pending' | 'processing' | 'done' | 'failed'
    response: null,
    completedAt: null
  };

  requests.push(newReq);
  writeJson(DEV_REQUESTS_FILE, requests);

  res.json({ success: true, request: newReq });
});

app.patch('/api/dev-requests/:id', (req, res) => {
  const requests = readJson(DEV_REQUESTS_FILE, []);
  const idx = requests.findIndex(r => r.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다.' });
  }

  requests[idx] = {
    ...requests[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  if (req.body.status === 'done' && !requests[idx].completedAt) {
    requests[idx].completedAt = new Date().toISOString();
  }

  writeJson(DEV_REQUESTS_FILE, requests);
  res.json({ success: true, request: requests[idx] });
});

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`\n======================================================`);
  console.log(`🪵 우드크래프트 스튜디오 (맞춤 씽크대 견적 & 관리자 시스템)`);
  console.log(`💻 [PC 관리자 페이지]:    http://localhost:${PORT}`);
  console.log(`📱 [모바일 앱/현장 실측]: http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
