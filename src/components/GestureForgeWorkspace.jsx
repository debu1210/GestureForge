
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Shield, Sparkles, Palette, RefreshCw, Cpu, Camera, Layers } from 'lucide-react';

// ============================================================================
// 1. TWO-HAND GESTURE ROTATION & SCALE MATH ENGINE
// ============================================================================
class TwoHandTransformationEngine {
  constructor() {
    this.prevLeft = new THREE.Vector3();
    this.prevRight = new THREE.Vector3();
    this.currentLeft = new THREE.Vector3();
    this.currentRight = new THREE.Vector3();
    
    this.dirPrev = new THREE.Vector3();
    this.dirCurrent = new THREE.Vector3();
    this.rotationAxis = new THREE.Vector3();
    this.deltaQuaternion = new THREE.Quaternion();

    this.isTrackingActive = false;
    this.smoothingFactor = 0.25; // Smooths out web-cam coordinate jitter
    this.minDistanceThreshold = 0.05;
  }

  processTwoHandInteraction(leftHandLandmark, rightHandLandmark, targetObject) {
    if (!leftHandLandmark || !rightHandLandmark || !targetObject) {
      this.isTrackingActive = false;
      return;
    }

    // Mirror horizontal axes coordinate variables for intuitive, natural face-to-camera control response
    this.currentLeft.set(
      (leftHandLandmark.x - 0.5) * -10, 
      (leftHandLandmark.y - 0.5) * -6, 
      leftHandLandmark.z * -5
    );
    this.currentRight.set(
      (rightHandLandmark.x - 0.5) * -10, 
      (rightHandLandmark.y - 0.5) * -6, 
      rightHandLandmark.z * -5
    );

    if (!this.isTrackingActive) {
      this.prevLeft.copy(this.currentLeft);
      this.prevRight.copy(this.currentRight);
      this.isTrackingActive = true;
      return;
    }

    // Calculate distance vectors between both hands to handle scale operations
    this.dirPrev.subVectors(this.prevRight, this.prevLeft);
    this.dirCurrent.subVectors(this.currentRight, this.currentLeft);

    const distPrev = this.dirPrev.length();
    const distCurrent = this.dirCurrent.length();

    if (distPrev < this.minDistanceThreshold || distCurrent < this.minDistanceThreshold) return;

    // Smoothly interpolate uniform scaling multiplier
    const targetScaleMultiplier = distCurrent / distPrev;
    const newScale = THREE.MathUtils.lerp(
      targetObject.scale.x, 
      targetObject.scale.x * targetScaleMultiplier, 
      this.smoothingFactor
    );
    const clampedScale = THREE.MathUtils.clamp(newScale, 0.3, 4.0);
    targetObject.scale.set(clampedScale, clampedScale, clampedScale);

    // Compute angular rotation (Dot and Cross products of hand vectors)
    this.dirPrev.normalize();
    this.dirCurrent.normalize();

    this.rotationAxis.crossVectors(this.dirPrev, this.dirCurrent);
    const dotProduct = THREE.MathUtils.clamp(this.dirPrev.dot(this.dirCurrent), -1.0, 1.0);
    const angleDelta = Math.acos(dotProduct);

    if (this.rotationAxis.lengthSq() > 0.0001 && Math.abs(angleDelta) > 0.001) {
      this.rotationAxis.normalize();
      this.deltaQuaternion.setFromAxisAngle(this.rotationAxis, angleDelta);
      
      const interpolationQuat = new THREE.Quaternion();
      interpolationQuat.slerp(this.deltaQuaternion, this.smoothingFactor);
      targetObject.quaternion.premultiply(interpolationQuat);
    }

    // Shift coordinates forward
    this.prevLeft.copy(this.currentLeft);
    this.prevRight.copy(this.currentRight);
  }

  resetTrackingState() {
    this.isTrackingActive = false;
  }
}

// ============================================================================
// 2. THREE.JS 3D WEBGL GRAPHICS AND PAINT ENGINE
// ============================================================================
class Engine3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.hologramObject = null;
    this.currentLine = null;
    this.activeBrushColor = 0x00ffff;
    this.twoHandEngine = new TwoHandTransformationEngine();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030712, 0.02);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 6;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Futuristic space light matrices
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 0.8);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x06b6d4, 3, 100);
    pointLight.position.set(0, 4, 4);
    this.scene.add(pointLight);

    // Centered glowing Holo-Cube geometry configuration
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x8b5cf6, linewidth: 2 });
    
    this.hologramObject = new THREE.LineSegments(wireframe, material);
    this.scene.add(this.hologramObject);

    // Flat floor grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = -2.5;
    this.scene.add(gridHelper);

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.animate();
  }

  updateHandData(landmarksList, handedness) {
    if (!landmarksList || landmarksList.length === 0) {
      this.twoHandEngine.resetTrackingState();
      this.currentLine = null;
      return;
    }

    // Mode A: Dual hand manipulation locked on target core
    if (landmarksList.length === 2) {
      this.twoHandEngine.processTwoHandInteraction(landmarksList[0], landmarksList[1], this.hologramObject);
      this.currentLine = null; 
      return;
    }

    // Mode B: Single hand spatial air-painting
    if (landmarksList.length === 1) {
      this.twoHandEngine.resetTrackingState();
      
      const landmarks = landmarksList[0];
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const middleTip = landmarks[12];

      const targetX = (indexTip.x - 0.5) * -10;
      const targetY = (indexTip.y - 0.5) * -6;
      const targetZ = indexTip.z * -5;
      const point = new THREE.Vector3(targetX, targetY, targetZ);

      const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      const isDrawing = indexTip.y < middleTip.y && pinchDist > 0.08;

      if (isDrawing) {
        this.drawInAir(point);
      } else {
        this.currentLine = null;
      }
    }
  }

  drawInAir(pointVector) {
    if (!this.currentLine) {
      const material = new THREE.LineBasicMaterial({ color: this.activeBrushColor });
      const geometry = new THREE.BufferGeometry().setFromPoints([pointVector]);
      this.currentLine = new THREE.Line(geometry, material);
      this.scene.add(this.currentLine);
    } else {
      const positions = this.currentLine.geometry.attributes.position.array;
      const newPositions = [...positions, pointVector.x, pointVector.y, pointVector.z];
      this.currentLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
      this.currentLine.geometry.attributes.position.needsUpdate = true;
    }
  }

  setBrushColor(hexColor) {
    this.activeBrushColor = hexColor;
  }

  clearCanvas() {
    for (let i = this.scene.children.length - 1; i >= 0; i--) {
      const child = this.scene.children[i];
      if (child instanceof THREE.Line && child !== this.hologramObject) {
        this.scene.remove(child);
      }
    }
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    if (this.hologramObject) {
      this.hologramObject.rotation.y += 0.003;
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

// ============================================================================
// 3. FRONTEND STARK HUD INTERFACE VIEWPORT
// ============================================================================
export default function GestureForgeWorkspace() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  
  const [hudStats, setHudStats] = useState({ activeHands: 0, status: 'INITIALIZING CAMERA...' });
  const [activeColor, setActiveColor] = useState('#00ffff');
  const [isSystemReady, setIsSystemReady] = useState(false);

  const colorPalette = [
    { name: 'Cyan Neon', hex: '#00ffff', numeric: 0x00ffff },
    { name: 'Matrix Emerald', hex: '#10b981', numeric: 0x10b981 },
    { name: 'Cyber Pink', hex: '#f43f5e', numeric: 0xf43f5e },
    { name: 'Stark Gold', hex: '#eab308', numeric: 0xeab308 }
  ];

  useEffect(() => {
    // Verifies global browser window CDN script injection readiness
    const checkLibraries = setInterval(() => {
      if (window.Hands && window.Camera) {
        setIsSystemReady(true);
        clearInterval(checkLibraries);
      }
    }, 200);
    return () => clearInterval(checkLibraries);
  }, []);

  useEffect(() => {
    if (!isSystemReady) return;

    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new Engine3D(canvasRef.current);
      engineRef.current.init();
      setHudStats(p => ({ ...p, status: 'SYSTEM READY' }));
    }

    const MediaPipeHands = window.Hands;
    const MediaPipeCamera = window.Camera;

    const hands = new MediaPipeHands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75,
    });

    hands.onResults((results) => {
      const trackingCount = results.multiHandLandmarks?.length || 0;
      setHudStats(prev => ({ 
        ...prev, 
        activeHands: trackingCount,
        status: trackingCount === 2 ? 'TWIN MATRIX ENGAGED' : trackingCount === 1 ? 'AIR GRAPHICS MODE' : 'AWAITING TRACKING TARGET'
      }));
      
      if (engineRef.current) {
        engineRef.current.updateHandData(results.multiHandLandmarks, results.multiHandedness);
      }
    });

    let cameraInstance = null;
    if (videoRef.current) {
      cameraInstance = new MediaPipeCamera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      cameraInstance.start();
    }

    return () => {
      cameraInstance?.stop();
      engineRef.current?.destroy();
    };
  }, [isSystemReady]);

  const handleColorChange = (hex, numeric) => {
    setActiveColor(hex);
    if (engineRef.current) engineRef.current.setBrushColor(numeric);
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-cyan-400 overflow-hidden font-mono select-none">
      {/* Hidden processing source stream anchor */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Primary WebGL Canvas Viewport */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Left Interface Panel: Live HUD Diagnostics */}
      <div className="absolute top-6 left-6 z-20 w-80 p-5 rounded-lg border border-cyan-500/30 bg-slate-950/80 backdrop-blur-md shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs tracking-widest text-cyan-500 font-bold border-b border-cyan-500/20 pb-2">
          <Shield className="w-4 h-4 animate-pulse" />
          <span>// GESTURE_FORGE_OS v1.0</span>
        </div>
        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5 text-slate-400"><Cpu className="w-3.5 h-3.5 text-cyan-500" /> SYSTEM STATUS:</span>
            <span className="text-white font-bold">{hudStats.status}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5 text-slate-400"><Camera className="w-3.5 h-3.5 text-cyan-500" /> LIVE HANDS:</span>
            <span className="text-cyan-400 font-bold">{hudStats.activeHands} / 2</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400"><Layers className="w-3.5 h-3.5 text-purple-500" /> GRAPHICS UNIT:</span>
            <span className="text-purple-400">THREE_JS (WebGL 2.0)</span>
          </div>
        </div>
      </div>

      {/* Right Interface Panel: Brush Coating Palette */}
      <div className="absolute top-6 right-6 z-20 p-4 rounded-lg border border-purple-500/30 bg-slate-950/80 backdrop-blur-md shadow-[0_0_25px_rgba(139,92,246,0.15)]">
        <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-2 tracking-wider">
          <Palette className="w-4 h-4" /> NEON BRUSH COATING
        </h3>
        <div className="flex flex-col gap-2">
          {colorPalette.map((color) => (
            <button
              key={color.hex}
              onClick={() => handleColorChange(color.hex, color.numeric)}
              className={`flex items-center gap-3 px-3 py-1.5 rounded text-left text-xs transition-all border ${
                activeColor === color.hex 
                  ? 'border-white bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                  : 'border-transparent hover:bg-slate-800/60 text-slate-400'
              }`}
            >
              <span className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: color.hex }} />
              {color.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Center Console: Global Action Commands */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-6 p-4 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-[0_0_35px_rgba(6,182,212,0.2)]">
        <button 
          onClick={() => engineRef.current?.clearCanvas()}
          className="flex items-center gap-2 px-4 py-2 border border-rose-500/40 hover:border-rose-500 rounded-md text-xs text-rose-400 hover:bg-rose-500/10 transition-all uppercase tracking-wider font-bold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Purge Air Lines
        </button>
        <div className="h-4 w-[1px] bg-slate-700" />
        <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
          <Sparkles className="inline w-3 h-3 mr-1 text-amber-400 animate-spin" />
          <b className="text-slate-300">Stark Core Calibration:</b> Raise 1 index finger to draw. Use both hands to scale/rotate the glowing central hyper-cube target smoothly.
        </p>
      </div>
    </div>
  );
}

