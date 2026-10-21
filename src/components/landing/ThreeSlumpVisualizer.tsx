import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  Play, 
  RotateCcw, 
  Layers, 
  Activity, 
  Eye, 
  Info,
  CheckCircle2,
  Ruler,
  Maximize2,
  Gauge,
  HelpCircle,
  Sliders
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface ThreeSlumpVisualizerProps {
  language: 'fa' | 'en';
}

type SlumpMode = 'true' | 'shear' | 'collapse';

export const ThreeSlumpVisualizer: React.FC<ThreeSlumpVisualizerProps> = ({ language }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interactive slump test states
  const [targetSlumpMm, setTargetSlumpMm] = useState<number>(120); // 120 mm = 12 cm
  const [currentSlumpMm, setCurrentSlumpMm] = useState<number>(0);
  const [isLifting, setIsLifting] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [slumpMode, setSlumpMode] = useState<SlumpMode>('true');
  const [showDimensions, setShowDimensions] = useState<boolean>(true);

  // Overlay screen coordinates for on-figure annotations
  const [coords, setCoords] = useState({
    coneTop: { x: 0, y: 0, visible: false },
    coneBottom: { x: 0, y: 0, visible: false },
    concreteTop: { x: 0, y: 0, visible: false },
    slumpArrowMid: { x: 0, y: 0, visible: false },
    rulerBase: { x: 0, y: 0, visible: false },
    rulerTop: { x: 0, y: 0, visible: false }
  });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const coneMeshRef = useRef<THREE.Mesh | null>(null);
  const concreteMeshRef = useRef<THREE.Mesh | null>(null);
  const rulerGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const isFa = language === 'fa';

  // Scientific Consistency Class (EN 206 / ISIRI 3203 / ACI 211)
  const getConsistencyClass = (slumpMm: number) => {
    if (slumpMm <= 40) return { 
      code: 'S1', 
      nameFa: 'بسیار سفت (Vibro-Dense)', 
      descFa: 'بتن متراکم غلطکی، دال‌های سنگین و جداول پیش‌ساخته (تراکم با ویبراتور قوی)', 
      descEn: 'Very Dry / Pavements & Roller Compacted Concrete' 
    };
    if (slumpMm <= 90) return { 
      code: 'S2', 
      nameFa: 'سفت و نیمه‌روان (Semi-Plastic)', 
      descFa: 'فونداسیون‌های حجیم، کف‌سازی‌های صنعتی و بتن‌ریزی بدون پمپ', 
      descEn: 'Semi-Plastic / Plain Concrete Foundations' 
    };
    if (slumpMm <= 150) return { 
      code: 'S3', 
      nameFa: 'روانی متوسط سازه‌ای (Standard Plastic)', 
      descFa: 'متداول‌ترین رده برای سازه‌های بتن‌آرمه، تیر، ستون، سقف دال و فونداسیون نواری', 
      descEn: 'Plastic Standard / Beams, Columns, Slabs' 
    };
    if (slumpMm <= 210) return { 
      code: 'S4', 
      nameFa: 'بسیار روان با فوق‌روان‌کننده (High Flow)', 
      descFa: 'پمپاژ بلندمرتبه، دیوارهای برشی متراکم از میلگرد، شمع‌های درجا و مقاطع پرتراکم', 
      descEn: 'Fluid / Long Distance Pumping & Dense Reinforcement' 
    };
    return { 
      code: 'S5', 
      nameFa: 'روانی بسیار بالا / خودتراکم (SCC)', 
      descFa: 'بتن پرسیلان یا خودتراکم شونده بدون نیاز به ویبراتور (Self-Compacting)', 
      descEn: 'Very High Flow / Self Consolidating Concrete' 
    };
  };

  const consistency = getConsistencyClass(targetSlumpMm);

  // 3D Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = container.clientWidth;
    const height = container.clientHeight || 400;
    
    // Ortho-perspective calibrated for ASTM inspection viewing angle
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.85, 2.2);
    camera.lookAt(0, 0.32, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Realistic Lab Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.6);
    dirLight1.position.set(3, 7, 4);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa5f3fc, 0.9);
    dirLight2.position.set(-3, 4, -2);
    scene.add(dirLight2);

    // 1. ASTM C143 Heavy Galvanized Base Plate (600x600 mm, thickness 4mm)
    const basePlateGeo = new THREE.BoxGeometry(1.3, 0.02, 1.3);
    const basePlateMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.25
    });
    const basePlate = new THREE.Mesh(basePlateGeo, basePlateMat);
    basePlate.position.y = -0.01;
    basePlate.receiveShadow = true;
    scene.add(basePlate);

    // Foot clamps on baseplate
    const clampMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const clamp1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), clampMat);
    clamp1.position.set(0.24, 0.01, 0);
    scene.add(clamp1);
    const clamp2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), clampMat);
    clamp2.position.set(-0.24, 0.01, 0);
    scene.add(clamp2);

    // 2. Standard Abram's Cone Mold (Top Ø100mm, Bottom Ø200mm, Height 300mm)
    // Scale: 300mm = 0.60 units height (0.10 top radius, 0.20 bottom radius)
    const coneHeight = 0.60;
    const coneTopR = 0.10;
    const coneBottomR = 0.20;

    const coneGeo = new THREE.CylinderGeometry(coneTopR, coneBottomR, coneHeight, 48, 1, true);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.92,
      roughness: 0.18,
      side: THREE.DoubleSide
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.y = coneHeight / 2;
    coneMesh.castShadow = true;
    scene.add(coneMesh);
    coneMeshRef.current = coneMesh;

    // Handles on Cone (Fixed handles for lifting)
    const handleGeo = new THREE.TorusGeometry(0.045, 0.007, 8, 24, Math.PI);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    const handle1 = new THREE.Mesh(handleGeo, handleMat);
    handle1.position.set(0.165, 0.05, 0);
    handle1.rotation.z = -Math.PI / 2;
    coneMesh.add(handle1);
    const handle2 = new THREE.Mesh(handleGeo, handleMat);
    handle2.position.set(-0.165, 0.05, 0);
    handle2.rotation.z = Math.PI / 2;
    coneMesh.add(handle2);

    // Foot pieces on bottom of cone
    const footMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const foot1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.05), footMat);
    foot1.position.set(0.22, -coneHeight / 2 + 0.005, 0);
    coneMesh.add(foot1);
    const foot2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.05), footMat);
    foot2.position.set(-0.22, -coneHeight / 2 + 0.005, 0);
    coneMesh.add(foot2);

    // 3. Concrete Sample Inside (Fresh Wet Concrete)
    const concreteGeo = new THREE.CylinderGeometry(coneTopR - 0.002, coneBottomR - 0.002, coneHeight - 0.005, 36, 16);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // Aggregated cementitious grey
      roughness: 0.94,
      metalness: 0.06
    });
    const concreteMesh = new THREE.Mesh(concreteGeo, concreteMat);
    concreteMesh.position.y = (coneHeight - 0.005) / 2;
    concreteMesh.castShadow = true;
    concreteMesh.receiveShadow = true;
    scene.add(concreteMesh);
    concreteMeshRef.current = concreteMesh;

    // 4. Standard ASTM C143 Steel Tamping Rod & Reference Ruler Assembly
    const rulerGroup = new THREE.Group();
    rulerGroup.position.set(0.38, 0, 0);

    // Graduated Millimeter Steel Rule (0 to 300 mm)
    const rulerBodyGeo = new THREE.BoxGeometry(0.03, 0.64, 0.006);
    const rulerBodyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15
    });
    const rulerBody = new THREE.Mesh(rulerBodyGeo, rulerBodyMat);
    rulerBody.position.y = 0.32;
    rulerGroup.add(rulerBody);

    // Measurement ticks on ruler
    for (let i = 0; i <= 30; i += 2) {
      const isMajor = i % 10 === 0;
      const tickGeo = new THREE.BoxGeometry(isMajor ? 0.024 : 0.014, 0.002, 0.007);
      const tickMat = new THREE.MeshBasicMaterial({ color: isMajor ? 0x000000 : 0x475569 });
      const tick = new THREE.Mesh(tickGeo, tickMat);
      // Height proportional to 300mm = 0.60m
      tick.position.set(0, (i / 30) * 0.60, 0.001);
      rulerGroup.add(tick);
    }

    // Reference Horizontal Rod spanning across cone peak (placed atop inverted cone per ASTM)
    const rodGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.60, 16);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });
    const crossRod = new THREE.Mesh(rodGeo, rodMat);
    crossRod.rotation.z = Math.PI / 2;
    crossRod.position.set(-0.38, 0.60, 0); // At exact 300mm mold height
    rulerGroup.add(crossRod);

    scene.add(rulerGroup);
    rulerGroupRef.current = rulerGroup;

    // Interactive Drag to Rotate Camera Orbit
    let isDragging = false;
    let prevX = 0;
    let rotY = 0;

    const onMouseDown = (e: MouseEvent) => { 
      isDragging = true; 
      prevX = e.clientX; 
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      rotY += dx * 0.007;
    };
    const onMouseUp = () => { isDragging = false; };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Vector for Projecting 3D Points to 2D HTML Coordinates
    const projectPoint = (vec3: THREE.Vector3) => {
      if (!mountRef.current) return { x: 0, y: 0, visible: false };
      const v = vec3.clone().applyMatrix4(scene.matrixWorld).project(camera);
      const hw = width / 2;
      const hh = height / 2;
      return {
        x: v.x * hw + hw,
        y: -(v.y * hh) + hh,
        visible: v.z < 1
      };
    };

    let isVisible = true;
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(container);

    let lastRotY = -999;
    let lastHeight = -999;

    // Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      if (!isVisible) return;

      const deltaRot = Math.abs(rotY - scene.rotation.y);
      if (deltaRot > 0.0001) {
        scene.rotation.y += (rotY - scene.rotation.y) * 0.1;
      }
      renderer.render(scene, camera);

      // Project Key Dimension Coordinates for the on-figure HUD only when changed
      const currentH = concreteMeshRef.current ? 0.60 * concreteMeshRef.current.scale.y : 0.60;
      if (Math.abs(scene.rotation.y - lastRotY) > 0.002 || Math.abs(currentH - lastHeight) > 0.002) {
        lastRotY = scene.rotation.y;
        lastHeight = currentH;

        const topConePos = new THREE.Vector3(0, 0.60, 0);
        const bottomConePos = new THREE.Vector3(0.20, 0.01, 0);
        const concreteTopPos = new THREE.Vector3(0, currentH, 0);
        const slumpArrowPos = new THREE.Vector3(-0.06, (0.60 + currentH) / 2, 0);
        const rulerBasePos = new THREE.Vector3(0.38, 0.01, 0);
        const rulerTopPos = new THREE.Vector3(0.38, 0.60, 0);

        setCoords({
          coneTop: projectPoint(topConePos),
          coneBottom: projectPoint(bottomConePos),
          concreteTop: projectPoint(concreteTopPos),
          slumpArrowMid: projectPoint(slumpArrowPos),
          rulerBase: projectPoint(rulerBasePos),
          rulerTop: projectPoint(rulerTopPos)
        });
      }
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      observer.disconnect();
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Scientific Physics Simulation: Lifting Cone & Subsidence Dynamics
  useEffect(() => {
    let interval: any = null;

    if (isLifting && !isCompleted) {
      let progress = 0;
      interval = setInterval(() => {
        progress += 0.025;
        
        // 1. Lift Cone upward (ASTM specifies 5±2 seconds smooth vertical lift)
        if (coneMeshRef.current) {
          coneMeshRef.current.position.y = 0.30 + progress * 0.85;
          coneMeshRef.current.position.z = progress * 0.15;
        }

        // 2. Calculate Scientific Subsidence (True vs Shear vs Collapse)
        if (concreteMeshRef.current) {
          const ratio = (targetSlumpMm / 300) * Math.min(1, progress * 1.35);
          
          if (slumpMode === 'true') {
            // True slump: symmetrical subsidence, base expansion
            const heightFactor = 1 - ratio * 0.88;
            const spreadFactor = 1 + ratio * 0.70;
            concreteMeshRef.current.scale.set(spreadFactor, heightFactor, spreadFactor);
            concreteMeshRef.current.position.y = (0.60 * heightFactor) / 2;
            concreteMeshRef.current.rotation.z = 0;
          } else if (slumpMode === 'shear') {
            // Shear slump: one side slides diagonally
            const heightFactor = 1 - ratio * 0.90;
            const spreadFactor = 1 + ratio * 0.65;
            concreteMeshRef.current.scale.set(spreadFactor, heightFactor, spreadFactor);
            concreteMeshRef.current.position.y = (0.60 * heightFactor) / 2;
            concreteMeshRef.current.rotation.z = progress * 0.12; // asymmetric tilt
          } else {
            // Collapse slump: total flat spread
            const heightFactor = Math.max(0.12, 1 - ratio * 0.96);
            const spreadFactor = 1 + ratio * 1.25;
            concreteMeshRef.current.scale.set(spreadFactor, heightFactor, spreadFactor);
            concreteMeshRef.current.position.y = (0.60 * heightFactor) / 2;
            concreteMeshRef.current.rotation.z = 0;
          }

          const liveMm = Math.round(ratio * 300);
          setCurrentSlumpMm(Math.min(targetSlumpMm, liveMm));
        }

        if (progress >= 1.0) {
          setIsLifting(false);
          setIsCompleted(true);
          setCurrentSlumpMm(targetSlumpMm);
        }
      }, 35);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLifting, isCompleted, targetSlumpMm, slumpMode]);

  const handleStartLift = () => {
    handleReset();
    setIsLifting(true);
  };

  const handleReset = () => {
    setIsLifting(false);
    setIsCompleted(false);
    setCurrentSlumpMm(0);

    if (coneMeshRef.current) {
      coneMeshRef.current.position.set(0, 0.30, 0);
    }

    if (concreteMeshRef.current) {
      concreteMeshRef.current.scale.set(1, 1, 1);
      concreteMeshRef.current.position.set(0, 0.30, 0);
      concreteMeshRef.current.rotation.set(0, 0, 0);
    }
  };

  const remainingHeightMm = 300 - currentSlumpMm;

  return (
    <div 
      ref={containerRef}
      className="relative w-full rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-[#031522] border border-cyan-500/30 shadow-2xl overflow-hidden transition-all text-white"
    >
      {/* Header with Standards & Controls */}
      <div className="px-5 py-4 bg-slate-900/90 backdrop-blur-md border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-md shadow-teal-500/20 shrink-0">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              <span>{isFa ? 'شبیه‌ساز علمی آزمون اسلامپ مخروط آبرامز' : 'Scientific 3D Abram\'s Cone Slump Simulator'}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-[#00d2a0] border border-cyan-500/40">
                ASTM C143 / ISIRI 3203-1
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              {isFa ? 'اندازه‌گیری افت ارتفاع بتن با میله و خط‌کش استاندارد بر روی شکل' : 'On-figure scientific height displacement & slump readout'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              showDimensions 
                ? 'bg-[#00c49f] text-slate-950 border-emerald-300 shadow-sm' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="نمایش یا پنهان‌سازی اندازه‌گذاری روی شکل"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isFa ? 'نمایش مقادیر روی شکل' : 'On-Figure Overlay'}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="بازنشانی شبیه‌ساز"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Area with Absolute Overlaid Dimensions */}
      <div className="relative w-full h-[360px] sm:h-[400px]">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* ON-FIGURE SCIENTIFIC VALUE ANNOTATIONS (Directly on the 3D shape) */}
        {showDimensions && (
          <div className="absolute inset-0 pointer-events-none select-none">
            
            {/* 1. Reference Level Line (Tamping Rod at 300mm) */}
            <div 
              className="absolute flex items-center gap-2 transition-all duration-300"
              style={{
                top: `${coords.coneTop.y}px`,
                left: `${coords.coneTop.x - 110}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-400 text-[10px] font-mono font-bold text-cyan-300 shadow-lg flex items-center gap-1">
                <span>تراز مرجع قالب:</span>
                <span className="text-white" dir="ltr">{toPersianDigits(300)} mm (۳۰cm)</span>
              </div>
            </div>

            {/* 2. Abram's Top Diameter (Ø100mm) */}
            {!isLifting && !isCompleted && (
              <div 
                className="absolute transition-all duration-300"
                style={{
                  top: `${coords.coneTop.y - 25}px`,
                  left: `${coords.coneTop.x}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="px-2 py-0.5 rounded-md bg-slate-950/85 border border-slate-600 text-[10px] font-mono text-slate-200 shadow-md">
                  قطر دهانه بالا: <strong>۱۰۰ mm</strong> (۱۰cm)
                </div>
              </div>
            )}

            {/* 3. Abram's Bottom Diameter (Ø200mm) */}
            {!isLifting && !isCompleted && (
              <div 
                className="absolute transition-all duration-300"
                style={{
                  top: `${coords.coneBottom.y + 15}px`,
                  left: `${coords.coneBottom.x - 70}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="px-2 py-0.5 rounded-md bg-slate-950/85 border border-slate-600 text-[10px] font-mono text-slate-200 shadow-md">
                  قطر دهانه پایین: <strong>۲۰۰ mm</strong> (۲۰cm)
                </div>
              </div>
            )}

            {/* 4. Active Slump Measurement Arrow & Value ON FIGURE (Delta h) */}
            {currentSlumpMm > 0 && (
              <div 
                className="absolute transition-all duration-300 animate-in fade-in zoom-in-95"
                style={{
                  top: `${coords.slumpArrowMid.y}px`,
                  left: `${coords.slumpArrowMid.x - 65}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="p-2 rounded-xl bg-cyan-950/95 border-2 border-[#00c49f] text-start shadow-2xl backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#00d2a0]">
                    <span className="w-2 h-2 rounded-full bg-[#00c49f] animate-ping" />
                    <span>مقدار افت اسلامپ (Δh):</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black font-mono text-white" dir="ltr">
                      {toPersianDigits(currentSlumpMm)}
                    </span>
                    <span className="text-[11px] font-bold text-cyan-200">میلی‌متر</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ({toPersianDigits((currentSlumpMm / 10).toFixed(1))} cm)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Subsided Concrete Height Line (h = 300 - Slump) */}
            {currentSlumpMm > 0 && (
              <div 
                className="absolute transition-all duration-300"
                style={{
                  top: `${coords.concreteTop.y}px`,
                  left: `${coords.concreteTop.x + 95}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-300 shadow-md">
                  ارتفاع نهایی بتن (h): <strong className="text-cyan-400" dir="ltr">{toPersianDigits(remainingHeightMm)} mm</strong>
                </div>
              </div>
            )}

            {/* 6. Standard Graduated Steel Ruler Indicator */}
            <div 
              className="absolute transition-all duration-300"
              style={{
                top: `${coords.rulerTop.y - 20}px`,
                left: `${coords.rulerTop.x}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[9px] font-mono text-slate-300">
                خط‌کش مدرج ۳۰۰mm
              </div>
            </div>

          </div>
        )}

        {/* Top Left Information Card (Engineering & Standard Readout) */}
        <div className="absolute top-4 start-4 z-10 max-w-[280px]">
          <div className="p-3.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 shadow-2xl space-y-2">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[11px] font-bold text-slate-400">رده روانی بتن (EN 206):</span>
              <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-[#00d2a0] border border-teal-500/40 text-xs font-black font-mono">
                {consistency.code}
              </span>
            </div>

            <div>
              <span className="text-xs font-black text-white block">
                {consistency.nameFa}
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                {consistency.descFa}
              </p>
            </div>

            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">نوع اسلامپ علمی:</span>
              <span className="font-bold text-cyan-300">
                {slumpMode === 'true' ? 'اسلامپ واقعی (True Slump)' : slumpMode === 'shear' ? 'اسلامپ برشی (Shear)' : 'فروریختگی (Collapse)'}
              </span>
            </div>

          </div>
        </div>

        {/* Floating Instruction Banner */}
        <div className="absolute bottom-3 start-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-3.5 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 backdrop-blur-md flex items-center gap-1.5">
            <Maximize2 className="w-3 h-3 text-cyan-400" />
            <span>جهت چرخش نمای سه‌بعدی، موس یا انگشت خود را روی تصویر بکشید</span>
          </div>
        </div>

      </div>

      {/* Control Panel: Slump Mode + Slider + Lift Action */}
      <div className="p-4 sm:p-5 bg-slate-900/95 backdrop-blur-md border-t border-cyan-500/20 space-y-4">
        
        {/* Slump Failure Mode Selector (Scientific ASTM Categories) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300 text-[11px]">حالت رفتار بتن:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => { setSlumpMode('true'); handleReset(); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  slumpMode === 'true' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                اسلامپ واقعی (True)
              </button>
              <button
                onClick={() => { setSlumpMode('shear'); handleReset(); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  slumpMode === 'shear' 
                    ? 'bg-amber-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="لغزش برشی به دلیل عدم چسبندگی یا دانه‌بندی نامناسب"
              >
                برشی (Shear)
              </button>
              <button
                onClick={() => { setSlumpMode('collapse'); handleReset(); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  slumpMode === 'collapse' 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="فروریختگی کامل بتن بسیار روان یا آب بیش از حد"
              >
                فروریختگی (Collapse)
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            استاندارد نمونه‌گیری: <strong className="text-slate-200">۳ لایه، هر لایه ۲۵ ضربه با میله سرگرد</strong>
          </div>
        </div>

        {/* Slider & Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
          
          {/* Slider with Exact Millimeter and Centimeter Readout */}
          <div className="flex-1 flex items-center gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <span className="text-xs font-bold text-slate-300 shrink-0">
              تنظیم اسلامپ هدف (Δh):
            </span>
            <input
              type="range"
              min="20"
              max="240"
              step="10"
              value={targetSlumpMm}
              onChange={(e) => { 
                setTargetSlumpMm(Number(e.target.value)); 
                handleReset(); 
              }}
              className="flex-1 accent-[#00c49f] cursor-pointer"
            />
            <div className="text-end shrink-0 font-mono">
              <span className="text-base font-black text-[#00d2a0]" dir="ltr">
                {toPersianDigits(targetSlumpMm)}
              </span>
              <span className="text-[11px] font-bold text-slate-400 mr-1">mm</span>
              <span className="text-xs font-bold text-slate-500 mr-1">
                ({toPersianDigits((targetSlumpMm / 10).toFixed(0))} cm)
              </span>
            </div>
          </div>

          {/* Action Lift Button */}
          <button
            onClick={handleStartLift}
            disabled={isLifting}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#00c49f] to-teal-400 hover:from-[#00b08e] hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{isLifting ? 'در حال بالا کشیدن قالب...' : 'بالا کشیدن قالب مخروط و اندازه‌گیری'}</span>
          </button>

        </div>

      </div>

    </div>
  );
};
