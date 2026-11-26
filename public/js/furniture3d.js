/**
 * furniture3d.js - 모델하우스 스튜디오 급 주방 씽크대 3D CAD 엔진 (v4 Luxury Architectural)
 * - 벽 뒤 회전 완전 차단 (카메라 방위각 제한 + 완결된 실내 공간/천장 써라운딩 마감)
 * - 벽면/타일/바닥재 실시간 커스터마이징 (템바보드, 미장, 빅슬랩 대리석, 테라조, 키트캣 타일 등)
 * - PMREM 스튜디오 환경 반사맵 + 고해상도 PBR 질감(Bump/Roughness) + Seamless Extrude 상판
 * - 일자형(Straight) 및 ㄱ자형(좌/우 코너 날개장) 완벽 지원 + 핸들/찬넬 & 가전 모델링
 */

class Furniture3DEngine {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.isViewerMode = options.isViewerMode || false;

    this.spec = {
      layoutType: options.layoutType || 'straight', // 'straight' | 'l_left' | 'l_right'
      sideLength: options.sideLength || 1800,
      wingHasUpper: Boolean(options.wingHasUpper),

      totalWidth: options.totalWidth || 2700,
      ceilingHeight: options.ceilingHeight || 2350,
      lowerHeight: options.lowerHeight || 860,
      lowerDepth: options.lowerDepth || 600,
      plinthHeight: options.plinthHeight || 120,
      topThickness: options.topThickness || 40,

      sinkBayWidth: options.sinkBayWidth || 1000,
      prepBayWidth: options.prepBayWidth || 800,
      cooktopBayWidth: options.cooktopBayWidth || 900,

      // 키큰장 / 가전수납장 (밥솥·오븐장 / 냉장고장 / 롱팬트리)
      tallCabinet: options.tallCabinet || 'none',       // 'none' | 'left' | 'right'
      tallCabinetWidth: options.tallCabinetWidth || 600,
      tallCabinetType: options.tallCabinetType || 'appliance', // 'appliance' | 'pantry' | 'fridge'

      upperHeight: options.upperHeight || 700,
      upperDepth: options.upperDepth || 350,
      midwayHeight: options.midwayHeight || 650,
      hasUpperCabinets: options.hasUpperCabinets !== false,

      bodyWoodType: options.bodyWoodType || 'birch_plywood',
      doorColor: options.doorColor || '#fcfcfc',
      doorStyle: options.doorStyle || 'flat',
      countertopType: options.countertopType || 'white_marble',
      handleType: options.handleType || 'j_channel', // 'j_channel' | 'bar_matte_black' | 'bar_champagne_gold' | 'bar_brushed_nickel'
      handleColor: options.handleColor || 'matte_black',

      // 공간 & 벽면 디자인 옵션
      wallDesign: options.wallDesign || 'warm_greige',       // 'warm_greige' | 'creamy_plaster' | 'sage_olive' | 'deep_charcoal' | 'walnut_temba'
      tileDesign: options.tileDesign || 'white_subway',      // 'white_subway' | 'beige_terrazzo' | 'herringbone_cream' | 'calacatta_slab' | 'deep_mocha_kitkat'
      floorDesign: options.floorDesign || 'natural_oak',     // 'natural_oak' | 'light_ash' | 'smoked_walnut' | 'limestone_tile'
      underlightTemp: options.underlightTemp || 'warm',      // 'warm' | 'neutral' | 'off'

      // 가전/수전 카탈로그 모델
      hoodType: options.hoodType || 'hidden',
      cooktopType: options.cooktopType || 'black_ind',
      faucetType: options.faucetType || 'gooseneck',

      isDoorOpen: false,
      showDimensions: true,
      showCadEdges: options.showCadEdges !== false,
      showCallouts: options.showCallouts !== false,
      showProps: false // 후추통 등 불필요한 소품 3D 겹침 완전 방지
    };

    this.doors = [];
    this.dimensionLines = [];
    this.cadEdgeLines = [];
    this.dimBadges = {};
    this.calloutBadges = {};
    this.textures = {};
    this.cameraAnim = null;

    this.initScene();
    this.createTexturesAndMaterials();
    this.buildRoomShell();
    this.buildKitchen();
    this.applyCameraConstraints(true);
    this.setupEvents();
    this.animate();
  }

  initScene() {
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd8d0c5);

    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    this.camera.position.set(1.9, 1.85, 3.65);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.physicallyCorrectLights = true;

    this.container.appendChild(this.renderer.domElement);

    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.07;
      this.controls.enablePan = false;
      this.controls.minPolarAngle = 0.25;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
      this.controls.minDistance = 1.65;
      this.controls.maxDistance = 6.0;
      this.controls.target.set(0, 1.15, 0.28);
    }

    this.setupStudioEnvironment();
    this.setupLighting();
    this.setupDimensionOverlay();
  }

  // 스튜디오 소프트박스 반사 환경맵 (메탈릭/글래스/유광타일/대리석 광택을 결정하는 핵심!)
  setupStudioEnvironment() {
    try {
      const envCanvas = document.createElement('canvas');
      envCanvas.width = 512;
      envCanvas.height = 256;
      const ctx = envCanvas.getContext('2d');

      const skyGrad = ctx.createLinearGradient(0, 0, 0, 256);
      skyGrad.addColorStop(0.0, '#ffffff');
      skyGrad.addColorStop(0.32, '#f6efe4');
      skyGrad.addColorStop(0.55, '#dcd2c5');
      skyGrad.addColorStop(1.0, '#a3896d');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 512, 256);

      // 소프트박스 하이라이트 창문 패널 2개
      ctx.fillStyle = 'rgba(255, 252, 245, 0.9)';
      ctx.fillRect(70, 26, 110, 58);
      ctx.fillRect(320, 32, 130, 52);

      const envTex = new THREE.CanvasTexture(envCanvas);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.encoding = THREE.sRGBEncoding;

      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();
      this.envRT = pmrem.fromEquirectangular(envTex);
      this.scene.environment = this.envRT.texture;
      envTex.dispose();
      pmrem.dispose();
    } catch (e) {
      // 일부 WebGL 환경 폴백
    }
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xfffaf3, 0xb89f82, 0.58);
    this.scene.add(hemiLight);

    // 메인 건축 키 라이트 (선명한 2K 그림자)
    this.keyLight = new THREE.DirectionalLight(0xfff5e8, 1.35);
    this.keyLight.position.set(2.8, 4.4, 3.6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.bias = -0.00035;
    this.keyLight.shadow.radius = 2.5;
    const d = 3.2;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.scene.add(this.keyLight);

    // 쿨톤 반대편 필 라이트
    const fillLight = new THREE.DirectionalLight(0xeef4fa, 0.42);
    fillLight.position.set(-3.2, 2.4, 2.8);
    this.scene.add(fillLight);

    // 상부장 하단 간접 조명 그룹
    this.underLights = [];
    for (let lx = -0.9; lx <= 0.9; lx += 0.9) {
      const pLight = new THREE.PointLight(0xffdfb0, 0.48, 2.2, 1.7);
      pLight.position.set(lx, 1.45, 0.24);
      this.scene.add(pLight);
      this.underLights.push(pLight);
    }

    // 천장 매립 실사 다운라이트 4개 (원뿔형 건축 스튜디오 조명으로 입체감 극대화)
    this.ceilingSpots = [];
    const spotCoords = [
      [-1.2, 3.4, 1.2],
      [0.0, 3.4, 1.4],
      [1.2, 3.4, 1.2],
      [-0.4, 3.4, 2.4]
    ];
    spotCoords.forEach(c => {
      const spot = new THREE.SpotLight(0xfff3e0, 0.85);
      spot.position.set(c[0], c[1], c[2]);
      spot.target.position.set(c[0], 0, c[2] - 0.5);
      spot.angle = Math.PI / 4.2;
      spot.penumbra = 0.82;
      spot.decay = 1.6;
      spot.distance = 5.5;
      spot.castShadow = false;
      this.scene.add(spot);
      this.scene.add(spot.target);
      this.ceilingSpots.push(spot);
    });
  }

  // 카메라가 절대 벽 뒤로 회전하지 않도록 방위각·고도 및 초기 구도 고정
  applyCameraConstraints(snapImmediate = false) {
    if (!this.controls) return;
    const totalW = this.spec.totalWidth / 1000;
    const lowerD = this.spec.lowerDepth / 1000;
    const sideLen = this.spec.sideLength / 1000;
    const isRightL = this.spec.layoutType === 'l_right';
    const isLeftL = this.spec.layoutType === 'l_left';

    const targetZ = (isRightL || isLeftL) ? Math.min(0.65, sideLen * 0.3) : lowerD * 0.42;
    const targetPos = new THREE.Vector3(0, 1.12, targetZ);

    // 벽 뒤 회전 완전 차단!
    let camDest;
    if (isRightL) {
      this.controls.minAzimuthAngle = -1.16;
      this.controls.maxAzimuthAngle = 0.14;
      camDest = new THREE.Vector3(-Math.max(1.85, totalW * 0.65), 1.92, Math.max(3.35, totalW * 1.18));
    } else if (isLeftL) {
      this.controls.minAzimuthAngle = -0.14;
      this.controls.maxAzimuthAngle = 1.16;
      camDest = new THREE.Vector3(Math.max(1.85, totalW * 0.65), 1.92, Math.max(3.35, totalW * 1.18));
    } else {
      this.controls.minAzimuthAngle = -1.14;
      this.controls.maxAzimuthAngle = 1.14;
      camDest = new THREE.Vector3(Math.max(1.3, totalW * 0.48), 1.82, Math.max(3.25, totalW * 1.18));
    }

    if (snapImmediate) {
      this.controls.target.copy(targetPos);
      this.camera.position.copy(camDest);
      this.controls.update();
    } else {
      this.cameraAnim = {
        targetPos,
        camDest,
        progress: 0
      };
    }
  }

  setCameraPreset(preset) {
    if (!this.controls) return;
    const totalW = this.spec.totalWidth / 1000;
    const isRightL = this.spec.layoutType === 'l_right';
    const isLeftL = this.spec.layoutType === 'l_left';

    if (preset === 'front') {
      const targetPos = new THREE.Vector3(0, 1.15, 0.25);
      const camDest = new THREE.Vector3(0, 1.25, Math.max(3.5, totalW * 1.32));
      this.cameraAnim = { targetPos, camDest, progress: 0 };
    } else if (preset === 'top') {
      const targetPos = new THREE.Vector3(0, 0.9, 0.45);
      const sideSign = isRightL ? -0.8 : (isLeftL ? 0.8 : 0.4);
      const camDest = new THREE.Vector3(sideSign, 3.65, 2.35);
      this.cameraAnim = { targetPos, camDest, progress: 0 };
    } else if (preset === 'cad_iso') {
      // 씽크대 실측 도면 전용 표준 CAD 아이소메트릭 축측 투시 앵글
      const targetPos = new THREE.Vector3(0, 1.12, 0.3);
      const sideSign = isRightL ? -1.0 : (isLeftL ? 1.0 : 0.9);
      const camDest = new THREE.Vector3(sideSign * (totalW * 0.72 + 0.6), 2.2, Math.max(3.3, totalW * 1.18));
      this.cameraAnim = { targetPos, camDest, progress: 0 };
      this.spec.showDimensions = true;
      this.spec.showCadEdges = true;
      this.spec.showCallouts = true;
      if (this.overlay) this.overlay.style.display = 'block';
      this.dimensionLines.forEach(l => l.visible = true);
      this.cadEdgeLines.forEach(l => l.visible = true);
    } else if (preset === 'house_overview') {
      // 집안 전체 풀 쇼룸 조망
      const targetPos = new THREE.Vector3(0.5, 0.9, 2.5);
      const camDest = new THREE.Vector3(5.5, 6.2, 9.8);
      this.cameraAnim = { targetPos, camDest, progress: 0 };
    } else if (preset === 'house_kitchen') {
      // 주방 & 아일랜드 구역 클로즈업
      const targetPos = new THREE.Vector3(-2.6, 1.1, 1.0);
      const camDest = new THREE.Vector3(0.2, 2.4, 4.6);
      this.cameraAnim = { targetPos, camDest, progress: 0 };
    } else if (preset === 'house_bedroom') {
      // 안방 & 붙박이장 구역 클로즈업
      const targetPos = new THREE.Vector3(4.2, 1.2, 0.8);
      const camDest = new THREE.Vector3(2.4, 2.3, 4.2);
      this.cameraAnim = { targetPos, camDest, progress: 0 };
    } else if (preset === 'house_living') {
      // 거실 TV다이 & 현관 구역 클로즈업
      const targetPos = new THREE.Vector3(0.8, 0.8, 5.0);
      const camDest = new THREE.Vector3(-1.8, 2.6, 8.2);
      this.cameraAnim = { targetPos, camDest, progress: 0 };
    } else {
      this.applyCameraConstraints(false);
    }
  }

  // =========================================================
  // 절차적 PBR 텍스처 (벽면 / 타일 / 바닥 / 원목 / 상판)
  // =========================================================
  createFloorTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (type === 'limestone_tile' || type === 'porcelain_gray') {
      const isGray = type === 'porcelain_gray';
      ctx.fillStyle = isGray ? '#a8a29b' : '#bab2a7';
      ctx.fillRect(0, 0, 1024, 1024);
      const tile = 512;
      const shades = isGray
        ? ['#b5afa7', '#aba59d', '#bab4ac', '#a29c94']
        : ['#cfc9bf', '#cac3b8', '#d4cec4', '#c5beb3'];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = shades[(r * 2 + c) % shades.length];
          ctx.fillRect(c * tile + 3, r * tile + 3, tile - 6, tile - 6);
          ctx.fillStyle = 'rgba(110,100,90,0.06)';
          for (let i = 0; i < 65; i++) {
            ctx.fillRect(c * tile + Math.random() * tile, r * tile + Math.random() * tile, 4 + Math.random() * 8, 2 + Math.random() * 5);
          }
        }
      }
    } else if (type === 'herringbone_wood') {
      ctx.fillStyle = '#bda485';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.save();
      ctx.translate(512, 512);
      ctx.rotate(Math.PI / 4);
      const hShades = ['#caa986', '#b89874', '#d2b492', '#ae8c67'];
      for (let x = -1024; x < 1024; x += 96) {
        for (let y = -1024; y < 1024; y += 48) {
          const idx = Math.abs(Math.floor(x / 96) + Math.floor(y / 48)) % hShades.length;
          ctx.fillStyle = hShades[idx];
          ctx.fillRect(x + 2, y + 2, 92, 44);
          ctx.fillStyle = 'rgba(60,40,25,0.09)';
          for (let g = 0; g < 6; g++) {
            ctx.fillRect(x + 2, y + 6 + g * 7, 92, 1.2);
          }
        }
      }
      ctx.restore();
    } else if (type === 'terrazzo_stone') {
      ctx.fillStyle = '#dbd4ca';
      ctx.fillRect(0, 0, 1024, 1024);
      const chips = ['#8c7965', '#4a443d', '#a89885', '#ede8df', '#c29d74'];
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = chips[i % chips.length];
        ctx.beginPath();
        ctx.arc(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const palettes = {
        natural_oak: { base: '#c5a883', tones: ['#c9ad8a', '#be9f79', '#cfb594', '#b89770'], grain: 'rgba(85,60,36,0.08)' },
        light_ash: { base: '#ded2bf', tones: ['#e2d6c5', '#d9cbb6', '#e6dccd', '#d3c4ae'], grain: 'rgba(110,92,70,0.06)' },
        smoked_walnut: { base: '#6b5341', tones: ['#705745', '#634c3b', '#795f4c', '#5b4535'], grain: 'rgba(28,18,12,0.14)' }
      };
      const pal = palettes[type] || palettes.natural_oak;
      ctx.fillStyle = pal.base;
      ctx.fillRect(0, 0, 1024, 1024);

      const plankH = 128;
      const plankW = 512;
      for (let row = 0; row < 1024 / plankH; row++) {
        const offsetX = (row % 2) * (plankW / 2);
        for (let col = -1; col < 3; col++) {
          const x = col * plankW + offsetX;
          const y = row * plankH;
          ctx.fillStyle = pal.tones[(row * 3 + col + 6) % pal.tones.length];
          ctx.fillRect(x, y, plankW, plankH);

          ctx.fillStyle = pal.grain;
          for (let g = 0; g < 18; g++) {
            ctx.fillRect(x, y + g * 7 + Math.sin(g * 1.4) * 2, plankW, 1.4);
          }
          ctx.strokeStyle = 'rgba(45, 32, 20, 0.26)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, plankW, plankH);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5.5, 5.5);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  createWallMaterials(design) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    const b = document.createElement('canvas');
    b.width = 512;
    b.height = 512;
    const bctx = b.getContext('2d');

    if (design === 'walnut_temba' || design === 'tambour_wood') {
      // 세로 우드 템바보드/루버 (선명한 입체 음영 범프맵 포함!)
      const isOak = design === 'tambour_wood';
      const slats = 16;
      const sw = 512 / slats;
      for (let i = 0; i < slats; i++) {
        const sx = i * sw;
        const grad = ctx.createLinearGradient(sx, 0, sx + sw, 0);
        if (isOak) {
          grad.addColorStop(0, '#8c704c');
          grad.addColorStop(0.14, '#c2a578');
          grad.addColorStop(0.5, '#d4bc90');
          grad.addColorStop(0.86, '#bca072');
          grad.addColorStop(1, '#785f3c');
        } else {
          grad.addColorStop(0, '#453124');
          grad.addColorStop(0.14, '#7a5941');
          grad.addColorStop(0.5, '#8c674c');
          grad.addColorStop(0.86, '#6e4f39');
          grad.addColorStop(1, '#3d2a1f');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(sx, 0, sw, 512);

        // 결 세로선
        ctx.fillStyle = isOak ? 'rgba(70,50,30,0.08)' : 'rgba(35,22,15,0.1)';
        ctx.fillRect(sx + sw * 0.35, 0, 1.5, 512);
        ctx.fillRect(sx + sw * 0.68, 0, 1.2, 512);

        // 범프 높이맵
        const bgrad = bctx.createLinearGradient(sx, 0, sx + sw, 0);
        bgrad.addColorStop(0, '#111111');
        bgrad.addColorStop(0.18, '#e8e8e8');
        bgrad.addColorStop(0.82, '#e8e8e8');
        bgrad.addColorStop(1, '#111111');
        bctx.fillStyle = bgrad;
        bctx.fillRect(sx, 0, sw, 512);
      }
      const mapTex = new THREE.CanvasTexture(c);
      const bumpTex = new THREE.CanvasTexture(b);
      [mapTex, bumpTex].forEach(t => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(9, 2);
      });
      mapTex.encoding = THREE.sRGBEncoding;
      return new THREE.MeshStandardMaterial({
        map: mapTex,
        bumpMap: bumpTex,
        bumpScale: 0.025,
        roughness: 0.58,
        metalness: 0.04,
        side: THREE.FrontSide
      });
    }

    if (design === 'calacatta_marble') {
      ctx.fillStyle = '#f6f4f0';
      ctx.fillRect(0, 0, 512, 512);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(145, 128, 110, 0.32)';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        let x = (i * 85 + 30) % 512;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 512) {
          y += 24;
          x += (Math.sin(y * 0.035 + i) * 16);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const mapTex = new THREE.CanvasTexture(c);
      mapTex.encoding = THREE.sRGBEncoding;
      return new THREE.MeshStandardMaterial({
        map: mapTex,
        roughness: 0.18,
        metalness: 0.06,
        side: THREE.FrontSide
      });
    }

    const solidMap = {
      warm_greige: '#cbc2b5',
      creamy_plaster: '#e6ded2',
      sage_olive: '#b3bdb0',
      deep_charcoal: '#46423d',
      modern_concrete: '#9c9892'
    };
    const hex = solidMap[design] || solidMap.warm_greige;
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, 512, 512);

    // 미세 유럽 미장 스터코 질감
    for (let i = 0; i < 420; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      const rr = 6 + Math.random() * 20;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(40,30,20,0.028)';
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill();

      bctx.fillStyle = i % 2 === 0 ? '#8c8c8c' : '#747474';
      bctx.beginPath();
      bctx.arc(rx, ry, rr, 0, Math.PI * 2);
      bctx.fill();
    }

    const mapTex = new THREE.CanvasTexture(c);
    const bumpTex = new THREE.CanvasTexture(b);
    [mapTex, bumpTex].forEach(t => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 2);
    });
    mapTex.encoding = THREE.sRGBEncoding;

    return new THREE.MeshStandardMaterial({
      map: mapTex,
      bumpMap: bumpTex,
      bumpScale: 0.004,
      roughness: 0.84,
      metalness: 0.02,
      side: THREE.FrontSide
    });
  }

  createTileMaterial(tileDesign) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    const b = document.createElement('canvas');
    b.width = 512;
    b.height = 512;
    const bctx = b.getContext('2d');

    let repX = 3.6;
    let repY = 1.25;
    let rough = 0.24;

    if (tileDesign === 'calacatta_slab') {
      // 빅슬랩 대리석 패널 (줄눈 없는 매끄러운 빅슬랩)
      ctx.fillStyle = '#f4f2ee';
      ctx.fillRect(0, 0, 512, 512);
      bctx.fillStyle = '#e0e0e0';
      bctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(155, 138, 118, 0.34)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        let x = (i * 90 + 20) % 512;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 512) {
          y += 28;
          x += (Math.sin(y * 0.03 + i) * 18);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      repX = 1.6;
      repY = 1.0;
      rough = 0.14;
    } else if (tileDesign === 'beige_terrazzo') {
      ctx.fillStyle = '#a59a8c';
      ctx.fillRect(0, 0, 512, 512);
      bctx.fillStyle = '#333333';
      bctx.fillRect(0, 0, 512, 512);

      const s = 256;
      for (let r = 0; r < 2; r++) {
        for (let col = 0; col < 2; col++) {
          ctx.fillStyle = (r + col) % 2 === 0 ? '#e3dbd0' : '#ded5c8';
          ctx.fillRect(col * s + 3, r * s + 3, s - 6, s - 6);
          bctx.fillStyle = '#e5e5e5';
          bctx.fillRect(col * s + 3, r * s + 3, s - 6, s - 6);
        }
      }
      const chips = ['#8c7a69', '#b89f85', '#6b6560', '#f7f3ed'];
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = chips[i % chips.length];
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, 1.5 + Math.random() * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      repX = 3.2;
      repY = 1.1;
      rough = 0.28;
    } else if (tileDesign === 'herringbone_cream') {
      ctx.fillStyle = '#b4aa9c';
      ctx.fillRect(0, 0, 512, 512);
      bctx.fillStyle = '#303030';
      bctx.fillRect(0, 0, 512, 512);

      ctx.save();
      ctx.translate(256, 256);
      ctx.rotate(Math.PI / 4);
      for (let x = -512; x < 512; x += 64) {
        for (let y = -512; y < 512; y += 32) {
          const idx = Math.abs(Math.floor(x / 64) + Math.floor(y / 32)) % 3;
          ctx.fillStyle = ['#efeae1', '#eae4da', '#f3eee6'][idx];
          ctx.fillRect(x + 2, y + 2, 60, 28);
          bctx.save();
          bctx.translate(256, 256);
          bctx.rotate(Math.PI / 4);
          bctx.fillStyle = '#dcdcdc';
          bctx.fillRect(x + 2, y + 2, 60, 28);
          bctx.restore();
        }
      }
      ctx.restore();
      repX = 3.0;
      repY = 1.15;
      rough = 0.22;
    } else if (tileDesign === 'deep_mocha_kitkat') {
      // 세로 슬림 모자이크 키트캣 타일
      ctx.fillStyle = '#3a3028';
      ctx.fillRect(0, 0, 512, 512);
      bctx.fillStyle = '#252525';
      bctx.fillRect(0, 0, 512, 512);

      const cols = 16;
      const rows = 4;
      const w = 512 / cols;
      const h = 512 / rows;
      const tones = ['#6e5645', '#765c4a', '#68503f', '#7d6350'];
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = tones[(r * 5 + col) % tones.length];
          ctx.fillRect(col * w + 2.5, r * h + 2.5, w - 5, h - 5);
          bctx.fillStyle = '#e0e0e0';
          bctx.fillRect(col * w + 2.5, r * h + 2.5, w - 5, h - 5);
        }
      }
      repX = 3.8;
      repY = 1.3;
      rough = 0.2;
    } else {
      // 화이트 유광 서브웨이 타일
      ctx.fillStyle = '#b4aca0';
      ctx.fillRect(0, 0, 512, 512);
      bctx.fillStyle = '#2a2a2a';
      bctx.fillRect(0, 0, 512, 512);

      const rows = 8;
      const cols = 4;
      const tileW = 512 / cols;
      const tileH = 512 / rows;
      const grout = 4;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (tileW / 2);
        for (let col = -1; col <= cols; col++) {
          const shade = 242 + ((r + col) % 3) * 3;
          ctx.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade - 7})`;
          ctx.fillRect(col * tileW + offset + grout / 2, r * tileH + grout / 2, tileW - grout, tileH - grout);
          bctx.fillStyle = '#e5e5e5';
          bctx.fillRect(col * tileW + offset + grout / 2, r * tileH + grout / 2, tileW - grout, tileH - grout);
        }
      }
      rough = 0.17;
    }

    const mapTex = new THREE.CanvasTexture(c);
    const bumpTex = new THREE.CanvasTexture(b);
    [mapTex, bumpTex].forEach(t => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repX, repY);
    });
    mapTex.encoding = THREE.sRGBEncoding;

    return new THREE.MeshStandardMaterial({
      map: mapTex,
      bumpMap: bumpTex,
      bumpScale: 0.008,
      roughness: rough,
      metalness: 0.06
    });
  }

  createCountertopMaterial(topType) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');

    const b = document.createElement('canvas');
    b.width = 1024;
    b.height = 1024;
    const bctx = b.getContext('2d');

    if (topType === 'nero_black') {
      // Nero Marquina (스페인 최고급 네로 마퀴나 블랙 마블)
      ctx.fillStyle = '#18191c';
      ctx.fillRect(0, 0, 1024, 1024);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 1024, 1024);

      // 미세 백색 안개 구름
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
        ctx.beginPath();
        ctx.arc(Math.random() * 1024, Math.random() * 1024, 60 + Math.random() * 120, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawMarbleVeins(ctx, bctx, 'rgba(242, 238, 230, 0.85)', 'rgba(255, 255, 255, 0.92)', 7, true);
    } else if (topType === 'calacatta_gold' || topType === 'cream_staron') {
      // Calacatta Gold (이탈리아 프리미엄 칼라카타 골드 / 웜 비앙코)
      const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
      grad.addColorStop(0, '#f9f6f0');
      grad.addColorStop(0.5, '#f5f0e6');
      grad.addColorStop(1, '#fbf8f2');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1024);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 1024, 1024);

      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(215, 178, 125, 0.045)' : 'rgba(182, 170, 152, 0.038)';
        ctx.beginPath();
        ctx.arc(Math.random() * 1024, Math.random() * 1024, 80 + Math.random() * 140, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawMarbleVeins(ctx, bctx, 'rgba(190, 158, 115, 0.65)', 'rgba(148, 136, 122, 0.45)', 7, false);
      this.drawMarbleVeins(ctx, bctx, 'rgba(135, 125, 114, 0.42)', 'rgba(175, 145, 105, 0.55)', 5, false);
    } else if (topType === 'terrazzo_stone') {
      // Terrazzo Concrete (모던 하이엔드 테라조 칩 스톤)
      ctx.fillStyle = '#eee9e0';
      ctx.fillRect(0, 0, 1024, 1024);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 1024, 1024);
      const chips = ['#8a7b6d', '#3e3a36', '#c4b5a3', '#faf6f0', '#b5926b', '#5c544d', '#ded7cc'];
      for (let i = 0; i < 850; i++) {
        ctx.fillStyle = chips[i % chips.length];
        const cx = Math.random() * 1024;
        const cy = Math.random() * 1024;
        const cr = 1.5 + Math.random() * 6;
        ctx.beginPath();
        const pts = 4 + Math.floor(Math.random() * 4);
        for (let p = 0; p < pts; p++) {
          const ang = (p / pts) * Math.PI * 2;
          const rad = cr * (0.6 + Math.random() * 0.8);
          const px = cx + Math.cos(ang) * rad;
          const py = cy + Math.sin(ang) * rad;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Aurora Bianco (LG/롯데 프리미엄 오로라 비앙코 대리석 - 실사급 베이닝)
      const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
      grad.addColorStop(0, '#fbfaf8');
      grad.addColorStop(0.35, '#f5f3ee');
      grad.addColorStop(0.7, '#f9f8f4');
      grad.addColorStop(1, '#f3f0e8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1024);
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 1024, 1024);

      for (let i = 0; i < 55; i++) {
        ctx.fillStyle = 'rgba(195, 188, 178, 0.045)';
        ctx.beginPath();
        ctx.arc(Math.random() * 1024, Math.random() * 1024, 90 + Math.random() * 150, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawMarbleVeins(ctx, bctx, 'rgba(150, 142, 130, 0.55)', 'rgba(122, 115, 106, 0.72)', 8, false);
      this.drawMarbleVeins(ctx, bctx, 'rgba(180, 172, 162, 0.42)', 'rgba(165, 156, 145, 0.55)', 6, false);
    }

    const tex = new THREE.CanvasTexture(c);
    const btex = new THREE.CanvasTexture(b);
    [tex, btex].forEach(t => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(0.65, 0.65);
    });
    tex.encoding = THREE.sRGBEncoding;

    // 실사급 고광택 대리석 PBR (빛 반사 하이라이트 및 클리어코트 질감)
    return new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: btex,
      bumpScale: 0.003,
      roughness: 0.12,
      metalness: 0.05
    });
  }

  drawMarbleVeins(ctx, bctx, subColor, mainColor, count, isDark) {
    for (let v = 0; v < count; v++) {
      ctx.save();
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.3 + Math.random() * 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let x = Math.random() * 1024;
      let y = Math.random() * 250;
      const angle = 0.52 + (Math.random() - 0.5) * 0.55;
      const length = 550 + Math.random() * 550;
      let curDist = 0;

      ctx.beginPath();
      ctx.moveTo(x, y);

      while (curDist < length && y < 1024 && x < 1024 && x > 0) {
        const step = 18 + Math.random() * 24;
        curDist += step;
        x += Math.cos(angle) * step + (Math.random() - 0.5) * 28;
        y += Math.sin(angle) * step + (Math.random() - 0.5) * 16;
        ctx.lineTo(x, y);

        if (Math.random() < 0.28) {
          ctx.stroke();
          ctx.save();
          ctx.strokeStyle = subColor;
          ctx.lineWidth = Math.max(0.6, ctx.lineWidth * 0.55);
          ctx.beginPath();
          ctx.moveTo(x, y);
          let bx = x;
          let by = y;
          const bAngle = angle + (Math.random() < 0.5 ? 0.68 : -0.68);
          for (let b = 0; b < 4; b++) {
            bx += Math.cos(bAngle) * 24 + (Math.random() - 0.5) * 16;
            by += Math.sin(bAngle) * 24 + (Math.random() - 0.5) * 16;
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
          ctx.restore();
          ctx.beginPath();
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  createBirchWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e5d1b0';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 2) {
      ctx.fillStyle = '#cfb58c';
      ctx.globalAlpha = 0.18 + Math.random() * 0.1;
      ctx.fillRect(0, y + Math.sin(y * 0.05) * 4, 512, 1.5);
    }
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  createTexturesAndMaterials() {
    this.textures.birch = this.createBirchWoodTexture();

    this.carcassWoodMat = new THREE.MeshStandardMaterial({
      map: this.textures.birch,
      roughness: 0.56,
      metalness: 0.02
    });

    this.darkGapMat = new THREE.MeshStandardMaterial({
      color: 0x3b322b,
      roughness: 0.72,
      metalness: 0.05
    });

    this.doorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.spec.doorColor),
      roughness: 0.36,
      metalness: 0.03
    });

    this.stainlessMat = new THREE.MeshStandardMaterial({
      color: 0xd9dde2,
      roughness: 0.24,
      metalness: 0.88
    });

    this.stainlessDarkMat = new THREE.MeshStandardMaterial({
      color: 0x8e959d,
      roughness: 0.34,
      metalness: 0.8
    });

    this.blackGlassMat = new THREE.MeshStandardMaterial({
      color: 0x15171b,
      roughness: 0.06,
      metalness: 0.94
    });

    // 장식장 강화 유리문 (브론즈/스모크 틴티드 반투명 글래스)
    this.glassDoorMat = new THREE.MeshStandardMaterial({
      color: 0x42382f,
      transparent: true,
      opacity: 0.38,
      roughness: 0.04,
      metalness: 0.35
    });

    // 장식장 내부 8T 강화유리 선반
    this.glassShelfMat = new THREE.MeshStandardMaterial({
      color: 0xcde0e8,
      transparent: true,
      opacity: 0.58,
      roughness: 0.05,
      metalness: 0.25
    });

    // 신발장 거울 도어
    this.mirrorMat = new THREE.MeshStandardMaterial({
      color: 0xe8ecf0,
      roughness: 0.02,
      metalness: 0.98
    });

    // 슬림 알루미늄 프레임 (매트 블랙 / 샴페인 골드)
    this.aluminumFrameMat = new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.32,
      metalness: 0.8
    });

    this.goldMetalMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.85
    });

    this.dimLineMat = new THREE.LineBasicMaterial({
      color: 0x2b2118,
      depthTest: false,
      transparent: true,
      opacity: 0.88
    });

    this.cadLineMat = new THREE.LineBasicMaterial({
      color: 0x1f2429,
      depthTest: true,
      transparent: true,
      opacity: 0.82
    });

    this.refreshDynamicMaterials();
  }

  refreshDynamicMaterials() {
    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.createFloorTexture(this.spec.floorDesign),
      roughness: this.spec.floorDesign === 'limestone_tile' ? 0.45 : 0.48,
      metalness: 0.04
    });

    this.wallMat = this.createWallMaterials(this.spec.wallDesign);
    this.tileWallMat = this.createTileMaterial(this.spec.tileDesign);
    this.countertopMat = this.createCountertopMaterial(this.spec.countertopType);
  }

  // =========================================================
  // 완결된 건축 실내 공간 셸 (뒷벽 + 바닥 + 측벽/걸레받이 + 천장 써라운딩)
  // =========================================================
  buildRoomShell() {
    if (this.roomGroup) this.scene.remove(this.roomGroup);
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    const totalW = this.spec.totalWidth / 1000;
    const ceilH = Math.max(2.35, this.spec.ceilingHeight / 1000);
    const sideLen = this.spec.sideLength / 1000;

    // 1. 바닥 원목 마루 / 타일
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 5.0);
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // 2. 메인 뒷벽 (앞면만 렌더 + 천장까지 꽉 채움)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, ceilH + 1.2), this.wallMat);
    backWall.position.set(0, (ceilH + 1.2) / 2, -0.002);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);

    // 벽체 걸레받이 (미니멀 우드 화이트/월넛 몰딩)
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xe9e3da, roughness: 0.65 });
    const backBase = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.015), baseMat);
    backBase.position.set(0, 0.04, 0.005);
    this.roomGroup.add(backBase);

    // 3. 레이아웃(일자, ㄱ자, ㄴ자, ㄷ자, ㄷ자 식탁형)에 따른 측벽 실시간 자동 적응
    const isPeninsula = this.spec.layoutType === 'u_peninsula';
    const isR = this.spec.layoutType === 'l_right' || this.spec.layoutType === 'u_shape';
    const isL = this.spec.layoutType === 'l_left' || this.spec.layoutType === 'u_shape' || isPeninsula;

    if (isR) {
      const rwD = sideLen + 2.8;
      const rWall = new THREE.Mesh(new THREE.PlaneGeometry(rwD, ceilH + 1.2), this.wallMat);
      rWall.rotation.y = -Math.PI / 2;
      rWall.position.set(totalW / 2 + 0.002, (ceilH + 1.2) / 2, rwD / 2 - 0.005);
      rWall.receiveShadow = true;
      this.roomGroup.add(rWall);

      const rBase = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, rwD), baseMat);
      rBase.position.set(totalW / 2 - 0.005, 0.04, rwD / 2);
      this.roomGroup.add(rBase);
    }
    if (isL) {
      const lwD = sideLen + 2.8;
      const lWall = new THREE.Mesh(new THREE.PlaneGeometry(lwD, ceilH + 1.2), this.wallMat);
      lWall.rotation.y = Math.PI / 2;
      lWall.position.set(-totalW / 2 - 0.002, (ceilH + 1.2) / 2, lwD / 2 - 0.005);
      lWall.receiveShadow = true;
      this.roomGroup.add(lWall);

      const lBase = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, lwD), baseMat);
      lBase.position.set(-totalW / 2 + 0.005, 0.04, lwD / 2);
      this.roomGroup.add(lBase);
    }

    // 4. 천장 소핏 슬라브 & 매입 다운라이트 3구 (건축적 깊이감 극대화!)
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf4f0ea, roughness: 0.9, side: THREE.FrontSide });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, ceilH + 0.08, 4.9);
    this.roomGroup.add(ceiling);

    // 천장 다운라이트 트림 3구
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3db });
    [-totalW * 0.34, 0, totalW * 0.34].forEach(lx => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.01, 24), trimMat);
      ring.position.set(lx, ceilH + 0.075, 0.88);
      this.roomGroup.add(ring);

      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 24), bulbMat);
      glow.position.set(lx, ceilH + 0.074, 0.88);
      this.roomGroup.add(glow);
    });
  }

  setupDimensionOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'dimension-overlay';
    this.overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; z-index:10;';
    this.container.style.position = 'relative';
    this.container.appendChild(this.overlay);

    this.dimBadges = {
      totalW: this.createDimBadge('전체 폭: 2,700mm'),
      tallW: this.createDimBadge('키큰장 600mm'),
      sinkW: this.createDimBadge('개수대 1,000mm'),
      prepW: this.createDimBadge('조리대 800mm'),
      cookW: this.createDimBadge('가열대 900mm'),
      lowerH: this.createDimBadge('하부 H:860'),
      midwayH: this.createDimBadge('벽면 H:650'),
      upperH: this.createDimBadge('상부 H:700'),
      totalH: this.createDimBadge('총 높이 2,210mm'),
      depth: this.createDimBadge('깊이 D:600'),
      wingLen: this.createDimBadge('세로 1,800mm')
    };

    this.calloutBadges = {
      tall: this.createCalloutBadge('키큰 가전수납장 (밥솥/오븐 W600)'),
      sink: this.createCalloutBadge('싱크볼 (사각볼 W850)'),
      prep: this.createCalloutBadge('조리대 (3단 서랍장)'),
      cook: this.createCalloutBadge('가열대 (3구 인덕션)'),
      top: this.createCalloutBadge('대리석 상판 (T40)'),
      upper: this.createCalloutBadge('상부장 (플랩/스윙장)'),
      wing: this.createCalloutBadge('코너 날개장 (식탁/아일랜드)')
    };
  }

  createDimBadge(text) {
    const el = document.createElement('div');
    el.className = 'cad-dim-badge';
    el.innerText = text;
    el.style.cssText = `
      position: absolute;
      background: rgba(255, 255, 255, 0.95);
      border: 1.2px solid #3d312a;
      color: #2b2118;
      padding: 2.5px 7px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 5px rgba(42,33,27,0.18);
      transform: translate(-50%, -50%);
      white-space: nowrap;
      display: ${this.spec.showDimensions ? 'block' : 'none'};
      pointer-events: none;
    `;
    this.overlay.appendChild(el);
    return el;
  }

  createCalloutBadge(text) {
    const el = document.createElement('div');
    el.className = 'cad-callout-badge';
    el.innerHTML = `
      <div style="display:flex; align-items:center; gap:5px; background:rgba(37,30,24,0.92); color:#fff; padding:3px 8px; border-radius:12px; font-size:10.5px; font-weight:600; box-shadow:0 3px 8px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.22); letter-spacing:-0.2px;">
        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#d4a373;"></span>
        <span>${text}</span>
      </div>
    `;
    el.style.cssText = `
      position: absolute;
      transform: translate(-50%, -100%);
      white-space: nowrap;
      display: ${this.spec.showCallouts ? 'block' : 'none'};
      pointer-events: none;
    `;
    this.overlay.appendChild(el);
    return el;
  }

  // =========================================================
  // 3. 주방 씽크대 전체 빌드
  // =========================================================
  // =========================================================
  // 3. 맞춤 가구 다중 카테고리 3D 통합 빌더 (씽크대, 붙박이장, 신발장, 아일랜드, 장식장 등)
  // =========================================================
  buildFurniture() {
    if (this.kitchenGroup) {
      this.scene.remove(this.kitchenGroup);
      this.doors = [];
      this.slidingDoors = [];
      this.dimensionLines.forEach(l => this.scene.remove(l));
      this.dimensionLines = [];
      this.cadEdgeLines.forEach(l => {
        if (l.parent) l.parent.remove(l);
        if (l.geometry) l.geometry.dispose();
      });
      this.cadEdgeLines = [];
    }

    this.kitchenGroup = new THREE.Group();
    this.scene.add(this.kitchenGroup);

    const cat = this.spec.category || 'sink';
    if (cat === 'wardrobe') {
      this.buildWardrobe();
    } else if (cat === 'shoe_cabinet') {
      this.buildShoeCabinet();
    } else if (cat === 'island') {
      this.buildIslandTable();
    } else if (cat === 'display_glass') {
      this.buildGlassDisplayCabinet();
    } else if (cat === 'tv_console') {
      this.buildTvConsole();
    } else if (cat === 'drawers') {
      this.buildDrawersUnit();
    } else if (cat === 'storage') {
      this.buildStorageCabinet();
    } else if (cat === 'prep_counter') {
      this.buildPrepCounter();
    } else if (cat === 'tall_cabinet') {
      this.buildStandaloneTallCabinet();
    } else if (cat === 'hood_cabinet') {
      this.buildDedicatedHoodCabinet();
    } else if (cat === 'base_corner') {
      this.buildDedicatedBaseCorner();
    } else if (cat === 'upper_corner') {
      this.buildDedicatedUpperCorner();
    } else if (cat === 'partition') {
      this.buildPartitionDoor();
    } else if (cat === 'bathroom') {
      this.buildBathroomZone();
    } else {
      this.buildKitchenLayout();
    }

    // CAD 윤곽선 생성
    this.addCadEdgesRecursively(this.kitchenGroup);
  }

  buildKitchen() {
    this.buildFurniture();
  }

  buildKitchenLayout() {
    const totalW = this.spec.totalWidth / 1000;
    const lowerH = this.spec.lowerHeight / 1000;
    const lowerD = this.spec.lowerDepth / 1000;
    const plinthH = this.spec.plinthHeight / 1000;
    const topT = this.spec.topThickness / 1000;
    const upperH = this.spec.upperHeight / 1000;
    const upperD = this.spec.upperDepth / 1000;
    const midwayH = this.spec.midwayHeight / 1000;
    const sideLen = this.spec.sideLength / 1000;

    const sinkW = this.spec.sinkBayWidth / 1000;
    const prepW = this.spec.prepBayWidth / 1000;
    const cookW = this.spec.cooktopBayWidth / 1000;
    const startX = -totalW / 2;
    const isLeftL = this.spec.layoutType === 'l_left';
    const isRightL = this.spec.layoutType === 'l_right';
    const isU = this.spec.layoutType === 'u_shape';
    const isPeninsula = this.spec.layoutType === 'u_peninsula';

    // 키큰장 (가전수납장 / 롱팬트리 / 냉장고장) 계산
    const hasTall = Boolean(this.spec.tallCabinet && this.spec.tallCabinet !== 'none');
    const isLeftTall = this.spec.tallCabinet === 'left';
    const isRightTall = this.spec.tallCabinet === 'right';
    const tallW = hasTall ? Math.min(1.2, (Number(this.spec.tallCabinetWidth) || 600) / 1000) : 0;
    const tallH = lowerH + midwayH + upperH;

    // 메인 하부장 및 상판 구간 계산 (키큰장 및 코너 간섭 완벽 회피)
    let lowerStartX = startX;
    let counterW = totalW;

    if (this.spec.layoutType === 'straight') {
      if (isLeftTall) {
        lowerStartX = startX + tallW;
        counterW = Math.max(1.0, totalW - tallW);
      } else if (isRightTall) {
        lowerStartX = startX;
        counterW = Math.max(1.0, totalW - tallW);
      }
    } else if (isLeftL) {
      lowerStartX = startX + lowerD;
      counterW = isRightTall ? Math.max(1.0, totalW - lowerD - tallW) : Math.max(1.0, totalW - lowerD);
    } else if (isRightL) {
      lowerStartX = isLeftTall ? (startX + tallW) : startX;
      counterW = isLeftTall ? Math.max(1.0, totalW - lowerD - tallW) : Math.max(1.0, totalW - lowerD);
    } else if (isU || isPeninsula) {
      lowerStartX = startX + lowerD;
      counterW = Math.max(1.0, totalW - lowerD * 2);
    }

    // A. 미드웨이 타일/빅슬랩 벽면 패널 (메인 + 코너 측벽)
    const tilePanel = new THREE.Mesh(
      new THREE.BoxGeometry(counterW + 0.04, midwayH + 0.14, 0.008),
      this.tileWallMat
    );
    tilePanel.position.set(lowerStartX + counterW / 2, lowerH + midwayH / 2, 0.004);
    tilePanel.receiveShadow = true;
    this.kitchenGroup.add(tilePanel);

    if ((isLeftL || isU || isPeninsula) && sideLen > lowerD) {
      const lSideTile = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, midwayH + 0.14, sideLen + 0.02),
        this.tileWallMat
      );
      lSideTile.position.set(startX + 0.004, lowerH + midwayH / 2, sideLen / 2);
      lSideTile.receiveShadow = true;
      this.kitchenGroup.add(lSideTile);
    }
    if ((isRightL || isU) && sideLen > lowerD) {
      const rSideTile = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, midwayH + 0.14, sideLen + 0.02),
        this.tileWallMat
      );
      rSideTile.position.set(startX + totalW - 0.004, lowerH + midwayH / 2, sideLen / 2);
      rSideTile.receiveShadow = true;
      this.kitchenGroup.add(rSideTile);
    }

    // A-2. 키큰장 캐비닛 (밥솥/오븐장 / 냉장고장) — 레이아웃별 충돌 없는 정확한 위치 배치
    if (hasTall) {
      let tallCX = 0;
      let tallCZ = lowerD / 2;

      if (this.spec.layoutType === 'straight') {
        tallCX = isLeftTall ? (startX + tallW / 2) : (startX + totalW - tallW / 2);
      } else if (isLeftL || isPeninsula) {
        if (isLeftTall) {
          // 좌측 ㄱ자 날개 끝단에 배치하여 코너 충돌 완전 방지
          tallCX = startX + lowerD / 2;
          tallCZ = sideLen - tallW / 2;
        } else {
          tallCX = startX + totalW - tallW / 2;
        }
      } else if (isRightL) {
        if (isRightTall) {
          tallCX = startX + totalW - lowerD / 2;
          tallCZ = sideLen - tallW / 2;
        } else {
          tallCX = startX + tallW / 2;
        }
      } else if (isU) {
        if (isLeftTall) {
          tallCX = startX + lowerD / 2;
          tallCZ = sideLen - tallW / 2;
        } else {
          tallCX = startX + totalW - lowerD / 2;
          tallCZ = sideLen - tallW / 2;
        }
      }
      this.buildTallCabinet(tallCX, tallW, tallH, lowerD, plinthH, this.spec.tallCabinetType || 'appliance', tallCZ);
    }

    // B. 하부장 캐비닛 (메인 라인 + ㄱ/ㄴ/ㄷ자 코너 날개장)
    const curSum = sinkW + prepW + cookW;
    const scaleFactor = counterW / curSum;
    const adjSinkW = sinkW * scaleFactor;
    const adjPrepW = prepW * scaleFactor;
    const adjCookW = cookW * scaleFactor;

    this.buildLowerCabinets(lowerStartX, counterW, lowerH, lowerD, plinthH, topT, adjSinkW, adjPrepW, adjCookW);

    // 코너 일체형 연결장 (L자 좌측 / 우측 / ㄷ자 양측) — 상·하부 코너장 일체화 연결
    if (isLeftL || isU || isPeninsula) {
      this.buildCornerCabinet('left', startX, totalW, lowerH, lowerD, plinthH, topT, upperH, upperD, midwayH);
    }
    if (isRightL || isU) {
      this.buildCornerCabinet('right', startX, totalW, lowerH, lowerD, plinthH, topT, upperH, upperD, midwayH);
    }

    // 날개장 (좌측 / 우측 / 양쪽 / ㄷ자 식탁형 아일랜드)
    if ((isLeftL || isU || isPeninsula) && sideLen > lowerD + 0.1) {
      const wingLen = isLeftTall ? (sideLen - tallW) : sideLen;
      this.buildWingCabinets('left', startX, totalW, lowerH, lowerD, plinthH, topT, wingLen, upperH, upperD, midwayH);
    }
    if ((isRightL || isU) && sideLen > lowerD + 0.1) {
      const wingLen = isRightTall ? (sideLen - tallW) : sideLen;
      this.buildWingCabinets('right', startX, totalW, lowerH, lowerD, plinthH, topT, wingLen, upperH, upperD, midwayH);
    }
    if (isPeninsula && sideLen > lowerD + 0.1) {
      this.buildPeninsulaDiningWing(startX, totalW, lowerH, lowerD, plinthH, topT, sideLen);
    }

    // C. Seamless Monolithic Beveled 인조대리석 상판 + 3D 싱크볼 + 수전 + 쿡탑
    this.buildMonolithicCountertopAndAppliances(startX, totalW, lowerH, lowerD, topT, adjSinkW, adjPrepW, adjCookW, sideLen);

    // D. 상부장 + 천장 써라운딩 몰딩 + 후드 + 간접조명 (코너장과 틈새 없이 완벽 연결)
    if (this.spec.hasUpperCabinets) {
      let upperStartX = lowerStartX;
      let upperCounterW = counterW;
      if (isLeftL || isU || isPeninsula) {
        upperStartX = startX + upperD;
        upperCounterW = (isRightL || isU) ? Math.max(0.6, totalW - upperD * 2) : Math.max(0.6, totalW - upperD);
      } else if (isRightL) {
        upperStartX = startX;
        upperCounterW = Math.max(0.6, totalW - upperD);
      }
      this.buildUpperCabinets(upperStartX, upperCounterW, lowerH, midwayH, upperH, upperD, adjSinkW, adjPrepW, adjCookW);
    }
    this.updateUnderLights(lowerH, midwayH, adjSinkW, adjPrepW, counterW, lowerStartX);

    // E. 쇼룸 데코 소품
    if (this.spec.showProps) {
      this.buildShowroomProps(lowerStartX, counterW, lowerH, lowerD, adjSinkW, adjPrepW, sideLen);
    }

    // F. 도면 치수선 (CAD 표준 45° 사선 틱 & 연장선)
    this.buildDimensionGuides(startX, totalW, lowerH, lowerD, upperH, upperD, midwayH, adjSinkW, adjPrepW, adjCookW, sideLen, hasTall, isLeftTall, tallW, counterW, lowerStartX);
  }

  addCadEdgesRecursively(obj) {
    if (!obj) return;
    obj.traverse(child => {
      if (child.isMesh && child.geometry && !child.userData.isCadEdge && !child.userData.isProp) {
        try {
          const edges = new THREE.EdgesGeometry(child.geometry, 22);
          const line = new THREE.LineSegments(edges, this.cadLineMat);
          line.userData.isCadEdge = true;
          line.visible = Boolean(this.spec.showCadEdges);
          child.add(line);
          this.cadEdgeLines.push(line);
        } catch(e) {}
      }
    });
  }

  updateUnderLights(lowerH, midwayH, sinkW, prepW, totalW, startX) {
    const temp = this.spec.underlightTemp;
    const lightColor = temp === 'neutral' ? 0xf3f7ff : 0xffdfb0;
    const isOn = temp !== 'off' && this.spec.hasUpperCabinets;
    this.underLights.forEach((l, i) => {
      l.color.setHex(lightColor);
      l.intensity = isOn ? 0.5 : 0;
      l.position.y = lowerH + midwayH - 0.04;
      l.position.x = (i - 1) * (totalW * 0.3);
    });
  }

  // B-0. 키큰장 / 가전수납장 (밥솥 슬라이딩장 / 오븐장 / 냉장고장 / 롱팬트리)
  buildTallCabinet(cx, tallW, tallH, tallD, plinthH, type = 'appliance', cz = null) {
    const bodyH = tallH - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;
    const centerZ = cz !== null ? cz : (tallD / 2);
    const frontZ = centerZ + tallD / 2;
    const backZ = centerZ - tallD / 2;

    const group = new THREE.Group();

    // 1. 걸레받이
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(tallW - 0.01, plinthH, tallD - 0.07),
      this.darkGapMat
    );
    plinth.position.set(cx, plinthH / 2, centerZ - 0.035);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    // 2. 몸통 측판 / 뒷판 / 상하판
    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, tallD), this.carcassWoodMat);
    leftSide.position.set(cx - tallW / 2 + T / 2, bodyY, centerZ);
    leftSide.castShadow = true;
    leftSide.receiveShadow = true;
    group.add(leftSide);

    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, tallD), this.carcassWoodMat);
    rightSide.position.set(cx + tallW / 2 - T / 2, bodyY, centerZ);
    rightSide.castShadow = true;
    rightSide.receiveShadow = true;
    group.add(rightSide);

    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(tallW - 2 * T, bodyH, 0.009), this.carcassWoodMat);
    backPanel.position.set(cx, bodyY, backZ + 0.005);
    group.add(backPanel);

    const topPanel = new THREE.Mesh(new THREE.BoxGeometry(tallW - 2 * T, T, tallD), this.carcassWoodMat);
    topPanel.position.set(cx, plinthH + bodyH - T / 2, centerZ);
    group.add(topPanel);

    const botPanel = new THREE.Mesh(new THREE.BoxGeometry(tallW - 2 * T, T, tallD), this.carcassWoodMat);
    botPanel.position.set(cx, plinthH + T / 2, centerZ);
    group.add(botPanel);

    // 3. 천장 써라운딩 몰딩 마감
    const ceilH = Math.max(tallH + 0.05, this.spec.ceilingHeight / 1000);
    const surroundH = Math.max(0.04, ceilH - tallH);
    const filler = new THREE.Mesh(new THREE.BoxGeometry(tallW, surroundH, tallD), this.doorMat);
    filler.position.set(cx, tallH + surroundH / 2, centerZ);
    filler.castShadow = true;
    group.add(filler);

    if (type === 'appliance') {
      // 밥솥 / 전자레인지 가전수납장 (한국 표준 아파트 키큰장)
      const lowerSecH = 0.82;
      const nicheH = 0.85;

      // 하부장과 중간 가전구역 분할 선반
      const midShelf = new THREE.Mesh(new THREE.BoxGeometry(tallW - 2 * T, T, tallD), this.carcassWoodMat);
      midShelf.position.set(cx, plinthH + lowerSecH, centerZ);
      group.add(midShelf);

      // 하부 2도어 (또는 2단 레일 서랍)
      const lowerDoorW = (tallW - 0.006) / 2;
      [-1, 1].forEach((dir) => {
        const dMesh = new THREE.Mesh(
          new THREE.BoxGeometry(lowerDoorW - 0.003, lowerSecH - 0.008, 0.018),
          this.doorMat
        );
        dMesh.position.set(cx + dir * (lowerDoorW / 2 + 0.0015), plinthH + lowerSecH / 2, frontZ + 0.009);
        dMesh.castShadow = true;
        group.add(dMesh);
      });

      // 가전구역 상단 선반
      const nicheTop = new THREE.Mesh(new THREE.BoxGeometry(tallW - 2 * T, T, tallD), this.carcassWoodMat);
      nicheTop.position.set(cx, plinthH + lowerSecH + nicheH, centerZ);
      group.add(nicheTop);

      // 밥솥 슬라이딩 인출 선반
      const tray = new THREE.Mesh(new THREE.BoxGeometry(tallW - 0.08, 0.02, tallD - 0.08), this.darkGapMat);
      tray.position.set(cx, plinthH + lowerSecH + 0.02, centerZ);
      group.add(tray);

      // 밥솥 모형
      const cooker = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 20), this.stainlessDarkMat);
      cooker.position.set(cx - 0.08, plinthH + lowerSecH + 0.02 + 0.09, centerZ);
      group.add(cooker);

      // 광파오븐 중간 분할선반 & 오븐 모형
      const ovenShelf = new THREE.Mesh(new THREE.BoxGeometry(tallW - 2 * T, T, tallD - 0.04), this.carcassWoodMat);
      ovenShelf.position.set(cx, plinthH + lowerSecH + 0.44, centerZ);
      group.add(ovenShelf);

      const oven = new THREE.Mesh(new THREE.BoxGeometry(tallW - 0.12, 0.28, 0.38), this.stainlessMat);
      oven.position.set(cx, plinthH + lowerSecH + 0.44 + 0.15, centerZ - 0.02);
      group.add(oven);

      // 상부 수납 도어 (플랩/스윙)
      const upperSecH = tallH - (plinthH + lowerSecH + nicheH);
      if (upperSecH > 0.15) {
        const upperDoorW = (tallW - 0.006) / 2;
        [-1, 1].forEach((dir) => {
          const uMesh = new THREE.Mesh(
            new THREE.BoxGeometry(upperDoorW - 0.003, upperSecH - 0.008, 0.018),
            this.doorMat
          );
          uMesh.position.set(cx + dir * (upperDoorW / 2 + 0.0015), plinthH + lowerSecH + nicheH + upperSecH / 2, frontZ + 0.009);
          uMesh.castShadow = true;
          group.add(uMesh);
        });
      }
    } else if (type === 'pantry') {
      // 롱도어 팬트리 수납장
      const doorH = bodyH - 0.008;
      const doorW = (tallW - 0.006) / 2;
      [-1, 1].forEach((dir) => {
        const pDoor = new THREE.Mesh(
          new THREE.BoxGeometry(doorW - 0.003, doorH, 0.018),
          this.doorMat
        );
        pDoor.position.set(cx + dir * (doorW / 2 + 0.0015), bodyY, frontZ + 0.009);
        pDoor.castShadow = true;
        group.add(pDoor);
      });
    } else {
      // 냉장고장 (상부 플랩장 + 하부 냉장고 오픈 공간)
      const bridgeH = 0.52;
      const bridgeY = tallH - bridgeH / 2;
      const bShelf = new THREE.Mesh(new THREE.BoxGeometry(tallW - 2 * T, T, tallD), this.carcassWoodMat);
      bShelf.position.set(cx, tallH - bridgeH, centerZ);
      group.add(bShelf);

      const bDoor = new THREE.Mesh(new THREE.BoxGeometry(tallW - 0.006, bridgeH - 0.008, 0.018), this.doorMat);
      bDoor.position.set(cx, bridgeY, frontZ + 0.009);
      bDoor.castShadow = true;
      group.add(bDoor);
    }

    this.kitchenGroup.add(group);
  }

  // =========================================================
  // B-1. 맞춤 붙박이장 (Wardrobe / Closet)
  // =========================================================
  buildWardrobe() {
    const W = (this.spec.totalWidth || 3000) / 1000;
    const CH = (this.spec.ceilingHeight || 2350) / 1000;
    const D = 0.65;
    const plinthH = 0.08;
    const surroundH = 0.05;
    const T = 0.018;
    const startX = -W / 2;
    const bodyH = CH - plinthH - surroundH;
    const bodyY = plinthH + bodyH / 2;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W, plinthH, D - 0.04), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, (D - 0.04) / 2);
    group.add(plinth);

    const topSurround = new THREE.Mesh(new THREE.BoxGeometry(W, surroundH, D), this.doorMat);
    topSurround.position.set(0, CH - surroundH / 2, D / 2);
    group.add(topSurround);

    const back = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, 0.009), this.carcassWoodMat);
    back.position.set(0, bodyY, 0.005);
    group.add(back);

    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, D), this.carcassWoodMat);
    leftSide.position.set(startX + T / 2, bodyY, D / 2);
    group.add(leftSide);

    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, D), this.carcassWoodMat);
    rightSide.position.set(startX + W - T / 2, bodyY, D / 2);
    group.add(rightSide);

    const botPanel = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, T, D), this.carcassWoodMat);
    botPanel.position.set(0, plinthH + T / 2, D / 2);
    group.add(botPanel);

    const topPanel = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, T, D), this.carcassWoodMat);
    topPanel.position.set(0, plinthH + bodyH - T / 2, D / 2);
    group.add(topPanel);

    const bayCount = Math.max(2, Math.round(W / 0.85));
    const bayW = (W - 2 * T - (bayCount - 1) * T) / bayCount;

    for (let b = 1; b < bayCount; b++) {
      const divX = startX + T + b * (bayW + T) - T / 2;
      const divider = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, D - 0.02), this.carcassWoodMat);
      divider.position.set(divX, bodyY, (D - 0.02) / 2 + 0.01);
      group.add(divider);
    }

    for (let b = 0; b < bayCount; b++) {
      const bayCX = startX + T + b * (bayW + T) + bayW / 2;
      const shelfY = plinthH + bodyH - 0.45;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.004, T, D - 0.03), this.carcassWoodMat);
      shelf.position.set(bayCX, shelfY, D / 2);
      group.add(shelf);

      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, bayW - 0.01, 16), this.stainlessMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(bayCX, shelfY - 0.06, D / 2);
      group.add(rod);

      if (b === 0 || b === bayCount - 1) {
        const drawerBoxH = 0.48;
        const dDiv = new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.004, T, D - 0.03), this.carcassWoodMat);
        dDiv.position.set(bayCX, plinthH + drawerBoxH, D / 2);
        group.add(dDiv);

        const dH = (drawerBoxH - 0.01) / 2;
        for (let di = 0; di < 2; di++) {
          const dy = plinthH + 0.005 + di * (dH + 0.005) + dH / 2;
          const dFront = new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.01, dH - 0.005, 0.018), this.carcassWoodMat);
          dFront.position.set(bayCX, dy, D - 0.02);
          group.add(dFront);

          const dPull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.008, 0.012), this.stainlessDarkMat);
          dPull.position.set(bayCX, dy + dH * 0.25, D - 0.008);
          group.add(dPull);
        }
      }
    }

    // 도어 시스템: 슬라이딩(미닫이) 또는 여닫이(스윙) 선택 지원
    const isSliding = (this.spec.wardrobeDoorType !== 'swing');

    if (isSliding) {
      // 1. 상부 알루미늄 더블 슬라이딩 트랙
      const trackDepth = 0.08;
      const topTrackH = 0.038;
      const topTrack = new THREE.Mesh(new THREE.BoxGeometry(W, topTrackH, trackDepth), this.aluminumFrameMat);
      topTrack.position.set(0, plinthH + bodyH - topTrackH / 2, D + trackDepth / 2 - 0.008);
      group.add(topTrack);

      // 2. 하부 슬라이딩 가이드 레일
      const botTrackH = 0.015;
      const botTrack = new THREE.Mesh(new THREE.BoxGeometry(W, botTrackH, trackDepth), this.aluminumFrameMat);
      botTrack.position.set(0, plinthH + botTrackH / 2, D + trackDepth / 2 - 0.008);
      group.add(botTrack);

      // 3. 도어 개수 (W <= 2.2m: 2도어, W > 2.2m: 3도어)
      const numDoors = (W <= 2.2) ? 2 : 3;
      const overlap = 0.06; // 도어 간 60mm 오버랩
      const doorW = (W + (numDoors - 1) * overlap) / numDoors;
      const sDoorH = bodyH - topTrackH - botTrackH - 0.008;
      const sDoorY = plinthH + botTrackH + sDoorH / 2 + 0.004;

      if (!this.slidingDoors) this.slidingDoors = [];

      for (let i = 0; i < numDoors; i++) {
        // 앞/뒤 레일 교차 배치 (i가 짝수면 앞 레일, 홀수면 뒤 레일)
        const isFrontRail = (i % 2 === 0);
        const railZ = isFrontRail ? (D + 0.052) : (D + 0.024);

        // 닫힌 상태의 기본 X 위치 (가로 폭에 맞춰 균등 분할)
        const closedX = startX + doorW / 2 + i * (doorW - overlap);

        // 열린 상태의 목표 X 위치 (좌/우로 슥 슬라이드)
        let openX;
        if (numDoors === 2) {
          openX = (i === 0) ? (closedX + doorW * 0.78) : (closedX - doorW * 0.78);
        } else {
          if (i === 0) openX = closedX + doorW * 0.85;
          else if (i === 2) openX = closedX - doorW * 0.85;
          else openX = closedX;
        }

        const doorGroup = new THREE.Group();
        const initialX = this.spec.isDoorOpen ? openX : closedX;
        doorGroup.position.set(initialX, sDoorY, railZ);

        // A. 슬라이딩 도어 전면 본체
        const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.006, sDoorH, 0.018), this.doorMat);
        panel.castShadow = true;
        panel.receiveShadow = true;
        doorGroup.add(panel);

        // B. 사방 알루미늄 슬림 엣지 프레임
        const frameT = 0.016;
        const frameL = new THREE.Mesh(new THREE.BoxGeometry(frameT, sDoorH, 0.022), this.aluminumFrameMat);
        frameL.position.set(-doorW / 2 + frameT / 2, 0, 0.001);
        doorGroup.add(frameL);

        const frameR = new THREE.Mesh(new THREE.BoxGeometry(frameT, sDoorH, 0.022), this.aluminumFrameMat);
        frameR.position.set(doorW / 2 - frameT / 2, 0, 0.001);
        doorGroup.add(frameR);

        // C. 세로 롱바 매립형 알루미늄 손잡이
        const handleX = isFrontRail ? (doorW / 2 - 0.024) : (-doorW / 2 + 0.024);
        const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.012, sDoorH * 0.92, 0.012), this.stainlessDarkMat);
        handleBar.position.set(handleX, 0, 0.012);
        doorGroup.add(handleBar);

        // D. 도어 중앙 프리미엄 분할 인레이 라인 (고급 맞춤 슬라이딩 장 장식선)
        const lineY1 = sDoorH * 0.16;
        const lineY2 = -sDoorH * 0.16;
        [lineY1, lineY2].forEach(ly => {
          const inlay = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.04, 0.003, 0.02), this.aluminumFrameMat);
          inlay.position.set(0, ly, 0.001);
          doorGroup.add(inlay);
        });

        group.add(doorGroup);

        this.slidingDoors.push({
          mesh: doorGroup,
          closedX: closedX,
          openX: openX,
          currentX: initialX
        });
      }
    } else {
      // 여닫이 (스윙 도어)
      const doorCount = bayCount * 2;
      const singleDoorW = (W - 0.01) / doorCount;
      const doorH = bodyH - 0.006;

      for (let d = 0; d < doorCount; d++) {
        const isLeft = (d % 2 === 0);
        const doorCX = startX + 0.005 + d * singleDoorW + singleDoorW / 2;

        const pivot = new THREE.Group();
        const hingeX = isLeft ? (doorCX - singleDoorW / 2) : (doorCX + singleDoorW / 2);
        pivot.position.set(hingeX, bodyY, D + 0.009);

        const doorPanel = this.createDoorPanel(singleDoorW - 0.004, doorH, 0.018);
        const offsetX = isLeft ? (singleDoorW / 2) : (-singleDoorW / 2);
        doorPanel.position.set(offsetX, 0, 0);
        pivot.add(doorPanel);

        this.addDoorHandleOrChannel(doorPanel, singleDoorW - 0.004, doorH, false, isLeft);

        group.add(pivot);
        this.doors.push({
          group: pivot,
          isLeft,
          openAngle: isLeft ? (-Math.PI * 0.48) : (Math.PI * 0.48),
          targetAngle: this.spec.isDoorOpen ? (isLeft ? -Math.PI * 0.48 : Math.PI * 0.48) : 0
        });
      }
    }

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, CH + 0.12, D], [W / 2, CH + 0.12, D]);
    this.createArchitecturalTick(-W / 2, CH + 0.12, D, 'xy');
    this.createArchitecturalTick(W / 2, CH + 0.12, D, 'xy');

    this.createLine([W / 2 + 0.18, 0, D], [W / 2 + 0.18, CH, D]);
    this.createArchitecturalTick(W / 2 + 0.18, 0, D, 'xy');
    this.createArchitecturalTick(W / 2 + 0.18, CH, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `붙박이장 W:${Math.round(W * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
    if (this.dimBadges.totalH) {
      this.dimBadges.totalH.innerText = `천장고 CH:${Math.round(CH * 1000)}mm`;
      this.dimBadges.totalH.style.display = 'block';
    }
  }

  // =========================================================
  // B-2. 현관 신발장 (Shoe Cabinet) — 하부 띄움 시공 & T5 간접조명 & 중간 오픈 니치
  // =========================================================
  buildShoeCabinet() {
    const W = (this.spec.totalWidth || 1200) / 1000;
    const CH = (this.spec.ceilingHeight || 2300) / 1000;
    const D = 0.38;
    const floatH = 0.20;
    const T = 0.018;
    const startX = -W / 2;
    const bodyH = CH - floatH - 0.04;
    const bodyY = floatH + bodyH / 2;

    const group = new THREE.Group();

    const floatBracket = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, floatH, D * 0.4), this.darkGapMat);
    floatBracket.position.set(0, floatH / 2, D * 0.2);
    group.add(floatBracket);

    const lightGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0.85 });
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, D - 0.06), lightGlowMat);
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.set(0, floatH - 0.005, D / 2);
    group.add(glowPlane);

    const back = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, 0.009), this.carcassWoodMat);
    back.position.set(0, bodyY, 0.005);
    group.add(back);

    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, D), this.carcassWoodMat);
    leftSide.position.set(startX + T / 2, bodyY, D / 2);
    group.add(leftSide);

    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, D), this.carcassWoodMat);
    rightSide.position.set(startX + W - T / 2, bodyY, D / 2);
    group.add(rightSide);

    const botPanel = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, T, D), this.carcassWoodMat);
    botPanel.position.set(0, floatH + T / 2, D / 2);
    group.add(botPanel);

    const topPanel = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, T, D), this.carcassWoodMat);
    topPanel.position.set(0, floatH + bodyH - T / 2, D / 2);
    group.add(topPanel);

    const nicheH = 0.35;
    const nicheBotY = floatH + 0.85;
    const nicheCenterY = nicheBotY + nicheH / 2;

    const nicheBot = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, T, D - 0.01), this.carcassWoodMat);
    nicheBot.position.set(0, nicheBotY, D / 2);
    group.add(nicheBot);

    const nicheTop = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, T, D - 0.01), this.carcassWoodMat);
    nicheTop.position.set(0, nicheBotY + nicheH, D / 2);
    group.add(nicheTop);

    const nicheBack = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, nicheH - 2 * T, 0.015), this.carcassWoodMat);
    nicheBack.position.set(0, nicheCenterY, 0.015);
    group.add(nicheBack);

    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.12), this.darkGapMat);
    tray.position.set(-W * 0.22, nicheBotY + 0.012, D * 0.6);
    group.add(tray);

    const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.065, 16), this.blackGlassMat);
    diffuser.position.set(W * 0.22, nicheBotY + 0.035, D * 0.6);
    group.add(diffuser);

    const doorCount = Math.max(2, Math.round(W / 0.45));
    const singleDoorW = (W - 0.006) / doorCount;

    const lowerDoorH = (nicheBotY - floatH) - 0.006;
    for (let d = 0; d < doorCount; d++) {
      const isLeft = (d % 2 === 0);
      const dcx = startX + 0.003 + d * singleDoorW + singleDoorW / 2;
      const dMesh = this.createDoorPanel(singleDoorW - 0.003, lowerDoorH, 0.018);
      dMesh.position.set(dcx, floatH + lowerDoorH / 2 + 0.003, D + 0.009);
      this.addDoorHandleOrChannel(dMesh, singleDoorW - 0.003, lowerDoorH, false, isLeft);
      group.add(dMesh);
    }

    const upperDoorH = (floatH + bodyH - (nicheBotY + nicheH)) - 0.006;
    const upperDoorY = nicheBotY + nicheH + upperDoorH / 2 + 0.003;
    for (let d = 0; d < doorCount; d++) {
      const isLeft = (d % 2 === 0);
      const isMirror = (d === doorCount - 1);
      const dcx = startX + 0.003 + d * singleDoorW + singleDoorW / 2;

      let dMesh;
      if (isMirror) {
        dMesh = new THREE.Mesh(new THREE.BoxGeometry(singleDoorW - 0.003, upperDoorH, 0.018), this.mirrorMat);
        dMesh.position.set(dcx, upperDoorY, D + 0.009);
        dMesh.castShadow = true;
      } else {
        dMesh = this.createDoorPanel(singleDoorW - 0.003, upperDoorH, 0.018);
        dMesh.position.set(dcx, upperDoorY, D + 0.009);
        this.addDoorHandleOrChannel(dMesh, singleDoorW - 0.003, upperDoorH, true, isLeft);
      }
      group.add(dMesh);
    }

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, CH + 0.1, D], [W / 2, CH + 0.1, D]);
    this.createArchitecturalTick(-W / 2, CH + 0.1, D, 'xy');
    this.createArchitecturalTick(W / 2, CH + 0.1, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `신발장 W:${Math.round(W * 1000)}mm (하부 띄움)`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-3. 아일랜드 식탁 (Kitchen Island) — 인조대리석 상판 오버행 & 가전 인출 수납
  // =========================================================
  buildIslandTable() {
    const W = (this.spec.totalWidth || 1800) / 1000;
    const D = (this.spec.islandDepth || 850) / 1000;
    const H = (this.spec.lowerHeight || 860) / 1000;
    const topT = 0.04;
    const plinthH = 0.10;
    const startX = -W / 2;
    const bodyD = D - 0.25;
    const bodyH = H - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const centerZ = 1.1;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, plinthH, bodyD - 0.06), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, centerZ - (D - bodyD) / 2);
    group.add(plinth);

    const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, bodyD), this.carcassWoodMat);
    bodyBox.position.set(0, bodyY, centerZ - (D - bodyD) / 2);
    bodyBox.castShadow = true;
    bodyBox.receiveShadow = true;
    group.add(bodyBox);

    const bayCount = Math.max(2, Math.round(W / 0.6));
    const bayW = (W - 0.01) / bayCount;
    for (let b = 0; b < bayCount; b++) {
      const bcx = startX + 0.005 + b * bayW + bayW / 2;
      const isApplianceBay = (b === 0);

      if (isApplianceBay) {
        const nicheInner = new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.02, bodyH * 0.55, bodyD * 0.85), this.darkGapMat);
        nicheInner.position.set(bcx, plinthH + bodyH * 0.7, centerZ - (D - bodyD) / 2 - 0.02);
        group.add(nicheInner);

        const cooker = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 20), this.stainlessDarkMat);
        cooker.position.set(bcx, plinthH + bodyH * 0.45 + 0.09, centerZ - (D - bodyD) / 2);
        group.add(cooker);

        const drawH = bodyH * 0.4;
        const dFront = this.createDoorPanel(bayW - 0.006, drawH, 0.018);
        dFront.position.set(bcx, plinthH + drawH / 2, centerZ - (D - bodyD) / 2 - bodyD / 2 - 0.009);
        this.addDoorHandleOrChannel(dFront, bayW - 0.006, drawH, false, true, true);
        group.add(dFront);
      } else {
        const count = 3;
        const gap = 0.004;
        const dH = (bodyH - gap * (count + 1)) / count;
        for (let di = 0; di < count; di++) {
          const dy = plinthH + gap + di * (dH + gap) + dH / 2;
          const front = this.createDoorPanel(bayW - 0.006, dH, 0.018);
          front.position.set(bcx, dy, centerZ - (D - bodyD) / 2 - bodyD / 2 - 0.009);
          this.addDoorHandleOrChannel(front, bayW - 0.006, dH, false, true, true);
          group.add(front);
        }
      }
    }

    const marbleTop = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, topT, D + 0.03), this.countertopMat);
    marbleTop.position.set(0, H - topT / 2, centerZ);
    marbleTop.castShadow = true;
    marbleTop.receiveShadow = true;
    group.add(marbleTop);

    [-W * 0.25, W * 0.25].forEach(sx => {
      const stoolGroup = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24), this.darkGapMat);
      seat.position.set(sx, 0.62, centerZ + D / 2 + 0.22);
      stoolGroup.add(seat);

      [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.60, 12), this.stainlessDarkMat);
        leg.position.set(sx + lx, 0.30, centerZ + D / 2 + 0.22 + lz);
        stoolGroup.add(leg);
      });
      group.add(stoolGroup);
    });

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, H + 0.12, centerZ], [W / 2, H + 0.12, centerZ]);
    this.createArchitecturalTick(-W / 2, H + 0.12, centerZ, 'xy');
    this.createArchitecturalTick(W / 2, H + 0.12, centerZ, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `아일랜드 식탁 W:${Math.round(W * 1000)}mm (D:${Math.round(D * 1000)})`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-4. 장식장(유리문) (Glass Display Cabinet) — 알루미늄 슬림 프레임 & 8T 강화유리 & LED 라인
  // =========================================================
  buildGlassDisplayCabinet() {
    const W = (this.spec.totalWidth || 900) / 1000;
    const CH = (this.spec.ceilingHeight || 2100) / 1000;
    const D = 0.40;
    const plinthH = 0.08;
    const bodyH = CH - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;
    const startX = -W / 2;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, plinthH, D - 0.04), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, (D - 0.04) / 2);
    group.add(plinth);

    const back = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, bodyH - 2 * T, 0.009), this.carcassWoodMat);
    back.position.set(0, bodyY, 0.005);
    group.add(back);

    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, D), this.carcassWoodMat);
    leftSide.position.set(startX + T / 2, bodyY, D / 2);
    group.add(leftSide);

    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, D), this.carcassWoodMat);
    rightSide.position.set(startX + W - T / 2, bodyY, D / 2);
    group.add(rightSide);

    const botPanel = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), this.carcassWoodMat);
    botPanel.position.set(0, plinthH + T / 2, D / 2);
    group.add(botPanel);

    const topPanel = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), this.carcassWoodMat);
    topPanel.position.set(0, plinthH + bodyH - T / 2, D / 2);
    group.add(topPanel);

    const shelfCount = 4;
    for (let s = 1; s <= shelfCount; s++) {
      const sy = plinthH + (bodyH / (shelfCount + 1)) * s;
      const gShelf = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T - 0.004, 0.008, D - 0.04), this.glassShelfMat);
      gShelf.position.set(0, sy, D / 2);
      group.add(gShelf);
    }

    [-W / 2 + T + 0.015, W / 2 - T - 0.015].forEach(lx => {
      const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, bodyH - 0.04, 0.012),
        new THREE.MeshBasicMaterial({ color: 0xffdfb0 })
      );
      ledBar.position.set(lx, bodyY, D - 0.02);
      group.add(ledBar);
    });

    const doorW = (W - 0.006) / 2;
    const doorH = bodyH - 0.006;
    [-1, 1].forEach((dir, i) => {
      const isLeft = (i === 0);
      const dcx = dir * (doorW / 2 + 0.0015);

      const pivot = new THREE.Group();
      const hingeX = isLeft ? (dcx - doorW / 2) : (dcx + doorW / 2);
      pivot.position.set(hingeX, bodyY, D + 0.008);

      const leafGroup = new THREE.Group();
      const offsetX = isLeft ? (doorW / 2) : (-doorW / 2);

      const frameW = 0.025;
      const fMat = this.aluminumFrameMat;
      const fTop = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.002, frameW, 0.018), fMat);
      fTop.position.set(0, doorH / 2 - frameW / 2, 0);
      leafGroup.add(fTop);
      const fBot = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.002, frameW, 0.018), fMat);
      fBot.position.set(0, -doorH / 2 + frameW / 2, 0);
      leafGroup.add(fBot);
      const fLeft = new THREE.Mesh(new THREE.BoxGeometry(frameW, doorH - 2 * frameW, 0.018), fMat);
      fLeft.position.set(-doorW / 2 + frameW / 2, 0, 0);
      leafGroup.add(fLeft);
      const fRight = new THREE.Mesh(new THREE.BoxGeometry(frameW, doorH - 2 * frameW, 0.018), fMat);
      fRight.position.set(doorW / 2 - frameW / 2, 0, 0);
      leafGroup.add(fRight);

      const glassPane = new THREE.Mesh(new THREE.BoxGeometry(doorW - 2 * frameW, doorH - 2 * frameW, 0.006), this.glassDoorMat);
      glassPane.position.set(0, 0, 0);
      leafGroup.add(glassPane);

      const barH = 0.16;
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.008, barH, 0.014), this.goldMetalMat);
      hBar.position.set(isLeft ? (doorW / 2 - 0.018) : (-doorW / 2 + 0.018), 0, 0.012);
      leafGroup.add(hBar);

      leafGroup.position.set(offsetX, 0, 0);
      pivot.add(leafGroup);
      group.add(pivot);

      this.doors.push({
        group: pivot,
        isLeft,
        openAngle: isLeft ? (-Math.PI * 0.48) : (Math.PI * 0.48),
        targetAngle: this.spec.isDoorOpen ? (isLeft ? -Math.PI * 0.48 : Math.PI * 0.48) : 0
      });
    });

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, CH + 0.1, D], [W / 2, CH + 0.1, D]);
    this.createArchitecturalTick(-W / 2, CH + 0.1, D, 'xy');
    this.createArchitecturalTick(W / 2, CH + 0.1, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `장식장(유리문) W:${Math.round(W * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-5. 티비다이 (TV Console / Lowboard)
  // =========================================================
  buildTvConsole() {
    const W = (this.spec.totalWidth || 2000) / 1000;
    const H = 0.45;
    const D = 0.42;
    const plinthH = 0.06;
    const bodyH = H - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const startX = -W / 2;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, plinthH, D - 0.08), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, D / 2);
    group.add(plinth);

    const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, D), this.carcassWoodMat);
    bodyBox.position.set(0, bodyY, D / 2);
    group.add(bodyBox);

    // 중앙 오픈 AV 니치
    const nicheW = W * 0.38;
    const niche = new THREE.Mesh(new THREE.BoxGeometry(nicheW, bodyH * 0.55, D * 0.9), this.darkGapMat);
    niche.position.set(0, bodyY, D / 2 + 0.02);
    group.add(niche);

    // 좌우 서랍장
    const sideW = (W - nicheW) / 2;
    [-W / 2 + sideW / 2, W / 2 - sideW / 2].forEach(sx => {
      const dFront = this.createDoorPanel(sideW - 0.008, bodyH - 0.01, 0.018);
      dFront.position.set(sx, bodyY, D + 0.009);
      this.addDoorHandleOrChannel(dFront, sideW - 0.008, bodyH - 0.01, false, true, true);
      group.add(dFront);
    });

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, H + 0.1, D], [W / 2, H + 0.1, D]);
    this.createArchitecturalTick(-W / 2, H + 0.1, D, 'xy');
    this.createArchitecturalTick(W / 2, H + 0.1, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `티비다이 W:${Math.round(W * 1000)}mm (H:${Math.round(H * 1000)})`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-6. 서랍장 (Chest of Drawers) — 3단/4단/5단 와이드 서랍장
  // =========================================================
  buildDrawersUnit() {
    const W = (this.spec.totalWidth || 900) / 1000;
    const H = (this.spec.lowerHeight || 950) / 1000;
    const D = 0.50;
    const plinthH = 0.08;
    const bodyH = H - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const startX = -W / 2;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, plinthH, D - 0.04), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, (D - 0.04) / 2);
    group.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, D), this.carcassWoodMat);
    body.position.set(0, bodyY, D / 2);
    group.add(body);

    const count = 4;
    const gap = 0.004;
    const dH = (bodyH - gap * (count + 1)) / count;
    for (let di = 0; di < count; di++) {
      const dy = plinthH + gap + di * (dH + gap) + dH / 2;
      const front = this.createDoorPanel(W - 0.008, dH, 0.018);
      front.position.set(0, dy, D + 0.009);
      this.addDoorHandleOrChannel(front, W - 0.008, dH, false, true, true);
      group.add(front);
    }

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, H + 0.1, D], [W / 2, H + 0.1, D]);
    this.createArchitecturalTick(-W / 2, H + 0.1, D, 'xy');
    this.createArchitecturalTick(W / 2, H + 0.1, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `4단 서랍장 W:${Math.round(W * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-7. 수납장 / 팬트리장 (Storage Cabinet)
  // =========================================================
  buildStorageCabinet() {
    const W = (this.spec.totalWidth || 900) / 1000;
    const CH = (this.spec.ceilingHeight || 2100) / 1000;
    const D = 0.45;
    const plinthH = 0.08;
    const bodyH = CH - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, plinthH, D - 0.04), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, (D - 0.04) / 2);
    group.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, D), this.carcassWoodMat);
    body.position.set(0, bodyY, D / 2);
    group.add(body);

    for (let s = 1; s <= 5; s++) {
      const sy = plinthH + (bodyH / 6) * s;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, T, D - 0.03), this.carcassWoodMat);
      shelf.position.set(0, sy, D / 2);
      group.add(shelf);
    }

    const doorW = (W - 0.006) / 2;
    const doorH = bodyH - 0.006;
    [-1, 1].forEach((dir, i) => {
      const isLeft = (i === 0);
      const dcx = dir * (doorW / 2 + 0.0015);

      const pivot = new THREE.Group();
      const hingeX = isLeft ? (dcx - doorW / 2) : (dcx + doorW / 2);
      pivot.position.set(hingeX, bodyY, D + 0.009);

      const doorPanel = this.createDoorPanel(doorW - 0.003, doorH, 0.018);
      const offsetX = isLeft ? (doorW / 2) : (-doorW / 2);
      doorPanel.position.set(offsetX, 0, 0);
      pivot.add(doorPanel);

      this.addDoorHandleOrChannel(doorPanel, doorW - 0.003, doorH, false, isLeft);

      group.add(pivot);
      this.doors.push({
        group: pivot,
        isLeft,
        openAngle: isLeft ? (-Math.PI * 0.48) : (Math.PI * 0.48),
        targetAngle: this.spec.isDoorOpen ? (isLeft ? -Math.PI * 0.48 : Math.PI * 0.48) : 0
      });
    });

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, CH + 0.1, D], [W / 2, CH + 0.1, D]);
    this.createArchitecturalTick(-W / 2, CH + 0.1, D, 'xy');
    this.createArchitecturalTick(W / 2, CH + 0.1, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `수납장 W:${Math.round(W * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-8. 조리대 (Prep Counter)
  // =========================================================
  buildPrepCounter() {
    const W = (this.spec.totalWidth || 1000) / 1000;
    const H = (this.spec.lowerHeight || 860) / 1000;
    const D = 0.60;
    const topT = 0.04;
    const plinthH = 0.12;
    const bodyH = H - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, plinthH, D - 0.07), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, (D - 0.07) / 2);
    group.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, D), this.carcassWoodMat);
    body.position.set(0, bodyY, D / 2);
    group.add(body);

    const topDrawH = 0.18;
    const topDraw = this.createDoorPanel(W - 0.006, topDrawH, 0.018);
    topDraw.position.set(0, plinthH + bodyH - topDrawH / 2, D + 0.009);
    this.addDoorHandleOrChannel(topDraw, W - 0.006, topDrawH, false, true, true);
    group.add(topDraw);

    const botDoorH = bodyH - topDrawH - 0.008;
    const botDoorW = (W - 0.006) / 2;
    [-1, 1].forEach((dir, i) => {
      const isLeft = (i === 0);
      const dcx = dir * (botDoorW / 2 + 0.0015);
      const dMesh = this.createDoorPanel(botDoorW - 0.003, botDoorH, 0.018);
      dMesh.position.set(dcx, plinthH + botDoorH / 2, D + 0.009);
      this.addDoorHandleOrChannel(dMesh, botDoorW - 0.003, botDoorH, false, isLeft);
      group.add(dMesh);
    });

    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, topT, D + 0.025), this.countertopMat);
    top.position.set(0, H - topT / 2, (D + 0.025) / 2);
    group.add(top);

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, H + 0.1, D], [W / 2, H + 0.1, D]);
    this.createArchitecturalTick(-W / 2, H + 0.1, D, 'xy');
    this.createArchitecturalTick(W / 2, H + 0.1, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `조리대 W:${Math.round(W * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-9. 단독 키큰장 (Tall Appliance Cabinet)
  // =========================================================
  buildStandaloneTallCabinet() {
    const W = (this.spec.tallCabinetWidth || this.spec.totalWidth || 600) / 1000;
    const CH = (this.spec.ceilingHeight || 2350) / 1000;
    const D = (this.spec.lowerDepth || 600) / 1000;
    const plinthH = 0.12;
    this.buildTallCabinet(0, W, CH, D, plinthH, this.spec.tallCabinetType || 'appliance');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `키큰장 W:${Math.round(W * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-10. 후드장 (Dedicated Hood Cabinet) — 스테인리스 후드 필터 & 상부 덕트 배기 연통
  // =========================================================
  buildDedicatedHoodCabinet() {
    const W = (this.spec.totalWidth || 800) / 1000;
    const H = (this.spec.upperHeight || 700) / 1000;
    const D = 0.35;
    const topY = 1.51 + H;
    const startY = 1.51;

    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), this.carcassWoodMat);
    body.position.set(0, startY + H / 2, D / 2);
    group.add(body);

    const doorW = (W - 0.006) / 2;
    [-1, 1].forEach((dir, i) => {
      const isLeft = (i === 0);
      const dcx = dir * (doorW / 2 + 0.0015);
      const dMesh = this.createDoorPanel(doorW - 0.003, H - 0.006, 0.018);
      dMesh.position.set(dcx, startY + H / 2, D + 0.009);
      this.addDoorHandleOrChannel(dMesh, doorW - 0.003, H - 0.006, true, isLeft);
      group.add(dMesh);
    });

    // 하부 매립형 스테인리스 후드 바디 & 필터 그릴
    const hoodBody = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.06, D - 0.04), this.stainlessMat);
    hoodBody.position.set(0, startY - 0.03, D / 2);
    group.add(hoodBody);

    const filter = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.008, D - 0.12), this.stainlessDarkMat);
    filter.position.set(0, startY - 0.055, D / 2);
    group.add(filter);

    // 상부 배기 연통 덕트 (Flexible Duct Pipe)
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.25, 20), this.stainlessMat);
    duct.position.set(0, topY + 0.125, D / 2);
    group.add(duct);

    this.kitchenGroup.add(group);

    this.createLine([-W / 2, topY + 0.3, D], [W / 2, topY + 0.3, D]);
    this.createArchitecturalTick(-W / 2, topY + 0.3, D, 'xy');
    this.createArchitecturalTick(W / 2, topY + 0.3, D, 'xy');

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `후드장 W:${Math.round(W * 1000)}mm (배기 덕트)`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-11. 하부 코너장 (Base Corner Cabinet) — 90° 코너 & 2단 회전 매직 선반
  // =========================================================
  buildDedicatedBaseCorner() {
    const W = 0.90;
    const D = 0.90;
    const H = (this.spec.lowerHeight || 860) / 1000;
    const topT = 0.04;
    const plinthH = 0.12;
    const bodyH = H - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;

    const group = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, plinthH, D - 0.04), this.darkGapMat);
    plinth.position.set(0, plinthH / 2, D / 2);
    group.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, D), this.carcassWoodMat);
    body.position.set(0, bodyY, D / 2);
    group.add(body);

    // 2단 회전 원형 선반 모형 (매직 코너)
    [0.35, 0.65].forEach(rh => {
      const carousel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.015, 24), this.stainlessMat);
      carousel.position.set(0, plinthH + bodyH * rh, D / 2);
      group.add(carousel);
    });

    // 전면 코너 접이식 도어
    const dMesh = this.createDoorPanel(W - 0.008, bodyH - 0.006, 0.018);
    dMesh.position.set(0, bodyY, D + 0.009);
    this.addDoorHandleOrChannel(dMesh, W - 0.008, bodyH - 0.006, false, true);
    group.add(dMesh);

    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, topT, D + 0.02), this.countertopMat);
    top.position.set(0, H - topT / 2, D / 2);
    group.add(top);

    this.kitchenGroup.add(group);

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `하부 코너장 900x900mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-12. 상부 코너장 (Upper Corner Cabinet) — 600x600 코너 연결장
  // =========================================================
  buildDedicatedUpperCorner() {
    const W = 0.60;
    const D = 0.60;
    const H = (this.spec.upperHeight || 700) / 1000;
    const startY = 1.51;

    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), this.carcassWoodMat);
    body.position.set(0, startY + H / 2, D / 2);
    group.add(body);

    const dMesh = this.createDoorPanel(W - 0.008, H - 0.006, 0.018);
    dMesh.position.set(0, startY + H / 2, D + 0.009);
    this.addDoorHandleOrChannel(dMesh, W - 0.008, H - 0.006, true, true);
    group.add(dMesh);

    this.kitchenGroup.add(group);

    if (this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `상부 코너장 600x600mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  buildLowerCabinets(startX, totalW, lowerH, lowerD, plinthH, topT, sinkW, prepW, cookW) {
    const bodyH = lowerH - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;

    // 1. 고급 걸레받이 (다크 쉐도우 플린스 - 65mm 후퇴로 공중부양 고급감)
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(totalW - 0.02, plinthH, lowerD - 0.07),
      this.darkGapMat
    );
    plinth.position.set(startX + totalW / 2, plinthH / 2, (lowerD - 0.07) / 2);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.kitchenGroup.add(plinth);

    // 2. 도어 뒤 줄눈 그림자 프레임 (도어 사이 음각 3mm 틈새 표현)
    const shadowBack = new THREE.Mesh(
      new THREE.BoxGeometry(totalW - 0.008, bodyH - 0.008, 0.012),
      this.darkGapMat
    );
    shadowBack.position.set(startX + totalW / 2, bodyY, lowerD - 0.007);
    this.kitchenGroup.add(shadowBack);

    const modules = [
      { type: 'sink', width: sinkW },
      { type: 'prep', width: prepW },
      { type: 'cooktop', width: cookW }
    ];

    let curX = startX;
    modules.forEach((mod) => {
      const bayW = mod.width;
      const cx = curX + bayW / 2;
      const cz = lowerD / 2;

      const lp = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, lowerD), this.carcassWoodMat);
      lp.position.set(curX + T / 2, bodyY, cz);
      lp.castShadow = true;
      lp.receiveShadow = true;
      this.kitchenGroup.add(lp);

      const rp = new THREE.Mesh(new THREE.BoxGeometry(T, bodyH, lowerD), this.carcassWoodMat);
      rp.position.set(curX + bayW - T / 2, bodyY, cz);
      rp.castShadow = true;
      rp.receiveShadow = true;
      this.kitchenGroup.add(rp);

      const bp = new THREE.Mesh(new THREE.BoxGeometry(bayW - 2 * T, T, lowerD), this.carcassWoodMat);
      bp.position.set(cx, plinthH + T / 2, cz);
      bp.receiveShadow = true;
      this.kitchenGroup.add(bp);

      const back = new THREE.Mesh(new THREE.BoxGeometry(bayW - 2 * T, bodyH, 0.006), this.carcassWoodMat);
      back.position.set(cx, bodyY, 0.008);
      this.kitchenGroup.add(back);

      if (mod.type === 'prep') {
        this.buildDrawerModule(cx, bayW, bodyH, plinthH, lowerD);
      } else {
        if (mod.type === 'cooktop') {
          const midShelf = new THREE.Mesh(new THREE.BoxGeometry(bayW - 2 * T, T, lowerD - 0.05), this.carcassWoodMat);
          midShelf.position.set(cx, plinthH + bodyH * 0.48, cz);
          this.kitchenGroup.add(midShelf);
        }
        this.buildSwingDoors(cx, bayW, bodyH, plinthH, lowerD, 2, false);
      }

      curX += bayW;
    });

    // 좌/우 노출 엔드판넬(EP) 마감재 (벽에 닿지 않은 쪽)
    if (this.spec.layoutType !== 'l_left') {
      const epL = this.createDoorPanel(lowerH - topT, lowerD + 0.018, 0.018);
      epL.rotation.y = Math.PI / 2;
      epL.position.set(startX - 0.009, (lowerH - topT) / 2, (lowerD + 0.018) / 2);
      this.kitchenGroup.add(epL);
    }
    if (this.spec.layoutType !== 'l_right') {
      const epR = this.createDoorPanel(lowerH - topT, lowerD + 0.018, 0.018);
      epR.rotation.y = Math.PI / 2;
      epR.position.set(startX + totalW + 0.009, (lowerH - topT) / 2, (lowerD + 0.018) / 2);
      this.kitchenGroup.add(epR);
    }
  }

  // ㄱ/ㄴ/ㄷ자 일체형 코너장 (하부 코너장 + 상부 코너장 틈새 없이 완벽 결합)
  buildCornerCabinet(side, startX, totalW, lowerH, lowerD, plinthH, topT, upperH, upperD, midwayH) {
    const isLeft = (side === 'left');
    const bodyH = lowerH - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;

    const cornerX = isLeft ? (startX + lowerD / 2) : (startX + totalW - lowerD / 2);
    const cornerZ = lowerD / 2;
    const wallX = isLeft ? startX : (startX + totalW);
    const faceDir = isLeft ? 1 : -1;

    // 1. 하부 코너장 - 원목 몸통 바닥판
    const cBot = new THREE.Mesh(new THREE.BoxGeometry(lowerD, T, lowerD), this.carcassWoodMat);
    cBot.position.set(cornerX, plinthH + T / 2, cornerZ);
    cBot.receiveShadow = true;
    this.kitchenGroup.add(cBot);

    // 2. 하부 코너장 - 뒷벽 후판 (뒷벽 밀착)
    const cBack = new THREE.Mesh(new THREE.BoxGeometry(lowerD, bodyH, 0.008), this.carcassWoodMat);
    cBack.position.set(cornerX, bodyY, 0.008);
    this.kitchenGroup.add(cBack);

    // 3. 하부 코너장 - 측벽 후판 (측벽 밀착)
    const cSideBack = new THREE.Mesh(new THREE.BoxGeometry(0.008, bodyH, lowerD), this.carcassWoodMat);
    cSideBack.position.set(wallX + faceDir * 0.004, bodyY, cornerZ);
    this.kitchenGroup.add(cSideBack);

    // 4. 하부 코너장 - 중간 선반
    const cShelf = new THREE.Mesh(new THREE.BoxGeometry(lowerD - 0.04, T, lowerD - 0.04), this.carcassWoodMat);
    cShelf.position.set(cornerX, plinthH + bodyH * 0.48, cornerZ);
    this.kitchenGroup.add(cShelf);

    // 5. 하부 코너장 - 90° 코너 기둥 및 블라인드 연결 필러 (도어 간섭 방지 60mm 기둥)
    const pillarW = 0.06;
    const pillar = this.createDoorPanel(pillarW, bodyH, 0.018);
    pillar.position.set(cornerX + faceDir * (lowerD / 2 - pillarW / 2), bodyY, lowerD + 0.009);
    this.kitchenGroup.add(pillar);

    // 6. 하부 코너 전면 도어 (코너장 전용 도어)
    const doorW = lowerD - pillarW - 0.006;
    const doorCX = cornerX - faceDir * (pillarW / 2);
    const cDoor = this.createDoorPanel(doorW, bodyH - 0.008, 0.018);
    cDoor.position.set(doorCX, bodyY, lowerD + 0.009);
    this.kitchenGroup.add(cDoor);
    this.addDoorHandleOrChannel(cDoor, doorW, bodyH, false, isLeft);

    // 7. 상부 코너장 (상부장 옵션 활성 시 — 틈새 없이 뒷벽/측벽 일체형 시공)
    if (this.spec.hasUpperCabinets) {
      const upperY = lowerH + midwayH + upperH / 2;
      const uCornerX = isLeft ? (startX + upperD / 2) : (startX + totalW - upperD / 2);
      const uCornerZ = upperD / 2;

      // 상부 코너장 몸통 박스
      const uBox = new THREE.Mesh(new THREE.BoxGeometry(upperD, upperH, upperD), this.carcassWoodMat);
      uBox.position.set(uCornerX, upperY, uCornerZ);
      this.kitchenGroup.add(uBox);

      // 상부 코너장 도어 & 블라인드 필러
      const uPillarW = 0.05;
      const uPillar = this.createDoorPanel(uPillarW, upperH, 0.018);
      uPillar.position.set(uCornerX + faceDir * (upperD / 2 - uPillarW / 2), upperY, upperD + 0.009);
      this.kitchenGroup.add(uPillar);

      const uDoorW = upperD - uPillarW - 0.006;
      const uDoorCX = uCornerX - faceDir * (uPillarW / 2);
      const uDoor = this.createDoorPanel(uDoorW, upperH - 0.008, 0.018);
      uDoor.position.set(uDoorCX, upperY, upperD + 0.009);
      this.kitchenGroup.add(uDoor);
      this.addDoorHandleOrChannel(uDoor, uDoorW, upperH, false, isLeft);
    }
  }

  // ㄱ자 코너 보조 날개장 (L-Return Wing)
  buildWingCabinets(side, startX, totalW, lowerH, lowerD, plinthH, topT, sideLen, upperH, upperD, midwayH) {
    const wingNet = sideLen - lowerD;
    if (wingNet < 0.15) return;

    const bodyH = lowerH - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;
    const isLeft = side === 'left';

    const wingCenterZ = lowerD + wingNet / 2;
    const wallX = isLeft ? startX : (startX + totalW);
    const centerX = isLeft ? (startX + lowerD / 2) : (startX + totalW - lowerD / 2);
    const frontX = isLeft ? (startX + lowerD) : (startX + totalW - lowerD);
    const faceDir = isLeft ? 1 : -1;

    // 1. 걸레받이
    const wPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(lowerD - 0.07, plinthH, wingNet - 0.01),
      this.darkGapMat
    );
    wPlinth.position.set(wallX + faceDir * (lowerD - 0.07) / 2, plinthH / 2, wingCenterZ);
    wPlinth.castShadow = true;
    this.kitchenGroup.add(wPlinth);

    // 2. 원목 몸통 측/후판
    const wBack = new THREE.Mesh(new THREE.BoxGeometry(0.008, bodyH, wingNet), this.carcassWoodMat);
    wBack.position.set(wallX + faceDir * 0.008, bodyY, wingCenterZ);
    this.kitchenGroup.add(wBack);

    const wBot = new THREE.Mesh(new THREE.BoxGeometry(lowerD, T, wingNet), this.carcassWoodMat);
    wBot.position.set(centerX, plinthH + T / 2, wingCenterZ);
    this.kitchenGroup.add(wBot);

    const wMid = new THREE.Mesh(new THREE.BoxGeometry(lowerD - 0.04, T, wingNet - T * 2), this.carcassWoodMat);
    wMid.position.set(centerX, plinthH + bodyH * 0.48, wingCenterZ);
    this.kitchenGroup.add(wMid);

    // 끝단 EP 마감판
    const endEP = this.createDoorPanel(lowerD + 0.018, lowerH - topT, 0.018);
    endEP.position.set(centerX, (lowerH - topT) / 2, sideLen + 0.009);
    this.kitchenGroup.add(endEP);

    // 날개장 안쪽 도어 2짝 (또는 폭 따라 1~2짝)
    const leafCount = wingNet > 0.72 ? 2 : 1;
    const gap = 0.004;
    const singleW = (wingNet - gap * (leafCount + 1)) / leafCount;
    const doorH = bodyH - gap * 2;

    for (let i = 0; i < leafCount; i++) {
      const centerZ = lowerD + gap + i * (singleW + gap) + singleW / 2;
      const leaf = this.createDoorPanel(singleW, doorH, 0.018);
      leaf.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
      leaf.position.set(frontX + faceDir * 0.009, plinthH + bodyH / 2, centerZ);
      this.kitchenGroup.add(leaf);

      this.addDoorHandleOrChannel(leaf, singleW, doorH, false, i === 0);
    }

    // 날개 상부장 (옵션 활성 시)
    if (this.spec.wingHasUpper && this.spec.hasUpperCabinets) {
      const wingUpperZ = upperD + (sideLen - upperD) / 2;
      const wuNet = sideLen - upperD;
      const wuCenterX = isLeft ? (startX + upperD / 2) : (startX + totalW - upperD / 2);
      const wuFrontX = isLeft ? (startX + upperD) : (startX + totalW - upperD);
      const upperY = lowerH + midwayH + upperH / 2;

      const uBox = new THREE.Mesh(new THREE.BoxGeometry(upperD, upperH, wuNet), this.carcassWoodMat);
      uBox.position.set(wuCenterX, upperY, wingUpperZ);
      this.kitchenGroup.add(uBox);

      const uLeaf = this.createDoorPanel(wuNet - 0.008, upperH - 0.008, 0.018);
      uLeaf.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
      uLeaf.position.set(wuFrontX + faceDir * 0.009, upperY, wingUpperZ);
      this.kitchenGroup.add(uLeaf);
    }
  }

  // ㄷ자 아일랜드 식탁 일체형 반도 날개 (대면형 식탁 + 무릎 공간 + 바 스툴 2개 + 팬던트 조명)
  buildPeninsulaDiningWing(startX, totalW, lowerH, lowerD, plinthH, topT, sideLen) {
    const wingNet = sideLen - lowerD;
    if (wingNet < 0.2) return;

    const bodyH = lowerH - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;

    const wingCenterZ = lowerD + wingNet / 2;
    const rightCornerX = startX + totalW;
    const innerX = rightCornerX - lowerD; // 주방 쪽 모듈 기준점
    const baseW = 0.50; // 하부장 깊이 500mm
    const overhangW = 0.22; // 무릎 여유 공간 220mm

    // 1. 걸레받이
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(baseW - 0.05, plinthH, wingNet - 0.02), this.darkGapMat);
    plinth.position.set(innerX + (baseW - 0.05) / 2, plinthH / 2, wingCenterZ);
    this.kitchenGroup.add(plinth);

    // 2. 하부 수납 몸통 (주방 쪽을 향하는 수납)
    const baseBox = new THREE.Mesh(new THREE.BoxGeometry(baseW, bodyH, wingNet), this.carcassWoodMat);
    baseBox.position.set(innerX + baseW / 2, bodyY, wingCenterZ);
    this.kitchenGroup.add(baseBox);

    // 주방 쪽 도어 2짝
    const leafCount = wingNet > 0.8 ? 2 : 1;
    const gap = 0.004;
    const singleW = (wingNet - gap * (leafCount + 1)) / leafCount;
    const doorH = bodyH - gap * 2;
    for (let i = 0; i < leafCount; i++) {
      const centerZ = lowerD + gap + i * (singleW + gap) + singleW / 2;
      const leaf = this.createDoorPanel(singleW, doorH, 0.018);
      leaf.rotation.y = -Math.PI / 2;
      leaf.position.set(innerX - 0.009, bodyY, centerZ);
      this.kitchenGroup.add(leaf);
      this.addDoorHandleOrChannel(leaf, singleW, doorH, false, i === 0);
    }

    // 끝단 사이드 패널 (EP 마감판)
    const endEP = this.createDoorPanel(baseW + overhangW, lowerH - topT, 0.018);
    endEP.position.set(innerX + (baseW + overhangW) / 2, (lowerH - topT) / 2, sideLen + 0.009);
    this.kitchenGroup.add(endEP);

    // 3. 바 체어 / 스툴 2개 (무릎 공간에 자연스럽게 배치)
    const stoolZ1 = lowerD + wingNet * 0.35;
    const stoolZ2 = lowerD + wingNet * 0.72;
    const stoolX = innerX + baseW + overhangW + 0.22; // 의자 중심 위치

    [stoolZ1, stoolZ2].forEach(sz => {
      this.buildBarStool(stoolX, sz);
    });

    // 4. 식탁 위 팬던트 조명 (식탁 분위기 연출)
    this.buildDiningPendant(innerX + (baseW + overhangW) / 2, lowerH + 0.95, wingCenterZ);
  }

  buildBarStool(x, z) {
    const stoolGroup = new THREE.Group();
    stoolGroup.position.set(x, 0, z);

    // 다리 4개 (슬림 블랙 메탈 튜브)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x242424, metalness: 0.82, roughness: 0.32 });
    const seatH = 0.62;
    const spread = 0.15;

    const legGeo = new THREE.CylinderGeometry(0.012, 0.01, seatH, 12);
    [[-spread, -spread], [spread, -spread], [-spread, spread], [spread, spread]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, seatH / 2, lz);
      leg.rotation.z = -lx * 0.12;
      leg.rotation.x = lz * 0.12;
      leg.castShadow = true;
      stoolGroup.add(leg);
    });

    // 발받침 링 (Footrest Ring)
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xc8a97e, metalness: 0.85, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(spread * 1.05, 0.008, 8, 24), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, seatH * 0.38, 0);
    stoolGroup.add(ring);

    // 시트 쿠션 (내추럴 오크 원목 / 웜베이지 쿠션)
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xd4c2a5, roughness: 0.68 });
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.175, 0.045, 24), seatMat);
    seat.position.set(0, seatH + 0.02, 0);
    seat.castShadow = true;
    stoolGroup.add(seat);

    this.kitchenGroup.add(stoolGroup);
  }

  buildDiningPendant(x, y, z) {
    const pGroup = new THREE.Group();
    pGroup.position.set(x, 0, z);

    const ceilH = Math.max(2.35, this.spec.ceilingHeight / 1000);
    const lampY = Math.min(ceilH - 0.45, Math.max(1.7, y));

    // 1. 와이어 코드
    const cordMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, ceilH - lampY, 8), cordMat);
    wire.position.set(0, (ceilH + lampY) / 2, 0);
    pGroup.add(wire);

    // 2. 모던 갓 (Brass / Gold Conical Shade)
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xcca662, metalness: 0.88, roughness: 0.22 });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.14, 24, 1, true), shadeMat);
    shade.position.set(0, lampY, 0);
    pGroup.add(shade);

    // 3. 전구 발광체
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffefcc });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), bulbMat);
    bulb.position.set(0, lampY - 0.025, 0);
    pGroup.add(bulb);

    // 4. 팬던트 포인트 조명
    const pLight = new THREE.PointLight(0xffdfa8, 0.65, 3.0, 1.8);
    pLight.position.set(0, lampY - 0.04, 0);
    pGroup.add(pLight);

    this.kitchenGroup.add(pGroup);
  }

  buildDrawerModule(cx, bayW, bodyH, plinthH, lowerD) {
    const count = 3;
    const gap = 0.004;
    const dH = (bodyH - gap * (count + 1)) / count;

    for (let i = 0; i < count; i++) {
      const dY = plinthH + gap + i * (dH + gap) + dH / 2;
      const front = this.createDoorPanel(bayW - 0.006, dH, 0.018);
      front.position.set(cx, dY, lowerD + 0.009);
      this.kitchenGroup.add(front);

      this.addDoorHandleOrChannel(front, bayW - 0.006, dH, false, true, true);
    }
  }

  buildSwingDoors(cx, bayW, bodyH, baseY, depth, doorCount = 2, isUpper = false) {
    const gap = 0.004;
    const singleW = (bayW - gap * (doorCount + 1)) / doorCount;
    const doorH = bodyH - gap * 2;
    const doorY = baseY + bodyH / 2;
    const doorZ = depth + 0.009;

    for (let d = 0; d < doorCount; d++) {
      const isLeft = (d === 0);
      const doorCenterX = (cx - bayW / 2) + gap + d * (singleW + gap) + singleW / 2;

      const pivot = new THREE.Group();
      const hingeX = isLeft ? (doorCenterX - singleW / 2) : (doorCenterX + singleW / 2);
      pivot.position.set(hingeX, doorY, doorZ);

      const doorPanel = this.createDoorPanel(singleW, doorH, 0.018);
      const offsetX = isLeft ? (singleW / 2) : (-singleW / 2);
      doorPanel.position.set(offsetX, 0, 0);
      pivot.add(doorPanel);

      this.addDoorHandleOrChannel(doorPanel, singleW, doorH, isUpper, isLeft, false);

      this.kitchenGroup.add(pivot);
      this.doors.push({
        group: pivot,
        isLeft,
        openAngle: isLeft ? (-Math.PI * 0.48) : (Math.PI * 0.48),
        targetAngle: this.spec.isDoorOpen ? (isLeft ? -Math.PI * 0.48 : Math.PI * 0.48) : 0
      });
    }
  }

  addDoorHandleOrChannel(parentPanel, w, h, isUpper, isLeftHinge, isDrawer = false) {
    const hType = this.spec.handleType || 'j_channel';

    if (hType === 'j_channel') {
      // 무손잡이 프리미엄 C/J찬넬 라인 몰딩 (도어 상단 또는 하단 미세 알루미늄 음각 라인)
      const chMat = new THREE.MeshStandardMaterial({ color: 0x3b3530, roughness: 0.35, metalness: 0.6 });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w - 0.002, 0.012, 0.006), chMat);
      strip.position.set(0, isUpper ? (-h / 2 + 0.006) : (h / 2 - 0.006), 0.008);
      parentPanel.add(strip);
      return;
    }

    const metalHex = hType === 'bar_champagne_gold' ? 0xd4b26f : (hType === 'bar_brushed_nickel' ? 0xd1d5db : 0x1e2024);
    const hMat = new THREE.MeshStandardMaterial({ color: metalHex, roughness: 0.24, metalness: 0.88 });

    if (isDrawer) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.2, w * 0.35), 0.009, 0.018), hMat);
      bar.position.set(0, h * 0.25, 0.016);
      bar.castShadow = true;
      parentPanel.add(bar);
    } else {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.16, 0.018), hMat);
      const bx = isLeftHinge ? (w / 2 - 0.03) : (-w / 2 + 0.03);
      const by = isUpper ? (-h * 0.32) : (h * 0.28);
      bar.position.set(bx, by, 0.016);
      bar.castShadow = true;
      parentPanel.add(bar);
    }
  }

  // 모던 플랫 or 웨인스코팅 쉐이커 도어 (만화같은 검은 외곽선 제거, 실제 목공 면치 적용)
  createDoorPanel(w, h, t) {
    const group = new THREE.Group();

    if (this.spec.doorStyle === 'shaker') {
      const frameW = Math.min(0.048, w * 0.18);
      const innerT = t * 0.45;
      const parts = [
        { g: [frameW, h, t], p: [-w / 2 + frameW / 2, 0, 0] },
        { g: [frameW, h, t], p: [w / 2 - frameW / 2, 0, 0] },
        { g: [w - 2 * frameW, frameW, t], p: [0, h / 2 - frameW / 2, 0] },
        { g: [w - 2 * frameW, frameW, t], p: [0, -h / 2 + frameW / 2, 0] },
        { g: [w - 2 * frameW, h - 2 * frameW, innerT], p: [0, 0, -t / 2 + innerT / 2] }
      ];
      parts.forEach(pt => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(...pt.g), this.doorMat);
        m.position.set(...pt.p);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      });
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), this.doorMat);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }

    return group;
  }

  // =========================================================
  // C. Seamless Monolithic Beveled 상판 (ExtrudeGeometry + 싱크홀)
  // =========================================================
  buildMonolithicCountertopAndAppliances(startX, totalW, lowerH, lowerD, topT, sinkW, prepW, cookW, sideLen) {
    const endX = startX + totalW;
    const totalD = lowerD + 0.025;
    const isLeftL = this.spec.layoutType === 'l_left';
    const isRightL = this.spec.layoutType === 'l_right';
    const hasWing = (isLeftL || isRightL) && sideLen > totalD + 0.1;

    // 1. 상판 2D 외곽 폴리곤 (y = -z) — 일자, ㄱ자, ㄴ자, ㄷ자, ㄷ자 식탁형 및 키큰장 간섭 완벽 회피
    const isU = this.spec.layoutType === 'u_shape';
    const isPeninsula = this.spec.layoutType === 'u_peninsula';
    const hasTall = Boolean(this.spec.tallCabinet && this.spec.tallCabinet !== 'none');
    const isLeftTall = this.spec.tallCabinet === 'left';
    const isRightTall = this.spec.tallCabinet === 'right';
    const tallW = hasTall ? Math.min(1.2, (Number(this.spec.tallCabinetWidth) || 600) / 1000) : 0;

    const mainStartX = (this.spec.layoutType === 'straight' && isLeftTall) ? (startX + tallW) : startX;
    const mainEndX = (this.spec.layoutType === 'straight' && isRightTall) ? (startX + totalW - tallW) : (startX + totalW);

    const leftWingEnd = (isLeftL || isU || isPeninsula) ? (isLeftTall ? Math.max(totalD + 0.1, sideLen - tallW) : sideLen) : 0;
    const rightWingEnd = (isRightL || isU || isPeninsula) ? (isRightTall ? Math.max(totalD + 0.1, sideLen - tallW) : sideLen) : 0;

    const shape = new THREE.Shape();
    if (isPeninsula && sideLen > totalD + 0.1) {
      // ㄷ자 아일랜드 식탁형: 좌측 표준 날개장 + 우측 무릎 공간(+220mm) 오버행을 갖는 대면형 식탁 카운터
      const pOverhang = 0.22;
      shape.moveTo(mainStartX, -leftWingEnd);
      shape.lineTo(mainStartX, 0);
      shape.lineTo(mainEndX + pOverhang, 0);
      shape.lineTo(mainEndX + pOverhang, -rightWingEnd);
      shape.lineTo(mainEndX - totalD, -rightWingEnd);
      shape.lineTo(mainEndX - totalD, -totalD);
      shape.lineTo(mainStartX + totalD, -totalD);
      shape.lineTo(mainStartX + totalD, -leftWingEnd);
      shape.closePath();
    } else if (isU && sideLen > totalD + 0.1) {
      shape.moveTo(mainStartX, -leftWingEnd);
      shape.lineTo(mainStartX, 0);
      shape.lineTo(mainEndX, 0);
      shape.lineTo(mainEndX, -rightWingEnd);
      shape.lineTo(mainEndX - totalD, -rightWingEnd);
      shape.lineTo(mainEndX - totalD, -totalD);
      shape.lineTo(mainStartX + totalD, -totalD);
      shape.lineTo(mainStartX + totalD, -leftWingEnd);
      shape.closePath();
    } else if (isRightL && hasWing) {
      shape.moveTo(mainStartX, 0);
      shape.lineTo(mainEndX, 0);
      shape.lineTo(mainEndX, -rightWingEnd);
      shape.lineTo(mainEndX - totalD, -rightWingEnd);
      shape.lineTo(mainEndX - totalD, -totalD);
      shape.lineTo(mainStartX, -totalD);
      shape.closePath();
    } else if (isLeftL && hasWing) {
      shape.moveTo(mainStartX, -leftWingEnd);
      shape.lineTo(mainStartX, 0);
      shape.lineTo(mainEndX, 0);
      shape.lineTo(mainEndX, -totalD);
      shape.lineTo(mainStartX + totalD, -totalD);
      shape.lineTo(mainStartX + totalD, -leftWingEnd);
      shape.closePath();
    } else {
      shape.moveTo(mainStartX, 0);
      shape.lineTo(mainEndX, 0);
      shape.lineTo(mainEndX, -totalD);
      shape.lineTo(mainStartX, -totalD);
      shape.closePath();
    }

    // 2. 싱크볼 타공 위치 (벽체/코너 간섭 회피 클램핑)
    const holeW = Math.min(0.76, sinkW - 0.14);
    const holeD = 0.43;
    let sinkCenterX = startX + sinkW / 2;
    if (isLeftL && hasWing) {
      sinkCenterX = Math.max(sinkCenterX, startX + Math.min(0.32, sinkW * 0.25) + holeW / 2);
      sinkCenterX = Math.min(sinkCenterX, startX + sinkW - holeW / 2 - 0.04);
    }

    const holeCenterZ = totalD / 2 + 0.012;
    const r = 0.022; // 라운드 사각 코너 반경
    const hx1 = sinkCenterX - holeW / 2;
    const hx2 = sinkCenterX + holeW / 2;
    const hyTop = -(holeCenterZ - holeD / 2);
    const hyBot = -(holeCenterZ + holeD / 2);

    // 시계방향 Hole Path
    const hole = new THREE.Path();
    hole.moveTo(hx1 + r, hyTop);
    hole.lineTo(hx1 + r, hyTop);
    hole.absarc(hx1 + r, hyTop - r, r, Math.PI / 2, Math.PI, false);
    hole.lineTo(hx1, hyBot + r);
    hole.absarc(hx1 + r, hyBot + r, r, Math.PI, Math.PI * 1.5, false);
    hole.lineTo(hx2 - r, hyBot);
    hole.absarc(hx2 - r, hyBot + r, r, Math.PI * 1.5, 0, false);
    hole.lineTo(hx2, hyTop - r);
    hole.absarc(hx2 - r, hyTop - r, r, 0, Math.PI / 2, false);
    shape.holes.push(hole);

    // 3. 베벨 압출로 통짜 상판 생성
    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: topT - 0.004,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
      curveSegments: 8
    });
    const slab = new THREE.Mesh(extrudeGeo, this.countertopMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = lowerH - topT + 0.002;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.kitchenGroup.add(slab);

    // 뒷선반 젠다이/턱 (55mm)
    const splashBack = new THREE.Mesh(new THREE.BoxGeometry(totalW, 0.055, 0.016), this.countertopMat);
    splashBack.position.set(0, lowerH + 0.027, 0.008);
    splashBack.castShadow = true;
    this.kitchenGroup.add(splashBack);

    if (hasWing) {
      const wingSp = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.055, sideLen), this.countertopMat);
      wingSp.position.set(isLeftL ? (startX + 0.008) : (endX - 0.008), lowerH + 0.027, sideLen / 2);
      wingSp.castShadow = true;
      this.kitchenGroup.add(wingSp);
    }

    // 4. 3D 스테인리스 싱크볼 + 수전
    this.buildRecessedSinkBowl(sinkCenterX, lowerH, holeCenterZ, holeW, holeD);
    this.buildFaucetModel(sinkCenterX, lowerH, (holeCenterZ - holeD / 2) * 0.55);

    // 5. 쿡탑 모델
    let cookCenterX = startX + sinkW + prepW + cookW / 2;
    if (isRightL && hasWing) {
      cookCenterX = Math.min(cookCenterX, endX - 0.36);
      cookCenterX = Math.max(cookCenterX, startX + sinkW + prepW + 0.32);
    }
    this.buildCooktopModel(cookCenterX, lowerH, totalD / 2);
  }

  buildRecessedSinkBowl(cx, topY, cz, w, d) {
    const depth = 0.185;
    const wallT = 0.004;

    const rimW = w + 0.032;
    const rimParts = [
      { g: [rimW, 0.004, 0.018], p: [cx, topY + 0.002, cz - d / 2 - 0.007] },
      { g: [rimW, 0.004, 0.018], p: [cx, topY + 0.002, cz + d / 2 + 0.007] },
      { g: [0.018, 0.004, d], p: [cx - w / 2 - 0.007, topY + 0.002, cz] },
      { g: [0.018, 0.004, d], p: [cx + w / 2 + 0.007, topY + 0.002, cz] }
    ];
    rimParts.forEach(p => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...p.g), this.stainlessMat);
      m.position.set(...p.p);
      this.kitchenGroup.add(m);
    });

    const bowlFloor = new THREE.Mesh(new THREE.BoxGeometry(w, wallT, d), this.stainlessDarkMat);
    bowlFloor.position.set(cx, topY - depth, cz);
    bowlFloor.receiveShadow = true;
    this.kitchenGroup.add(bowlFloor);

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(w, depth, wallT), this.stainlessMat);
    wallBack.position.set(cx, topY - depth / 2, cz - d / 2);
    this.kitchenGroup.add(wallBack);

    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(w, depth, wallT), this.stainlessDarkMat);
    wallFront.position.set(cx, topY - depth / 2, cz + d / 2);
    this.kitchenGroup.add(wallFront);

    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(wallT, depth, d), this.stainlessMat);
    wallLeft.position.set(cx - w / 2, topY - depth / 2, cz);
    this.kitchenGroup.add(wallLeft);

    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(wallT, depth, d), this.stainlessDarkMat);
    wallRight.position.set(cx + w / 2, topY - depth / 2, cz);
    this.kitchenGroup.add(wallRight);

    // 배수구 스텐 거름망 + 캡
    const drainOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.004, 24),
      this.stainlessMat
    );
    drainOuter.position.set(cx + w * 0.16, topY - depth + 0.003, cz - d * 0.12);
    this.kitchenGroup.add(drainOuter);

    const drainCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.044, 0.006, 24),
      new THREE.MeshStandardMaterial({ color: 0x3f4752, roughness: 0.35, metalness: 0.85 })
    );
    drainCap.position.set(cx + w * 0.16, topY - depth + 0.006, cz - d * 0.12);
    this.kitchenGroup.add(drainCap);
  }

  buildFaucetModel(cx, topY, cz) {
    const fGroup = new THREE.Group();
    fGroup.position.set(cx, topY, cz);
    const mat = this.stainlessMat;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.036, 24), mat);
    base.position.y = 0.018;
    fGroup.add(base);

    if (this.spec.faucetType === 'square_l') {
      const vPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.28, 18), mat);
      vPipe.position.y = 0.16;
      vPipe.castShadow = true;
      fGroup.add(vPipe);

      const hPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.18, 18), mat);
      hPipe.rotation.x = Math.PI / 2;
      hPipe.position.set(0, 0.295, 0.085);
      hPipe.castShadow = true;
      fGroup.add(hPipe);

      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.013, 0.032, 18), mat);
      nozzle.position.set(0, 0.28, 0.17);
      fGroup.add(nozzle);
    } else {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.03, 0),
        new THREE.Vector3(0, 0.22, 0),
        new THREE.Vector3(0, 0.315, 0.075),
        new THREE.Vector3(0, 0.28, 0.155),
        new THREE.Vector3(0, 0.205, 0.165)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0115, 16, false), mat);
      tube.castShadow = true;
      fGroup.add(tube);

      const aerator = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.022, 18), mat);
      aerator.position.set(0, 0.20, 0.165);
      fGroup.add(aerator);
    }

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.075, 14), mat);
    lever.rotation.z = -Math.PI / 3;
    lever.position.set(0.042, 0.06, 0);
    fGroup.add(lever);

    this.kitchenGroup.add(fGroup);
  }

  buildCooktopModel(cx, topY, cz) {
    const cW = 0.59;
    const cD = 0.51;

    if (this.spec.cooktopType === 'gas_3') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(cW, 0.014, cD), this.stainlessMat);
      base.position.set(cx, topY + 0.007, cz);
      base.castShadow = true;
      this.kitchenGroup.add(base);

      const grateMat = new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.65 });
      [[cx - 0.15, cz - 0.03], [cx + 0.15, cz - 0.03], [cx, cz - 0.13]].forEach(([bx, bz]) => {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.015, 20), grateMat);
        cap.position.set(bx, topY + 0.02, bz);
        this.kitchenGroup.add(cap);

        const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.012), grateMat);
        g1.position.set(bx, topY + 0.022, bz);
        this.kitchenGroup.add(g1);
        const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.18), grateMat);
        g2.position.set(bx, topY + 0.022, bz);
        this.kitchenGroup.add(g2);
      });

      for (let i = -1; i <= 1; i++) {
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.016, 16), grateMat);
        knob.position.set(cx + i * 0.11, topY + 0.018, cz + cD / 2 - 0.04);
        this.kitchenGroup.add(knob);
      }
    } else {
      const isWhite = this.spec.cooktopType === 'white_ind';
      const glassMat = isWhite
        ? new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.1, metalness: 0.18 })
        : this.blackGlassMat;

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(cW + 0.012, 0.005, cD + 0.012), this.stainlessMat);
      bezel.position.set(cx, topY + 0.003, cz);
      this.kitchenGroup.add(bezel);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(cW, 0.007, cD), glassMat);
      glass.position.set(cx, topY + 0.005, cz);
      glass.castShadow = true;
      this.kitchenGroup.add(glass);

      const ringMat = new THREE.MeshBasicMaterial({ color: isWhite ? 0xb7a790 : 0x738296 });
      [
        { x: cx - 0.14, z: cz, rIn: 0.08, rOut: 0.095 },
        { x: cx + 0.13, z: cz - 0.09, rIn: 0.09, rOut: 0.105 },
        { x: cx + 0.13, z: cz + 0.11, rIn: 0.055, rOut: 0.068 }
      ].forEach(z => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(z.rIn, z.rOut, 36), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(z.x, topY + 0.0095, z.z);
        this.kitchenGroup.add(ring);
      });

      const ledPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.001, 0.025),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      ledPanel.position.set(cx, topY + 0.0095, cz + cD / 2 - 0.045);
      this.kitchenGroup.add(ledPanel);
    }
  }

  // D. 상부장 + 천장 써라운딩 마감 + 후드 + LED 간접조명
  buildUpperCabinets(startX, totalW, lowerH, midwayH, upperH, upperD, sinkW, prepW, cookW) {
    const upperY = lowerH + midwayH + upperH / 2;
    const upperCZ = upperD / 2;
    const T = 0.018;
    const ceilH = Math.max(lowerH + midwayH + upperH + 0.05, this.spec.ceilingHeight / 1000);
    const isChimney = this.spec.hoodType === 'chimney';

    const modules = [
      { width: sinkW, isHood: false },
      { width: prepW, isHood: false },
      { width: cookW, isHood: true }
    ];

    let curX = startX;

    modules.forEach((mod) => {
      const bayW = mod.width;
      const cx = curX + bayW / 2;

      if (mod.isHood && isChimney) {
        const hoodW = Math.min(0.88, bayW - 0.04);
        const hoodH = 0.056;
        const hoodD = 0.47;
        const hoodY = lowerH + midwayH + 0.028;

        const canopy = new THREE.Mesh(new THREE.BoxGeometry(hoodW, hoodH, hoodD), this.stainlessMat);
        canopy.position.set(cx, hoodY, hoodD / 2);
        canopy.castShadow = true;
        this.kitchenGroup.add(canopy);

        const glassVisor = new THREE.Mesh(new THREE.BoxGeometry(hoodW + 0.01, 0.008, hoodD + 0.02), this.blackGlassMat);
        glassVisor.position.set(cx, hoodY + hoodH / 2 + 0.003, hoodD / 2 + 0.005);
        this.kitchenGroup.add(glassVisor);

        const chimneyH = Math.max(0.45, ceilH - hoodY + 0.06);
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.28, chimneyH, 0.24), this.stainlessMat);
        chimney.position.set(cx, hoodY + chimneyH / 2, 0.12);
        chimney.castShadow = true;
        this.kitchenGroup.add(chimney);

        const btnBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.014, 0.01), this.blackGlassMat);
        btnBar.position.set(cx, hoodY, hoodD + 0.002);
        this.kitchenGroup.add(btnBar);
      } else {
        const lp = new THREE.Mesh(new THREE.BoxGeometry(T, upperH, upperD), this.carcassWoodMat);
        lp.position.set(curX + T / 2, upperY, upperCZ);
        lp.castShadow = true;
        this.kitchenGroup.add(lp);

        const rp = new THREE.Mesh(new THREE.BoxGeometry(T, upperH, upperD), this.carcassWoodMat);
        rp.position.set(curX + bayW - T / 2, upperY, upperCZ);
        rp.castShadow = true;
        this.kitchenGroup.add(rp);

        const tp = new THREE.Mesh(new THREE.BoxGeometry(bayW - 2 * T, T, upperD), this.carcassWoodMat);
        tp.position.set(cx, upperY + upperH / 2 - T / 2, upperCZ);
        this.kitchenGroup.add(tp);

        const bp = new THREE.Mesh(new THREE.BoxGeometry(bayW - 2 * T, T, upperD), this.carcassWoodMat);
        bp.position.set(cx, upperY - upperH / 2 + T / 2, upperCZ);
        this.kitchenGroup.add(bp);

        if (mod.isHood) {
          const hiddenHood = new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.04, 0.036, upperD - 0.02), this.stainlessDarkMat);
          hiddenHood.position.set(cx, upperY - upperH / 2 + 0.018, upperCZ);
          this.kitchenGroup.add(hiddenHood);
        } else {
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(bayW - 2 * T, T, upperD - 0.03), this.carcassWoodMat);
          shelf.position.set(cx, upperY, upperCZ);
          this.kitchenGroup.add(shelf);
        }

        this.buildSwingDoors(cx, bayW, upperH, lowerH + midwayH, upperD, 2, true);
      }

      curX += bayW;
    });

    // 상부장 상단 천장 써라운딩 마감판 (실제 한국 아파트 인테리어 씽크대 필수 디테일)
    const upperTopY = lowerH + midwayH + upperH;
    const fillerH = ceilH - upperTopY + 0.08;
    if (fillerH > 0.02) {
      const fillerW = isChimney ? (sinkW + prepW) : totalW;
      const fillerX = isChimney ? (startX + fillerW / 2) : (startX + totalW / 2);
      const surround = new THREE.Mesh(
        new THREE.BoxGeometry(fillerW, fillerH, 0.018),
        this.doorMat
      );
      surround.position.set(fillerX, upperTopY + fillerH / 2, upperD - 0.02);
      surround.castShadow = true;
      this.kitchenGroup.add(surround);
    }

    // T5 온백색 / 주백색 LED 바
    if (this.spec.underlightTemp !== 'off') {
      const ledW = isChimney ? (sinkW + prepW - 0.04) : (totalW - 0.04);
      const ledX = isChimney ? (startX + (sinkW + prepW) / 2) : (startX + totalW / 2);
      const ledHex = this.spec.underlightTemp === 'neutral' ? 0xf2f7ff : 0xffe8c2;
      const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(ledW, 0.008, 0.014),
        new THREE.MeshBasicMaterial({ color: ledHex })
      );
      ledBar.position.set(ledX, lowerH + midwayH + 0.004, upperD * 0.72);
      this.kitchenGroup.add(ledBar);
    }
  }

  // E. 모델하우스 쇼룸 소품 (사용자 요청: 3D 회전 시 겹치거나 지워지지 않는 후추통/조미료병 오버랩 완전 제거)
  buildShowroomProps(startX, totalW, topY, depth, sinkW, prepW, sideLen) {
    // 순수 가구 도면 및 깔끔한 3D 실사 렌더링을 위해 불필요한 원통 오브제 소품을 일체 배제합니다.
  }

  buildDimensionGuides(startX, totalW, lowerH, lowerD, upperH, upperD, midwayH, sinkW, prepW, cookW, sideLen, hasTall = false, isLeftTall = false, tallW = 0, counterW = 0, lowerStartX = 0) {
    const halfW = totalW / 2;
    const offset = 0.18;
    const isL = (this.spec.layoutType === 'l_left' || this.spec.layoutType === 'l_right');
    const isLeftL = this.spec.layoutType === 'l_left';

    // 1. 최상단 전체 폭 (Total Width) 치수선 + 45° 사선 틱
    const totalTopY = lowerH + midwayH + upperH + 0.12;
    this.createLine([-halfW, totalTopY, upperD], [halfW, totalTopY, upperD]);
    // 보조 연장선 (Extension Lines)
    this.createLine([-halfW, totalTopY - 0.08, upperD], [-halfW, totalTopY + 0.04, upperD]);
    this.createLine([halfW, totalTopY - 0.08, upperD], [halfW, totalTopY + 0.04, upperD]);
    // 45° 건축 사선 틱 (Architectural slash ticks)
    this.createArchitecturalTick(-halfW, totalTopY, upperD, 'xy');
    this.createArchitecturalTick(halfW, totalTopY, upperD, 'xy');

    // 2. 하부장 전면 모듈별 분할 치수선 (Sink / Prep / Cooktop + 키큰장)
    const dimY = 0.02;
    const dimZ = lowerD + offset;
    const xPts = [];
    if (hasTall && isLeftTall) {
      xPts.push(startX, startX + tallW, startX + tallW + sinkW, startX + tallW + sinkW + prepW, startX + tallW + sinkW + prepW + cookW);
    } else if (hasTall && !isLeftTall) {
      xPts.push(startX, startX + sinkW, startX + sinkW + prepW, startX + sinkW + prepW + cookW, startX + totalW);
    } else {
      xPts.push(startX, startX + sinkW, startX + sinkW + prepW, startX + sinkW + prepW + cookW);
    }

    // 메인 전면 치수 기준선
    if (xPts.length >= 2) {
      this.createLine([xPts[0], dimY, dimZ], [xPts[xPts.length - 1], dimY, dimZ]);
      xPts.forEach(x => {
        // 바닥 연장선
        this.createLine([x, 0, lowerD], [x, dimY, dimZ + 0.03]);
        // 틱 마크
        this.createArchitecturalTick(x, dimY, dimZ, 'xz');
      });
    }

    // 3. 우측면 수직 높이 치수선 (하부장, 미드웨이 타일, 상부장, 전체 높이)
    const rightX = halfW + offset;
    const uBotY = lowerH + midwayH;
    const uTopY = uBotY + upperH;

    // 하부장 높이
    this.createLine([rightX, 0, lowerD], [rightX, lowerH, lowerD]);
    this.createLine([halfW, lowerH, lowerD], [rightX + 0.05, lowerH, lowerD]);
    this.createLine([halfW, 0, lowerD], [rightX + 0.05, 0, lowerD]);
    this.createArchitecturalTick(rightX, 0, lowerD, 'xy');
    this.createArchitecturalTick(rightX, lowerH, lowerD, 'xy');

    if (this.spec.hasUpperCabinets) {
      // 미드웨이 높이
      this.createLine([rightX, lowerH, upperD], [rightX, uBotY, upperD]);
      this.createLine([halfW, uBotY, upperD], [rightX + 0.05, uBotY, upperD]);
      this.createArchitecturalTick(rightX, uBotY, upperD, 'xy');

      // 상부장 높이
      this.createLine([rightX, uBotY, upperD], [rightX, uTopY, upperD]);
      this.createLine([halfW, uTopY, upperD], [rightX + 0.05, uTopY, upperD]);
      this.createArchitecturalTick(rightX, uTopY, upperD, 'xy');

      // 전체 높이 (Total Height) 바깥선
      const farRightX = rightX + 0.12;
      this.createLine([farRightX, 0, upperD], [farRightX, uTopY, upperD]);
      this.createLine([rightX, 0, upperD], [farRightX + 0.03, 0, upperD]);
      this.createLine([rightX, uTopY, upperD], [farRightX + 0.03, uTopY, upperD]);
      this.createArchitecturalTick(farRightX, 0, upperD, 'xy');
      this.createArchitecturalTick(farRightX, uTopY, upperD, 'xy');
    }

    // 4. 하부장 깊이 치수선
    const depthY = 0.02;
    const depthX = halfW + offset;
    this.createLine([depthX, depthY, 0], [depthX, depthY, lowerD]);
    this.createLine([halfW, depthY, 0], [depthX + 0.03, depthY, 0]);
    this.createLine([halfW, depthY, lowerD], [depthX + 0.03, depthY, lowerD]);
    this.createArchitecturalTick(depthX, depthY, 0, 'xz');
    this.createArchitecturalTick(depthX, depthY, lowerD, 'xz');

    // 5. ㄱ자 코너 날개 구간 치수선
    if (isL && sideLen > lowerD) {
      const wx = isLeftL ? (-halfW - offset) : (halfW + offset);
      this.createLine([wx, 0.02, 0], [wx, 0.02, sideLen]);
      this.createLine([wx, 0.02, 0], [isLeftL ? -halfW : halfW, 0.02, 0]);
      this.createLine([wx, 0.02, sideLen], [isLeftL ? (-halfW + lowerD) : (halfW - lowerD), 0.02, sideLen]);
      this.createArchitecturalTick(wx, 0.02, 0, 'xz');
      this.createArchitecturalTick(wx, 0.02, sideLen, 'xz');
    }
  }

  createArchitecturalTick(x, y, z, plane = 'xy') {
    const s = 0.024;
    let p1, p2;
    if (plane === 'xy') {
      p1 = [x - s, y - s, z];
      p2 = [x + s, y + s, z];
    } else if (plane === 'xz') {
      p1 = [x - s, y, z - s];
      p2 = [x + s, y, z + s];
    } else if (plane === 'yz') {
      p1 = [x, y - s, z - s];
      p2 = [x, y + s, z + s];
    }
    this.createLine(p1, p2);
  }

  createLine(p1, p2) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p1), new THREE.Vector3(...p2)]);
    const line = new THREE.Line(geo, this.dimLineMat);
    line.visible = Boolean(this.spec.showDimensions);
    this.scene.add(line);
    this.dimensionLines.push(line);
  }

  updateDimensionBadges() {
    if (!this.overlay) return;

    if (!this.spec.showDimensions) {
      Object.values(this.dimBadges).forEach(b => b.style.display = 'none');
    }
    if (!this.spec.showCallouts) {
      Object.values(this.calloutBadges).forEach(b => b.style.display = 'none');
    }
    if (!this.spec.showDimensions && !this.spec.showCallouts) return;

    const totalW = this.spec.totalWidth / 1000;
    const lowerH = this.spec.lowerHeight / 1000;
    const lowerD = this.spec.lowerDepth / 1000;
    const upperH = this.spec.upperHeight / 1000;
    const upperD = this.spec.upperDepth / 1000;
    const midwayH = this.spec.midwayHeight / 1000;
    const sinkW = this.spec.sinkBayWidth / 1000;
    const prepW = this.spec.prepBayWidth / 1000;
    const cookW = this.spec.cooktopBayWidth / 1000;
    const sideLen = this.spec.sideLength / 1000;
    const startX = -totalW / 2;
    const offset = 0.18;
    const isL = this.spec.layoutType === 'l_left' || this.spec.layoutType === 'l_right';
    const isLeftL = this.spec.layoutType === 'l_left';

    const hasTall = Boolean(this.spec.tallCabinet && this.spec.tallCabinet !== 'none');
    const isLeftTall = this.spec.tallCabinet === 'left';
    const tallW = hasTall ? Math.min(1.2, (Number(this.spec.tallCabinetWidth) || 600) / 1000) : 0;
    const tallCX = isLeftTall ? (startX + tallW / 2) : (startX + totalW - tallW / 2);

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // 1. 치수선 텍스트 업데이트
    if (this.spec.showDimensions) {
      this.dimBadges.totalW.innerText = `전체 W: ${this.spec.totalWidth.toLocaleString()}mm`;
      if (hasTall && this.dimBadges.tallW) {
        this.dimBadges.tallW.innerText = `키큰장 ${this.spec.tallCabinetWidth}mm`;
      }
      this.dimBadges.sinkW.innerText = `개수대 ${this.spec.sinkBayWidth}mm`;
      this.dimBadges.prepW.innerText = `조리대 ${this.spec.prepBayWidth}mm`;
      this.dimBadges.cookW.innerText = `가열대 ${this.spec.cooktopBayWidth}mm`;
      this.dimBadges.lowerH.innerText = `하부 H:${this.spec.lowerHeight}`;
      this.dimBadges.midwayH.innerText = `벽면 H:${this.spec.midwayHeight}`;
      this.dimBadges.upperH.innerText = `상부 H:${this.spec.upperHeight}`;
      this.dimBadges.depth.innerText = `깊이 D:${this.spec.lowerDepth}`;
      this.dimBadges.wingLen.innerText = `날개 L:${this.spec.sideLength.toLocaleString()}mm`;
      this.dimBadges.totalH.innerText = `총 높이 ${(this.spec.lowerHeight + this.spec.midwayHeight + this.spec.upperHeight).toLocaleString()}mm`;

      const wingX = isLeftL ? (startX + lowerD / 2) : (totalW / 2 - lowerD / 2);
      const points = {
        totalW: new THREE.Vector3(0, lowerH + midwayH + upperH + 0.16, upperD),
        tallW: new THREE.Vector3(tallCX, 0.04, lowerD + offset + 0.02),
        sinkW: new THREE.Vector3(startX + (hasTall && isLeftTall ? tallW : 0) + sinkW / 2, 0.04, lowerD + offset + 0.02),
        prepW: new THREE.Vector3(startX + (hasTall && isLeftTall ? tallW : 0) + sinkW + prepW / 2, 0.04, lowerD + offset + 0.02),
        cookW: new THREE.Vector3(startX + (hasTall && isLeftTall ? tallW : 0) + sinkW + prepW + cookW / 2, 0.04, lowerD + offset + 0.02),
        lowerH: new THREE.Vector3(totalW / 2 + offset + 0.02, lowerH / 2, lowerD),
        midwayH: new THREE.Vector3(totalW / 2 + offset + 0.02, lowerH + midwayH / 2, upperD),
        upperH: new THREE.Vector3(totalW / 2 + offset + 0.02, lowerH + midwayH + upperH / 2, upperD),
        totalH: new THREE.Vector3(totalW / 2 + offset + 0.14, (lowerH + midwayH + upperH) / 2, upperD),
        depth: new THREE.Vector3(totalW / 2 + offset + 0.02, 0.04, lowerD / 2),
        wingLen: new THREE.Vector3(wingX, lowerH + 0.06, sideLen)
      };

      for (const [key, badge] of Object.entries(this.dimBadges)) {
        if (key === 'tallW' && !hasTall) { badge.style.display = 'none'; continue; }
        if (key === 'wingLen' && !isL) { badge.style.display = 'none'; continue; }
        if ((key === 'upperH' || key === 'midwayH' || key === 'totalH') && !this.spec.hasUpperCabinets) {
          badge.style.display = 'none'; continue;
        }
        const pt = points[key];
        if (!pt) continue;
        const pos = pt.clone().project(this.camera);
        if (pos.z > 1.0) { badge.style.display = 'none'; continue; }
        badge.style.display = 'block';
        badge.style.left = `${(pos.x * 0.5 + 0.5) * w}px`;
        badge.style.top = `${(-(pos.y * 0.5) + 0.5) * h}px`;
      }
    }

    // 2. 부품 명칭 핀 (Callouts) 업데이트
    if (this.spec.showCallouts) {
      let sinkCX = startX + (hasTall && isLeftTall ? tallW : 0) + sinkW / 2;
      let cookCX = startX + (hasTall && isLeftTall ? tallW : 0) + sinkW + prepW + cookW / 2;
      let prepCX = startX + (hasTall && isLeftTall ? tallW : 0) + sinkW + prepW / 2;
      const calloutPts = {
        tall: new THREE.Vector3(tallCX, lowerH * 0.9, lowerD + 0.02),
        sink: new THREE.Vector3(sinkCX, lowerH + 0.04, lowerD * 0.45),
        cook: new THREE.Vector3(cookCX, lowerH + 0.04, lowerD * 0.5),
        prep: new THREE.Vector3(prepCX, lowerH * 0.55, lowerD + 0.015),
        top: new THREE.Vector3(startX + (hasTall && isLeftTall ? tallW : 0) + 0.15, lowerH + 0.03, lowerD + 0.02),
        upper: new THREE.Vector3(startX + (hasTall && isLeftTall ? tallW : 0) + (totalW - tallW) * 0.35, lowerH + midwayH + upperH * 0.55, upperD + 0.015),
        wing: new THREE.Vector3(isLeftL ? (startX + lowerD * 0.5) : (totalW / 2 - lowerD * 0.5), lowerH + 0.03, Math.min(sideLen * 0.7, sideLen - 0.2))
      };

      for (const [key, badge] of Object.entries(this.calloutBadges)) {
        if (key === 'tall' && !hasTall) { badge.style.display = 'none'; continue; }
        if (key === 'wing' && !isL) { badge.style.display = 'none'; continue; }
        if (key === 'upper' && !this.spec.hasUpperCabinets) { badge.style.display = 'none'; continue; }
        const pt = calloutPts[key];
        if (!pt) continue;
        const pos = pt.clone().project(this.camera);
        if (pos.z > 1.0) { badge.style.display = 'none'; continue; }
        badge.style.display = 'block';
        badge.style.left = `${(pos.x * 0.5 + 0.5) * w}px`;
        badge.style.top = `${(-(pos.y * 0.5) + 0.5) * h}px`;
      }
    }
  }

  animate() {
    this.animFrameId = requestAnimationFrame(() => this.animate());

    if (this.cameraAnim && this.controls) {
      this.cameraAnim.progress += 0.08;
      this.camera.position.lerp(this.cameraAnim.camDest, 0.14);
      this.controls.target.lerp(this.cameraAnim.targetPos, 0.14);
      if (this.cameraAnim.progress >= 1.0) this.cameraAnim = null;
    }

    if (this.controls) this.controls.update();

    for (const d of this.doors) {
      if (Math.abs(d.group.rotation.y - d.targetAngle) > 0.001) {
        d.group.rotation.y += (d.targetAngle - d.group.rotation.y) * 0.12;
      }
    }

    if (this.slidingDoors && this.slidingDoors.length > 0) {
      for (const sd of this.slidingDoors) {
        const destX = this.spec.isDoorOpen ? sd.openX : sd.closedX;
        if (Math.abs(sd.mesh.position.x - destX) > 0.001) {
          sd.mesh.position.x += (destX - sd.mesh.position.x) * 0.12;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.updateDimensionBadges();
  }

  updateSpec(newSpec) {
    let rebuildKitchen = false;
    let rebuildMaterials = false;
    let rebuildRoom = false;
    let resetCamera = false;

    const materialKeys = new Set(['wallDesign', 'tileDesign', 'floorDesign', 'countertopType']);
    const roomKeys = new Set(['layoutType', 'sideLength', 'totalWidth', 'ceilingHeight', 'wallDesign', 'floorDesign']);
    const kitchenKeys = new Set([
      'category', 'wardrobeDepth', 'islandDepth', 'layoutType', 'sideLength', 'wingHasUpper',
      'totalWidth', 'ceilingHeight', 'lowerHeight', 'lowerDepth', 'sinkBayWidth', 'prepBayWidth', 'cooktopBayWidth',
      'tallCabinet', 'tallCabinetWidth', 'tallCabinetType',
      'upperHeight', 'upperDepth', 'midwayHeight', 'hasUpperCabinets',
      'doorColor', 'doorStyle', 'countertopType', 'handleType', 'handleColor',
      'tileDesign', 'hoodType', 'cooktopType', 'faucetType', 'underlightTemp'
    ]);

    for (const key of Object.keys(newSpec)) {
      const val = newSpec[key];
      if (val === undefined || val === this.spec[key]) continue;

      this.spec[key] = val;
      if (key === 'layoutType') resetCamera = true;
      if (materialKeys.has(key)) rebuildMaterials = true;
      if (roomKeys.has(key)) rebuildRoom = true;
      if (kitchenKeys.has(key)) rebuildKitchen = true;
    }

    if (newSpec.doorColor && this.doorMat) {
      this.doorMat.color.set(this.spec.doorColor);
    }

    if (newSpec.showDimensions !== undefined) {
      this.dimensionLines.forEach(l => l.visible = this.spec.showDimensions);
    }

    if (newSpec.isDoorOpen !== undefined) {
      this.setDoorOpen(newSpec.isDoorOpen);
    }

    if (rebuildMaterials) this.refreshDynamicMaterials();
    if (rebuildRoom) this.buildRoomShell();
    if (rebuildKitchen) this.buildKitchen();
    if (resetCamera) this.applyCameraConstraints(false);
  }

  setDoorOpen(isOpen) {
    this.spec.isDoorOpen = isOpen;
    for (const d of this.doors) {
      d.targetAngle = isOpen ? d.openAngle : 0;
    }
  }

  toggleDoors() {
    this.setDoorOpen(!this.spec.isDoorOpen);
    return this.spec.isDoorOpen;
  }

  toggleDimensions() {
    this.spec.showDimensions = !this.spec.showDimensions;
    this.dimensionLines.forEach(l => l.visible = Boolean(this.spec.showDimensions));
    return this.spec.showDimensions;
  }

  toggleCadEdges() {
    this.spec.showCadEdges = !this.spec.showCadEdges;
    this.cadEdgeLines.forEach(l => l.visible = Boolean(this.spec.showCadEdges));
    return this.spec.showCadEdges;
  }

  toggleCallouts() {
    this.spec.showCallouts = !this.spec.showCallouts;
    if (this.overlay) {
      Object.values(this.calloutBadges).forEach(b => {
        b.style.display = this.spec.showCallouts ? 'block' : 'none';
      });
    }
    return this.spec.showCallouts;
  }

  captureImage(resolutionMultiplier = 2) {
    const origRatio = this.renderer.getPixelRatio();
    const prevDim = this.spec.showDimensions;
    const prevCallouts = this.spec.showCallouts;
    this.dimensionLines.forEach(l => l.visible = false);
    if (this.overlay) this.overlay.style.display = 'none';

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * resolutionMultiplier, 3));
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/jpeg', 0.94);

    this.renderer.setPixelRatio(origRatio);
    this.dimensionLines.forEach(l => l.visible = prevDim);
    if (this.overlay) this.overlay.style.display = 'block';

    return dataUrl;
  }

  // =========================================================
  // B-13. 자바라 홀딩도어 / 공간 분할 가벽 (Accordion Partition)
  // =========================================================
  buildPartitionDoor() {
    const W = (this.spec.totalWidth || 1350) / 1000;
    const H = (this.spec.ceilingHeight || 2460) / 1000;
    const D = 0.08;

    const railMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.7 });
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.55, metalness: 0.05 });

    // 상부 알루미늄 레일 & 좌우 포스트
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D), railMat);
    topRail.position.set(0, H - 0.025, D / 2);
    this.kitchenGroup.add(topRail);

    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.04, H, D), railMat);
    postL.position.set(-W / 2 + 0.02, H / 2, D / 2);
    this.kitchenGroup.add(postL);

    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.04, H, D), railMat);
    postR.position.set(W / 2 - 0.02, H / 2, D / 2);
    this.kitchenGroup.add(postR);

    // 주름(자바라) 슬랫 판넬
    const foldCount = Math.max(6, Math.round(W / 0.14));
    const slatW = (W - 0.08) / foldCount;
    for (let i = 0; i < foldCount; i++) {
      const sx = -W / 2 + 0.04 + slatW * (i + 0.5);
      const slat = new THREE.Mesh(new THREE.BoxGeometry(slatW * 0.94, H - 0.06, 0.018), slatMat);
      slat.position.set(sx, (H - 0.05) / 2, D / 2 + ((i % 2 === 0) ? 0.015 : -0.015));
      slat.rotation.y = (i % 2 === 0) ? 0.25 : -0.25;
      slat.castShadow = true;
      slat.receiveShadow = true;
      this.kitchenGroup.add(slat);
    }

    if (this.dimBadges && this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `자바라 W:${Math.round(W * 1000)} × H:${Math.round(H * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // B-14. 화장실 바닥 타일 & 욕실 구역 (Bathroom Zone)
  // =========================================================
  buildBathroomZone() {
    const W = (this.spec.totalWidth || 3000) / 1000;
    const D = (this.spec.lowerDepth || 3000) / 1000;
    const H = (this.spec.ceilingHeight || 2460) / 1000;

    // 1. 타일 마감 바닥 슬래브 (방수 턱 20mm)
    const tileFloorMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.4, metalness: 0.05 });
    const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.025, D), tileFloorMat);
    floorSlab.position.set(0, 0.0125, D / 2);
    floorSlab.receiveShadow = true;
    this.kitchenGroup.add(floorSlab);

    // 타일 격자 라인
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x94A3B8 });
    for (let gx = -W / 2 + 0.5; gx < W / 2; gx += 0.5) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, D), lineMat);
      line.position.set(gx, 0.026, D / 2);
      this.kitchenGroup.add(line);
    }
    for (let gz = 0.5; gz < D; gz += 0.5) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(W, 0.002, 0.006), lineMat);
      line.position.set(0, 0.026, gz);
      this.kitchenGroup.add(line);
    }

    // 2. 강화유리 샤워 파티션
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xE0F2FE, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.1
    });
    const glassWall = new THREE.Mesh(new THREE.BoxGeometry(0.015, Math.min(H - 0.1, 2.1), D * 0.45), glassMat);
    glassWall.position.set(0, Math.min(H - 0.1, 2.1) / 2 + 0.025, D * 0.25);
    this.kitchenGroup.add(glassWall);

    // 3. 하부 플로팅 세면대 하부장 + 세면볼 + 거울
    const vanityW = Math.min(0.9, W * 0.35);
    const vanity = new THREE.Mesh(new THREE.BoxGeometry(vanityW, 0.55, 0.48), this.doorMat);
    vanity.position.set(-W / 2 + vanityW / 2 + 0.2, 0.50, 0.26);
    vanity.castShadow = true;
    this.kitchenGroup.add(vanity);

    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.15, metalness: 0.05 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.16, 0.12, 24), ceramicMat);
    basin.position.set(-W / 2 + vanityW / 2 + 0.2, 0.83, 0.26);
    this.kitchenGroup.add(basin);

    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.05, metalness: 0.85 });
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(vanityW * 0.9, 0.75, 0.02), mirrorMat);
    mirror.position.set(-W / 2 + vanityW / 2 + 0.2, 1.48, 0.02);
    this.kitchenGroup.add(mirror);

    if (this.dimBadges && this.dimBadges.totalW) {
      this.dimBadges.totalW.innerText = `화장실 바닥 ${Math.round(W * 1000)} × ${Math.round(D * 1000)}mm`;
      this.dimBadges.totalW.style.display = 'block';
    }
  }

  // =========================================================
  // C. 집안 전체 맞춤 가구 통합 3D 쇼룸 (Full House Showroom)
  // 모든 발주 품목을 가상 주택/아파트 실내 공간에 유기적으로 동시 배치
  // =========================================================
  setFullHouseMode(items = [], isFullHouse = true) {
    this.isFullHouseMode = isFullHouse;
    this.fullHouseItems = items;

    if (isFullHouse && items && items.length > 0) {
      this.buildFullHouseShowroom(items);
    } else {
      this.buildRoomShell();
      this.buildFurniture();
      this.applyCameraConstraints(false);
    }
  }

  buildFullHouseShowroom(items) {
    if (this.kitchenGroup) {
      this.scene.remove(this.kitchenGroup);
      this.doors = [];
      this.slidingDoors = [];
      this.dimensionLines.forEach(l => this.scene.remove(l));
      this.dimensionLines = [];
      this.cadEdgeLines.forEach(l => {
        if (l.parent) l.parent.remove(l);
        if (l.geometry) l.geometry.dispose();
      });
      this.cadEdgeLines = [];
    }
    if (this.roomGroup) this.scene.remove(this.roomGroup);

    // 1. 전체 실내 룸 셸 구축 (14m x 10m 공간)
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    const floorW = 14;
    const floorD = 10;
    const ceilH = 2.45;

    // A. 바닥 (광폭 오크 원목 마루)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, floorD / 2 - 0.8);
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // B. 후면 메인 벽체 (14m)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(floorW, ceilH + 0.6), this.wallMat);
    backWall.position.set(0, (ceilH + 0.6) / 2, -0.002);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);

    // C. 좌측 벽 (주방 구역 벽 5.0m)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(5.0, ceilH + 0.6), this.wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-floorW / 2, (ceilH + 0.6) / 2, 2.5);
    leftWall.receiveShadow = true;
    this.roomGroup.add(leftWall);

    // D. 인테리어 무드 파티션 (주방과 침실 사이)
    const partWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, ceilH, 3.0), this.carcassWoodMat);
    partWall.position.set(1.4, ceilH / 2, 1.5);
    this.roomGroup.add(partWall);

    // 2. 가구 그룹 생성 및 품목별 구역 자동 배치
    this.kitchenGroup = new THREE.Group();
    this.scene.add(this.kitchenGroup);

    let kitchenCursorX = -3.4;
    let islandZ = 2.2;
    let bedroomX = 4.2;
    let livingZ = 4.8;
    let entryX = -4.2;
    let bathroomX = 3.8;

    items.forEach((item, idx) => {
      const cat = item.category || 'sink';
      const spec = item.spec || this.spec;
      const subGroup = new THREE.Group();

      const origSpec = { ...this.spec };
      Object.assign(this.spec, spec);
      this.refreshDynamicMaterials();

      const tempGroup = new THREE.Group();
      const prevKitchenGroup = this.kitchenGroup;
      this.kitchenGroup = tempGroup;

      if (cat === 'wardrobe') {
        this.buildWardrobe();
        subGroup.add(tempGroup);
        subGroup.position.set(bedroomX, 0, 0);
        bedroomX += ((spec.totalWidth || 3000) / 1000) * 0.45 + 1.2;
      } else if (cat === 'shoe_cabinet') {
        this.buildShoeCabinet();
        subGroup.add(tempGroup);
        subGroup.position.set(entryX, 0, 5.2);
        entryX += 1.6;
      } else if (cat === 'island') {
        this.buildIslandTable();
        subGroup.add(tempGroup);
        subGroup.position.set(-2.0, 0, islandZ);
        islandZ += 1.8;
      } else if (cat === 'tv_console') {
        this.buildTvConsole();
        subGroup.add(tempGroup);
        subGroup.position.set(2.8, 0, livingZ);
        livingZ += 1.6;
      } else if (cat === 'display_glass') {
        this.buildGlassDisplayCabinet();
        subGroup.add(tempGroup);
        subGroup.position.set(1.4 + 0.65, 0, 0.3);
      } else if (cat === 'drawers') {
        this.buildDrawersUnit();
        subGroup.add(tempGroup);
        subGroup.position.set(4.6, 0, 3.2);
      } else if (cat === 'storage') {
        this.buildStorageCabinet();
        subGroup.add(tempGroup);
        subGroup.position.set(-5.4, 0, 1.6);
      } else if (cat === 'tall_cabinet') {
        this.buildStandaloneTallCabinet();
        subGroup.add(tempGroup);
        const tallW = (spec.tallCabinetWidth || spec.totalWidth || 600) / 1000;
        subGroup.position.set(kitchenCursorX + tallW / 2, 0, 0);
        kitchenCursorX += tallW + 0.02;
      } else if (cat === 'prep_counter') {
        this.buildPrepCounter();
        subGroup.add(tempGroup);
        const prepW = (spec.totalWidth || 1000) / 1000;
        subGroup.position.set(kitchenCursorX + prepW / 2, 0, 0);
        kitchenCursorX += prepW + 0.02;
      } else if (cat === 'partition') {
        this.buildPartitionDoor();
        subGroup.add(tempGroup);
        subGroup.position.set(1.5, 0, 1.6);
      } else if (cat === 'bathroom') {
        this.buildBathroomZone();
        subGroup.add(tempGroup);
        const bW = (spec.totalWidth || 3000) / 1000;
        subGroup.position.set(bathroomX, 0, 1.6);
        bathroomX += bW + 0.4;
      } else {
        // 주방 씽크대 (연속 배치 시 겹치지 않도록 X 커서 자동 이동)
        this.buildKitchenLayout();
        subGroup.add(tempGroup);
        const kW = (spec.totalWidth || 2700) / 1000;
        subGroup.position.set(kitchenCursorX + kW / 2, 0, 0);
        kitchenCursorX += kW + 0.05;
      }

      subGroup.userData.zone = cat;
      subGroup.userData.itemId = item.id;

      this.kitchenGroup = prevKitchenGroup;
      this.kitchenGroup.add(subGroup);

      // 각 가구 상단에 입체적인 3D 핀 뱃지 부착
      this.createHouseItemPin(subGroup, idx + 1, item.name);

      this.spec = origSpec;
      this.refreshDynamicMaterials();
    });

    // 3. 카메라를 집안 전체 조망 투시도로 전환
    if (this.controls) {
      this.controls.minDistance = 2.5;
      this.controls.maxDistance = 24.0;
      this.controls.minAzimuthAngle = -1.35;
      this.controls.maxAzimuthAngle = 1.35;
      this.setCameraPreset('house_overview');
    }

    this.addCadEdgesRecursively(this.kitchenGroup);
  }

  // =========================================================
  // D. 집안 전체 실시간 인테리어 수정 권한 컨트롤러 (Full House Authority)
  // =========================================================
  setWallDesign(designKey) {
    this.spec.wallDesign = designKey;
    this.wallMat = this.createWallMaterials(designKey);
    if (this.isFullHouseMode && this.fullHouseItems && this.fullHouseItems.length > 0) {
      this.buildFullHouseShowroom(this.fullHouseItems);
    } else {
      this.buildRoomShell();
    }
  }

  setFloorDesign(designKey) {
    this.spec.floorDesign = designKey;
    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.createFloorTexture(designKey),
      roughness: (designKey === 'limestone_tile' || designKey === 'porcelain_gray') ? 0.42 : 0.48,
      metalness: 0.04
    });
    if (this.isFullHouseMode && this.fullHouseItems && this.fullHouseItems.length > 0) {
      this.buildFullHouseShowroom(this.fullHouseItems);
    } else {
      this.buildRoomShell();
    }
  }

  setLightTemperature(kelvin) {
    let keyHex, hemiSky, hemiGround, underHex;
    if (kelvin <= 3200) { // 3000K 전구색
      keyHex = 0xffdfa8;
      hemiSky = 0xfff0da;
      hemiGround = 0xa38564;
      underHex = 0xffdfb0;
    } else if (kelvin <= 4500) { // 4000K 주백색
      keyHex = 0xfff7ee;
      hemiSky = 0xfffaf5;
      hemiGround = 0xb4a491;
      underHex = 0xfff6e6;
    } else { // 5700K 주광색
      keyHex = 0xf0f5ff;
      hemiSky = 0xffffff;
      hemiGround = 0xc5d0dc;
      underHex = 0xf3f7ff;
    }
    if (this.keyLight) this.keyLight.color.setHex(keyHex);
    if (this.hemiLight) {
      this.hemiLight.color.setHex(hemiSky);
      this.hemiLight.groundColor.setHex(hemiGround);
    }
    if (this.underLights) {
      this.underLights.forEach(l => l.color.setHex(underHex));
    }
  }

  setZoneVisibility(zone, isVisible) {
    if (!this.kitchenGroup) return;
    this.kitchenGroup.children.forEach(child => {
      if (child.userData && (child.userData.zone === zone || (zone === 'sink' && (child.userData.zone === 'prep_counter' || child.userData.zone === 'sink')))) {
        child.visible = Boolean(isVisible);
      }
    });
  }

  toggleXRayMode(enable) {
    this.isXRayMode = Boolean(enable);
    const targetOpacity = this.isXRayMode ? 0.42 : 1.0;
    const isTrans = this.isXRayMode;
    const processGroup = (grp) => {
      if (!grp) return;
      grp.traverse(child => {
        if (child.isMesh && child.material && !child.userData.isCadEdge) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              m.transparent = isTrans;
              m.opacity = targetOpacity;
            });
          } else {
            child.material.transparent = isTrans;
            child.material.opacity = targetOpacity;
          }
        }
      });
    };
    processGroup(this.roomGroup);
    processGroup(this.kitchenGroup);
  }

  createHouseItemPin(parentGroup, num, name) {
    const pinGroup = new THREE.Group();
    pinGroup.position.set(0, 2.48, 0.35);

    // 슬림 스탠드 바
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 12), this.aluminumFrameMat);
    pole.position.set(0, -0.16, 0);
    pinGroup.add(pole);

    // 세련된 원형 황금/브론즈 핀 뱃지
    const badgeGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.024, 24);
    badgeGeom.rotateX(Math.PI / 2);
    const badgeMat = new THREE.MeshStandardMaterial({
      color: 0x8C6239,
      metalness: 0.6,
      roughness: 0.25,
      emissive: 0x3d2714,
      emissiveIntensity: 0.35
    });
    const badge = new THREE.Mesh(badgeGeom, badgeMat);
    pinGroup.add(badge);

    parentGroup.add(pinGroup);
  }

  resize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setupEvents() {
    window.addEventListener('resize', () => this.resize());
  }
}

window.Furniture3DEngine = Furniture3DEngine;
