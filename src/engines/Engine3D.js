import * as THREE from 'three';
import { TwoHandTransformationEngine } from './TwoHandEngine';

export class Engine3D {
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

    // Futuristic Lights
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 0.8);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x06b6d4, 3, 100);
    pointLight.position.set(0, 4, 4);
    this.scene.add(pointLight);

    // Create central Holo-Cube Target
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x8b5cf6, linewidth: 2 });
    
    this.hologramObject = new THREE.LineSegments(wireframe, material);
    this.scene.add(this.hologramObject);

    // Add a holographic floor grid reference
    const gridHelper = new THREE.GridHelper(20, 20, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = -2.5;
    this.scene.add(gridHelper);

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  updateHandData(landmarksList, handedness) {
    if (!landmarksList || landmarksList.length === 0) {
      this.twoHandEngine.resetTrackingState();
      this.currentLine = null;
      return;
    }

    // Two-Hand Transform Logic Mode
    if (landmarksList.length === 2) {
      this.twoHandEngine.processTwoHandInteraction(landmarksList[0], landmarksList[1], this.hologramObject);
      this.currentLine = null; 
      return;
    }

    // Single-Hand Spatial Pointer / Drawing Mode
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

      // Simple Gesture Detections
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
    // Traverse scene backwards to remove dynamic air lines safely
    for (let i = this.scene.children.length - 1; i >= 0; i--) {
      const child = this.scene.children[i];
      if (child instanceof THREE.Line && child !== this.hologramObject) {
        this.scene.remove(child);
      }
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Constant diagnostic baseline spin for the central holographic cube
    if (this.hologramObject) {
      this.hologramObject.rotation.y += 0.003;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.renderer.dispose();
  }
}
