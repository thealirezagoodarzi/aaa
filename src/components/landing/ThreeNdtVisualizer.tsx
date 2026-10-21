import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Language } from '../../utils/i18n';
import { 
  Activity, 
  RotateCcw, 
  Waves, 
  Eye, 
  ShieldCheck, 
  Sliders, 
  Maximize2,
  Cpu
} from 'lucide-react';

interface ThreeNdtVisualizerProps {
  language: Language;
}

export const ThreeNdtVisualizer: React.FC<ThreeNdtVisualizerProps> = ({ language }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isFa = language === 'fa';

  // Interactive controls
  const [pulseFreqKhz, setPulseFreqKhz] = useState<number>(54);
  const [hasInternalVoid, setHasInternalVoid] = useState<boolean>(true);
  const [pulseVelocity, setPulseVelocity] = useState<number>(4450); // m/s
  const [concreteQuality, setConcreteQuality] = useState<string>('عالی (Excellent Quality)');
  const [isPulsing, setIsPulsing] = useState<boolean>(true);
  const [ndtMode, setNdtMode] = useState<'ultrasonic' | 'schmidt'>('ultrasonic');
  const [reboundNumber, setReboundNumber] = useState<number>(38); // Schmidt hammer R value

  useEffect(() => {
    // Recalculate pulse velocity & quality
    if (hasInternalVoid) {
      setPulseVelocity(3620);
      setConcreteQuality(isFa ? 'مشکوک به تخلخل و ترک داخلی (Questionable / Void Detected)' : 'Questionable / Void Detected');
      setReboundNumber(31);
    } else {
      setPulseVelocity(4580);
      setConcreteQuality(isFa ? 'عالی و متراکم (Excellent / Dense Matrix)' : 'Excellent / Dense Matrix');
      setReboundNumber(42);
    }
  }, [hasInternalVoid, isFa]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 400;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5, 14);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dirLight.position.set(10, 15, 10);
    scene.add(dirLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 2, 20);
    purpleLight.position.set(-6, 4, 4);
    scene.add(purpleLight);

    // Root Group for interactive rotation
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Concrete Element (Semi-transparent beam/block to see inside)
    const blockGeo = new THREE.BoxGeometry(8, 3.5, 3.5);
    const blockMat = new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
      transmission: 0.35,
      thickness: 1.5,
      wireframe: false
    });
    const blockMesh = new THREE.Mesh(blockGeo, blockMat);
    rootGroup.add(blockMesh);

    // Rebars inside concrete block
    const rebarGeo = new THREE.CylinderGeometry(0.12, 0.12, 8.4, 16);
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
    
    const rebarPositions = [
      [-1.2, -1.2],
      [1.2, -1.2],
      [-1.2, 1.2],
      [1.2, 1.2]
    ];
    rebarPositions.forEach(([y, z]) => {
      const rebar = new THREE.Mesh(rebarGeo, rebarMat);
      rebar.rotation.z = Math.PI / 2;
      rebar.position.set(0, y, z);
      rootGroup.add(rebar);
    });

    // 2. Void / Defect representation inside the block
    const voidGeo = new THREE.DodecahedronGeometry(0.7, 1);
    const voidMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.6,
      wireframe: true
    });
    const voidMesh = new THREE.Mesh(voidGeo, voidMat);
    voidMesh.position.set(0.5, 0.1, 0);
    voidMesh.visible = hasInternalVoid;
    rootGroup.add(voidMesh);

    // 3. NDT Transducers (Transmitter on left, Receiver on right)
    const transducerGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32);
    const transmitterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.2 });
    const receiverMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.7, roughness: 0.2 });

    // Left Transducer (Tx)
    const tx = new THREE.Mesh(transducerGeo, transmitterMat);
    tx.rotation.z = Math.PI / 2;
    tx.position.set(-4.6, 0, 0);
    rootGroup.add(tx);

    // Right Transducer (Rx)
    const rx = new THREE.Mesh(transducerGeo, receiverMat);
    rx.rotation.z = -Math.PI / 2;
    rx.position.set(4.6, 0, 0);
    rootGroup.add(rx);

    // 4. Ultrasonic Pulse Wave Rings (traveling along X from Tx to Rx)
    const waveCount = 8;
    const waveRings: THREE.Mesh[] = [];
    const ringGeo = new THREE.TorusGeometry(1.2, 0.04, 16, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8
    });

    for (let i = 0; i < waveCount; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat.clone());
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-4 + (i * 1.1), 0, 0);
      rootGroup.add(ring);
      waveRings.push(ring);
    }

    // Grid Floor
    const grid = new THREE.GridHelper(20, 20, 0x1e293b, 0x0f172a);
    grid.position.y = -3;
    scene.add(grid);

    // Mouse Drag Rotation
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      rootGroup.rotation.y += deltaX * 0.008;
      rootGroup.rotation.x += deltaY * 0.008;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    let isVisible = true;
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(container);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;
      const time = clock.getElapsedTime();

      // Subtle slow floating rotation if not dragging
      if (!isDragging) {
        rootGroup.rotation.y = Math.sin(time * 0.3) * 0.2 + 0.1;
      }

      // Update Ultrasonic Wave Animation
      if (isPulsing) {
        waveRings.forEach((ring, index) => {
          const speed = (pulseVelocity / 3500) * 2.5;
          let newX = -4 + ((time * speed + index * (8 / waveCount)) % 8);
          ring.position.x = newX;

          // Fade out near receiver or void
          const distFromStart = newX - (-4);
          const mat = ring.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.sin((distFromStart / 8) * Math.PI) * 0.85;

          // Color shifts to red/amber if passing through void
          if (hasInternalVoid && newX > -0.5 && newX < 1.5) {
            mat.color.setHex(0xf43f5e);
          } else {
            mat.color.setHex(0x38bdf8);
          }
        });

        // Pulse the void mesh
        if (hasInternalVoid) {
          voidMesh.rotation.y += 0.02;
          voidMesh.rotation.x += 0.01;
          const scale = 1 + Math.sin(time * 5) * 0.1;
          voidMesh.scale.set(scale, scale, scale);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      blockGeo.dispose();
      blockMat.dispose();
      voidGeo.dispose();
      voidMat.dispose();
      rebarGeo.dispose();
      rebarMat.dispose();
      transducerGeo.dispose();
      transmitterMat.dispose();
      receiverMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    };
  }, [hasInternalVoid, isPulsing, pulseVelocity]);

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-4 sm:p-6 text-slate-900 dark:text-white relative overflow-hidden transition-colors">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-bold mb-1.5 border border-cyan-200 dark:border-cyan-500/30">
            <Waves className="w-3.5 h-3.5" />
            <span>{isFa ? 'آزمون‌های غیرمخرب (NDT) و آلتراسونیک' : 'Non-Destructive Testing (NDT) 3D'}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {isFa ? 'پایش سرعت امواج اولتراسونیک (UPV) و همگنی بتن' : 'Ultrasonic Pulse Velocity (UPV) & Defect Tomography'}
          </h3>
        </div>

        {/* Action badges */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHasInternalVoid(!hasInternalVoid)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              hasInternalVoid 
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40' 
                : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
            }`}
          >
            {hasInternalVoid 
              ? (isFa ? 'تخلخل و حفره: فعال' : 'Void Detected') 
              : (isFa ? 'ماتریس بتن: کاملاً متراکم' : 'Dense Concrete Matrix')}
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div className="relative w-full h-[320px] sm:h-[380px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Live Gauges HUD Overlay */}
        <div className="absolute top-3 start-3 p-3 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 text-xs space-y-1.5 pointer-events-none shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">{isFa ? 'سرعت سیر امواج (UPV):' : 'Pulse Velocity:'}</span>
            <span className="font-mono font-black text-blue-600 dark:text-cyan-400 text-sm">{pulseVelocity} m/s</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">{isFa ? 'فرکانس پراب:' : 'Probe Frequency:'}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{pulseFreqKhz} kHz</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">{isFa ? 'عدد بازتاب اشمیت (R):' : 'Schmidt R-Value:'}</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{reboundNumber}</span>
          </div>
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-bold">
            <span className="text-slate-500 dark:text-slate-400">{isFa ? 'ارزیابی کیفیت:' : 'Quality:'}</span>
            <span className={hasInternalVoid ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>{concreteQuality}</span>
          </div>
        </div>

        {/* 3D Rotation hint */}
        <div className="absolute bottom-3 end-3 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/80 text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 pointer-events-none shadow-xs">
          {isFa ? 'چرخش ۳۶۰ درجه با درگ موس' : 'Drag to Rotate 360°'}
        </div>
      </div>

      {/* Control Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
        
        {/* Toggle Pulse */}
        <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between shadow-xs">
          <span className="text-slate-700 dark:text-slate-300 font-bold">{isFa ? 'انیمیشن امواج صوتی' : 'Acoustic Wave Emission'}</span>
          <button
            onClick={() => setIsPulsing(!isPulsing)}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer"
          >
            {isPulsing ? (isFa ? 'توقف' : 'Pause') : (isFa ? 'شروع' : 'Play')}
          </button>
        </div>

        {/* Defect injection */}
        <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between shadow-xs">
          <span className="text-slate-700 dark:text-slate-300 font-bold">{isFa ? 'تست تخلخل / لانه زنبوری' : 'Simulate Void / Honeycomb'}</span>
          <button
            onClick={() => setHasInternalVoid(!hasInternalVoid)}
            className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-600 transition cursor-pointer"
          >
            {hasInternalVoid ? (isFa ? 'رفع تخلخل' : 'Remove Void') : (isFa ? 'ایجاد حفره' : 'Inject Void')}
          </button>
        </div>

        {/* Standard reference */}
        <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between shadow-xs">
          <span className="text-slate-500 dark:text-slate-400">{isFa ? 'استاندارد مرجع:' : 'Reference Standard:'}</span>
          <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">ASTM C597 / BS 1881</span>
        </div>

      </div>

    </div>
  );
};
