#version 300 es

#ifdef GL_ES
precision highp float;
#endif

in vec2 texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution; // Screen resolution
out vec4 outColor;

vec3 applyFXAA(sampler2D tex, vec2 uv, vec2 resolution) {
    vec2 texel = 1.0f / resolution;

    // Sample the neighborhood
    vec3 rgbNW = texture(tex, uv + vec2(-texel.x, -texel.y)).rgb;
    vec3 rgbNE = texture(tex, uv + vec2(texel.x, -texel.y)).rgb;
    vec3 rgbSW = texture(tex, uv + vec2(-texel.x, texel.y)).rgb;
    vec3 rgbSE = texture(tex, uv + vec2(texel.x, texel.y)).rgb;
    vec3 rgbM = texture(tex, uv).rgb;

    // Luminance (brightness) calculations
    float lumaNW = dot(rgbNW, vec3(0.299f, 0.587f, 0.114f));
    float lumaNE = dot(rgbNE, vec3(0.299f, 0.587f, 0.114f));
    float lumaSW = dot(rgbSW, vec3(0.299f, 0.587f, 0.114f));
    float lumaSE = dot(rgbSE, vec3(0.299f, 0.587f, 0.114f));
    float lumaM = dot(rgbM, vec3(0.299f, 0.587f, 0.114f));

    // Edge detection
    float edgeHorizontal = abs(lumaNW + lumaNE - lumaSW - lumaSE);
    float edgeVertical = abs(lumaNW + lumaSW - lumaNE - lumaSE);
    float maxEdge = max(edgeHorizontal, edgeVertical);

    // Edge threshold
    float edgeThreshold = 0.125f; // Lower this if edges are missed, raise if too much blurring
    vec3 finalColor = rgbM;

    if(maxEdge > edgeThreshold) {
        vec3 avgColor = (rgbNW + rgbNE + rgbSW + rgbSE) * 0.25f;
        finalColor = mix(rgbM, avgColor, 0.5f);
    }

    return finalColor;
}

void main() {

    vec3 inputColor = texture(u_texture, texCoord).rgb;

    vec3 gammaCorrectedColor = pow(inputColor, vec3(1.0 / 2.2));

    outColor = vec4(gammaCorrectedColor, 1.0f);
}
