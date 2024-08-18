import * as THREE from 'three';


class BVHNode {
    static nodeId = 0;
    constructor(boundingBox, leftChild = null, rightChild = null, trianglesArray = [], triangleIndicesArray = [-1]) {
        const centroid = new THREE.Vector3();
        boundingBox.getCenter(centroid);

        // values passed through parameter
        this.nodeId = BVHNode.nodeId++;
        this.boundingBox = boundingBox;
        this.leftChild = leftChild;
        this.rightChild = rightChild;
        this.trianglesArray = trianglesArray;
        this.triangleIndicesArray = triangleIndicesArray;
        
        // computed values
        this.centroid = centroid;
        
        //to be filled later
        this.missLink = null;
        this.triangleCount = 0;
        this.firstIndexInInorderTriangleIndicesArray = null;
    }

    isLeaf() {
        return this.triangleIndex !== null;
    }
}

export default BVHNode;