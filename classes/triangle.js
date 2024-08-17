

class Triangle {
    constructor(triangle = null, normal = null, color = null, emission = null, centroid = null, distanceToCamera = null) {
        this.triangle = triangle;
        this.normal = normal;
        this.color = color;
        this.emission = emission;
        this.centroid = centroid;
        this.distanceToCamera = distanceToCamera;
    }
}

export default Triangle;