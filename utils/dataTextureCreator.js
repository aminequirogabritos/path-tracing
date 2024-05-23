import * as THREE from 'three';

// Helper function to create a DataTexture
export function createRGBDataTexture(data, width, height) {
    
    const texture = new THREE.DataTexture(new Float32Array(data), width, height, THREE.RGBFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
}

