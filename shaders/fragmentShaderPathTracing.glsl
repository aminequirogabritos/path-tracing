#version 300 es
#define M_PI 3.141592653589793238462643
#define M_1_PI 0.3183098861837907
#define SCALING_FACTOR 1.0f
#define EPSILON 0.00001
#define FILTER_GLOSSY 0.2f

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
  float metallic;
  float roughness;
};

struct BVHNode {
  vec3 minBounds;
  vec3 maxBounds;
  int firstTriangleIndex;
  int triangleCount;
  int missLink;
};

uniform sampler2D coordinatesTexture;
uniform sampler2D normalsTexture;
uniform sampler2D colorsTexture;
uniform sampler2D emissionsTexture;
uniform sampler2D metallicsTexture;
uniform sampler2D roughnessesTexture;

uniform sampler2D lightIndicesTexture;

uniform sampler2D nodesBoundingBoxesMins;
uniform sampler2D nodesBoundingBoxesMaxs;
uniform sampler2D nodesMissLinkIndices;
uniform sampler2D nodesFirstTriangleIndex;
uniform sampler2D nodesTrianglesCount;
uniform sampler2D inorderTrianglesIndicesArray;
uniform sampler2D previousFrameTexture;

uniform vec2 windowSize;
uniform float aspectRatio;
uniform vec3 cameraSource;
uniform vec3 cameraUp;
uniform vec3 cameraRight;
uniform vec3 cameraLeftBottom;
uniform int vertexCount;
uniform int triangleCount;
uniform int lightIndicesCount;
uniform int timestamp;
uniform int maxPathLength;
uniform int sampleCount;
uniform int sampleNumber;
uniform int bvhNodeCount;
uniform int maxTextureSize;

out vec4 outColor;

int coordinatesTexColCount;

int trianglesTexColCount;

int nodesTexColCount;

int lightsIndicesTexColCount;

void getColCount() {
  coordinatesTexColCount = min(vertexCount, maxTextureSize);

  trianglesTexColCount = min(triangleCount, maxTextureSize);

  nodesTexColCount = min(bvhNodeCount, maxTextureSize);

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
  triangle.metallic = texelFetch(metallicsTexture, texCoord, 0).x;
  triangle.roughness = texelFetch(roughnessesTexture, texCoord, 0).x;

  return triangle;

}

BVHNode getBVHNode(int index) {
  BVHNode node;

  ivec2 texCoord = ivec2(index % nodesTexColCount, index / nodesTexColCount);

  node.minBounds = texelFetch(nodesBoundingBoxesMins, texCoord, 0).xyz;
  node.maxBounds = texelFetch(nodesBoundingBoxesMaxs, texCoord, 0).xyz;
  node.firstTriangleIndex = int(texelFetch(nodesFirstTriangleIndex, texCoord, 0).x);
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
  if (a > epsilon && a < epsilon)
    return false;    // This ray is parallel to this triangle.
  float f = 1.0f / a;
  vec3 s = origin - triangle.vertex0;
  float u = f * dot(s, h);
  if (u < 0.0f || u > 1.0f)
    return false;
  vec3 q = cross(s, edge1);
  float v = f * dot(direction, q);
  if (v < 0.0f || u + v > 1.0f)
    return false;
    // At this stage we can compute t to find out where the intersection point is on the line.
  float t = f * dot(edge2, q);
  if (t > epsilon) { // ray intersection
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
  for (int i = 0; i < triangleCount; i++) {
    Triangle triangle = getTriangleFromTextures(i);
    float t;
    if (ray_triangle_intersection(t, origin, direction, triangle) && t < out_t) {
      out_t = t;
      out_triangle = triangle;
    }
  }
  return out_t < 1.0e38f;
}

bool ray_bvh_intersection_hit_miss(out float out_t, out Triangle out_triangle, vec3 origin, vec3 direction) {
  out_t = 1.0e38f;
  int currentIndex = 0; // Start with the root node

  while (currentIndex != -1 && currentIndex < bvhNodeCount) {
    BVHNode currentNode = getBVHNode(currentIndex);

    // Check if the ray intersects the bounding box
    if (ray_box_intersection(origin, direction, currentNode.minBounds, currentNode.maxBounds)) {

      if (currentNode.firstTriangleIndex != -2) {

        for (int i = currentNode.firstTriangleIndex; i < currentNode.firstTriangleIndex + currentNode.triangleCount; i++) {
          int triangleIndex = getIndexFromInorderTrianglesIndicesArray(i);
          Triangle triangle = getTriangleFromTextures(triangleIndex);
          float t;
          if (ray_triangle_intersection(t, origin, direction, triangle) && t < out_t) {
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
  if (r1 + r2 > 1.0f) {
    r1 = 1.0f - r1;
    r2 = 1.0f - r2;
  }

  return vec2(r1, r2);
}

bool is_light_visible(vec3 origin, vec3 light_point, vec3 direction) {
  float t;
  Triangle blocking_triangle;

  // Check if any geometry blocks the ray
  bool hits = ray_bvh_intersection_hit_miss(t, blocking_triangle, origin, direction);

  // Determine if the blocking geometry is the light itself
  if (hits) {
    float hitDistance = t * length(direction);
    float lightDistance = length(light_point - origin);

    // If hit distance is significantly smaller, the light is blocked
    if (abs(hitDistance - lightDistance) > 1e-4f) {
      return false;
    }
  }

  return true;
}

void sample_random_light(inout uvec2 seed, inout Triangle lightTriangle, inout vec3 lightPoint, inout float lightPdf, inout float lightArea, vec3 origin, inout bool hitsLight) {

  for (int i = 0; i < lightIndicesCount; ++i) {
    int lightIndex = getIndexFromLightIndicesTexture(i);
    Triangle currentTriangle = getTriangleFromTextures(lightIndex);

    // Generate a random point on the triangle using barycentric coordinates
    vec2 r = get_random_barycentric(seed);
    vec3 currentLightPoint = (1.0f - r.x - r.y) * currentTriangle.vertex0 + r.x * currentTriangle.vertex1 + r.y * currentTriangle.vertex2;

    // Calculate the direction to the light and check visibility
    vec3 directionToLight = normalize(currentLightPoint - origin);
    if (is_light_visible(origin, currentLightPoint, directionToLight)) {

      hitsLight = true;

      // Compute light area
      float currentLightArea = 0.5f * length(cross(currentTriangle.vertex1 - currentTriangle.vertex0, currentTriangle.vertex2 - currentTriangle.vertex0));

      // Compute light PDF
      float currentLightPdf = 1.0f / (float(lightIndicesCount) * currentLightArea);

      // Assign the first visible light and exit
      lightTriangle = currentTriangle;
      lightPoint = currentLightPoint;
      lightPdf = currentLightPdf;
      lightArea = currentLightArea;
      return;
    }
  }
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

vec3 sample_ggx(vec2 random, vec3 normal, vec3 incomingDir, float roughness) {

  float alpha = max(roughness * roughness, 0.001f);

  float phi = 2.0f * M_PI * random.x;
  float cosTheta = sqrt((1.0f - random.y) / (1.0f + (alpha * alpha - 1.0f) * random.y));
  float sinTheta = sqrt(1.0f - cosTheta * cosTheta);

  vec3 H = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);

  vec3 tangent = normalize(cross(abs(normal.z) > 0.1f ? vec3(1, 0, 0) : vec3(0, 0, 1), normal));
  vec3 bitangent = cross(normal, tangent);
  H = normalize(H.x * tangent + H.y * bitangent + H.z * normal);

  vec3 L = reflect(-incomingDir, H);
  return normalize(L);
}

float calculate_pdf(vec3 incomingDir, vec3 selectedDir, vec3 normal, Triangle triangle, float rand) {
  float pdf = 0.0f;

  vec3 halfwayDir = normalize(incomingDir + selectedDir);
  float NdotH = max(dot(normal, halfwayDir), 0.0f);
  float HdotV = max(dot(halfwayDir, selectedDir), 0.0f);
  float HdotL = max(dot(selectedDir, halfwayDir), 0.001f);

  float reflect_prob = triangle.metallic;
  float diffuse_prob = 1.0f - triangle.metallic;

  // For rough reflections
  float alpha = max(triangle.roughness * triangle.roughness, 0.001f);
  float alpha2 = alpha * alpha;

  float D = alpha2 /
    (M_PI * pow(((NdotH * NdotH) * (alpha2 - 1.0f) + 1.0f), 2.0f));

  float specular_pdf = (D * NdotH) / (4.0f * HdotL);

  // Diffuse reflection case
  float cosTheta = max(dot(normal, selectedDir), 0.0f);
  float diffuse_pdf = cosTheta * M_1_PI;

  pdf = specular_pdf * reflect_prob + diffuse_pdf * diffuse_prob;

  return pdf;
}

vec3 sample_direction(Triangle triangle, vec3 normal, vec3 incomingDir, inout uvec2 seed, inout float out_pdf, inout bool isSpecular) {

  vec2 rand = get_random_numbers(seed);

  float reflect_prob = triangle.metallic;
  reflect_prob = clamp(reflect_prob, 0.0f, 1.0f);

  vec3 selectedDir;

  // Apply GGX sampling for rough reflections
  if (rand.x < reflect_prob) {  // Specular reflection case
    selectedDir = sample_ggx(rand, normal, incomingDir, triangle.roughness);
    isSpecular = true;
  } else {
    selectedDir = sample_hemisphere_cosine_weighted(rand, normal);
    isSpecular = false;
  }

  // Calculate the PDF for the selected direction
  out_pdf = calculate_pdf(incomingDir, selectedDir, normal, triangle, rand.x);

  return selectedDir;
}

vec3 calculate_brdf(Triangle triangle, vec3 incomingDir, vec3 outgoingDir, vec3 normal) {

  vec3 halfVector = normalize(incomingDir + outgoingDir);
  float NdotL = max(dot(normal, incomingDir), 0.0f);
  float NdotV = max(dot(normal, outgoingDir), 0.0f);
  float NdotH = max(dot(normal, halfVector), 0.0f);
  float HdotV = max(dot(halfVector, outgoingDir), 0.0f);

  float alpha = max(triangle.roughness * triangle.roughness, 0.001f);
  float alpha2 = alpha * alpha;

  float D = alpha2 / (M_PI * (((NdotH * NdotH) * (alpha2 - 1.0f)) + 1.0f) * (((NdotH * NdotH) * (alpha2 - 1.0f)) + 1.0f));

  float kDirect = ((triangle.roughness + 1.0f) * (triangle.roughness + 1.0f)) / (8.0f);
  float Gv = (NdotV) / (NdotV * (1.0f - kDirect) + kDirect);
  float Gl = (NdotL) / (NdotL * (1.0f - kDirect) + kDirect);
  float G = Gv * Gl;

  // Fresnel (F) - Schlick's approximation
  vec3 F0 = clamp(mix(vec3(0.04f), triangle.color, triangle.metallic), 0.0f, 1.0f);

  vec3 F = F0 + (1.0f - F0) * pow(clamp(1.0f - HdotV, 0.0f, 1.0f), 5.0f);

  // Specular BRDF component
  vec3 specular = (D * G * F) / (4.0f * NdotL * NdotV + EPSILON);

  // Diffuse BRDF component
  vec3 diffuse = (1.0f - F) * (1.0f - triangle.metallic) * triangle.color * (M_1_PI);

  // Combine specular and diffuse components
  return diffuse + specular;

}

vec3 get_ray_radiance(vec3 origin, vec3 direction, inout uvec2 seed) {
  vec3 radiance = vec3(0.0f);
  vec3 throughput_weight = vec3(1.0f);

  float tPrimaryTriangle;
  Triangle primaryTriangle;
  vec3 originPrimaryTriangle = origin;

  vec3 directionPrimaryTriangle = direction;
  bool isSpecularBounce = false;
  float pdf;
  vec3 new_direction;

  for (int i = 0; i < maxPathLength; i++) {

    // Perform ray-triangle intersection test
    if (ray_bvh_intersection_hit_miss(tPrimaryTriangle, primaryTriangle, originPrimaryTriangle, directionPrimaryTriangle)) {

      // Early termination cases:

      // If it's the first step and the triangle is emmissive - it's a light, stop the algorithm
      if (i == 0 && primaryTriangle.emission != vec3(0.0f)) {
        radiance = primaryTriangle.color * primaryTriangle.emission;
        // return radiance;
      }

      // If the newfound primary triangle is emissive and the triangle from which the ray is coming from caused a specular bounce, add the emission to the radiance and return
      if (primaryTriangle.emission != vec3(0.0f) && isSpecularBounce) {
        vec3 safe_weight = clamp(throughput_weight, 0.0f, 1.0f);
        radiance += safe_weight * primaryTriangle.emission;
        return radiance;
      }

      // Get the intersection point of the ray and the primary triangle
      // Note: t is the closest intersection distance along the ray. It will hold the
      // smallest value of t for which the ray intersects a triangle in the BVH 
      // In ray tracing, t is the parameter in the ray equation origin + t * direction that gives the intersection point.
      vec3 intersection = originPrimaryTriangle + tPrimaryTriangle * directionPrimaryTriangle;

      // Add a small epsilon to the intersection point to avoid self-intersection issues
      // This is necessary to avoid self-shadowing artifacts
      vec3 rayPrimaryTriangleIntersectionPoint = intersection + primaryTriangle.normal * EPSILON;

      Triangle lightTriangle;
      vec3 lightPoint = vec3(0.0f, 0.0f, 0.0f);
      float lightPdf = 0.5f;
      float lightArea = 0.0f;
      bool hitsLight = false;

      // Sample a random light
      sample_random_light(seed, lightTriangle, lightPoint, lightPdf, lightArea, rayPrimaryTriangleIntersectionPoint, hitsLight);

      vec3 directionToShadowRayLightIntersection = normalize(lightPoint - rayPrimaryTriangleIntersectionPoint);
      float distanceToShadowRayLightIntersection = abs(length(lightPoint - rayPrimaryTriangleIntersectionPoint));

      vec3 direct_light = vec3(0.0f);

      // Check visibility of the light source
/*       if (dot(primaryTriangle.normal, directionToShadowRayLightIntersection) > 0.0f && dot(lightTriangle.normal, -directionToShadowRayLightIntersection) > 0.0f) { */

/*         Triangle blockingTriangle;
        float tBlockingTriangle;
        bool hits = ray_bvh_intersection_hit_miss(tBlockingTriangle, blockingTriangle, rayPrimaryTriangleIntersectionPoint, directionToShadowRayLightIntersection);

        // if the light is visible from the shadow ray's origin
        if (!hits || (hits && (blockingTriangle.emission != vec3(0.0f)))) { */
      if (hitsLight) {

        // Calculate direct light contribution

        float solid_angle = max(dot(lightTriangle.normal, -directionToShadowRayLightIntersection), 0.0f) / (distanceToShadowRayLightIntersection * distanceToShadowRayLightIntersection);

        vec3 brdf = calculate_brdf(primaryTriangle, -directionPrimaryTriangle, directionToShadowRayLightIntersection, primaryTriangle.normal);

        float brdfPdf = calculate_pdf(-directionPrimaryTriangle, directionToShadowRayLightIntersection, primaryTriangle.normal, primaryTriangle, get_random_numbers(seed).x);

        float MISweight = power_heuristic(lightPdf, brdfPdf);
        float cos_theta_i = max(dot(primaryTriangle.normal, directionToShadowRayLightIntersection), 0.0f);

        // Compute direct light contribution
        direct_light = float(lightIndicesCount) * (lightTriangle.emission) * solid_angle * brdf * cos_theta_i * vec3(MISweight) / lightPdf;
      }

      // }

      // Add to the radiance the direct light contribution weighted by the throughput weight factor
      // If the direct light is zero, the radiance consists only of indirect lighting
      radiance += throughput_weight * direct_light;

      // Sample the new direction according to the triangle's material
      // Get Probability Density Function (PDF) according to triangle's material
      new_direction = sample_direction(primaryTriangle, primaryTriangle.normal, -directionPrimaryTriangle, seed, pdf, isSpecularBounce);

      float cos_theta = max(dot(new_direction, primaryTriangle.normal), 0.0f);

      if (cos_theta < 0.0f) {
        break; // Skip if the new direction is below the surface
      }

      // Calculate the Bidirectional Reflectance Distribution Function (BRDF) 
      vec3 brdf = calculate_brdf(primaryTriangle, -directionPrimaryTriangle, new_direction, primaryTriangle.normal);

      // Indirect lighting is accumulated implicitly through the loop by propagating throughput_weight and sampling new directions recursively.
      if (pdf > 0.0f) // To avoid division by zero
        // Update throughput
        throughput_weight *= brdf * cos_theta / pdf;

      // Set the ray-triangle intersection point as the origin for the new ray
      originPrimaryTriangle = rayPrimaryTriangleIntersectionPoint;
      
      // Set the direction of the new ray for the next ray-triangle intersection test
      directionPrimaryTriangle = new_direction;

      // Russian Roulette termination
      if (length(throughput_weight) < 0.001f) {
        if (get_random_numbers(seed).x > 0.1f)
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
  getColCount();

  // Compute normalized coordinates
  vec2 tex_coord = gl_FragCoord.xy / windowSize;

  // Use tex_coord for previous frame sampling
  vec4 previousColor = getPreviousColorFromPreviousFrameTexture(tex_coord);

  // Apply aspect ratio correction only for ray generation
  vec2 correctedUV = tex_coord;
  if (aspectRatio > 1.0f) {
    correctedUV.x *= aspectRatio;
  } else if (aspectRatio < 1.0f) {
    correctedUV.y /= aspectRatio;
  }

  vec4 currentColor;
  currentColor.rgb = vec3(0.0f);
  currentColor.a = 1.0f;

  // Perform path tracing with sampleCount paths
  for (int i = 0; i != sampleCount; ++i) {
    uvec2 sampleSeed = uvec2(gl_FragCoord) ^ uvec2(timestamp + i, (timestamp + i) << 16);
    vec2 rand = get_random_numbers(sampleSeed); // returns in [0,1)

    vec2 jitteredUV = correctedUV + rand / windowSize; // jitter within the pixel

    vec3 ray_direction = get_primary_ray_direction(jitteredUV.x, jitteredUV.y, cameraSource, cameraLeftBottom, cameraRight, cameraUp);
    currentColor.rgb += get_ray_radiance(cameraSource, ray_direction, sampleSeed);
  }

  currentColor.rgb /= float(sampleCount);
  currentColor.rgb = clamp(currentColor.rgb, 0.0f, 1.0f);

  // Blend the current color with the previous color
  float blendFactor = 1.0f / float(sampleNumber + 1); // converges faster
  vec4 blendedColor = mix(previousColor, currentColor, blendFactor);

  outColor = vec4(blendedColor.rgb, 1.0f);

}