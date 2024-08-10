import * as THREE from 'three';


class BVHNode {
    constructor(index, boundingBox, leftChild = null, rightChild = null, triangleIndex = null) {

        
        const centroid = new THREE.Vector3();
        boundingBox.getCenter(centroid);

        this.index = index;
        this.boundingBox = boundingBox;
        this.leftChild = leftChild;
        this.rightChild = rightChild;
        this.triangleIndex = triangleIndex;
        // this.triangle = triangle;
        this.centroid = centroid;
    }

    isLeaf() {
        return this.triangleIndex !== null;
    }
}

export default BVHNode;