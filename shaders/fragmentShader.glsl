#version 300 es

#define MAX_PATH_LENGTH 1
#define SAMPLE_COUNT 5
#define M_PI 3.141592653589793238462643

#ifdef GL_ES
precision lowp float;
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
uniform vec3 cameraUp;
uniform vec3 cameraRight;
uniform vec3 cameraLeftBottom;
uniform int vertexCount;
uniform int triangleCount;

out vec4 fragColor;


void main() {

  //fragColor = out_color;
  fragColor = vec4(0.0, 1.0, 0.0, 1.0);

}