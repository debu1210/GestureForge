import * as THREE from 'three';

export class TwoHandTransformationEngine {
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
    this.smoothingFactor = 0.2; // Smooths out webcam noise
    this.minDistanceThreshold = 0.05;
  }

  processTwoHandInteraction(leftHandLandmark, rightHandLandmark, targetObject) {
    if (!leftHandLandmark || !rightHandLandmark || !targetObject) {
      this.isTrackingActive = false;
      return;
    }

    // Mirror X coordinates for natural intuition when facing a camera
    this.currentLeft.set((leftHandLandmark.x - 0.5) * -10, (leftHandLandmark.y - 0.5) * -6, leftHandLandmark.z * -5);
    this.currentRight.set((rightHandLandmark.x - 0.5) * -10, (rightHandLandmark.y - 0.5) * -6, rightHandLandmark.z * -5);

    if (!this.isTrackingActive) {
      this.prevLeft.copy(this.currentLeft);
      this.prevRight.copy(this.currentRight);
      this.isTrackingActive = true;
      return;
    }

    this.dirPrev.subVectors(this.prevRight, this.prevLeft);
    this.dirCurrent.subVectors(this.currentRight, this.currentLeft);

    const distPrev = this.dirPrev.length();
    const distCurrent = this.dirCurrent.length();

    if (distPrev < this.minDistanceThreshold || distCurrent < this.minDistanceThreshold) return;

    // 1. Uniform Spatial Scaling
    const targetScaleMultiplier = distCurrent / distPrev;
    const newScale = THREE.MathUtils.lerp(targetObject.scale.x, targetObject.scale.x * targetScaleMultiplier, this.smoothingFactor);
    const clampedScale = THREE.MathUtils.clamp(newScale, 0.3, 4.0);
    targetObject.scale.set(clampedScale, clampedScale, clampedScale);

    // 2. Quaternion Rotation Transformation
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

    // Move state variables forward
    this.prevLeft.copy(this.currentLeft);
    this.prevRight.copy(this.currentRight);
  }

  resetTrackingState() {
    this.isTrackingActive = false;
  }
}
