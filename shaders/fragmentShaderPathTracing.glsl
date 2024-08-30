#version 300 es
#define M_PI 3.141592653589793238462643
#define M_1_PI 0.3183098861837907
// #define SCALING_FACTOR 0.1f
#define SCALING_FACTOR 1.0f
# define EPSILON 0.00001

#ifdef GL_ES
precision highp float;
#endif

struct Triangle {
  vec3 vertex0;
  vec3 vertex1;
  vec3 vertex2;
  vec3 normal;
  vec3 color;
  vec3 emission;
  float ior;
  float metallic;
  float roughness;
  float specular;
  float transmission;
};

struct BVHNode {
  vec3 minBounds;
  vec3 maxBounds;
  int triangleInorderIndex;
  int triangleCount;
  int missLink;
};

uniform sampler2D coordinatesTexture;
uniform sampler2D normalsTexture;
uniform sampler2D colorsTexture;
uniform sampler2D emissionsTexture;
uniform sampler2D lightIndicesTexture;
uniform sampler2D iorsTexture;
uniform sampler2D metallicsTexture;
uniform sampler2D roughnessesTexture;
uniform sampler2D specularsTexture;
uniform sampler2D transmissionsTexture;

uniform sampler2D nodesBoundingBoxesMins;
uniform sampler2D nodesBoundingBoxesMaxs;
uniform sampler2D nodesMissLinkIndices;
uniform sampler2D nodesInorderTrianglesIndices;
uniform sampler2D nodesTrianglesCount;
uniform sampler2D inorderTrianglesIndicesArray;
// uniform sampler2D nodesTrianglesIndices;
uniform sampler2D previousFrameTexture;

uniform vec2 windowSize;
uniform float aspectRatio;
uniform vec3 cameraSource;
uniform vec3 cameraDirection;
uniform vec3 cameraUp;
uniform vec3 cameraRight;
uniform vec3 cameraLeftBottom;
uniform int vertexCount;
uniform int triangleCount;
uniform int lightIndicesCount;
uniform int timestamp;
uniform int maxPathLength;
uniform int sampleCount;
uniform int frameNumber;
uniform int totalFrames;
uniform int quadX;
uniform int quadY;
uniform int quadSize;
uniform int bvhNodeCount;
uniform int maxTextureSize;

out vec4 outColor;

int coordinatesTexRowCount;
int coordinatesTexColCount;

int trianglesTexRowCount;
int trianglesTexColCount;

int nodesTexRowCount;
int nodesTexColCount;

int lightsIndicesTexRowCount;
int lightsIndicesTexColCount;

void getRowAndColCount() {
  coordinatesTexRowCount = (vertexCount + maxTextureSize - 1) / maxTextureSize;
  coordinatesTexColCount = min(vertexCount, maxTextureSize);

  trianglesTexRowCount = (triangleCount + maxTextureSize - 1) / maxTextureSize;
  trianglesTexColCount = min(triangleCount, maxTextureSize);

  nodesTexRowCount = (bvhNodeCount + maxTextureSize - 1) / maxTextureSize;
  nodesTexColCount = min(bvhNodeCount, maxTextureSize);

  lightsIndicesTexRowCount = (lightIndicesCount + maxTextureSize - 1) / maxTextureSize;
  lightsIndicesTexColCount = min(lightIndicesCount, maxTextureSize);
}

Triangle getTriangleFromTextures(int index) {

  Triangle triangle;

  int indexV0 = 3 * index;
  int indexV1 = 3 * index + 1;
  int indexV2 = 3 * index + 2;

  ivec2 texCoordV0 = ivec2(indexV0 % coordinatesTexColCount, indexV0 / coordinatesTexColCount);
  ivec2 texCoordV1 = ivec2(indexV1 % coordinatesTexColCount, indexV1 / coordinatesTexColCount);
  ivec2 texCoordV2 = ivec2(indexV2 % coordinatesTexColCount, indexV2 / coordinatesTexColCount);

  triangle.vertex0 = texelFetch(coordinatesTexture, texCoordV0, 0).xyz;
  triangle.vertex1 = texelFetch(coordinatesTexture, texCoordV1, 0).xyz;
  triangle.vertex2 = texelFetch(coordinatesTexture, texCoordV2, 0).xyz;

  ivec2 texCoord = ivec2(index % trianglesTexColCount, index / trianglesTexColCount);

  triangle.normal = texelFetch(normalsTexture, texCoord, 0).xyz;
  triangle.color = texelFetch(colorsTexture, texCoord, 0).xyz;
  triangle.emission = texelFetch(emissionsTexture, texCoord, 0).xyz;
  triangle.ior = texelFetch(iorsTexture, texCoord, 0).x;
  triangle.metallic = texelFetch(metallicsTexture, texCoord, 0).x;
  triangle.roughness = texelFetch(roughnessesTexture, texCoord, 0).x;
  triangle.specular = texelFetch(specularsTexture, texCoord, 0).x;
  triangle.transmission = texelFetch(transmissionsTexture, texCoord, 0).x;

  return triangle;

}

BVHNode getBVHNode(int index) {
  BVHNode node;

  ivec2 texCoord = ivec2(index % nodesTexColCount, index / nodesTexColCount);

  node.minBounds = texelFetch(nodesBoundingBoxesMins, texCoord, 0).xyz;
  node.maxBounds = texelFetch(nodesBoundingBoxesMaxs, texCoord, 0).xyz;
  node.triangleInorderIndex = int(texelFetch(nodesInorderTrianglesIndices, texCoord, 0).x);
  node.triangleCount = int(texelFetch(nodesTrianglesCount, texCoord, 0).x);
  node.missLink = int(texelFetch(nodesMissLinkIndices, texCoord, 0).x);

  return node;
}

int getIndexFromInorderTrianglesIndicesArray(int index) {
  ivec2 texCoord = ivec2(index % trianglesTexColCount, index / trianglesTexColCount);
  return int(texelFetch(inorderTrianglesIndicesArray, texCoord, 0).x);
}

int getIndexFromLightIndicesTexture(int index) {
  ivec2 texCoord = ivec2(index % lightsIndicesTexColCount, index / lightsIndicesTexColCount);
  return int(texelFetch(lightIndicesTexture, texCoord, 0).x);
}

vec4 getPreviousColorFromPreviousFrameTexture(vec2 texCoord) {
  return vec4(texture(previousFrameTexture, texCoord).rgb, 1.0f);
}

vec3 get_primary_ray_direction(float x, float y, vec3 camera_position, vec3 left_bottom, vec3 right, vec3 up) {
  vec3 image_plane_pos = left_bottom + x * right + y * up;
  return normalize(image_plane_pos - camera_position);
}

bool ray_triangle_intersection(out float out_t, vec3 origin, vec3 direction, Triangle triangle) {
  vec3 edge1 = triangle.vertex1 - triangle.vertex0;
  vec3 edge2 = triangle.vertex2 - triangle.vertex0;
  vec3 h = cross(direction, edge2);
  float a = dot(edge1, h);
  float epsilon = 1e-6f;
  if(a > epsilon && a < epsilon)
    return false;    // This ray is parallel to this triangle.
  float f = 1.0f / a;
  vec3 s = origin - triangle.vertex0;
  float u = f * dot(s, h);
  if(u < 0.0f || u > 1.0f)
    return false;
  vec3 q = cross(s, edge1);
  float v = f * dot(direction, q);
  if(v < 0.0f || u + v > 1.0f)
    return false;
    // At this stage we can compute t to find out where the intersection point is on the line.
  float t = f * dot(edge2, q);
  if(t > epsilon) { // ray intersection
    out_t = t;
    return true;
  } else // This means that there is a line intersection but not a ray intersection.
    return false;
}

bool ray_box_intersection(vec3 origin, vec3 direction, vec3 minBound, vec3 maxBound) {
  vec3 invDir = 1.0f / direction; // Inverse of the direction to avoid division by zero
  // invDir.x = direction.x != 0.0f ? 1.0f / direction.x : float(0xffffffff);
  // invDir.y = direction.y != 0.0f ? 1.0f / direction.y : float(0xffffffff);
  // invDir.z = direction.z != 0.0f ? 1.0f / direction.z : float(0xffffffff);
  vec3 t1 = (minBound - origin) * invDir;
  vec3 t2 = (maxBound - origin) * invDir;

  vec3 tmin = min(t1, t2);
  vec3 tmax = max(t1, t2);

  float tNear = max(max(tmin.x, tmin.y), tmin.z);
  float tFar = min(min(tmax.x, tmax.y), tmax.z);

  // Return true if intersection exists and tFar is positive
  return (tNear <= tFar) && (tFar > 0.0f);
}

bool ray_mesh_intersection(out float out_t, out Triangle out_triangle, vec3 origin, vec3 direction) {
  out_t = 1.0e38f;
  for(int i = 0; i < triangleCount; i++) {
    Triangle triangle = getTriangleFromTextures(i);
    float t;
    if(ray_triangle_intersection(t, origin, direction, triangle) && t < out_t) {
      out_t = t;
      out_triangle = triangle;
    }
  }
  return out_t < 1.0e38f;
}

bool ray_bvh_intersection_hit_miss(out float out_t, out Triangle out_triangle, vec3 origin, vec3 direction) {
  out_t = 1.0e38f;
  int currentIndex = 0; // Start with the root node

  while(currentIndex != -1 && currentIndex < bvhNodeCount) {
    BVHNode currentNode = getBVHNode(currentIndex);

    // Check if the ray intersects the bounding box
    if(ray_box_intersection(origin, direction, currentNode.minBounds, currentNode.maxBounds)) {

      if(currentNode.triangleInorderIndex != -2) {

        for(int i = currentNode.triangleInorderIndex; i < currentNode.triangleInorderIndex + currentNode.triangleCount; i++) {
          int triangleIndex = getIndexFromInorderTrianglesIndicesArray(i);
          Triangle triangle = getTriangleFromTextures(triangleIndex);
          float t;
          if(ray_triangle_intersection(t, origin, direction, triangle) && t < out_t) {
            out_t = t;
            out_triangle = triangle;
          }
        }
      }
      currentIndex++;

    } else {
      // If the ray doesn't intersect, follow the miss link
      currentIndex = currentNode.missLink;
    }
  }

  return out_t < 1.0e38f;
}

vec2 get_random_numbers(inout uvec2 seed) {
    // This is PCG2D: https://jcgt.org/published/0009/03/02/
  seed = 1664525u * seed + 1013904223u;
  seed.x += 1664525u * seed.y;
  seed.y += 1664525u * seed.x;
  seed ^= (seed >> 16u);
  seed.x += 1664525u * seed.y;
  seed.y += 1664525u * seed.x;
  seed ^= (seed >> 16u);
    // Convert to float. The constant here is 2^-32.
  return vec2(seed) * 2.32830643654e-10f;
}

vec2 get_random_barycentric(inout uvec2 seed) {
  vec2 rand = get_random_numbers(seed); // Get two random numbers between 0 and 1
  float r1 = rand.x;
  float r2 = rand.y;

  // Ensure the random point lies within the triangle
  if(r1 + r2 > 1.0f) {
    r1 = 1.0f - r1;
    r2 = 1.0f - r2;
  }

  return vec2(r1, r2);
}

bool is_light_visible(vec3 origin, vec3 light_point, Triangle light_triangle, vec3 direction) {
  float t;
  Triangle blocking_triangle;
  bool hits = ray_bvh_intersection_hit_miss(t, blocking_triangle, origin, direction);

    // If the ray hits something and it's not the light itself, the light is blocked
  if(hits && (blocking_triangle.emission != light_triangle.emission || blocking_triangle.transmission == 0.0f)) {
    return false;
  }
  return true;
}

void sample_random_light(inout uvec2 seed, inout Triangle lightTriangle, inout vec3 lightPoint, inout float lightPdf, inout float lightArea, vec3 origin) {
  const int max_attempts = 10;
  int attempts = 0;
  bool visible = false;
  int randomIndex;
  int lightIndex;
  vec3 directionToLight;

  while(attempts < max_attempts && !visible) {
    attempts++;

    randomIndex = int(float(lightIndicesCount) * get_random_numbers(seed).x) % (lightIndicesCount);
    lightIndex = getIndexFromLightIndicesTexture(randomIndex);
    // outColor = vec4(float(lightIndex / lightIndicesCount), float(lightIndex / lightIndicesCount), float(lightIndex / lightIndicesCount), 1.0f);

    lightTriangle = getTriangleFromTextures(lightIndex);

    vec2 r = get_random_barycentric(seed);

    lightPoint = (1.0f - r.x - r.y) * lightTriangle.vertex0 + r.x * lightTriangle.vertex1 + r.y * lightTriangle.vertex2;

    directionToLight = normalize(lightPoint - origin);
    visible = is_light_visible(origin, lightPoint, lightTriangle, directionToLight);
  }

  if(visible) {
    lightArea = 0.5f * length(cross(lightTriangle.vertex1 - lightTriangle.vertex0, lightTriangle.vertex2 - lightTriangle.vertex0));
    // lightPdf = (1.0f / (float(lightIndicesCount) * lightArea));
    float distanceToShadowRayLightIntersection = abs(length(lightPoint - origin));

    lightPdf = (distanceToShadowRayLightIntersection * distanceToShadowRayLightIntersection) / (lightArea * max(dot(lightTriangle.normal, -directionToLight), 0.0f));

    // TODO: no hardcodear tarea total triangulos
    // lightPdf = (float(lightIndicesCount) * lightArea) / (dot(lightTriangle.normal, directionToLight));
  } else {
    lightPdf = 1.0f; // Default value if no light is visible
  }
}

/* vec3 bsdf(Triangle triangle, vec3 incomingDir, vec3 outgoingDir, vec3 normal) {
    // Fresnel reflection coefficient (Schlick's approximation)
  float R0 = pow((triangle.ior - 1.0f) / (triangle.ior + 1.0f), 2.0f);
  float cosTheta = (dot((normal), -(incomingDir)));
  float fresnel = R0 + (1.0f - R0) * pow(1.0f - cosTheta, 5.0f);
  fresnel = clamp(fresnel, 0.0f, 1.0f); 

      // Specular reflection for metals
  vec3 specular = vec3(0.0f); // Initialize specular to zero
  // if(triangle.metallic > 0.0f) {
  vec3 specularColor = mix(vec3(1.0f), triangle.color, triangle.metallic);
  specular = specularColor * fresnel;
  // }

    // Diffuse reflection for non-metallic materials
  vec3 diffuse = vec3(0.0f);
  if(triangle.metallic < 1.0f) {
    diffuse = triangle.color * (1.0f - triangle.s);
  }

    // Combine diffuse and specular reflection
  return diffuse * M_1_PI + specular;
} */

float power_heuristic(float pdfDirect, float pdfIndirect) {
  float f1 = pdfDirect * pdfDirect;
  float f2 = pdfIndirect * pdfIndirect;
  return f1 / (f1 + f2);
}

vec3 sample_hemisphere_cosine_weighted(vec2 random_numbers, vec3 normal) {
// cosine-weighted hemisphere sampling 
  // Random polar coordinates
  float theta = 2.0f * M_PI * random_numbers[0]; // Azimuthal angle
  float r = sqrt(random_numbers[1]); // Radius

  // Cartesian coordinates in the local frame
  float x = r * cos(theta);
  float y = r * sin(theta);
  float z = sqrt(1.0f - r * r);

  // Choose the major axis to avoid degeneracies
  vec3 majorAxis = abs(normal.x) < 0.57735026919f ? vec3(1.0f, 0.0f, 0.0f) : abs(normal.y) < 0.57735026919f ? vec3(0.0f, 1.0f, 0.0f) : vec3(0.0f, 0.0f, 1.0f);

  // Create orthonormal basis
  vec3 u = normalize(cross(normal, majorAxis));
  vec3 v = cross(normal, u);
  vec3 w = normal;

  // Transform local direction to world space
  vec3 sample_dir = x * u + y * v + z * w;

  return normalize(sample_dir);
}

vec3 sample_hemisphere_uniform(vec2 random_numbers, vec3 normal) {
  // Random polar coordinates
  float theta = 2.0f * M_PI * random_numbers.x; // Azimuthal angle
  float phi = acos(1.0f - random_numbers.y); // Elevation angle (uniform sampling)

  // Cartesian coordinates in the local frame
  float x = sin(phi) * cos(theta);
  float y = sin(phi) * sin(theta);
  float z = cos(phi);

  // Choose the major axis to avoid degeneracies
  vec3 majorAxis = abs(normal.x) < 0.57735026919f ? vec3(1.0f, 0.0f, 0.0f) : abs(normal.y) < 0.57735026919f ? vec3(0.0f, 1.0f, 0.0f) : vec3(0.0f, 0.0f, 1.0f);

  // Create orthonormal basis
  vec3 u = normalize(cross(normal, majorAxis));
  vec3 v = cross(normal, u);
  vec3 w = normal;

  // Transform local direction to world space
  vec3 sample_dir = x * u + y * v + z * w;

  return normalize(sample_dir);
}

vec3 sample_direction(Triangle triangle, vec3 normal, vec3 incomingDir, inout uvec2 seed, inout float pdf) {
  vec3 reflectedDir = reflect(-incomingDir, normal);

    // Apply roughness to the reflection direction using a microfacet model
  vec3 lambertSample;
  vec3 roughSample;

  if(triangle.metallic > 0.0f) {
    // Use a microfacet distribution to adjust the reflected direction
    roughSample = sample_hemisphere_uniform(get_random_numbers(seed), normal);
    reflectedDir = normalize(mix(reflectedDir, roughSample, triangle.roughness));
  }

  vec3 selectedDir;

    // Calculate the refracted direction
  float eta = 1.0f / triangle.ior; // Assuming the incoming medium is air (IOR = 1.0)
  vec3 refractedDir = refract(-incomingDir, normal, eta);
  if(length(refractedDir) == 0.0f) {
    // Total internal reflection occurs, handle accordingly
    selectedDir = reflectedDir; // Fallback to reflection in case of TIR
  } else {
    selectedDir = refractedDir; // Fallback to reflection in case of TIR

  }

  vec2 rand = get_random_numbers(seed);
  float reflect_prob = triangle.metallic + triangle.specular;
  float refract_prob = triangle.transmission * (1.0f - reflect_prob);
  float diffuse_prob = 1.0f - reflect_prob - refract_prob;

    // Normalize probabilities to ensure they sum to 1
  // float total_prob = reflect_prob + refract_prob + (1.0f - triangle.transmission);
  float total_prob = reflect_prob + refract_prob + diffuse_prob;
  reflect_prob /= total_prob;
  refract_prob /= total_prob;

  if(rand.x < reflect_prob) {
        // Specular reflection selected
    selectedDir = reflectedDir;
    float NdotH = max(dot(normal, normalize(incomingDir + reflectedDir)), 0.0f);
    float HdotV = max(dot(normalize(incomingDir + reflectedDir), reflectedDir), 0.0f);
    float D = triangle.roughness * triangle.roughness /
      (M_PI * pow((NdotH * NdotH * (triangle.roughness * triangle.roughness - 1.0f) + 1.0f), 2.0f));
    pdf = (D * NdotH) / (4.0f * HdotV);
    // pdf = 1.0f / (2.0f * M_PI);
    pdf *= reflect_prob; // Scale by the reflection probability
  } else if(rand.x < reflect_prob + refract_prob) {
        // Refraction selected
    // selectedDir = refractedDir;
    pdf = 1.0f / (2.0f * M_PI); // Example uniform PDF, adjust as needed
    pdf *= refract_prob; // Scale by the refraction probability
  } else {
        // Diffuse reflection selected
    lambertSample = sample_hemisphere_cosine_weighted(get_random_numbers(seed), normal);
    selectedDir = lambertSample;
    float cosTheta = max(dot(normal, lambertSample), 0.0f);
    pdf = cosTheta * M_1_PI;
    pdf *= diffuse_prob; // Scale by the diffuse probability
  }

  return selectedDir;

}

/* vec3 sample_direction(Triangle triangle, vec3 normal, vec3 incomingDir, inout uvec2 seed) {
    // Calculate the reflected direction based on the incoming direction and surface normal
  vec3 reflectedDir = reflect(-incomingDir, normal);

    // Apply roughness to the reflection direction using a microfacet model
  if(triangle.roughness > 0.0f) {
        // Sample a random direction in the hemisphere around the normal
    vec3 roughSample = sample_hemisphere_cosine_weighted(get_random_numbers(seed), normal);

        // Mix the perfect reflection direction with the rough sampled direction based on the roughness value
    reflectedDir = normalize(mix(reflectedDir, roughSample, triangle.roughness));
  }

    // Return the final reflected direction
  return reflectedDir;
} */

vec3 bsdf(Triangle triangle, vec3 incomingDir, vec3 outgoingDir, vec3 normal) {

  vec3 halfVector = normalize(incomingDir + outgoingDir);
  float NdotL = max(dot(normal, incomingDir), 0.0f);
  float NdotV = max(dot(normal, outgoingDir), 0.0f);
  float NdotH = max(dot(normal, halfVector), 0.0f);
  float HdotV = max(dot(halfVector, outgoingDir), 0.0f);

  float alpha = triangle.roughness * triangle.roughness;
  float alpha2 = alpha * alpha;

  float D = alpha2 / (M_PI * (((NdotH * NdotH) * (alpha2 - 1.0f)) + 1.0f) * (((NdotH * NdotH) * (alpha2 - 1.0f)) + 1.0f));

  float kDirect = ((alpha + 1.0f) * (alpha + 1.0f)) / (8.0f);
  float Gv = (NdotV) / (NdotV * (1.0f - kDirect) + kDirect);
  float Gl = (NdotL) / (NdotL * (1.0f - kDirect) + kDirect);
  float G = Gv * Gl;

    // Fresnel (F) - Schlick's approximation
  vec3 F0 = vec3(0.04f);
  F0 = (mix(F0, triangle.color, triangle.metallic));

  vec3 F = F0 + (1.0f - F0) * pow(clamp(1.0f - HdotV, 0.0f, 1.0f), 5.0f);//F0 + (1.0f - F0) * pow(clamp
  // F *= triangle.specular; // Scale by specular intensity

    // Specular BRDF component
  vec3 specular = (D * G * F) / (4.0f * NdotL * NdotV + EPSILON);

    // Diffuse BRDF component
  vec3 diffuse = vec3(0.0f);
  // vec3 diffuse = triangle.color * M_1_PI; // Lambertian reflection (1/π for energy conservation)

  if(triangle.metallic == 0.0f) {
    diffuse = triangle.color * M_1_PI; // Lambertian reflection (1/π for energy conservation)
  }
  vec3 kD = vec3(1.0f) - F;
// kD *= 1.0f - triangle.metallic;

    // Combine specular and diffuse components
  return diffuse * kD + specular;

}

struct BSDFResult {
  vec3 direction; // Sampled outgoing direction
  vec3 bsdfValue; // BSDF value for the sampled direction
  float pdf;      // PDF value for the sampled direction
};
float calculate_pdf(Triangle triangle, vec3 normal, vec3 sampledDir, vec3 incomingDir) {
  float cosTheta = max(dot(normal, sampledDir), 0.0f);

  if(triangle.transmission > 0.0f) {
        // Transmission (Glass/Dielectric)
    return 1.0f; // For refraction, the PDF can be treated as delta, hence 1.0f if sampled correctly.
  } else if(triangle.roughness < 0.05f) {
        // Specular Reflection (Perfect Mirror)
    return 1.0f; // Perfect reflection; assume delta distribution for the reflection direction.
  } else if(triangle.roughness < 1.0f) {
        // Glossy Reflection (Microfacet Model)
    vec3 halfVector = normalize(incomingDir + sampledDir);
    float NdotH = max(dot(normal, halfVector), 0.0f);

        // GGX PDF for the microfacet distribution
    float alpha = triangle.roughness * triangle.roughness;
    float alpha2 = alpha * alpha;
    float denom = (NdotH * NdotH * (alpha2 - 1.0f) + 1.0f);
    float D = alpha2 / (M_PI * denom * denom);

    float pdf = D * NdotH / (4.0f * dot(halfVector, sampledDir));
    return pdf;
  } else 
        // Diffuse (Lambertian) Material
    return cosTheta * M_1_PI;

}

/* float calculate_pdf(Triangle triangle, vec3 normal, vec3 sampledDir, vec3 incomingDir) {
  float cosTheta = max(dot(normal, sampledDir), 0.0f);

  if(triangle.transmission > 0.0f) {
        // Transmission (Glass/Dielectric)
    return 1.0f; // For refraction, the PDF can be treated as delta, hence 1.0f if sampled correctly.
  } else if(triangle.roughness < 0.05f) {
        // Specular Reflection (Perfect Mirror)
    return 1.0f; // Perfect reflection; assume delta distribution for the reflection direction.
  } else if(triangle.roughness < 1.0f) {
        // Glossy Reflection (Microfacet Model)
    vec3 halfVector = normalize(incomingDir + sampledDir);
    float NdotH = max(dot(normal, halfVector), 0.0f);

        // GGX PDF for the microfacet distribution
    float alpha = triangle.roughness * triangle.roughness;
    float alpha2 = alpha * alpha;
    float denom = (NdotH * NdotH * (alpha2 - 1.0f) + 1.0f);
    float D = alpha2 / (M_PI * denom * denom);

    float pdf = D * NdotH / (4.0f * dot(halfVector, sampledDir));
    return pdf;
  } else 
        // Diffuse (Lambertian) Material
    return cosTheta * M_1_PI;

} */

/* float calculate_pdf(Triangle triangle, vec3 normal, vec3 sampledDir, vec3 incomingDir) {
  float cosTheta = max(dot(normal, sampledDir), 0.0f);
  if(triangle.transmission > 0.0f) {
        // Transmission (Glass/Dielectric)
    return 1.0f; // For refraction, the PDF can be treated as delta, hence 1.0f if sampled correctly.
  } else if(triangle.roughness < 1.0f) {
            // Glossy Reflection (Microfacet Model)
    vec3 halfVector = normalize(incomingDir + sampledDir);
    float NdotH = max(dot(normal, halfVector), 0.0f);

        // GGX PDF for the microfacet distribution
    float alpha = triangle.roughness * triangle.roughness;
    float alpha2 = alpha * alpha;
    float denom = (NdotH * NdotH * (alpha2 - 1.0f) + 1.0f);
    float D = alpha2 / (M_PI * denom * denom);

    float pdf = D * NdotH / (4.0f * dot(halfVector, sampledDir));
    return pdf;
  } else {
        // Diffuse (Lambertian) Material
    return cosTheta * M_1_PI;
  }
} */

vec3 get_ray_radiance(vec3 origin, vec3 direction, inout uvec2 seed) {
  vec3 radiance = vec3(0.0f);
  vec3 throughput_weight = vec3(1.0f);
  float directLighting, indirectLighting;
  for(int i = 0; i < maxPathLength; i++) {
    float t;
    Triangle triangle;

    if(ray_bvh_intersection_hit_miss(t, triangle, origin, direction)) {

      // If it's the first step and the triangle is emmissive - it's a light, stop the algorithm
      if(/* i == 0 && */ (triangle.emission.x > 0.0f || triangle.emission.y > 0.0f || triangle.emission.z > 0.0f)) {
        if(i == 0)
          radiance = triangle.color * triangle.emission;
        return radiance;
        // break;
      }

      vec3 rayTriangleIntersectionPoint = (origin + triangle.normal * EPSILON) + t * direction; // epsilon to avoid self intersection

      // Next Event Estimation

      float MISweight;
      Triangle lightTriangle;
      vec3 lightPoint = vec3(0.0f, 0.0f, 0.0f);
      float lightPdf = 1.0f;
      float lightArea = 0.0f;
      sample_random_light(seed, lightTriangle, lightPoint, lightPdf, lightArea, rayTriangleIntersectionPoint);

      vec3 directionToShadowRayLightIntersection = normalize(lightPoint - rayTriangleIntersectionPoint);
      float distanceToShadowRayLightIntersection = abs(length(lightPoint - rayTriangleIntersectionPoint));

      vec3 direct_light = vec3(0.0f);
      // Check visibility of the light source
      if(dot(triangle.normal, directionToShadowRayLightIntersection) > 0.0f && dot(lightTriangle.normal, -directionToShadowRayLightIntersection) > 0.0f) {

        Triangle blockingTriangle;
        float tBlockingTriangle;
        bool hits = ray_bvh_intersection_hit_miss(tBlockingTriangle, blockingTriangle, rayTriangleIntersectionPoint, directionToShadowRayLightIntersection);

        // if doesn't hit anything or hits and it's the light source or a transmittant material?????????
        if(!hits || (hits && (blockingTriangle.emission != vec3(0.0f)/*  || blockingTriangle.transmission > 0.0f */))) {
          // Calculate direct light contribution

          float solid_angle = max(dot(lightTriangle.normal, -directionToShadowRayLightIntersection), 0.0f) / (distanceToShadowRayLightIntersection * distanceToShadowRayLightIntersection);

          // vec3 brdf = triangle.color * M_1_PI * dot(triangle.normal, directionToShadowRayLightIntersection);
          // vec3 brdf = bsdf(triangle, directionToShadowRayLightIntersection, -direction, triangle.normal);
                    // Apply MIS weight
          // float brdfPdf;// = lightPdf * solid_angle; // Approximation, adjust based on your implementation
          // float brdfPdf = dot(lightTriangle.normal, -directionToShadowRayLightIntersection) * M_1_PI;
          // sample_direction(triangle, triangle.normal, directionToShadowRayLightIntersection, seed, brdfPdf);
          // brdfPdf = lightPdf * solid_angle; // Approximation, adjust based on your implementation

          // lightPdf = ((distanceToShadowRayLightIntersection * distanceToShadowRayLightIntersection) / (lightArea * max(dot(lightTriangle.normal, normalize(-directionToShadowRayLightIntersection)), 0.0f)));

          // MISweight = power_heuristic(lightPdf, brdfPdf);
          direct_light = lightTriangle.emission * (solid_angle / lightPdf);

        }

      }

      // radiance += throughput_weight * triangle.emission;

      // vec3 new_direction = sample_hemisphere_cosine_weighted(get_random_numbers(seed), triangle.normal);

      float pdf;
      vec3 new_direction = sample_direction(triangle, triangle.normal, -direction, seed, pdf);

      float cos_theta = dot(new_direction, triangle.normal);
      if(cos_theta < 0.0f && triangle.transmission == 0.0f) {
        break; // Skip if the new direction is below the surface
      } 

      // vec3 eval = triangle.color * M_1_PI * dot(new_direction, triangle.normal);
      // vec3 brdf = triangle.color * M_1_PI; // aka eval?

      // float pdf = cos_theta * M_1_PI;
      // vec3 brdf = triangle.color * M_1_PI;

      // float pdf = (cos_theta * M_1_PI); // Update for correct PDF considering specular and transmission
      // Compute PDF for this direction
      // float pdf = calculate_pdf(triangle, triangle.normal, new_direction, direction);

      vec3 brdf = bsdf(triangle, new_direction, -direction, triangle.normal);
      MISweight = power_heuristic(lightPdf, pdf);

      // throughput_weight *= eval / pdf;
      if(pdf > 0.0f)
        throughput_weight *= (brdf * cos_theta) / pdf;


      radiance += throughput_weight * direct_light * vec3(MISweight);

      // Update the direction for the next bounce
      origin = rayTriangleIntersectionPoint;
      direction = new_direction;

      if(length(throughput_weight) < 0.001f) {
        if(get_random_numbers(seed).x > 0.1f)
          break;
        throughput_weight /= 0.1f;
      }
    } else {
      // radiance += throughput_weight * vec3(0.0f);

      break;
    }
  }
  return radiance;
}

void main() {
  getRowAndColCount();
  //gl_FragColor = vec4(color, 1.0);

    // Define the camera position and the view plane

    // Compute the camera ray
  // vec2 tex_coord = gl_FragCoord.xy / windowSize;
  vec2 tex_coord = (gl_FragCoord.xy /* + vec2(float(quadX * quadSize), float(quadY * quadSize)) */) / windowSize;
  // vec2 tex_coord = (gl_FragCoord.xy + vec2(float(max(quadX * quadSize), windowSize.x), float(max(quadY * quadSize, windowSize.y)))) / windowSize;

  if(aspectRatio > 1.0f) {
     // if width is bigger than height
     // if image is wider
    tex_coord.x *= aspectRatio;
    tex_coord.x -= 0.125f;
  } else if(aspectRatio < 1.0f) {
    tex_coord.y /= aspectRatio;
    tex_coord.y -= 0.125f;
  };

  vec3 ray_direction = get_primary_ray_direction(tex_coord.x, tex_coord.y, cameraSource, cameraLeftBottom, cameraRight, cameraUp);

  vec4 currentColor;
  currentColor.rgb = vec3(0.0f);
  currentColor.a = 1.0f;

  uvec2 seed = uvec2(gl_FragCoord) ^ uvec2(timestamp << 16);

  // Perform path tracing with sampleCount paths
  for(int i = 0; i != sampleCount; ++i) {
    currentColor.rgb += get_ray_radiance(cameraSource, ray_direction, seed);
  }
  currentColor.rgb /= float(sampleCount);
  currentColor.rgb = clamp(currentColor.rgb, 0.0f, 1.0f);

  currentColor.rgb = clamp(currentColor.rgb, 0.0f, 1.0f);

  // Get the color from the previous frame
  vec4 previousColor = getPreviousColorFromPreviousFrameTexture(tex_coord);
  previousColor.rgb = clamp(previousColor.rgb, 0.0f, 1.0f);

  // Blend the current color with the previous color
  // float blendFactor = 0.5;
  float blendFactor = 1.0f / float(frameNumber + 1); // converges faster
  // float blendFactor = 1.0 - (float(frameNumber)) / ((float(totalFrames) + 1.0) * 2.0);
  // float blendFactor = 1.0f - (float(frameNumber)) / ((float(totalFrames)));
  vec4 blendedColor = mix(previousColor, currentColor, blendFactor);
  // vec4 blendedColor = mix(previousColor, currentColor, 0.2);

    // Apply exposure control
/*   vec3 finalColor = vec3(1.0) - exp(-blendedColor.rgb * 0.5); */

  // outColor = vec4(blendedColor.rgb, 1.0f);
  // blendedColor.rgb = clamp(blendedColor.rgb, 0.0f, 1.0f);

    // blendedColor = ((previousColor * float(sampleCount)) + currentColor) / float(frameNumber + 1); // converges faster

  // vec3 gammaCorrectedColor = pow(blendedColor.rgb, vec3(1.0f / 2.2f));
  outColor = vec4(blendedColor.rgb, 1.0f);
  // outColor = getBVHNode(7).triangleInorderIndex == -2 ? vec4(0.0f,  1.0f, 0.0f, 1.0f) : vec4(1.0f,  0.0f, 0.0f, 1.0f);

}