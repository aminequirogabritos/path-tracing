struct Triangle {
    vec3 vertex0;
    vec3 vertex1;
    vec3 vertex2;
    vec3 normal;
    vec3 color;
    vec3 emission;
    float ior;            // Index of Refraction
    float metallic;       // Metallic factor
    float roughness;      // Surface roughness
    float specular;       // Specular factor
    float transmission;   // Transmission factor
};

// Function to evaluate the BSDF based on material properties
vec3 evaluateBSDF(Triangle triangle, vec3 incomingDir, vec3 outgoingDir, vec3 normal) {
    // Implement the evaluation of the BSDF based on the material properties
    // using microfacet models (e.g., GGX for roughness), Fresnel equations,
    // and other factors like metallic, specular, and transmission.

    // For simplicity, let's assume a basic model that mixes diffuse and specular reflections
    vec3 diffuse = (1.0 - triangle.metallic) * triangle.color / PI;
    vec3 specular = calculateSpecular(triangle, incomingDir, outgoingDir, normal);

    // Combine diffuse and specular components based on roughness and metallic properties
    vec3 bsdf = mix(diffuse, specular, triangle.metallic);

    // Adjust the BSDF with Fresnel and roughness
    float fresnel = calculateFresnel(triangle, incomingDir, normal);
    bsdf *= fresnel;

    // Add transmission if applicable
    if (triangle.transmission > 0.0) {
        vec3 transmission = calculateTransmission(triangle, incomingDir, outgoingDir, normal);
        bsdf = mix(bsdf, transmission, triangle.transmission);
    }

    return bsdf;
}

// Pseudocode for Ray Radiance Calculation using NEE and MIS
vec3 calculateRadiance(Ray ray) {
    vec3 radiance = vec3(0.0);
    vec3 throughput = vec3(1.0);
    bool isSpecular = false;

    for (int bounce = 0; bounce < MAX_BOUNCES; ++bounce) {
        // Intersect ray with scene
        Intersection intersection = intersectScene(ray);
        if (!intersection.hit) {
            break; // No hit, terminate the loop
        }

        // Fetch the intersected triangle
        Triangle triangle = intersection.triangle;

        // Calculate direct lighting using Next Event Estimation (NEE)
        vec3 directLighting = vec3(0.0);
        LightSample lightSample = sampleLight(intersection.position);
        
        // Construct a shadow ray towards the light
        Ray shadowRay = createRay(intersection.position, lightSample.direction);
        Intersection shadowIntersection = intersectScene(shadowRay);

        if (!shadowIntersection.hit || shadowIntersection.distance > lightSample.distance) {
            // No obstruction, calculate the contribution
            float lightPdf = lightSample.pdf;
            float bsdfPdf = calculateBSDFPdf(triangle, intersection, lightSample.direction);
            float misWeight = calculateMISWeight(bsdfPdf, lightPdf);

            vec3 bsdfValue = evaluateBSDF(triangle, -ray.direction, lightSample.direction, intersection.normal);
            directLighting = lightSample.emission * bsdfValue * misWeight / lightPdf;
        }

        // Accumulate the radiance
        radiance += throughput * directLighting;

        // Sample a new direction based on the BSDF
        vec3 bsdfDirection = sampleBSDF(triangle, intersection.normal, -ray.direction);
        float bsdfPdf = calculateBSDFPdf(triangle, intersection, bsdfDirection);
        if (bsdfPdf == 0.0) {
            break; // No new direction sampled, terminate the loop
        }

        // Calculate the contribution from the light using MIS
        if (!isSpecular) {
            float lightPdf = calculateLightPdf(intersection.position, bsdfDirection);
            float misWeight = calculateMISWeight(bsdfPdf, lightPdf);

            vec3 bsdfValue = evaluateBSDF(triangle, -ray.direction, bsdfDirection, intersection.normal);
            LightSample lightSampleBSDF = sampleLightFromBSDF(intersection, bsdfDirection);

            // Accumulate the indirect lighting
            radiance += throughput * bsdfValue * lightSampleBSDF.emission * misWeight / bsdfPdf;
        }

        // Update the throughput for the next bounce
        vec3 bsdfValue = evaluateBSDF(triangle, -ray.direction, bsdfDirection, intersection.normal);
        throughput *= bsdfValue / bsdfPdf;

        // Update the ray for the next bounce
        ray = createRay(intersection.position, bsdfDirection);

        // Check if the material is specular
        isSpecular = (triangle.roughness < 0.1);
    }

    return radiance;
}
