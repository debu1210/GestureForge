import React, { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import * as cam from '@mediapipe/camera_utils';
import { Engine3D } from '../engines/Engine3D';
import { Shield, Zap, RefreshCw, Sparkles, Palette } from 'lucide-react';

export default function GestureForgeWorkspace() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  
  const [hudStats, setHudStats] = useState({ activeHands: 0, status: 'INITIALIZING CORE...' });
  const [activeColor, setActiveColor] = useState('#00ffff');

  const colorPalette = [
    { name: 'Cyan Neon', hex: '#00ffff', numeric: 0x00ffff },
    { name: 'Matrix Emerald', hex: '#10b981', numeric: 0x10b981 },
    { name: 'Cyber Pink', hex: '#f43f5e', numeric: 0xf43f5e },
    { name: 'Stark Gold', hex: '#eab308', numeric: 0xeab308 }
  ];

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new Engine3D(canvasRef.current);
      engineRef.current.init();
      setHudStats(p => ({ ...p, status: 'SYSTEM ACTIVE' }));
    }

    const hands = new Hands({
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
        status: trackingCount === 2 ? 'TWIN COORD MATRIX ENGAGED' : trackingCount === 1 ? 'AIR DRAWING ACTIVE' : 'AWAITING TRACKING GESTURE'
      }));
      
      if (engineRef.current) {
        engineRef.current.updateHandData(results.multiHandLandmarks, results.multiHandedness);
      }
    });

    let cameraInstance = null;
    if (videoRef.current) {
      cameraInstance = new cam.Camera(videoRef.current, {
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
  }, []);

  const handleColorChange = (hex, numeric) => {
    setActiveColor(hex);
    if (engineRef.current) engineRef.current.setBrushColor(numeric);
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-cyan-400 overflow-hidden font-mono select-none">
      {/* Hidden processing source stream anchor */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Primary Interactive Render Viewport */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Top Left: Main Diagnostic HUD Panel */}
      <div className="absolute top-6 left-6 z-20 w-80 p-5 rounded-lg border border-cyan-500/30 bg-slate-900/70 backdrop-blur-md shadow-[0_0_25px_rgba(6,182,212,0.15)]">
        <div className="flex items-center gap-2 mb-3 text-xs tracking-widest text-cyan-500 font-bold border-b border-cyan-500/20 pb-2">
          <Shield className="w-4 h-4 animate-pulse" />
          <span>// GESTURE_FORGE_OS v1.0</span>
        </div>
        <div className="space-y-2 text-xs text-slate-300">
          <p className="flex justify-between">SYSTEM STATUS: <span className="text-white font-bold">{hudStats.status}</span></p>
          <p className="flex justify-between">ACTIVE HAND ANCHORS: <span className="text-cyan-400 font-bold">{hudStats.activeHands} / 2</span></p>
          <p className="flex justify-between">RENDER MATRIX: <span className="text-purple-400">WebGL 2.0 (Three.js)</span></p>
        </div>
      </div>

      {/* Top Right: Color Controls Overlay */}
      <div className="absolute top-6 right-6 z-20 p-4 rounded-lg border border-purple-500/30 bg-slate-900/70 backdrop-blur-md shadow-[0_0_25px_rgba(139,92,246,0.15)]">
        <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-2 tracking-wider">
          <Palette className="w-4 h-4" /> NEON COATINGS
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

      {/* Bottom Center: System Action Array */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-6 p-4 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-[0_0_35px_rgba(6,182,212,0.2)]">
        <button 
          onClick={() => engineRef.current?.clearCanvas()}
          className="flex items-center gap-2 px-4 py-2 border border-rose-500/40 hover:border-rose-500 rounded-md text-xs text-rose-400 hover:bg-rose-500/10 transition-all uppercase tracking-wider font-bold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Purge Air Lines
        </button>
        <div className="h-4 w-[1px] bg-slate-700" />
        <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
          <Sparkles className="inline w-3 h-3 mr-1 text-amber-400" />
          <b className="text-slate-300">Tony Stark Interface Config:</b> Lift 1 index finger to draw. Bring in both hands simultaneously to rotate & size the central hyper-cube core natively.
        </p>
      </div>
    </div>
  );
}
