

class Triangle {
    constructor(triangle = null, normal = null, centroid = null, distanceToCamera = null,  color = null, emission = null, ior = 0, metallic = 0, roughness = 1, specular = 0, transmission = 0
    ) {
        //geometry poroerties
        this.triangle = triangle;
        this.normal = normal;
        this.centroid = centroid;
        this.distanceToCamera = distanceToCamera;
        
        // material properties
        this.color = color;
        this.emission = emission;
        this.ior = ior;
        this.metallic = metallic;
        this.roughness = roughness;
        this.specular = specular;
        this.transmission = transmission;
    }
}

export default Triangle;