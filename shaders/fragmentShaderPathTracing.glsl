#version 300 es
#define M_PI 3.141592653589793238462643
#define M_1_PI 0.3183098861837907
// #define SCALING_FACTOR 0.1f
#define SCALING_FACTOR 1.0f

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
  if(a > -0.0001f && a < 0.0001f)
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
  if(t > 0.0001f) { // ray intersection
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
      // return out_t < 1.0e38f; // NO PUEDO HACER ESTO!!!!
    }
  }
  return out_t < 1.0e38f;
}

bool ray_bvh_intersection_hit_miss(out float out_t, out Triangle out_triangle, vec3 origin, vec3 direction) {
  out_t = 1.0e38f;
  int currentIndex = 0; // Start with the root node

  while(currentIndex != -1 && currentIndex < bvhNodeCount) {
    BVHNode currentNode = getBVHNode(currentIndex);
    // outColor = vec4(1.0f, 1.0f, 0.0f, 1.0f);
    // outColor = vec4(0.0f, float(currentNode.missLink == -1), 0.0f, 1.0f);

        // Check if the ray intersects the bounding box
    if(ray_box_intersection(origin, direction, currentNode.minBounds, currentNode.maxBounds)) {

            // If it's a leaf node, check intersection with the stored triangle(s)
    // outColor = vec4(1.0f, 1.0f, 0.0f, 1.0f);

      // if(currentNode.triangleCount > 0)

      if(currentNode.triangleInorderIndex != -2) {
        // outColor = vec4(0.0f, 1.0f, 0.0f, 1.0f);

        for(int i = currentNode.triangleInorderIndex; i < currentNode.triangleInorderIndex + currentNode.triangleCount; i++) {
          int triangleIndex = getIndexFromInorderTrianglesIndicesArray(i);
          Triangle triangle = getTriangleFromTextures(triangleIndex);
          float t;
          if(ray_triangle_intersection(t, origin, direction, triangle) && t < out_t) {
            // outColor = vec4(0.0f, 1.0f, 0.0f, 1.0f);
            out_t = t;
            out_triangle = triangle;
          }
        }
      }
      currentIndex++;

    } else {
            // If the ray doesn't intersect, follow the miss link
      // outColor = vec4(1.0f, 0.0f, 0.0f, 1.0f);

      currentIndex = currentNode.missLink;
    }
  }

  return out_t < 1.0e38f;
}

/* bool ray_bvh_intersection(out float out_t, out Triangle out_triangle, vec3 origin, vec3 direction) {
  out_t = 1.0e38f; // Initialize with a large value
  int stack[256];  // Stack to keep track of node indices to visit
  int stackPointer = 0;
  stack[stackPointer++] = 0;  // Start with the root node

  while(stackPointer > 0) {
    int currentIndex = stack[--stackPointer]; // Pop from stack

    // Sample min and max bounds for the current node
    BVHNode currentNode = getBVHNode(currentIndex);

    if(currentNode.triangleInorderIndex == -1) {
      // it's an empty leaf node - skip
      continue;
    }

    // Check if ray intersects bounding box
    if(ray_box_intersection(origin, direction, currentNode.minBounds, currentNode.maxBounds)) {
      // Check if the current node is a leaf
      if(currentNode.triangleInorderIndex != -2) {
        // It's a leaf node with triangles, check intersection with the stored triangle
        for(int i = currentNode.triangleInorderIndex; i < currentNode.triangleInorderIndex + currentNode.triangleCount; i++) {

          int triangleIndex = getIndexFromInorderTrianglesIndicesArray(i);
          Triangle triangle = getTriangleFromTextures(triangleIndex);
          float t;
          if(ray_triangle_intersection(t, origin, direction, triangle) && t < out_t) {
            out_t = t;
            out_triangle = triangle;
          }
        }
      } else if(currentNode.triangleInorderIndex == -2) {
        // Push right child to stack first (since we'll process left child next)
        int rightChildIndex = 2 * currentIndex + 2;
        if(rightChildIndex < bvhNodeCount) {
          stack[stackPointer++] = rightChildIndex;
        }

        // Push left child to stack
        int leftChildIndex = 2 * currentIndex + 1;
        if(leftChildIndex < bvhNodeCount) {
          stack[stackPointer++] = leftChildIndex;
        }
      }
    }
  }

  return out_t < 1.0e38f;
} */

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

vec3 sample_hemisphere(vec2 random_numbers, vec3 normal) {
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
  if(hits && blocking_triangle.emission != light_triangle.emission) {
    return false;
  }
  return true;
}

void sample_random_light(inout uvec2 seed, inout Triangle lightTriangle, inout vec3 lightPoint, inout float lightPdf, vec3 origin) {
  const int max_attempts = 10;
  int attempts = 0;
  bool visible = false;
  int randomIndex;
  int lightIndex;

  while(attempts < max_attempts && !visible) {
    attempts++;

    randomIndex = int(float(lightIndicesCount) * get_random_numbers(seed).x) % (lightIndicesCount);
    lightIndex = getIndexFromLightIndicesTexture(randomIndex);
    // outColor = vec4(float(lightIndex / lightIndicesCount), float(lightIndex / lightIndicesCount), float(lightIndex / lightIndicesCount), 1.0f);

    lightTriangle = getTriangleFromTextures(lightIndex);

    vec2 r = get_random_barycentric(seed);

    lightPoint = (1.0f - r.x - r.y) * lightTriangle.vertex0 + r.x * lightTriangle.vertex1 + r.y * lightTriangle.vertex2;

    vec3 direction = normalize(lightPoint - origin);
    visible = is_light_visible(origin, lightPoint, lightTriangle, direction);
  }

  if(visible) {
    float lightArea = 0.5f * length(cross(lightTriangle.vertex1 - lightTriangle.vertex0, lightTriangle.vertex2 - lightTriangle.vertex0));
    // lightPdf =/*  1.0f / */ (/* float(lightIndicesCount) * */ ((area) / (area * 2.0f)));
    lightPdf = (1.0f / (float(lightIndicesCount) * lightArea));
  } else {
    lightPdf = 1.0f; // Default value if no light is visible
  }
}

float power_heuristic(float pdf1, float pdf2) {
  float f1 = pdf1 * pdf1;
  float f2 = pdf2 * pdf2;
  return f1 / (f1 + f2);
}

vec3 get_ray_radiance(vec3 origin, vec3 direction, inout uvec2 seed) {
  vec3 radiance = vec3(0.0f);
  vec3 throughput_weight = vec3(1.0f);
  float directLighting, indirectLighting;
  for(int i = 0; i < maxPathLength; i++) {
    float t;
    Triangle triangle;

    // if(ray_bvh_intersection(t, triangle, origin, direction)) {
    if(ray_bvh_intersection_hit_miss(t, triangle, origin, direction)) {

      // If it's the first step and the triangle is emmissive - it's a light, stop the algorithm
      if(i == 0 && (triangle.emission.x > 0.0f || triangle.emission.y > 0.0f || triangle.emission.z > 0.0f)) {
        radiance = triangle.color * triangle.emission;
        return radiance;
        break;
      }

      vec3 rayTriangleIntersectionPoint = origin + t * direction;

      // Next Event Estimation

      Triangle lightTriangle;
      vec3 lightPoint = vec3(0.0f, 0.0f, 0.0f);
      float lightPdf = 1.0f;
      sample_random_light(seed, lightTriangle, lightPoint, lightPdf, rayTriangleIntersectionPoint);

      vec3 intersectionToLightDirection = normalize(lightPoint - rayTriangleIntersectionPoint);
      float intersectionToLightDistance = length(lightPoint - rayTriangleIntersectionPoint);

      // Check visibility of the light source
      if(dot(triangle.normal, intersectionToLightDirection) > 0.0f && dot(lightTriangle.normal, -intersectionToLightDirection) > 0.0f) {

        Triangle blockingTriangle;
        float tBlockingTriangle;
        bool hits = ray_bvh_intersection_hit_miss(tBlockingTriangle, blockingTriangle, rayTriangleIntersectionPoint, intersectionToLightDirection);

        // if doesn't hit anything or hits and it's a light source
        if(!hits || (hits && blockingTriangle.emission != vec3(0.0f))) {
          // Calculate direct light contribution
          float solid_angle = max(dot(lightTriangle.normal, -intersectionToLightDirection), 0.0f) / (intersectionToLightDistance * intersectionToLightDistance);
          vec3 brdf = triangle.color * M_1_PI * dot(triangle.normal, intersectionToLightDirection);
          vec3 direct_light = lightTriangle.emission * solid_angle * brdf;

                    // Apply MIS weight
          float brdfPdf = lightPdf * solid_angle; // Approximation, adjust based on your implementation
          float weight = power_heuristic(lightPdf, brdfPdf);

          radiance += throughput_weight * vec3(weight) /* * (50.0f) */ * direct_light / lightPdf;
        }

      }

      // radiance += throughput_weight * triangle.emission;

      vec3 new_direction = sample_hemisphere(get_random_numbers(seed), triangle.normal);

      float cos_theta = dot(new_direction, triangle.normal);
      if(cos_theta < 0.0f) {
        break; // Skip if the new direction is below the surface
      }

      // vec3 eval = triangle.color * M_1_PI * dot(new_direction, triangle.normal);
      // vec3 brdf = triangle.color * M_1_PI; // aka eval?

      float pdf = cos_theta * M_1_PI;

      // Update the throughput weight
      vec3 brdf = triangle.color * M_1_PI;

      // throughput_weight *= eval / pdf;
      if(pdf > 0.0f)
        throughput_weight *= (brdf * cos_theta) / pdf;

      // Update the direction for the next bounce
      origin = rayTriangleIntersectionPoint;
      direction = new_direction;

      if(length(throughput_weight) < 0.001f) {
        if(get_random_numbers(seed).x > 0.1f)
          break;
        throughput_weight /= 0.1f;
      }
    } else
      break;
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