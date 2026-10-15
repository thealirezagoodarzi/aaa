import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export const ThreeHeroCube: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 400;
    let height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const blueLight = new THREE.PointLight(0x2563eb, 3, 20);
    blueLight.position.set(4, 5, 4);
    scene.add(blueLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 2.5, 20);
    cyanLight.position.set(-4, -3, 3);
    scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0x8b5cf6, 2, 20);
    purpleLight.position.set(0, -4, -3);
    scene.add(purpleLight);

    // Main Group
    const group = new THREE.Group();
    scene.add(group);

    // 1. Central Concrete Specimen Cube with Chamfered look
    const cubeGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4, 4, 4, 4);
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      metalness: 0.1,
      roughness: 0.4,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
      wireframe: false
    });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    group.add(cube);

    // 2. Wireframe outer cage
    const wireGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    group.add(wire);

    // 3. Orbiting Data / Aggregate Nodes
    const particleCount = 28;
    const particlesGroup = new THREE.Group();
    group.add(particlesGroup);

    const nodeGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x2563eb,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });

    const particlePositions: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.0 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(x, y, z);
      particlesGroup.add(node);
      particlePositions.push(new THREE.Vector3(x, y, z));
    }

    // 4. Connecting Lines / Lattice
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.25
    });

    const lineGeo = new THREE.BufferGeometry();
    const linePoints: number[] = [];
    for (let i = 0; i < particlePositions.length; i++) {
      for (let j = i + 1; j < particlePositions.length; j++) {
        if (particlePositions[i].distanceTo(particlePositions[j]) < 1.6) {
          linePoints.push(
            particlePositions[i].x, particlePositions[i].y, particlePositions[i].z,
            particlePositions[j].x, particlePositions[j].y, particlePositions[j].z
          );
        }
      }
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
    particlesGroup.add(linesMesh);

    // Interactive Drag (Mouse & Touch)
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevX;
      const deltaY = e.clientY - prevY;
      group.rotation.y += deltaX * 0.008;
      group.rotation.x += deltaY * 0.008;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isDragging = true;
        prevX = e.touches[0].clientX;
        prevY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const deltaX = e.touches[0].clientX - prevX;
      const deltaY = e.touches[0].clientY - prevY;
      group.rotation.y += deltaX * 0.008;
      group.rotation.x += deltaY * 0.008;
      prevX = e.touches[0].clientX;
      prevY = e.touches[0].clientY;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.style.touchAction = 'pan-y';
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // Animation Loop with Visibility Optimization
    let animationFrameId: number;
    let isVisible = true;
    const clock = new THREE.Clock();

    const animate = () => {
      if (isVisible) {
        const time = clock.getElapsedTime();

        if (!isDragging) {
          group.rotation.y = time * 0.35;
          group.rotation.x = Math.sin(time * 0.2) * 0.2;
        }

        particlesGroup.rotation.y = -time * 0.15;
        wire.rotation.z = time * 0.1;

        renderer.render(scene, camera);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // IntersectionObserver to pause rendering when off-screen (saves mobile battery and GPU)
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(container);

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 300;
      height = container.clientHeight || 300;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      renderer.dispose();
      cubeGeo.dispose();
      cubeMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full min-h-[300px] sm:min-h-[380px] relative flex items-center justify-center">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
