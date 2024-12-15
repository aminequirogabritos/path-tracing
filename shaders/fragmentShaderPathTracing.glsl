#version 300 es
#define M_PI 3.141592653589793238462643
#define M_1_PI 0.3183098861837907
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

/* bool is_light_visible(vec3 origin, vec3 light_point, Triangle light_triangle, vec3 direction) {
  float t;
  Triangle blocking_triangle;
  bool hits = ray_bvh_intersection_hit_miss(t, blocking_triangle, origin, direction);

    // If the ray hits something and it's not the light itself, the light is blocked
  if(hits && (blocking_triangle.emission != light_triangle.emission)) {
    return false;
  }
  return true;
} */


bool is_light_visible(vec3 origin, vec3 light_point, Triangle light_triangle, vec3 direction) {
  float t;
  Triangle blocking_triangle;

    // Check if any geometry blocks the ray
  bool hits = ray_bvh_intersection_hit_miss(t, blocking_triangle, origin, direction);

    // Determine if the blocking geometry is the light itself
  if(hits) {
    float hitDistance = t * length(direction);
    float lightDistance = length(light_point - origin);

        // If hit distance is significantly smaller, the light is blocked
    if(abs(hitDistance - lightDistance) > 1e-4f) {
      return false;
    }
  }

  return true;
}

/* void sample_random_light(inout uvec2 seed, inout Triangle lightTriangle, inout vec3 lightPoint, inout float lightPdf, inout float lightArea, vec3 origin) {
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
    lightPdf = (1.0f / (float(lightIndicesCount) * lightArea));
    float distanceToShadowRayLightIntersection = abs(length(lightPoint - origin));

    // lightPdf = (distanceToShadowRayLightIntersection * distanceToShadowRayLightIntersection) / (lightArea * max(dot(lightTriangle.normal, -directionToLight), 0.0f));

    // TODO: no hardcodear tarea total triangulos
    // lightPdf = (float(lightIndicesCount) * lightArea) / (dot(lightTriangle.normal, directionToLight));

    // float distanceToLight = length(lightPoint - origin);
    // float solidAngle = lightArea / (distanceToLight * distanceToLight);
    // lightPdf = solidAngle / (float(lightIndicesCount) * lightArea);

  } else {
    lightPdf = 0.5f; // Default value if no light is visible
  }
} */


void sample_random_light(inout uvec2 seed, inout Triangle lightTriangle, inout vec3 lightPoint, inout float lightPdf, inout float lightArea, vec3 origin) {
  lightPdf = 0.0f; // Default to no light contribution
  for(int i = 0; i < lightIndicesCount; ++i) {
    int lightIndex = getIndexFromLightIndicesTexture(i);
    Triangle currentTriangle = getTriangleFromTextures(lightIndex);

        // Generate a random point on the triangle using barycentric coordinates
    vec2 r = get_random_barycentric(seed);
    vec3 currentLightPoint = (1.0f - r.x - r.y) * currentTriangle.vertex0 + r.x * currentTriangle.vertex1 + r.y * currentTriangle.vertex2;

        // Calculate the direction to the light and check visibility
    vec3 directionToLight = normalize(currentLightPoint - origin);
    if(is_light_visible(origin, currentLightPoint, currentTriangle, directionToLight)) {
            // Compute light area and PDF
      float currentLightArea = 0.5f * length(cross(currentTriangle.vertex1 - currentTriangle.vertex0, currentTriangle.vertex2 - currentTriangle.vertex0));
      float currentLightPdf = 1.0f / (float(lightIndicesCount) * currentLightArea);

            // Assign the first visible light and exit
      lightTriangle = currentTriangle;
      lightPoint = currentLightPoint;
      lightPdf = currentLightPdf;
      lightArea = currentLightArea;
      return;
    }
  }

    // If no light is visible, set a default PDF
  lightPdf = 0.5f; // Placeholder for missed lights
}

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

vec3 sample_ggx(vec2 random, vec3 normal, float roughness) {
  float alpha = roughness * roughness;

  float phi = 2.0f * M_PI * random.x;
  float cosTheta = sqrt((1.0f - random.y) / (1.0f + (alpha * alpha - 1.0f) * random.y));
  float sinTheta = sqrt(1.0f - cosTheta * cosTheta);

  vec3 H = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);

  vec3 tangent = normalize(cross(abs(normal.z) > 0.1f ? vec3(1, 0, 0) : vec3(0, 0, 1), normal));
  vec3 bitangent = cross(normal, tangent);
  vec3 sampledDir = normalize(H.x * tangent + H.y * bitangent + H.z * normal);

  return sampledDir;
}

float calculate_pdf(vec3 incomingDir, vec3 selectedDir, vec3 normal, Triangle triangle, float rand) {
  float pdf = 0.0f;

  vec3 halfwayDir = normalize(incomingDir + selectedDir);
  float NdotH = max(dot(normal, halfwayDir), 0.0f);
  float HdotV = max(dot(halfwayDir, selectedDir), 0.0f);

  float reflect_prob = triangle.metallic;// + triangle.specular;
  // float refract_prob = triangle.transmission * (1.0f - reflect_prob);
  // float diffuse_prob = 1.0f - reflect_prob - refract_prob;
  float diffuse_prob = 1.0f - reflect_prob;

    // Calculate PDF based on surface type
  if(rand < reflect_prob) {  // Specular reflection case

            // For rough reflections
    float alpha = triangle.roughness * triangle.roughness;
    float alpha2 = alpha * alpha;
    float D = alpha2 /
      (M_PI * pow(((NdotH * NdotH) * (alpha2 - 1.0f) + 1.0f), 2.0f));
    pdf = (D * HdotV) / (4.0f * HdotV);
    // pdf = 0.0f;

    pdf *= reflect_prob; // Scale by reflection probability
/*   } else if(rand < reflect_prob + refract_prob) {
        // Refraction case
    pdf = 1.0f / (2.0f * M_PI); // Example uniform PDF, adjust as needed
    pdf *= refract_prob; */ // Scale by refraction probability
  } else {
        // Diffuse reflection case
    float cosTheta = max(dot(normal, selectedDir), 0.0f);
    pdf = cosTheta * M_1_PI;
    pdf *= diffuse_prob; // Scale by diffuse probability
  }

  return pdf;
}

vec3 sample_direction(Triangle triangle, vec3 normal, vec3 incomingDir, inout uvec2 seed, inout float pdf) {
    // Reflect the incoming direction
  vec3 reflectedDir = reflect(-incomingDir, normal);

    // Apply GGX sampling for rough reflections
  vec3 roughSample = sample_ggx(get_random_numbers(seed), normal, triangle.roughness);
  vec3 selectedDir = normalize(mix(reflectedDir, roughSample, triangle.roughness));

  vec2 rand = get_random_numbers(seed);
    // Calculate the PDF for the selected direction
  pdf = calculate_pdf(incomingDir, selectedDir, normal, triangle, rand.x);

  return selectedDir;
}

/* float calculate_pdf() {

} */

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

  float kDirect = ((triangle.roughness + 1.0f) * (triangle.roughness + 1.0f)) / (8.0f);
  float Gv = (NdotV) / (NdotV * (1.0f - kDirect) + kDirect);
  float Gl = (NdotL) / (NdotL * (1.0f - kDirect) + kDirect);
  float G = Gv * Gl;

    // Fresnel (F) - Schlick's approximation
  vec3 F0 = vec3(0.04f);
  F0 = (mix(F0, triangle.color, triangle.metallic));
  // F0 = vec3((triangle.ior - 1.0) * (triangle.ior - 1.0)) / ((triangle.ior + 1.0) * (triangle.ior + 1.0));

  vec3 F = F0 + (1.0f - F0) * pow(clamp(1.0f - HdotV, 0.0f, 1.0f), 5.0f);

    // Specular BRDF component
  vec3 specular = (D * G * F) / (4.0f * NdotL * NdotV + EPSILON);

    // Diffuse BRDF component
  vec3 diffuse = vec3(0.0f);

  // if(triangle.metallic == 0.0f) {
  diffuse = triangle.color * (M_1_PI * max(dot(triangle.normal, outgoingDir), 0.0f)); // Lambertian reflection (1/π for energy conservation)

  // }
  vec3 kD = vec3(1.0f) - F;
  kD *= 1.0f - triangle.metallic;

    // Combine specular and diffuse components
  return (diffuse * kD + specular);

}

vec3 get_ray_radiance(vec3 origin, vec3 direction, inout uvec2 seed) {
  vec3 radiance = vec3(0.0f);
  vec3 throughput_weight = vec3(1.0f);

  float tPrimaryTriangle;
  Triangle primaryTriangle;
  vec3 originPrimaryTriangle = origin;
  vec3 directionPrimaryTriangle = direction;

  for(int i = 0; i < maxPathLength; i++) {
    float t;
    Triangle triangle;
    float pdf;
    vec3 new_direction;

    if(ray_bvh_intersection_hit_miss(tPrimaryTriangle, primaryTriangle, originPrimaryTriangle, directionPrimaryTriangle)) {

      // If it's the first step and the triangle is emmissive - it's a light, stop the algorithm
      if(i == 0 && primaryTriangle.emission != vec3(0.0f)) {
        radiance = primaryTriangle.color * primaryTriangle.emission;
        return radiance;
      }

    // vec3 rayPrimaryTriangleIntersectionPoint = (originPrimaryTriangle + primaryTriangle.normal * EPSILON) + tPrimaryTriangle * directionPrimaryTriangle; // epsilon to avoid self intersection

      vec3 intersection = originPrimaryTriangle + tPrimaryTriangle * directionPrimaryTriangle;
      vec3 rayPrimaryTriangleIntersectionPoint = intersection + primaryTriangle.normal * EPSILON;
      // vec3 rayPrimaryTriangleIntersectionPoint = (originPrimaryTriangle + primaryTriangle.normal * EPSILON) + tPrimaryTriangle * directionPrimaryTriangle; // epsilon to avoid self intersection

      // Next Event Estimation

      float MISweight;
      Triangle lightTriangle;
      vec3 lightPoint = vec3(0.0f, 0.0f, 0.0f);
      float lightPdf = 1.0f;
      float lightArea = 0.0f;

      int j;
      int maxLightSamples = min(lightIndicesCount, 10); // TODO: change to constant

      // for(j = 0; j < maxLightSamples; j++) {

      sample_random_light(seed, lightTriangle, lightPoint, lightPdf, lightArea, /* origin of the ray: */rayPrimaryTriangleIntersectionPoint);

      vec3 directionToShadowRayLightIntersection = normalize(lightPoint - rayPrimaryTriangleIntersectionPoint);
      float distanceToShadowRayLightIntersection = abs(length(lightPoint - rayPrimaryTriangleIntersectionPoint));

      vec3 direct_light = vec3(0.0f);
      // Check visibility of the light source
      if(dot(primaryTriangle.normal, directionToShadowRayLightIntersection) > 0.0f && dot(lightTriangle.normal, -directionToShadowRayLightIntersection) > 0.0f) {

        Triangle blockingTriangle;
        float tBlockingTriangle;
        bool hits = ray_bvh_intersection_hit_miss(tBlockingTriangle, blockingTriangle, rayPrimaryTriangleIntersectionPoint, directionToShadowRayLightIntersection);

        // if doesn't hit anything or hits and it's the light source or a transmittant material?????????
        if(!hits || (hits && (blockingTriangle.emission != vec3(0.0f)/*  || blockingTriangle.transmission > 0.0f */))) {
          // Calculate direct light contribution

          float solid_angle = max(dot(lightTriangle.normal, -directionToShadowRayLightIntersection), 0.0f) / (distanceToShadowRayLightIntersection * distanceToShadowRayLightIntersection);

          vec3 brdf = bsdf(primaryTriangle, -directionPrimaryTriangle, directionToShadowRayLightIntersection, primaryTriangle.normal);

          float brdfPdf = calculate_pdf(-directionPrimaryTriangle, directionToShadowRayLightIntersection, primaryTriangle.normal, primaryTriangle, get_random_numbers(seed).x);

          MISweight = power_heuristic(lightPdf, brdfPdf);
          // Compute direct light contribution
          direct_light = (lightTriangle.emission) * solid_angle * brdf * vec3(MISweight) / lightPdf;
/* * (max(dot(primaryTriangle.normal, directionToShadowRayLightIntersection), 0.0f))  */
          // outColor = vec4(brdf, 1.0f);

          // radiance += throughput_weight * direct_light; * vec3(MISweight);

        }

      }
      radiance += throughput_weight * direct_light;

      // }

      // float pdf;
      new_direction = sample_direction(primaryTriangle, primaryTriangle.normal, -directionPrimaryTriangle, seed, pdf);

// solid_angle = max(dot(lightTriangle.normal, -directionToShadowRayLightIntersection), 0.0f) / (distanceToShadowRayLightIntersection * distanceToShadowRayLightIntersection);

      float cos_theta = max(dot(new_direction, primaryTriangle.normal), 0.0f);

      if(cos_theta < 0.0f && primaryTriangle.transmission == 0.0f) {
        break; // Skip if the new direction is below the surface
      }

      vec3 brdf = bsdf(primaryTriangle, -directionPrimaryTriangle, new_direction, primaryTriangle.normal);

      MISweight = power_heuristic(lightPdf, pdf);

      if(pdf > 0.0f)
        throughput_weight *= brdf * cos_theta / pdf; // Update throughput

      originPrimaryTriangle = rayPrimaryTriangleIntersectionPoint;
      directionPrimaryTriangle = new_direction;

      if(length(throughput_weight) < 0.001f) {
        if(get_random_numbers(seed).x > 0.1f)
          break;
        throughput_weight /= 0.1f;
      }
    } else {

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
  vec2 tex_coord = (gl_FragCoord.xy) / windowSize;

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
  float blendFactor = 1.0f / float(frameNumber + 1); // converges faster
  vec4 blendedColor = mix(previousColor, currentColor, blendFactor);

    // Apply exposure control
/*   vec3 finalColor = vec3(1.0) - exp(-blendedColor.rgb * 0.5); */

  // outColor = vec4(blendedColor.rgb, 1.0f);
  // blendedColor.rgb = clamp(blendedColor.rgb, 0.0f, 1.0f);

    // blendedColor = ((previousColor * float(sampleCount)) + currentColor) / float(frameNumber + 1); // converges faster

  // vec3 gammaCorrectedColor = pow(blendedColor.rgb, vec3(1.0f / 2.2f));
  outColor = vec4(blendedColor.rgb, 1.0f);
  // outColor = getBVHNode(7).triangleInorderIndex == -2 ? vec4(0.0f,  1.0f, 0.0f, 1.0f) : vec4(1.0f,  0.0f, 0.0f, 1.0f);

}