#version 300 es
#define M_PI 3.141592653589793238462643
#define SCALING_FACTOR 2.0f

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

uniform vec2 windowSize;
uniform vec3 cameraSource;
uniform vec3 cameraDirection;
uniform vec3 cameraUp;
uniform vec3 cameraRight;
uniform vec3 cameraLeftBottom;
uniform int vertexCount;
uniform int triangleCount;
uniform int timestamp;
uniform int maxPathLength;
uniform int sampleCount;
uniform int frameNumber;

// in vec2 v_texCoord;
// uniform sampler2D u_currentFrame;
// uniform sampler2D u_accumulatedFrame;
// uniform float u_alpha;

// in vec2 vTexCoord;
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

/* vec3 sample_sphere(vec2 random_numbers) {
  float z = 2.0f * random_numbers[1] - 1.0f;
  float phi = 2.0f * M_PI * random_numbers[0];
  float x = cos(phi) * sqrt(1.0f - z * z);
  float y = sin(phi) * sqrt(1.0f - z * z);
  return vec3(x, y, z);
} */

vec3 sample_hemisphere(vec2 random_numbers, vec3 normal) {
  // vec3 direction = sample_sphere(random_numbers);
  float phi = 2.0f * M_PI * random_numbers[0];
  float z = 2.0f * random_numbers[1] - 1.0f;

  float cos_theta = sqrt(1.0f - random_numbers.y);
  float sin_theta = sqrt(random_numbers.y);

  // Compute local sample direction
  vec3 local_dir = vec3(sin_theta * cos(phi), sin_theta * sin(phi), cos_theta);

  // Create an orthonormal basis
  vec3 up = abs(normal.z) < 0.999f ? vec3(0, 0, 1) : vec3(1, 0, 0);
  vec3 tangent = normalize(cross(up, normal));
  vec3 bitangent = cross(normal, tangent);

  // Transform local direction to world space
  vec3 sample_dir = local_dir.x * tangent + local_dir.y * bitangent + local_dir.z * normal;

  return sample_dir;
}

vec3 get_ray_radiance(vec3 origin, vec3 direction, inout uvec2 seed) {
  vec3 radiance = vec3(0.0f);
  vec3 throughput_weight = vec3(8.0f);
  for(int i = 0; i < maxPathLength; i++) {
    float t;
    Triangle triangle;
    if(ray_mesh_intersection(t, triangle, origin, direction)) {
      radiance += throughput_weight * triangle.emission;
      origin += t * direction;
      vec3 new_direction = sample_hemisphere(get_random_numbers(seed), triangle.normal);

      // Update the throughput weight
      float cos_theta = dot(new_direction, triangle.normal);
      throughput_weight *= triangle.color * SCALING_FACTOR * (cos_theta / M_PI);
      
      // Update the direction for the next bounce
      direction = new_direction;

/*       if(length(throughput_weight) < 0.001f) {
        if(get_random_numbers(seed, ) > 0.1f)
          break;
        throughput_weight /= 0.1f;
      } */
    } else
      break;
  }
  return radiance;
}

void main() {
  //gl_FragColor = vec4(color, 1.0);

    // Define the camera position and the view plane

    // Compute the camera ray
  vec2 tex_coord = gl_FragCoord.xy / windowSize.xy;
  vec3 ray_direction = get_primary_ray_direction(tex_coord.x, tex_coord.y, cameraSource, cameraLeftBottom, cameraRight, cameraUp);
  // vec3 ray_direction = normalize(cameraDirection + tex_coord.x * cameraRight + tex_coord.y * cameraUp);

  Triangle triangle;
  float t;
  vec4 out_color;
  out_color.rgb = vec3(0.0f);

// V1: simple ray tracing  
  /* if(ray_mesh_intersection(t, triangle, cameraSource, ray_direction))
    out_color.rgb = triangle.color + triangle.emission; */
    // out_color = vec4( 1.0, 0.0, 0.3098028231594383, 1.0);

  uvec2 seed = uvec2(gl_FragCoord) ^ uvec2(1092773/* timestamp */ << 16);
    // Perform path tracing with sampleCount paths
  out_color.rgb = vec3(0.0f);
  for(int i = 0; i != sampleCount; ++i) out_color.rgb += get_ray_radiance(cameraSource, ray_direction, seed);
  out_color.rgb /= float(sampleCount);
  // out_color.r = min(out_color.r, 1.0);
  // out_color.g = min(out_color.g, 1.0);
  // out_color.b = min(out_color.b, 1.0);

  out_color.a = 1.0f;

  // Triangle t2 = getTriangleFromTextures(0);
  //fragColor = out_color;
  // outColor = vec4(0.0f, 1.0f, 0.0f, 1.0f);
  // outColor = vec4(t2.color, 1.0);
  // outColor = vec4( vTexCoord.xy, 0.0, 1.0);
  // outColor = vec4( tex_coord, 0.0, 1.0);

  // outColor = texture(colorsTexture, vec2(float(28.0 / float(triangleCount -  1)), 0.0f));

  // outColor = vec4(t2.emission, 1.0);
  // outColor = vec4(t2.emission, 1.0);
  // vec4 a= vec4( 1.0, 0.0, 0.3098028231594383, 1.0);

  outColor = out_color;

  // vec4 currentColor = texture2D(u_currentFrame, v_texCoord);
  // vec4 accumulatedColor = texture2D(u_accumulatedFrame, v_texCoord);
  // outColor = mix(accumulatedColor, currentColor, u_alpha);

}