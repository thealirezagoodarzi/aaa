import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  Play, 
  RotateCcw, 
  Layers, 
  Activity, 
  Zap, 
  Sliders, 
  Maximize2, 
  Eye, 
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Info
} from 'lucide-react';

// Helper to generate a realistic concrete aggregate texture with laboratory stencil mark
const createConcreteTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base concrete grey with subtle gradation
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.5, '#8898aa');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Fine cement matrix pores & aggregate specks
    for (let i = 0; i < 7000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 2 + 0.5;
      const val = Math.floor(Math.random() * 70) + 110;
      ctx.fillStyle = `rgba(${val}, ${val + 2}, ${val + 6}, ${Math.random() * 0.35 + 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coarse aggregates (crushed gravel / sand particles)
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 3.5 + 1;
      const isDark = Math.random() > 0.45;
      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Concrete specimen stencil lab markings
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('C30 / 150mm #28D', 50, 255);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('CTL-LAB SPECIMEN (ISIRI 3206)', 50, 280);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

interface ThreeConcretePressProps {
  language: 'fa' | 'en';
}

export const ThreeConcretePress: React.FC<ThreeConcretePressProps> = ({ language }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // State for interactive simulation
  const [specimenType, setSpecimenType] = useState<'cube' | 'cylinder'>('cube');
  const [concreteGrade, setConcreteGrade] = useState<'C25' | 'C30' | 'C40' | 'C50' | 'C60'>('C30');
  const [targetMaxStrength, setTargetMaxStrength] = useState<number>(38.5); // MPa
  const [currentLoadKn, setCurrentLoadKn] = useState<number>(0);
  const [currentMpa, setCurrentMpa] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isBroken, setIsBroken] = useState<boolean>(false);
  const [failureMode, setFailureMode] = useState<string>('');
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [stressHeatmap, setStressHeatmap] = useState<boolean>(true);
  const [showSchematic, setShowSchematic] = useState<boolean>(true);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const specimenMeshRef = useRef<THREE.Mesh | null>(null);
  const pistonRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const loadStateRef = useRef<{ loadKn: number; isRunning: boolean; isBroken: boolean }>({
    loadKn: 0,
    isRunning: false,
    isBroken: false
  });

  // Calculate target failure load based on grade and specimen size
  const areaMm2 = specimenType === 'cube' ? (150 * 150) : (Math.PI * 75 * 75); // 22,500 mm2 or 17,671 mm2
  const maxStrengthMpa = {
    'C25': 28.5,
    'C30': 34.2,
    'C40': 45.8,
    'C50': 56.4,
    'C60': 68.0
  }[concreteGrade] || 35.0;

  const failureLoadKn = (maxStrengthMpa * areaMm2) / 1000;

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const width = container.clientWidth;
    const height = container.clientHeight || 450;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.2, 3.2);
    camera.lookAt(0, 0.4, 0);
    cameraRef.current = camera;

    // Renderer with transparent background
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dirLight1.position.set(5, 10, 7);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 1.2);
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x60a5fa, 2, 10);
    pointLight.position.set(0, 2, 2);
    scene.add(pointLight);

    // Machine Structure (Hydraulic Press Frame)
    const machineGroup = new THREE.Group();

    // Base plate (Heavy Steel)
    const baseGeo = new THREE.BoxGeometry(2.2, 0.25, 1.6);
    const baseMat = new THREE.MeshStandardMaterial({ 
      color: 0x1e293b, 
      metalness: 0.85, 
      roughness: 0.25 
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.125;
    baseMesh.receiveShadow = true;
    machineGroup.add(baseMesh);

    // Columns (4 Chrome Cylinders)
    const colGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.8, 32);
    const colMat = new THREE.MeshStandardMaterial({ 
      color: 0xe2e8f0, 
      metalness: 0.95, 
      roughness: 0.1 
    });

    const colPositions = [
      [-0.7, 0.8, -0.5],
      [0.7, 0.8, -0.5],
      [-0.7, 0.8, 0.5],
      [0.7, 0.8, 0.5],
    ];

    colPositions.forEach(([x, y, z]) => {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(x, y, z);
      col.castShadow = true;
      machineGroup.add(col);
    });

    // Upper Crosshead (Top Steel Block)
    const topGeo = new THREE.BoxGeometry(2.0, 0.3, 1.4);
    const topMat = new THREE.MeshStandardMaterial({ 
      color: 0x0f172a, 
      metalness: 0.9, 
      roughness: 0.2 
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.y = 1.65;
    topMesh.castShadow = true;
    machineGroup.add(topMesh);

    // Hydraulic Actuator Housing on Top (Rigid Box Column Housing)
    const hydCylGeo = new THREE.BoxGeometry(0.48, 0.4, 0.48);
    const hydCylMat = new THREE.MeshStandardMaterial({ 
      color: 0x1d4ed8, 
      metalness: 0.75, 
      roughness: 0.25 
    });
    const hydCyl = new THREE.Mesh(hydCylGeo, hydCylMat);
    hydCyl.position.y = 1.35;
    machineGroup.add(hydCyl);

    // Piston & Upper Platen Group (Moves downward on load)
    const pistonGroup = new THREE.Group();
    pistonGroup.position.y = 1.15;
    pistonRef.current = pistonGroup;

    const pistonRodGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 32);
    const pistonRodMat = new THREE.MeshStandardMaterial({ 
      color: 0xf8fafc, 
      metalness: 0.98, 
      roughness: 0.05 
    });
    const pistonRod = new THREE.Mesh(pistonRodGeo, pistonRodMat);
    pistonRod.position.y = 0.15;
    pistonGroup.add(pistonRod);

    // Upper Bearing Platen (Square heavy hardened steel plate for standard 150mm cubes)
    const platenGeo = new THREE.BoxGeometry(0.72, 0.09, 0.72);
    const platenMat = new THREE.MeshStandardMaterial({ 
      color: 0x334155, 
      metalness: 0.9, 
      roughness: 0.15 
    });
    const platenMesh = new THREE.Mesh(platenGeo, platenMat);
    platenMesh.position.y = 0;
    platenMesh.castShadow = true;
    pistonGroup.add(platenMesh);

    machineGroup.add(pistonGroup);

    // Lower Platen (Fixed square heavy base plate for 150mm cube specimen)
    const lowerPlatenGeo = new THREE.BoxGeometry(0.76, 0.09, 0.76);
    const lowerPlaten = new THREE.Mesh(lowerPlatenGeo, platenMat);
    lowerPlaten.position.y = 0.045;
    lowerPlaten.receiveShadow = true;
    machineGroup.add(lowerPlaten);

    // Digital Load Cell & Indicator Ring
    const ringGeo = new THREE.TorusGeometry(0.26, 0.02, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
    const loadRing = new THREE.Mesh(ringGeo, ringMat);
    loadRing.rotation.x = Math.PI / 2;
    loadRing.position.y = 1.16;
    machineGroup.add(loadRing);

    scene.add(machineGroup);

    // Floor Grid
    const gridHelper = new THREE.GridHelper(6, 12, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -0.26;
    scene.add(gridHelper);

    // Fracture Particle System
    const particleCount = 250;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleVels = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 0.4;
      particlePos[i * 3 + 1] = 0.35 + (Math.random() - 0.5) * 0.3;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

      particleVels[i * 3] = (Math.random() - 0.5) * 0.08;
      particleVels[i * 3 + 1] = Math.random() * 0.08;
      particleVels[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.035,
      transparent: true,
      opacity: 0
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // Mouse Interaction (Orbiting)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = 0;
    let targetRotationX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetRotationY += deltaX * 0.008;
      targetRotationX = Math.max(-0.4, Math.min(0.6, targetRotationX + deltaY * 0.008));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Touch events for mobile
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
      targetRotationY += deltaX * 0.008;
      targetRotationX = Math.max(-0.4, Math.min(0.6, targetRotationX + deltaY * 0.008));
    };
    const onTouchEnd = () => {
      isDragging = false;
    };

    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    dom.addEventListener('touchmove', onTouchMove, { passive: true });
    dom.addEventListener('touchend', onTouchEnd);

    // Render / Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Smooth camera orbit
      machineGroup.rotation.y += (targetRotationY - machineGroup.rotation.y) * 0.08;
      camera.position.y = 1.2 + targetRotationX;
      camera.lookAt(0, 0.45, 0);

      // Render
      renderer.render(scene, camera);
    };

    animate();

    // Window Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update Concrete Specimen Mesh when type/grade/wireframe/fracture changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old specimen
    if (specimenMeshRef.current) {
      scene.remove(specimenMeshRef.current);
      specimenMeshRef.current.geometry.dispose();
      (specimenMeshRef.current.material as THREE.Material).dispose();
      specimenMeshRef.current = null;
    }

    let geometry: THREE.BufferGeometry;
    const height = 0.55;

    if (specimenType === 'cube') {
      // 150x150 mm standard cube in 3D scale (0.55 x 0.55 x 0.55)
      geometry = new THREE.BoxGeometry(0.55, height, 0.55, 12, 12, 12);
    } else {
      // 150x300 mm cylinder (radius 0.27, height 0.65)
      geometry = new THREE.CylinderGeometry(0.27, 0.27, 0.65, 32, 16);
    }

    // Concrete Shader Material with Procedural Aggregate & Stress Heatmap
    const concreteMap = specimenType === 'cube' ? createConcreteTexture() : null;
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Tint with white so texture displays natural colors
      map: concreteMap,
      roughness: 0.88,
      metalness: 0.05,
      wireframe: wireframeMode,
      flatShading: isBroken
    });

    const specimenMesh = new THREE.Mesh(geometry, material);
    specimenMesh.position.y = specimenType === 'cube' ? 0.355 : 0.405;
    specimenMesh.castShadow = true;
    specimenMesh.receiveShadow = true;

    scene.add(specimenMesh);
    specimenMeshRef.current = specimenMesh;

    // Set initial position of upper piston to touch specimen top
    if (pistonRef.current) {
      const specimenTopY = specimenMesh.position.y + (specimenType === 'cube' ? 0.275 : 0.325);
      pistonRef.current.position.y = specimenTopY;
    }
  }, [specimenType, wireframeMode]);

  // Simulation Step / Hydraulic Press Running Loop
  useEffect(() => {
    loadStateRef.current = { loadKn: currentLoadKn, isRunning, isBroken };
  }, [currentLoadKn, isRunning, isBroken]);

  useEffect(() => {
    let interval: any = null;

    if (isRunning && !isBroken) {
      interval = setInterval(() => {
        setCurrentLoadKn(prev => {
          const step = failureLoadKn / 140; // 5-7 seconds test simulation
          const nextVal = prev + step;
          const currentMpaCalc = (nextVal * 1000) / areaMm2;
          setCurrentMpa(Number(currentMpaCalc.toFixed(2)));

          // Update specimen stress color / deformation
          if (specimenMeshRef.current && stressHeatmap) {
            const ratio = Math.min(1, nextVal / failureLoadKn);
            const mat = specimenMeshRef.current.material as THREE.MeshStandardMaterial;
            
            // Color shifts from standard concrete grey to stress glow (blue -> yellow -> red)
            if (ratio < 0.5) {
              mat.color.setRGB(0.58 + ratio * 0.1, 0.64 - ratio * 0.2, 0.72 - ratio * 0.4);
            } else if (ratio < 0.85) {
              mat.color.setRGB(0.85 + (ratio - 0.5) * 0.2, 0.60 - (ratio - 0.5) * 0.6, 0.2);
            } else {
              mat.color.setRGB(0.98, 0.25, 0.15); // High stress red
            }

            // Micro-compression deformation on Y axis
            specimenMeshRef.current.scale.y = 1 - ratio * 0.04;
            specimenMeshRef.current.scale.x = 1 + ratio * 0.03;
            specimenMeshRef.current.scale.z = 1 + ratio * 0.03;

            // Move hydraulic piston down slightly
            if (pistonRef.current) {
              const baseTop = specimenMeshRef.current.position.y + (specimenType === 'cube' ? 0.275 : 0.325);
              pistonRef.current.position.y = baseTop * (1 - ratio * 0.04);
            }
          }

          // Trigger Failure / Fracture
          if (nextVal >= failureLoadKn) {
            setIsRunning(false);
            setIsBroken(true);
            setFailureMode(
              specimenType === 'cube'
                ? (language === 'fa' ? 'شکست دو هرمی متقارن استاندارد (Hourglass / Semi-Pyramidal Shear)' : 'Standard Hourglass / Semi-Pyramidal Shear')
                : (language === 'fa' ? 'شکست برشی مخروطی (Cone & Split Failure ASTM C39)' : 'Cone & Split Failure ASTM C39')
            );

            // Deform mesh aggressively to show fractured state
            if (specimenMeshRef.current) {
              const mat = specimenMeshRef.current.material as THREE.MeshStandardMaterial;
              mat.color.setHex(0x71717a);
              mat.wireframe = false;
              specimenMeshRef.current.rotation.z = 0.035;
              specimenMeshRef.current.rotation.x = -0.02;
              specimenMeshRef.current.scale.set(1.08, 0.88, 1.08);
            }

            // Activate dust / particle burst
            if (particlesRef.current) {
              (particlesRef.current.material as THREE.PointsMaterial).opacity = 0.9;
              setTimeout(() => {
                if (particlesRef.current) {
                  (particlesRef.current.material as THREE.PointsMaterial).opacity = 0;
                }
              }, 1200);
            }

            return failureLoadKn;
          }

          return nextVal;
        });
      }, 40);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isBroken, failureLoadKn, areaMm2, stressHeatmap, specimenType, language]);

  const handleStart = () => {
    if (isBroken) handleReset();
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsBroken(false);
    setCurrentLoadKn(0);
    setCurrentMpa(0);
    setFailureMode('');

    if (specimenMeshRef.current) {
      const mat = specimenMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x94a3b8);
      mat.wireframe = wireframeMode;
      specimenMeshRef.current.rotation.set(0, 0, 0);
      specimenMeshRef.current.scale.set(1, 1, 1);
    }

    if (pistonRef.current && specimenMeshRef.current) {
      const baseTop = specimenMeshRef.current.position.y + (specimenType === 'cube' ? 0.275 : 0.325);
      pistonRef.current.position.y = baseTop;
    }
  };

  return (
    <div className="relative w-full rounded-3xl bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
      
      {/* Top HUD Bar */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 sm:px-6 py-3.5 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'شبیه‌ساز سه‌بعدی جک هیدرولیکی ۲۰۰۰ kN' : '3D Hydraulic Press 2000 kN Digital Station'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                WebGL 3D
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              {language === 'fa' 
                ? 'محاسبه هم‌زمان تنش و کرنش بر اساس استاندارد ASTM C39 و ISIRI 3206' 
                : 'Real-time Stress-Strain simulation under ASTM C39 & EN 12390-3'}
            </p>
          </div>
        </div>

        {/* Specimen Switcher & Wireframe Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => { setSpecimenType('cube'); handleReset(); }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                specimenType === 'cube' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {language === 'fa' ? 'مکعب ۱۵۰mm' : 'Cube 150mm'}
            </button>
            <button
              onClick={() => { setSpecimenType('cylinder'); handleReset(); }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                specimenType === 'cylinder' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {language === 'fa' ? 'استوانه ۱۵۰×۳۰۰' : 'Cylinder Ø150'}
            </button>
          </div>

          <button
            onClick={() => setShowSchematic(!showSchematic)}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
              showSchematic 
                ? 'bg-blue-50 dark:bg-blue-600/30 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs' 
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="شماتیک فنی اجزا"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{language === 'fa' ? 'شماتیک قطعات' : 'Schematic'}</span>
          </button>

          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              wireframeMode 
                ? 'bg-indigo-50 dark:bg-indigo-600/30 border-indigo-300 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300' 
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Wireframe Structure"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div 
        ref={mountRef} 
        className="w-full h-[460px] sm:h-[500px] cursor-grab active:cursor-grabbing relative"
      />

      {/* Floating Schematic Callouts */}
      {showSchematic && (
        <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
          {/* Top Platen Callout */}
          <div className="absolute top-[28%] end-[12%] sm:end-[22%] animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 ring-4 ring-cyan-500/30 animate-pulse" />
              <div className="h-[1px] w-8 bg-cyan-500/80" />
              <div className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-cyan-400/60 dark:border-cyan-500/40 text-[10px] font-bold text-cyan-800 dark:text-cyan-300 shadow-md">
                {language === 'fa' ? 'نشیمنگاه کروی خودتراز و فک صلب بالایی' : 'Spherical Seating & Upper Platen'}
              </div>
            </div>
          </div>

          {/* Specimen Cube Callout */}
          <div className="absolute top-[48%] end-[8%] sm:end-[18%] animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/30 animate-pulse" />
              <div className="h-[1px] w-10 bg-emerald-500/80" />
              <div className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-emerald-400/60 dark:border-emerald-500/40 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 shadow-md">
                {specimenType === 'cube' 
                  ? (language === 'fa' ? 'نمونه مکعب استاندارد ۱۵۰×۱۵۰mm (ISIRI 3206)' : 'Standard 150mm Cube (EN 12390-3)')
                  : (language === 'fa' ? 'نمونه استوانه استاندارد Ø150×300mm' : 'Cylinder Specimen (ASTM C39)')}
              </div>
            </div>
          </div>

          {/* Load Cell Ring Callout */}
          <div className="absolute top-[22%] start-[10%] sm:start-[20%] animate-in fade-in duration-300">
            <div className="flex items-center gap-2 flex-row-reverse">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/30 animate-pulse" />
              <div className="h-[1px] w-8 bg-blue-500/80" />
              <div className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-blue-400/60 dark:border-blue-500/40 text-[10px] font-bold text-blue-800 dark:text-blue-300 shadow-md">
                {language === 'fa' ? 'حلقه لودسل دیجیتال ۲۰۰۰ kN (کلاس ۰.۵)' : '2000 kN Digital Load Cell Ring'}
              </div>
            </div>
          </div>

          {/* Lower Hydraulic Platen Callout */}
          <div className="absolute top-[66%] start-[12%] sm:start-[22%] animate-in fade-in duration-300">
            <div className="flex items-center gap-2 flex-row-reverse">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/30 animate-pulse" />
              <div className="h-[1px] w-8 bg-indigo-500/80" />
              <div className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-indigo-400/60 dark:border-indigo-500/40 text-[10px] font-bold text-indigo-800 dark:text-indigo-300 shadow-md">
                {language === 'fa' ? 'فک زیرین و جک هیدرولیکی دوطرفه' : 'Lower Platen & Hydraulic Ram'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Interactive Digital Gauge & Stress Telemetry */}
      <div className="absolute top-20 start-4 sm:start-6 z-20 pointer-events-none max-w-xs space-y-2.5">
        
        {/* Real-time Digital Load Cell Box */}
        <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-xl pointer-events-auto">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
            <span>{language === 'fa' ? 'بار هیدرولیکی اعمالی' : 'Applied Hydraulic Load'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-blue-600 dark:text-cyan-400 tracking-tight">
              {(currentLoadKn || 0).toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">kN</span>
          </div>

          {/* Real-time MPa Strength Gauge */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {language === 'fa' ? 'مقاومت فشاری محاسباتی' : 'Calculated Strength'}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {(currentMpa || 0).toFixed(2)} <span className="text-xs text-slate-500 dark:text-slate-300 font-sans">MPa (N/mm²)</span>
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                {failureLoadKn > 0 ? (((currentLoadKn || 0) / failureLoadKn) * 100).toFixed(0) : '0'}%
              </span>
            </div>

            {/* Progress Bar with Stress Gradient */}
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500 transition-all duration-75"
                style={{ width: `${failureLoadKn > 0 ? Math.min(100, ((currentLoadKn || 0) / failureLoadKn) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Failure Mode Banner */}
        {isBroken && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/90 border border-rose-200 dark:border-rose-600/60 shadow-xl text-rose-900 dark:text-rose-200 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{language === 'fa' ? 'شکست نهایی نمونه (Peak Failure)' : 'Specimen Ultimate Fracture'}</span>
            </div>
            <p className="text-[11px] text-rose-800 dark:text-rose-100/90 leading-tight">
              {failureMode}
            </p>
            <div className="mt-2 pt-1.5 border-t border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-[11px]">
              <span>{language === 'fa' ? 'مقاومت نهایی:' : 'Peak Strength:'}</span>
              <span className="font-bold font-mono text-rose-900 dark:text-white">{(maxStrengthMpa || 0).toFixed(1)} MPa</span>
            </div>
          </div>
        )}

      </div>

      {/* 3D Interaction Hint & Real-time Stress-Strain Curve */}
      <div className="absolute top-20 end-4 sm:end-6 z-20 hidden md:flex flex-col items-end gap-3 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 shadow-sm">
          <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{language === 'fa' ? 'چرخش ۳۶۰ درجه با موس یا لمس' : 'Drag to Rotate 360°'}</span>
        </div>

        {/* Real-time Stress-Strain SVG Curve */}
        <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl w-60 text-start pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
              {language === 'fa' ? 'منحنی تنش - کرنش (σ - ε)' : 'Stress-Strain Curve (σ - ε)'}
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-cyan-400">
              {(currentMpa || 0).toFixed(1)} MPa
            </span>
          </div>

          <div className="relative h-24 w-full bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80 p-1 flex items-end">
            {/* Grid lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 opacity-30 dark:opacity-20 pointer-events-none">
              <div className="border-b border-r border-slate-300 dark:border-slate-600" />
              <div className="border-b border-r border-slate-300 dark:border-slate-600" />
              <div className="border-b border-slate-300 dark:border-slate-600" />
              <div className="border-r border-slate-300 dark:border-slate-600" />
              <div className="border-r border-slate-300 dark:border-slate-600" />
              <div />
            </div>

            {/* SVG Path */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 60" preserveAspectRatio="none">
              {/* Target / Reference Curve */}
              <path
                d="M 2 58 Q 30 15, 65 8 T 98 45"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />

              {/* Active Plotted Curve */}
              {currentLoadKn > 0 && (
                (() => {
                  const ratio = Math.min(1, currentLoadKn / (failureLoadKn || 1));
                  // x goes from 2 to 65 at peak, then to 98
                  const curX = ratio <= 0.85 ? 2 + ratio * 70 : 65 + (ratio - 0.85) * 220;
                  const curY = ratio <= 0.85 ? 58 - (ratio / 0.85) * 50 : 8 + ((ratio - 0.85) / 0.15) * 35;
                  return (
                    <>
                      <path
                        d={`M 2 58 Q ${Math.min(30, curX * 0.5)} ${Math.max(curY, 58 - ratio * 45)}, ${curX} ${curY}`}
                        fill="none"
                        stroke={isBroken ? '#f43f5e' : '#0284c7'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx={curX} cy={curY} r="3.5" fill={isBroken ? '#f43f5e' : '#0284c7'} className="animate-ping" />
                      <circle cx={curX} cy={curY} r="2.5" fill="#ffffff" />
                    </>
                  );
                })()
              )}
            </svg>
          </div>

          <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-1 px-0.5">
            <span>ε = 0</span>
            <span>ε_peak ≈ 0.002</span>
            <span>ε_ult = 0.0035</span>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-4 sm:px-6 py-4 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Concrete Grade Selector */}
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
              {language === 'fa' ? 'رده بتن:' : 'Grade:'}
            </span>
            {(['C25', 'C30', 'C40', 'C50', 'C60'] as const).map((grade) => (
              <button
                key={grade}
                onClick={() => { setConcreteGrade(grade); handleReset(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  concreteGrade === grade
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {grade}
              </button>
            ))}
          </div>

          {/* Play / Pause / Reset Action Buttons */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
            
            <button
              id="btn-3d-reset"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === 'fa' ? 'تنظیم مجدد' : 'Reset'}</span>
            </button>

            {!isRunning ? (
              <button
                id="btn-3d-start"
                onClick={handleStart}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-blue-500/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{language === 'fa' ? 'اعمال بار هیدرولیک و شکست بتن' : 'Run Hydraulic Compression'}</span>
              </button>
            ) : (
              <button
                id="btn-3d-pause"
                onClick={handlePause}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-amber-500/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Activity className="w-4 h-4 animate-spin" />
                <span>{language === 'fa' ? 'توقف بارگذاری' : 'Hold Load'}</span>
              </button>
            )}

          </div>

        </div>
      </div>

    </div>
  );
};
