#version 300 es
#define M_PI 3.141592653589793238462643
#define M_1_PI 0.3183098861837907
#define SCALING_FACTOR 0.1f

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

uniform sampler2D coordinatesTexture;
uniform sampler2D normalsTexture;
uniform sampler2D colorsTexture;
uniform sampler2D emissionsTexture;
uniform sampler2D lightIndicesTexture;
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

out vec4 outColor;

Triangle getTriangleFromTextures(int index) {

  Triangle triangle;

  triangle.vertex0 = texture(coordinatesTexture, vec2(float(3 * index) / float(vertexCount - 1), 0.0f)).xyz;
  triangle.vertex1 = texture(coordinatesTexture, vec2(float(3 * index + 1) / float(vertexCount - 1), 0.0f)).xyz;
  triangle.vertex2 = texture(coordinatesTexture, vec2(float(3 * index + 2) / float(vertexCount - 1), 0.0f)).xyz;

  triangle.normal = texture(normalsTexture, vec2(float(index) / float(triangleCount - 1), 0.0f)).xyz;

  triangle.color = texture(colorsTexture, vec2(float(index) / float(triangleCount - 1), 0.0f)).xyz;

  triangle.emission = texture(emissionsTexture, vec2(float(index) / float(triangleCount - 1), 0.0f)).xyz;

  return triangle;

}

vec3 get_primary_ray_direction(float x, float y, vec3 camera_position, vec3 left_bottom, vec3 right, vec3 up) {
  vec3 image_plane_pos = left_bottom + x * right + y * up;
  return normalize(image_plane_pos - camera_position);
}

bool ray_triangle_intersection(out float out_t, vec3 origin, vec3 direction, Triangle triangle) {
  vec3 v0 = triangle.vertex0;
  mat3 matrix = mat3(-direction, triangle.vertex1 - v0, triangle.vertex2 - v0);
  vec3 solution = inverse(matrix) * (origin - v0);
  out_t = solution.x;
  vec2 barys = solution.yz;
  return out_t >= 0.001f && barys.x >= 0.0f && barys.y >= 0.0f && barys.x + barys.y <= 1.0f;
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
  // vec3 direction = sample_sphere(random_numbers);
  float theta = 2.0f * M_PI * random_numbers[0];
  float r = sqrt(random_numbers[1]);

  float x = r * cos(theta);
  float y = r * sin(theta);
  float z = sqrt(1.0f - x * x - y * y);

  vec3 majorAxis = abs(normal.x) < 0.57735026919f ? vec3(1.0f, 0.0f, 0.0f) : abs(normal.y) < 0.57735026919f ? vec3(0.0f, 1.0f, 0.0f) : vec3(0.0f, 0.0f, 1.0f);

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
  bool hits = ray_mesh_intersection(t, blocking_triangle, origin, direction);

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

  while(attempts < max_attempts && !visible) {
    attempts++;
    int randomIndex = int(float(lightIndicesCount) * get_random_numbers(seed).x);
    int lightIndex = int(texture(lightIndicesTexture, vec2(float(3 * randomIndex) / float(lightIndicesCount - 1), 0.0f)).x);
    lightTriangle = getTriangleFromTextures(lightIndex);

    vec2 r = get_random_barycentric(seed);

    lightPoint = (1.0f - r.x - r.y) * lightTriangle.vertex0 + r.x * lightTriangle.vertex1 + r.y * lightTriangle.vertex2;

    float area = 0.5f * length(cross(lightTriangle.vertex1 - lightTriangle.vertex0, lightTriangle.vertex2 - lightTriangle.vertex0));
    lightPdf = 1.0f / (float(lightIndex) * area);

    vec3 direction = normalize(lightPoint - origin);
    visible = is_light_visible(origin, lightPoint, lightTriangle, direction);
  }
}

vec3 get_ray_radiance(vec3 origin, vec3 direction, inout uvec2 seed) {
  vec3 radiance = vec3(0.0f);
  vec3 throughput_weight = vec3(1.0f);
  for(int i = 0; i < maxPathLength; i++) {
    float t;
    Triangle triangle;
    if(ray_mesh_intersection(t, triangle, origin, direction)) {
      radiance += throughput_weight * (triangle.emission * (SCALING_FACTOR));

      if(triangle.emission.x > 0.0f || triangle.emission.y > 0.0f || triangle.emission.z > 0.0f) {
        // return triangle.color;
        break;
      }

      vec3 rayTriangleIntersectionPoint = origin + t * direction;

      // Next Event Estimation

      Triangle lightTriangle;
      vec3 lightPoint = vec3(0.0f, 0.0f, 0.0f);
      float lightPdf = 0.0f;
      sample_random_light(seed, lightTriangle, lightPoint, lightPdf, rayTriangleIntersectionPoint);

      vec3 intersectionToLightDirection = normalize(lightPoint - rayTriangleIntersectionPoint);
      float intersectionToLightDistance = length(lightPoint - rayTriangleIntersectionPoint);

      // Check visibility of the light source
      if(dot(triangle.normal, intersectionToLightDirection) > 0.0f && dot(lightTriangle.normal, -intersectionToLightDirection) > 0.0f) {

        Triangle blockingTriangle;
        float tBlockingTriangle;
        bool hits = ray_mesh_intersection(tBlockingTriangle, blockingTriangle, rayTriangleIntersectionPoint, intersectionToLightDirection);

        // if doesn't hit anything or hits and it's a light source
        if(!hits || (hits && blockingTriangle.emission != vec3(0.0f))) {
          // Calculate direct light contribution
          float solid_angle = max(dot(lightTriangle.normal, -intersectionToLightDirection), 0.0f) / (intersectionToLightDistance * intersectionToLightDistance);
          vec3 brdf = triangle.color * M_1_PI * dot(triangle.normal, intersectionToLightDirection);
          vec3 direct_light = lightTriangle.color * solid_angle * brdf;
          radiance += throughput_weight * (SCALING_FACTOR) * direct_light / lightPdf;
        }

      }

      vec3 new_direction = sample_hemisphere(get_random_numbers(seed), triangle.normal);

      float cos_theta = dot(new_direction, triangle.normal);
      if(cos_theta < 0.0f) {
        break; // Skip if the new direction is below the surface
      }

      // vec3 eval = triangle.color * M_1_PI * dot(new_direction, triangle.normal);
      // vec3 brdf = triangle.color * M_1_PI; // aka eval?

      float pdf = cos_theta * M_1_PI;

      // Update the throughput weight

      vec3 eval = triangle.color * M_1_PI;

      // throughput_weight *= eval / pdf;
      throughput_weight *= eval * cos_theta / pdf;

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

  // Get the color from the previous frame
  vec4 previousColor = vec4(texture(previousFrameTexture, tex_coord).rgb, 1.0f);

  // Blend the current color with the previous color
  float blendFactor = 1.0f / float(frameNumber + 1);
  vec4 blendedColor = mix(previousColor, currentColor, blendFactor);
  // vec4 blendedColor = mix(previousColor, currentColor, 0.2);

    // Apply exposure control
/*   vec3 finalColor = vec3(1.0) - exp(-blendedColor.rgb * 0.5); */

  outColor = vec4(blendedColor.rgb, 1.0f);

}