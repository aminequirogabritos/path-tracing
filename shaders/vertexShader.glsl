#version 300 es

#ifdef GL_ES
precision highp float;
#endif

/* void main() {
    v_normal = vec4(transpose(inverse(mat3(modelViewMatrix))) * normal, 1.0); // Pass normal to fragment shader
    v_position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = v_position;
} */

// out vec2 v_texCoord;

layout(location = 0) in vec2 position;

void main() {
    gl_Position = vec4(position, 0.0f, 1.0f);
    // Convert position to texture coordinates (0.0 to 1.0)
    // v_texCoord = position.xy * 0.5f + 0.5f;
}
