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
      showProps: options.showProps !== false
    };

    this.doors = [];
    this.dimensionLines = [];
    this.dimBadges = {};
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
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

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

    if (type === 'limestone_tile') {
      ctx.fillStyle = '#bab2a7';
      ctx.fillRect(0, 0, 1024, 1024);
      const tile = 512;
      const shades = ['#cfc9bf', '#cac3b8', '#d4cec4', '#c5beb3'];
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

    if (design === 'walnut_temba') {
      // 세로 우드 템바보드/루버 (선명한 입체 음영 범프맵 포함!)
      const slats = 16;
      const sw = 512 / slats;
      for (let i = 0; i < slats; i++) {
        const sx = i * sw;
        const grad = ctx.createLinearGradient(sx, 0, sx + sw, 0);
        grad.addColorStop(0, '#453124');
        grad.addColorStop(0.14, '#7a5941');
        grad.addColorStop(0.5, '#8c674c');
        grad.addColorStop(0.86, '#6e4f39');
        grad.addColorStop(1, '#3d2a1f');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, 0, sw, 512);

        // 결 세로선
        ctx.fillStyle = 'rgba(35,22,15,0.1)';
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

    const solidMap = {
      warm_greige: '#cbc2b5',
      creamy_plaster: '#e6ded2',
      sage_olive: '#b3bdb0',
      deep_charcoal: '#46423d'
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

    if (topType === 'nero_black') {
      ctx.fillStyle = '#212224';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.strokeStyle = 'rgba(235, 228, 215, 0.28)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = Math.random() * 1024;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 1024) {
          y += 28;
          x += (Math.random() - 0.45) * 42;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (topType === 'terrazzo_stone') {
      ctx.fillStyle = '#ebe5dc';
      ctx.fillRect(0, 0, 1024, 1024);
      const flecks = ['#9b8b7a', '#c9b8a3', '#6b635b', '#ffffff', '#bfa382'];
      for (let i = 0; i < 700; i++) {
        ctx.fillStyle = flecks[i % flecks.length];
        ctx.beginPath();
        ctx.arc(Math.random() * 1024, Math.random() * 1024, 1.5 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (topType === 'cream_staron') {
      ctx.fillStyle = '#f2eadc';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.strokeStyle = 'rgba(195, 175, 145, 0.25)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        let x = i * 150;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 1024) {
          y += 30;
          x += Math.sin(y * 0.015 + i) * 16;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      // white_marble
      ctx.fillStyle = '#f5f2ed';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.strokeStyle = 'rgba(170, 160, 148, 0.34)';
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = Math.random() * 1024;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 1024) {
          y += 26;
          x += (Math.random() - 0.48) * 44;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // ExtrudeGeometry UV가 미터 단위이므로 0.55 배율로 자연스럽게 매핑
    tex.repeat.set(0.55, 0.55);
    tex.encoding = THREE.sRGBEncoding;

    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.18,
      metalness: 0.06
    });
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

    this.dimLineMat = new THREE.LineBasicMaterial({
      color: 0x8c6239,
      depthTest: false,
      transparent: true,
      opacity: 0.9
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

    // 3. ㄱ자 레이아웃일 때 해당 측벽(내측면) 자동 생성
    if (this.spec.layoutType === 'l_right') {
      const rwD = sideLen + 2.8;
      const rWall = new THREE.Mesh(new THREE.PlaneGeometry(rwD, ceilH + 1.2), this.wallMat);
      rWall.rotation.y = -Math.PI / 2;
      rWall.position.set(totalW / 2 + 0.002, (ceilH + 1.2) / 2, rwD / 2 - 0.005);
      rWall.receiveShadow = true;
      this.roomGroup.add(rWall);

      const rBase = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, rwD), baseMat);
      rBase.position.set(totalW / 2 - 0.005, 0.04, rwD / 2);
      this.roomGroup.add(rBase);
    } else if (this.spec.layoutType === 'l_left') {
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
    this.overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden;';
    this.container.style.position = 'relative';
    this.container.appendChild(this.overlay);

    this.dimBadges = {
      totalW: this.createDimBadge('전체 폭: 2,700mm', '#8C6239'),
      sinkW: this.createDimBadge('개수대 1,000mm', '#3A2E26'),
      prepW: this.createDimBadge('조리대 800mm', '#3A2E26'),
      cookW: this.createDimBadge('가열대 900mm', '#3A2E26'),
      lowerH: this.createDimBadge('하부 H:860', '#5C4D42'),
      upperH: this.createDimBadge('상부 H:700', '#5C4D42'),
      depth: this.createDimBadge('깊이 D:600', '#7A6F66'),
      wingLen: this.createDimBadge('세로 1,800mm', '#8C6239')
    };
  }

  createDimBadge(text, bgColor) {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.cssText = `
      position: absolute; background: ${bgColor}; color: #fff;
      padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 600;
      box-shadow: 0 2px 6px rgba(42,33,27,0.22); transform: translate(-50%, -50%);
      white-space: nowrap; display: ${this.spec.showDimensions ? 'block' : 'none'};
    `;
    this.overlay.appendChild(el);
    return el;
  }

  // =========================================================
  // 3. 주방 씽크대 전체 빌드
  // =========================================================
  buildKitchen() {
    if (this.kitchenGroup) {
      this.scene.remove(this.kitchenGroup);
      this.doors = [];
      this.dimensionLines.forEach(l => this.scene.remove(l));
      this.dimensionLines = [];
    }

    this.kitchenGroup = new THREE.Group();
    this.scene.add(this.kitchenGroup);

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

    // A. 미드웨이 타일/빅슬랩 벽면 패널 (메인 + ㄱ자 측벽)
    const tilePanel = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 0.04, midwayH + 0.14, 0.008),
      this.tileWallMat
    );
    tilePanel.position.set(0, lowerH + midwayH / 2, 0.004);
    tilePanel.receiveShadow = true;
    this.kitchenGroup.add(tilePanel);

    if ((isLeftL || isRightL) && sideLen > lowerD) {
      const sideTile = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, midwayH + 0.14, sideLen + 0.02),
        this.tileWallMat
      );
      sideTile.position.set(
        isLeftL ? (startX + 0.004) : (startX + totalW - 0.004),
        lowerH + midwayH / 2,
        sideLen / 2
      );
      sideTile.receiveShadow = true;
      this.kitchenGroup.add(sideTile);
    }

    // B. 하부장 캐비닛 (메인 라인 + ㄱ자 코너 날개장)
    this.buildLowerCabinets(startX, totalW, lowerH, lowerD, plinthH, topT, sinkW, prepW, cookW);

    if ((isLeftL || isRightL) && sideLen > lowerD + 0.1) {
      this.buildWingCabinets(isLeftL ? 'left' : 'right', startX, totalW, lowerH, lowerD, plinthH, topT, sideLen, upperH, upperD, midwayH);
    }

    // C. Seamless Monolithic Beveled 인조대리석 상판 + 3D 싱크볼 + 수전 + 쿡탑
    this.buildMonolithicCountertopAndAppliances(startX, totalW, lowerH, lowerD, topT, sinkW, prepW, cookW, sideLen);

    // D. 상부장 + 천장 써라운딩 몰딩 + 후드 + 간접조명
    if (this.spec.hasUpperCabinets) {
      this.buildUpperCabinets(startX, totalW, lowerH, midwayH, upperH, upperD, sinkW, prepW, cookW);
    }
    this.updateUnderLights(lowerH, midwayH, sinkW, prepW, totalW, startX);

    // E. 쇼룸 데코 소품
    if (this.spec.showProps) {
      this.buildShowroomProps(startX, totalW, lowerH, lowerD, sinkW, prepW, sideLen);
    }

    // F. 도면 치수선
    this.buildDimensionGuides(startX, totalW, lowerH, lowerD, upperH, upperD, midwayH, sinkW, prepW, cookW, sideLen);
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

  buildLowerCabinets(startX, totalW, lowerH, lowerD, plinthH, topT, sinkW, prepW, cookW) {
    const bodyH = lowerH - topT - plinthH;
    const bodyY = plinthH + bodyH / 2;
    const T = 0.018;

    // 1. 고급 걸레받이 (다크 쉐도우 플린스 - 65mm 후퇴로 공중부양 고급감)
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(totalW - 0.02, plinthH, lowerD - 0.07),
      this.darkGapMat
    );
    plinth.position.set(0, plinthH / 2, (lowerD - 0.07) / 2);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.kitchenGroup.add(plinth);

    // 2. 도어 뒤 줄눈 그림자 프레임 (도어 사이 음각 3mm 틈새 표현)
    const shadowBack = new THREE.Mesh(
      new THREE.BoxGeometry(totalW - 0.008, bodyH - 0.008, 0.012),
      this.darkGapMat
    );
    shadowBack.position.set(0, bodyY, lowerD - 0.007);
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

    // 1. 상판 2D 외곽 폴리곤 (y = -z)
    const shape = new THREE.Shape();
    if (isRightL && hasWing) {
      shape.moveTo(startX, 0);
      shape.lineTo(endX, 0);
      shape.lineTo(endX, -sideLen);
      shape.lineTo(endX - totalD, -sideLen);
      shape.lineTo(endX - totalD, -totalD);
      shape.lineTo(startX, -totalD);
      shape.closePath();
    } else if (isLeftL && hasWing) {
      shape.moveTo(startX, 0);
      shape.lineTo(endX, 0);
      shape.lineTo(endX, -totalD);
      shape.lineTo(startX + totalD, -totalD);
      shape.lineTo(startX + totalD, -sideLen);
      shape.lineTo(startX, -sideLen);
      shape.closePath();
    } else {
      shape.moveTo(startX, 0);
      shape.lineTo(endX, 0);
      shape.lineTo(endX, -totalD);
      shape.lineTo(startX, -totalD);
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
      const fillerX = isChimney ? (startX + fillerW / 2) : 0;
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
      const ledX = isChimney ? (startX + (sinkW + prepW) / 2) : 0;
      const ledHex = this.spec.underlightTemp === 'neutral' ? 0xf2f7ff : 0xffe8c2;
      const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(ledW, 0.008, 0.014),
        new THREE.MeshBasicMaterial({ color: ledHex })
      );
      ledBar.position.set(ledX, lowerH + midwayH + 0.004, upperD * 0.72);
      this.kitchenGroup.add(ledBar);
    }
  }

  // E. 모델하우스 쇼룸 소품
  buildShowroomProps(startX, totalW, topY, depth, sinkW, prepW, sideLen) {
    const prepCX = startX + sinkW + prepW / 2;

    // 1. 월넛 도마
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.35, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x8d633d, roughness: 0.58 })
    );
    board.position.set(prepCX - 0.14, topY + 0.175, 0.07);
    board.rotation.x = -0.12;
    board.castShadow = true;
    this.kitchenGroup.add(board);

    // 2. 도자기 오일병 2종
    const bottleMat1 = new THREE.MeshStandardMaterial({ color: 0x43352c, roughness: 0.25 });
    const bottle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.19, 18), bottleMat1);
    bottle1.position.set(prepCX + 0.12, topY + 0.095, 0.11);
    bottle1.castShadow = true;
    this.kitchenGroup.add(bottle1);

    const bottleMat2 = new THREE.MeshStandardMaterial({ color: 0xded6ca, roughness: 0.35 });
    const bottle2 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.14, 18), bottleMat2);
    bottle2.position.set(prepCX + 0.2, topY + 0.07, 0.14);
    bottle2.castShadow = true;
    this.kitchenGroup.add(bottle2);

    // 3. ㄱ자 날개 코너가 있는 경우 에스프레소/드립 케틀 실루엣 + 도자기 화병
    if ((this.spec.layoutType === 'l_left' || this.spec.layoutType === 'l_right') && sideLen > depth + 0.3) {
      const isLeft = this.spec.layoutType === 'l_left';
      const kx = isLeft ? (startX + depth * 0.5) : (startX + totalW - depth * 0.5);
      const kz = depth + 0.38;

      const vase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.056, 0.17, 20),
        new THREE.MeshStandardMaterial({ color: 0xe6dfd5, roughness: 0.52 })
      );
      vase.position.set(kx, topY + 0.085, kz);
      vase.castShadow = true;
      this.kitchenGroup.add(vase);

      const stemMat = new THREE.MeshStandardMaterial({ color: 0x5d6e52, roughness: 0.7 });
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), stemMat);
        leaf.scale.set(0.7, 1.3, 0.6);
        leaf.position.set(kx + (i - 1) * 0.03, topY + 0.21 + i * 0.015, kz + (i % 2) * 0.02);
        leaf.rotation.z = (i - 1) * 0.25;
        leaf.castShadow = true;
        this.kitchenGroup.add(leaf);
      }
    }
  }

  buildDimensionGuides(startX, totalW, lowerH, lowerD, upperH, upperD, midwayH, sinkW, prepW, cookW, sideLen) {
    const halfW = totalW / 2;
    const offset = 0.16;

    const totalTopY = lowerH + midwayH + upperH + 0.08;
    this.createLine([-halfW, totalTopY, upperD], [halfW, totalTopY, upperD]);
    this.createLine([-halfW, totalTopY - 0.04, upperD], [-halfW, totalTopY + 0.04, upperD]);
    this.createLine([halfW, totalTopY - 0.04, upperD], [halfW, totalTopY + 0.04, upperD]);

    const dimY = 0.03;
    const dimZ = lowerD + offset;

    const x1 = startX;
    const x2 = startX + sinkW;
    const x3 = x2 + prepW;
    const x4 = x3 + cookW;

    this.createLine([x1, dimY, dimZ], [x4, dimY, dimZ]);
    [x1, x2, x3, x4].forEach(x => {
      this.createLine([x, 0, lowerD], [x, dimY + 0.04, dimZ]);
    });

    const rightX = halfW + offset;
    this.createLine([rightX, 0, lowerD], [rightX, lowerH, lowerD]);
    this.createLine([halfW, lowerH, lowerD], [rightX + 0.04, lowerH, lowerD]);

    const uBotY = lowerH + midwayH;
    const uTopY = uBotY + upperH;
    this.createLine([rightX, uBotY, upperD], [rightX, uTopY, upperD]);
    this.createLine([halfW, uBotY, upperD], [rightX + 0.04, uBotY, upperD]);
    this.createLine([halfW, uTopY, upperD], [rightX + 0.04, uTopY, upperD]);

    if ((this.spec.layoutType === 'l_left' || this.spec.layoutType === 'l_right') && sideLen > lowerD) {
      const wx = this.spec.layoutType === 'l_left' ? (-halfW - offset) : (halfW + offset);
      this.createLine([wx, 0.03, 0], [wx, 0.03, sideLen]);
    }
  }

  createLine(p1, p2) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p1), new THREE.Vector3(...p2)]);
    const line = new THREE.Line(geo, this.dimLineMat);
    line.visible = this.spec.showDimensions;
    this.scene.add(line);
    this.dimensionLines.push(line);
  }

  updateDimensionBadges() {
    if (!this.spec.showDimensions || !this.overlay) {
      Object.values(this.dimBadges).forEach(b => b.style.display = 'none');
      return;
    }

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
    const offset = 0.16;
    const isL = this.spec.layoutType === 'l_left' || this.spec.layoutType === 'l_right';

    this.dimBadges.totalW.innerText = `전체 폭: ${this.spec.totalWidth.toLocaleString()}mm`;
    this.dimBadges.sinkW.innerText = `개수대 ${this.spec.sinkBayWidth}mm`;
    this.dimBadges.prepW.innerText = `조리대 ${this.spec.prepBayWidth}mm`;
    this.dimBadges.cookW.innerText = `가열대 ${this.spec.cooktopBayWidth}mm`;
    this.dimBadges.lowerH.innerText = `하부 H:${this.spec.lowerHeight}`;
    this.dimBadges.upperH.innerText = `상부 H:${this.spec.upperHeight}`;
    this.dimBadges.depth.innerText = `깊이 D:${this.spec.lowerDepth}`;
    this.dimBadges.wingLen.innerText = `세로 ${this.spec.sideLength.toLocaleString()}mm`;

    const wingX = this.spec.layoutType === 'l_left' ? (startX + lowerD / 2) : (totalW / 2 - lowerD / 2);

    const points = {
      totalW: new THREE.Vector3(0, lowerH + midwayH + upperH + 0.1, upperD),
      sinkW: new THREE.Vector3(startX + sinkW / 2, 0.05, lowerD + offset),
      prepW: new THREE.Vector3(startX + sinkW + prepW / 2, 0.05, lowerD + offset),
      cookW: new THREE.Vector3(startX + sinkW + prepW + cookW / 2, 0.05, lowerD + offset),
      lowerH: new THREE.Vector3(totalW / 2 + offset, lowerH / 2, lowerD),
      upperH: new THREE.Vector3(totalW / 2 + offset, lowerH + midwayH + upperH / 2, upperD),
      depth: new THREE.Vector3(totalW / 2 + offset, 0.05, lowerD / 2),
      wingLen: new THREE.Vector3(wingX, lowerH + 0.06, sideLen)
    };

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    for (const key of Object.keys(this.dimBadges)) {
      if (key === 'wingLen' && !isL) {
        this.dimBadges[key].style.display = 'none';
        continue;
      }
      if (key === 'upperH' && !this.spec.hasUpperCabinets) {
        this.dimBadges[key].style.display = 'none';
        continue;
      }
      const pos = points[key].clone().project(this.camera);
      if (pos.z > 1.0) {
        this.dimBadges[key].style.display = 'none';
        continue;
      }
      this.dimBadges[key].style.display = 'block';
      this.dimBadges[key].style.left = `${(pos.x * 0.5 + 0.5) * w}px`;
      this.dimBadges[key].style.top = `${(-(pos.y * 0.5) + 0.5) * h}px`;
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
      'layoutType', 'sideLength', 'wingHasUpper',
      'totalWidth', 'ceilingHeight', 'lowerHeight', 'lowerDepth', 'sinkBayWidth', 'prepBayWidth', 'cooktopBayWidth',
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
    this.dimensionLines.forEach(l => l.visible = this.spec.showDimensions);
    return this.spec.showDimensions;
  }

  captureImage(resolutionMultiplier = 2) {
    const origRatio = this.renderer.getPixelRatio();
    const prevDim = this.spec.showDimensions;
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
