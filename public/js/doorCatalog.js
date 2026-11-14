/**
 * doorCatalog.js - 기성품 도어 업체 및 모델 라이브러리
 * "문짝은 기성품 업체한테서 가져오는거라 종류가 진짜 많은데 어떻게 해야할까" 해결책:
 * - 벤더사(공급업체), 도어 스타일(민자, 쉐이커 프레임, 웨인스코팅, 루버), 마감재, 컬러별 DB 관리
 * - 영업사원이 현장에서 고객과 상담 시 손쉽게 고르고, 필요시 새 도어/단가 추가 가능
 */

const DOOR_CATALOG = {
  vendors: [
    { id: 'all', name: '전체 업체' },
    { id: 'younglim', name: '영림도어' },
    { id: 'yerim', name: '예림임업' },
    { id: 'hanssem', name: '한샘 제휴납품' },
    { id: 'daejin', name: '대진/동화' },
    { id: 'custom', name: '기타/특수제작' }
  ],

  // 도어 스타일 분류
  styles: [
    { id: 'flat', name: '모던 플랫 (민자)', desc: '심플하고 깔끔한 최신 미니멀 스타일' },
    { id: 'shaker', name: '쉐이커 프레임 (사각 홈)', desc: '단정한 엣지 테두리 음각 프레임' },
    { id: 'wainscot', name: '클래식 프렌치 (웨인스코팅)', desc: '고급스럽고 우아한 유럽풍 몰딩' },
    { id: 'louver', name: '루버/갤러리 (살대형)', desc: '통풍성이 좋고 입체적인 빗살 디자인' }
  ],

  // 등록된 기성 도어 품목 리스트
  items: [
    // 1. 영림
    {
      id: 'yl-pet-white',
      vendor: 'younglim',
      style: 'flat',
      name: '영림 프리미엄 매트화이트 PET',
      finish: '무광 친환경 PET (18T MDF)',
      colorHex: '#fcfcfc',
      textureType: 'matte',
      sqmPrice: 42000, // 헤베당 매입가
      popular: true
    },
    {
      id: 'yl-pet-cashmere',
      vendor: 'younglim',
      style: 'flat',
      name: '영림 소프트 캐시미어 크림',
      finish: '무광 PET (18T MDF)',
      colorHex: '#ede5d8',
      textureType: 'matte',
      sqmPrice: 43000,
      popular: true
    },
    {
      id: 'yl-shaker-fog',
      vendor: 'younglim',
      style: 'shaker',
      name: '영림 쉐이커 엣지 포그그레이',
      finish: '수성 도장 마감 (22T MDF 프레임)',
      colorHex: '#c8cbd0',
      textureType: 'frame',
      sqmPrice: 58000,
      popular: true
    },

    // 2. 예림
    {
      id: 'yr-pet-charcoal',
      vendor: 'yerim',
      style: 'flat',
      name: '예림 벨벳 차콜그레이',
      finish: '지문방지 하이퍼PET (18T MDF)',
      colorHex: '#30343f',
      textureType: 'matte',
      sqmPrice: 45000,
      popular: false
    },
    {
      id: 'yr-classic-cream',
      vendor: 'yerim',
      style: 'wainscot',
      name: '예림 로열 클래식 앤틱도어',
      finish: '우레탄 5회 도장 (20T MDF)',
      colorHex: '#f5f0e6',
      textureType: 'frame',
      sqmPrice: 72000,
      popular: false
    },
    {
      id: 'yr-pet-sage',
      vendor: 'yerim',
      style: 'flat',
      name: '예림 세이지 올리브 그린',
      finish: '무광 실키PET (18T MDF)',
      colorHex: '#6b7a69',
      textureType: 'matte',
      sqmPrice: 47000,
      popular: true
    },

    // 3. 한샘제휴
    {
      id: 'hs-milan-white',
      vendor: 'hanssem',
      style: 'flat',
      name: '한샘 밀란 퓨어화이트',
      finish: '친환경 ASA 무광 마감',
      colorHex: '#fafafa',
      textureType: 'matte',
      sqmPrice: 49000,
      popular: true
    },
    {
      id: 'hs-euro-oak',
      vendor: 'hanssem',
      style: 'flat',
      name: '한샘 유로 내추럴 오크우드',
      finish: '입체 동조 엠보 우드 (18T MDF)',
      colorHex: '#cbb08b',
      textureType: 'wood_oak',
      sqmPrice: 54000,
      popular: true
    },
    {
      id: 'hs-shaker-navy',
      vendor: 'hanssem',
      style: 'shaker',
      name: '한샘 키친바흐 딥 미드나잇네이비',
      finish: '열경화성 분체도장 (22T MDF)',
      colorHex: '#1e2d42',
      textureType: 'frame',
      sqmPrice: 78000,
      popular: false
    },

    // 4. 대진/동화
    {
      id: 'dj-warm-taupe',
      vendor: 'daejin',
      style: 'flat',
      name: '동화자연마루 웜 토프베이지',
      finish: '내지문 슈퍼E0 무광',
      colorHex: '#d8cbba',
      textureType: 'matte',
      sqmPrice: 44000,
      popular: false
    },
    {
      id: 'dj-walnut-line',
      vendor: 'daejin',
      style: 'flat',
      name: '대진 프리미엄 다크월넛',
      finish: '천연 질감 무늬목 래핑',
      colorHex: '#483526',
      textureType: 'wood_walnut',
      sqmPrice: 59000,
      popular: false
    }
  ]
};

// 브라우저 전역 노출
window.DOOR_CATALOG = DOOR_CATALOG;
