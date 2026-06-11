/**
 * Generative Fine Art — Three.js Core
 * Ultra-fine grain · Curl Noise flow · Bioluminescent Bloom
 */

// ─── Particle density (combine / mobile) ────────────────────────
let _spiritCombineMode = false;
let _mobileMode = false;
function setSpiritCombineMode(on) { _spiritCombineMode = !!on; }
function setMobileMode(on) { _mobileMode = !!on; }
function pc(n) {
    let v = n;
    if (_spiritCombineMode) v = Math.max(8000, Math.floor(n * 0.32));
    if (_mobileMode) v = Math.max(6000, Math.floor(v * (_spiritCombineMode ? 0.72 : 0.48)));
    return v;
}

// ─── Audio helper ───────────────────────────────────────────────
function audioScale(audioData) {
    if (typeof audioData === 'number') return audioData;
    if (audioData && typeof audioData === 'object') {
        return 0.3 + audioData.volume * 2 + audioData.bass * 1.5 + audioData.treble * 0.5;
    }
    return 1.0;
}

function audioBass(audioData) {
    if (audioData && typeof audioData === 'object') return audioData.bass || 0;
    return audioScale(audioData) * 0.3;
}

function audioTreble(audioData) {
    if (audioData && typeof audioData === 'object') return audioData.treble || 0;
    return audioScale(audioData) * 0.3;
}

// ─── GLSL: Simplex 3D + Curl Noise ─────────────────────────────
const GLSL_NOISE = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float n1 = snoise(p + vec3(0.0, e, 0.0)) - snoise(p - vec3(0.0, e, 0.0));
    float n2 = snoise(p + vec3(0.0, 0.0, e)) - snoise(p - vec3(0.0, 0.0, e));
    float n3 = snoise(p + vec3(e, 0.0, 0.0)) - snoise(p - vec3(e, 0.0, 0.0));
    float n4 = snoise(p + vec3(0.0, 0.0, e)) - snoise(p - vec3(0.0, 0.0, e));
    float n5 = snoise(p + vec3(e, 0.0, 0.0)) - snoise(p - vec3(e, 0.0, 0.0));
    float n6 = snoise(p + vec3(0.0, e, 0.0)) - snoise(p - vec3(0.0, e, 0.0));
    float x = n1 - n2;
    float y = n3 - n4;
    float z = n5 - n6;
    return vec3(x, y, z) / (2.0 * e);
}
`;

// ─── Glow particle shader material ──────────────────────────────
function createGlowParticleMaterial(opts) {
    const o = Object.assign({
        pointSize: 0.035,
        noiseFreq: 0.35,
        flowSpeed: 0.4,
        flowStrength: 0.6,
        pulseStrength: 0.0,
        colorMix: 0.5,
        bloomBoost: 1.0
    }, opts);

    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uAudio: { value: 1.0 },
            uBass: { value: 0 },
            uTreble: { value: 0 },
            uPulse: { value: 0 },
            uPointSize: { value: o.pointSize },
            uNoiseFreq: { value: o.noiseFreq },
            uFlowSpeed: { value: o.flowSpeed },
            uFlowStrength: { value: o.flowStrength },
            uPulseStrength: { value: o.pulseStrength },
            uColorMix: { value: o.colorMix },
            uBloomBoost: { value: o.bloomBoost }
        },
        vertexShader: `
            attribute vec3 aBasePosition;
            attribute vec3 aColorA;
            attribute vec3 aColorB;
            attribute float aPhase;
            attribute float aSpeed;
            attribute float aLayer;

            uniform float uTime;
            uniform float uAudio;
            uniform float uBass;
            uniform float uTreble;
            uniform float uPulse;
            uniform float uPointSize;
            uniform float uNoiseFreq;
            uniform float uFlowSpeed;
            uniform float uFlowStrength;
            uniform float uPulseStrength;

            varying vec3 vColor;
            varying float vAlpha;
            varying float vGlow;

            ${GLSL_NOISE}

            void main() {
                vec3 pos = aBasePosition;
                float t = uTime * uFlowSpeed + aPhase;
                vec3 np = pos * uNoiseFreq + vec3(t * 0.3, t * 0.17, t * 0.23);
                vec3 flow = curlNoise(np) * uFlowStrength;

                flow *= (0.4 + aSpeed * 0.6) * (0.6 + uAudio * 0.8);
                flow += vec3(
                    sin(t * 1.7 + aPhase) * 0.08,
                    cos(t * 1.3 + aPhase * 1.4) * 0.06,
                    sin(t * 2.1) * 0.05
                ) * uBass;

                pos += flow;

                float pulse = sin(t * 4.0 + aPhase * 6.28) * uPulseStrength * (1.0 + uTreble * 2.0);
                pos += normalize(aBasePosition + 0.001) * pulse * uPulse;

                float speedProxy = length(flow) * 3.0;
                float mixT = clamp(speedProxy + uPulse * 0.5, 0.0, 1.0);
                mixT = mixT * mixT * (3.0 - 2.0 * mixT);
                vColor = mix(aColorA, aColorB, mixT);

                vGlow = (0.5 + speedProxy * 0.5 + uPulse * 0.3) * (0.7 + uAudio * 0.5);
                vAlpha = 0.35 + aLayer * 0.25 + speedProxy * 0.2;

                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = uPointSize * (280.0 / -mv.z) * (1.0 + vGlow * 0.3 + uAudio * 0.15);
            }
        `,
        fragmentShader: `
            uniform float uBloomBoost;
            varying vec3 vColor;
            varying float vAlpha;
            varying float vGlow;

            void main() {
                vec2 uv = gl_PointCoord - 0.5;
                float d = length(uv);
                float core = exp(-d * d * 28.0);
                float halo = exp(-d * d * 6.0) * 0.55;
                float grain = exp(-d * d * 80.0) * 0.3;
                float alpha = (core + halo + grain) * vAlpha;
                if (alpha < 0.004) discard;
                vec3 col = vColor * (1.0 + vGlow * uBloomBoost);
                gl_FragColor = vec4(col, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}

// ─── Bloom post-processing ──────────────────────────────────────
const BloomEngine = {
    composer: null,
    bloomPass: null,

    init(renderer, scene, camera) {
        if (typeof THREE.EffectComposer === 'undefined') return false;
        this.composer = new THREE.EffectComposer(renderer);
        this.composer.addPass(new THREE.RenderPass(scene, camera));
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.2, 0.5, 0.15
        );
        this.composer.addPass(this.bloomPass);
        return true;
    },

    resize(w, h) {
        if (this.composer) this.composer.setSize(w, h);
        if (this.bloomPass) this.bloomPass.resolution.set(w, h);
    },

    setSceneProfile(profile) {
        if (!this.bloomPass) return;
        const p = Object.assign({ strength: 1.2, radius: 0.5, threshold: 0.15 }, profile);
        this.bloomPass.strength = p.strength;
        this.bloomPass.radius = p.radius;
        this.bloomPass.threshold = p.threshold;
    },

    render() {
        if (this.composer) this.composer.render();
    },

    dispose() {
        if (this.composer) this.composer.dispose();
        this.composer = null;
        this.bloomPass = null;
    }
};

// ─── Base component ─────────────────────────────────────────────
class GenerativeComponent {
    constructor(scene, meshes) {
        this.meshes = Array.isArray(meshes) ? meshes : [meshes];
        this.meshes.forEach(m => scene.add(m));
        this._pulse = 0;
    }

    _setUniforms(time, audioData, extra) {
        const intensity = audioScale(audioData);
        const bass = audioBass(audioData);
        const treble = audioTreble(audioData);
        this.meshes.forEach(mesh => {
            const u = mesh.material.uniforms;
            if (!u) return;
            u.uTime.value = time;
            u.uAudio.value = intensity;
            u.uBass.value = bass;
            u.uTreble.value = treble;
            u.uPulse.value = this._pulse;
            if (extra) Object.keys(extra).forEach(k => { if (u[k]) u[k].value = extra[k]; });
        });
    }

    destroy(scene) {
        this.meshes.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
    }
}

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function lerpColor(c1, c2, t, out, i) {
    out[i] = c1[0] + (c2[0] - c1[0]) * t;
    out[i + 1] = c1[1] + (c2[1] - c1[1]) * t;
    out[i + 2] = c1[2] + (c2[2] - c1[2]) * t;
}

function buildGlowGeometry(count, initFn) {
    const base = new Float32Array(count * 3);
    const colorA = new Float32Array(count * 3);
    const colorB = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const speed = new Float32Array(count);
    const layer = new Float32Array(count);
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        initFn(i, base, colorA, colorB, phase, speed, layer, pos);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aBasePosition', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aColorA', new THREE.BufferAttribute(colorA, 3));
    geo.setAttribute('aColorB', new THREE.BufferAttribute(colorB, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));
    return geo;
}

// ═══════════════════════════════════════════════════════════════
// 1. SHOEGAZE — 深邃蓝雾与粉紫神经藤蔓
// ═══════════════════════════════════════════════════════════════
class ShoegazeComponent extends GenerativeComponent {
    constructor(scene) {
        const deepBlue = hexToRgb('#0000FF');
        const iceCyan = hexToRgb('#00BFFF');
        const neonPink = hexToRgb('#FF1493');
        const neonPurple = hexToRgb('#8800FF');

        const fogGeo = buildGlowGeometry(pc(55000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = Math.pow(Math.random(), 0.55) * 14;
            base[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
            base[i * 3 + 1] = (Math.random() - 0.5) * 8;
            base[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.6;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            const t = r / 14;
            lerpColor(deepBlue, iceCyan, t * 0.4, ca, i * 3);
            lerpColor(deepBlue, iceCyan, 0.6 + t * 0.4, cb, i * 3);
            ph[i] = Math.random() * Math.PI * 2;
            sp[i] = 0.15 + Math.random() * 0.2;
            ly[i] = 0.3 + Math.random() * 0.3;
        });

        const vineGeo = buildGlowGeometry(pc(45000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const vineId = Math.floor(i / 900);
            const seg = (i % 900) / 900;
            const branchAngle = (vineId % 24) / 24 * Math.PI * 2 + vineId * 0.37;
            const fork = Math.floor(vineId / 24) % 5;
            const len = 3 + fork * 2.5 + Math.random() * 4;
            const curl = Math.sin(seg * 8 + vineId) * 1.2;
            base[i * 3] = Math.cos(branchAngle) * seg * len + curl * Math.cos(branchAngle + 1.2);
            base[i * 3 + 1] = (seg - 0.5) * 6 + Math.sin(seg * 12 + vineId) * 0.8;
            base[i * 3 + 2] = Math.sin(branchAngle) * seg * len + curl * Math.sin(branchAngle + 1.2);
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            lerpColor(neonPink, neonPurple, seg, ca, i * 3);
            lerpColor(neonPurple, neonPink, Math.pow(seg, 0.5), cb, i * 3);
            ph[i] = vineId * 0.1 + seg * 4;
            sp[i] = 0.6 + Math.random() * 0.4;
            ly[i] = 0.7 + seg * 0.3;
        });

        const fogMat = createGlowParticleMaterial({
            pointSize: 0.028, noiseFreq: 0.22, flowSpeed: 0.18, flowStrength: 0.35, pulseStrength: 0.08
        });
        const vineMat = createGlowParticleMaterial({
            pointSize: 0.032, noiseFreq: 0.55, flowSpeed: 0.65, flowStrength: 1.1, pulseStrength: 0.45, bloomBoost: 1.8
        });

        super(scene, [
            new THREE.Points(fogGeo, fogMat),
            new THREE.Points(vineGeo, vineMat)
        ]);
        this._pulsePhase = 0;
    }

    update(time, audioData) {
        const treble = audioTreble(audioData);
        this._pulsePhase += 0.08 + treble * 0.3;
        this._pulse = (Math.sin(this._pulsePhase * 3.7) * 0.5 + 0.5) * (0.3 + treble * 1.5);
        this._setUniforms(time, audioData);
        this.meshes[0].rotation.y = time * 0.02;
        this.meshes[1].rotation.y = time * 0.04;
    }
}

// ═══════════════════════════════════════════════════════════════
// 2. PSYCHEDELIC ROCK — 羽状海百合与孢子喷发
// ═══════════════════════════════════════════════════════════════
class PsychedelicRockComponent extends GenerativeComponent {
    constructor(scene) {
        const purple = hexToRgb('#6A0DAD');
        const blue = hexToRgb('#4169E1');
        const pinkBlue = hexToRgb('#FF69B4');
        const cyanBlue = hexToRgb('#00CED1');

        const lilyGeo = buildGlowGeometry(pc(60000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const arms = 16;
            const arm = i % arms;
            const p = Math.floor(i / arms);
            const t = p / (60000 / arms);
            const angle = (arm / arms) * Math.PI * 2 + Math.sin(t * 6) * 0.3;
            const radius = 1.5 + Math.pow(t, 0.7) * 10;
            const feather = Math.sin(t * 20 + arm) * 0.4 * t;
            base[i * 3] = Math.cos(angle) * (radius + feather);
            base[i * 3 + 1] = -3 + t * 2 + Math.sin(t * 8) * 0.5;
            base[i * 3 + 2] = Math.sin(angle) * (radius + feather);
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            lerpColor(purple, blue, t, ca, i * 3);
            lerpColor(blue, purple, Math.sin(t * 3) * 0.5 + 0.5, cb, i * 3);
            ph[i] = arm * 0.5 + t * 3;
            sp[i] = 0.2 + t * 0.3;
            ly[i] = 0.4 + t * 0.3;
        });

        const sporeGeo = buildGlowGeometry(pc(40000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = Math.pow(Math.random(), 0.4) * 16;
            base[i * 3] = Math.sin(phi) * Math.cos(theta) * r * 0.3;
            base[i * 3 + 1] = -2 + Math.sin(phi) * Math.sin(theta) * r * 0.2;
            base[i * 3 + 2] = Math.cos(phi) * r * 0.3;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            lerpColor(pinkBlue, cyanBlue, r / 16, ca, i * 3);
            lerpColor(cyanBlue, pinkBlue, Math.random(), cb, i * 3);
            ph[i] = Math.random() * Math.PI * 2;
            sp[i] = 0.7 + Math.random() * 0.3;
            ly[i] = 0.5 + Math.random() * 0.4;
        });

        const lilyMat = createGlowParticleMaterial({
            pointSize: 0.03, noiseFreq: 0.3, flowSpeed: 0.35, flowStrength: 0.5, pulseStrength: 0.15
        });
        const sporeMat = createGlowParticleMaterial({
            pointSize: 0.025, noiseFreq: 0.7, flowSpeed: 0.9, flowStrength: 1.4, pulseStrength: 0.6, bloomBoost: 1.6
        });
        sporeMat.uniforms.uFlowStrength.value = 1.8;

        super(scene, [
            new THREE.Points(lilyGeo, lilyMat),
            new THREE.Points(sporeGeo, sporeMat)
        ]);
        this._erupt = 0;
    }

    update(time, audioData) {
        const bass = audioBass(audioData);
        const treble = audioTreble(audioData);
        this._erupt = Math.min(1, this._erupt + treble * 0.05);
        this._pulse = bass * 1.5 + treble * 0.8;
        this._setUniforms(time, audioData);
        const sporeMat = this.meshes[1].material;
        sporeMat.uniforms.uFlowStrength.value = 0.8 + this._erupt * 2.0;
        sporeMat.uniforms.uFlowSpeed.value = 0.5 + treble * 1.2;
        this.meshes[0].rotation.z = Math.sin(time * 0.4) * 0.15;
        this.meshes[1].scale.setScalar(1 + this._erupt * 0.5);
    }
}

// ═══════════════════════════════════════════════════════════════
// 3. DREAM POP — 发光浮游藻类与花簇
// ═══════════════════════════════════════════════════════════════
class DreamPopComponent extends GenerativeComponent {
    constructor(scene) {
        const dreamyPink = hexToRgb('#FFB6C1');
        const softPink = hexToRgb('#FF69B4');
        const bioCyan = hexToRgb('#00E5FF');
        const deepBlue = hexToRgb('#1A237E');

        const algaeGeo = buildGlowGeometry(pc(70000), (i, base, ca, cb, ph, sp, ly, pos) => {
            base[i * 3] = (Math.random() - 0.5) * 40;
            base[i * 3 + 1] = (Math.random() - 0.5) * 25;
            base[i * 3 + 2] = (Math.random() - 0.5) * 20;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            const t = Math.random();
            lerpColor(deepBlue, bioCyan, t * 0.6, ca, i * 3);
            lerpColor(bioCyan, deepBlue, t, cb, i * 3);
            ph[i] = Math.random() * Math.PI * 2;
            sp[i] = 0.1 + Math.random() * 0.15;
            ly[i] = 0.2 + Math.random() * 0.2;
        });

        const flowerGeo = buildGlowGeometry(pc(30000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const cluster = Math.floor(i / 5000);
            const p = (i % 5000) / 5000;
            const petals = 7;
            const petal = i % petals;
            const angle = (petal / petals) * Math.PI * 2 + p * 2;
            const cx = (cluster % 3 - 1) * 5;
            const cz = (Math.floor(cluster / 3) - 1) * 5;
            const r = p * 3.5 * (0.6 + Math.sin(p * 5) * 0.2);
            base[i * 3] = cx + Math.cos(angle) * r;
            base[i * 3 + 1] = Math.sin(p * 4) * 1.5;
            base[i * 3 + 2] = cz + Math.sin(angle) * r;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            lerpColor(dreamyPink, bioCyan, p, ca, i * 3);
            lerpColor(softPink, bioCyan, Math.pow(p, 0.7), cb, i * 3);
            ph[i] = cluster * 0.8 + p * 5;
            sp[i] = 0.25 + p * 0.2;
            ly[i] = 0.5 + p * 0.4;
        });

        super(scene, [
            new THREE.Points(algaeGeo, createGlowParticleMaterial({
                pointSize: 0.022, noiseFreq: 0.18, flowSpeed: 0.12, flowStrength: 0.25, pulseStrength: 0.05
            })),
            new THREE.Points(flowerGeo, createGlowParticleMaterial({
                pointSize: 0.038, noiseFreq: 0.28, flowSpeed: 0.25, flowStrength: 0.4, pulseStrength: 0.2, bloomBoost: 1.4
            }))
        ]);
    }

    update(time, audioData) {
        this._pulse = Math.sin(time * 1.5) * 0.3 + audioScale(audioData) * 0.2;
        this._setUniforms(time, audioData);
        this.meshes[1].rotation.y = time * 0.06;
    }
}

// ═══════════════════════════════════════════════════════════════
// 4. MATH ROCK — 晶格流体树枝与电码脉冲
// ═══════════════════════════════════════════════════════════════
class MathRockComponent extends GenerativeComponent {
    constructor(scene) {
        const electricBlue = hexToRgb('#00BFFF');
        const cyan = hexToRgb('#00FFFF');
        const emerald = hexToRgb('#00FF7F');

        const trunkGeo = buildGlowGeometry(pc(50000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const line = Math.floor(i / 2500);
            const p = (i % 2500) / 2500;
            const y = (line % 8 - 3.5) * 2.2;
            const morse = Math.floor(p * 20) % 3;
            const gap = morse === 0 ? 0 : morse === 1 ? 0.15 : 0.35;
            const x = -18 + p * 36;
            if (Math.random() < gap) {
                base[i * 3] = x + (Math.random() - 0.5) * 20;
                base[i * 3 + 1] = y + (Math.random() - 0.5) * 10;
                base[i * 3 + 2] = (Math.random() - 0.5) * 4;
                ly[i] = 0.05;
            } else {
                base[i * 3] = x;
                base[i * 3 + 1] = y + (Math.random() - 0.5) * 0.15;
                base[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
                ly[i] = 0.7 + Math.random() * 0.3;
            }
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            const t = (x + 18) / 36;
            lerpColor(electricBlue, cyan, t, ca, i * 3);
            lerpColor(cyan, emerald, Math.pow(t, 0.5), cb, i * 3);
            ph[i] = line * 0.3 + p * 8;
            sp[i] = 0.5 + Math.random() * 0.3;
        });

        const branchGeo = buildGlowGeometry(pc(20000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const b = Math.floor(i / 400);
            const p = (i % 400) / 400;
            const trunkX = -14 + (b % 10) * 3.2;
            const trunkY = (Math.floor(b / 10) % 6 - 2.5) * 2;
            const dir = (b % 4);
            const dx = dir === 0 ? p * 3 : dir === 1 ? -p * 3 : 0;
            const dy = dir === 2 ? p * 3 : dir === 3 ? -p * 3 : 0;
            base[i * 3] = trunkX + dx;
            base[i * 3 + 1] = trunkY + dy;
            base[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            lerpColor(cyan, emerald, p, ca, i * 3);
            lerpColor(emerald, electricBlue, 1 - p, cb, i * 3);
            ph[i] = b + p * 4;
            sp[i] = 0.7;
            ly[i] = 0.8;
        });

        const trunkMat = createGlowParticleMaterial({
            pointSize: 0.03, noiseFreq: 0.5, flowSpeed: 0.7, flowStrength: 0.9, pulseStrength: 0.3, bloomBoost: 1.5
        });
        trunkMat.uniforms.uFlowSpeed.value = 0.8;
        const branchMat = createGlowParticleMaterial({
            pointSize: 0.035, noiseFreq: 0.4, flowSpeed: 1.2, flowStrength: 0.5, pulseStrength: 0.8, bloomBoost: 2.0
        });

        super(scene, [
            new THREE.Points(trunkGeo, trunkMat),
            new THREE.Points(branchGeo, branchMat)
        ]);
        this._sprout = 0;
    }

    update(time, audioData) {
        const bass = audioBass(audioData);
        if (bass > 0.5) this._sprout = 1;
        this._sprout *= 0.95;
        this._pulse = this._sprout + bass;
        this._setUniforms(time, audioData);
        this.meshes[1].material.uniforms.uFlowStrength.value = 0.3 + this._sprout * 1.5;
        this.meshes[1].scale.set(1 + this._sprout * 0.3, 1 + this._sprout * 0.3, 1);
    }
}

// ═══════════════════════════════════════════════════════════════
// 5. POST-PUNK — 漆黑分形树冠与红金交织脉冲
// ═══════════════════════════════════════════════════════════════
class PostPunkComponent extends GenerativeComponent {
    constructor(scene) {
        const black = [0.02, 0.02, 0.04];
        const crimson = hexToRgb('#8B0000');
        const gold = hexToRgb('#FFD700');
        const deepRed = hexToRgb('#DC143C');

        let pIdx = 0;
        const canopyCount = pc(40000);
        const base = new Float32Array(canopyCount * 3);
        const colorA = new Float32Array(canopyCount * 3);
        const colorB = new Float32Array(canopyCount * 3);
        const phase = new Float32Array(canopyCount);
        const speed = new Float32Array(canopyCount);
        const layer = new Float32Array(canopyCount);
        const pos = new Float32Array(canopyCount * 3);

        const genBranch = (sx, sy, sz, ax, ay, len, depth) => {
            if (depth > 7 || pIdx >= canopyCount) return;
            const steps = Math.floor(600 / depth);
            const ex = sx + Math.sin(ax) * Math.cos(ay) * len;
            const ey = sy + Math.cos(ax) * len;
            const ez = sz + Math.sin(ax) * Math.sin(ay) * len;
            for (let s = 0; s < steps && pIdx < canopyCount; s++) {
                const t = s / steps;
                const i = pIdx;
                base[i * 3] = sx + (ex - sx) * t + (Math.random() - 0.5) * 0.08;
                base[i * 3 + 1] = sy + (ey - sy) * t;
                base[i * 3 + 2] = sz + (ez - sz) * t + (Math.random() - 0.5) * 0.08;
                pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
                if (depth > 4) {
                    lerpColor(gold, gold, t, colorA, i * 3);
                    colorB[i * 3] = gold[0] * 1.2; colorB[i * 3 + 1] = gold[1]; colorB[i * 3 + 2] = gold[2] * 0.3;
                    layer[i] = 0.8;
                    speed[i] = 0.15;
                } else {
                    lerpColor(black, crimson, t * 0.3, colorA, i * 3);
                    lerpColor(crimson, black, depth / 7, colorB, i * 3);
                    layer[i] = 0.3 + depth * 0.05;
                    speed[i] = 0.1;
                }
                phase[i] = depth + t * 3;
                pIdx++;
            }
            const nl = len * 0.72;
            genBranch(ex, ey, ez, ax + 0.45, ay + 0.9, nl, depth + 1);
            genBranch(ex, ey, ez, ax - 0.35, ay - 1.1, nl, depth + 1);
        };
        genBranch(0, -7, 0, 0.1, 0, 5, 1);

        const canopyGeo = new THREE.BufferGeometry();
        canopyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        canopyGeo.setAttribute('aBasePosition', new THREE.BufferAttribute(base, 3));
        canopyGeo.setAttribute('aColorA', new THREE.BufferAttribute(colorA, 3));
        canopyGeo.setAttribute('aColorB', new THREE.BufferAttribute(colorB, 3));
        canopyGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        canopyGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
        canopyGeo.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));

        const bassGeo = buildGlowGeometry(pc(30000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const ring = Math.floor(i / 3000);
            const p = (i % 3000) / 3000;
            const angle = (ring / 10) * Math.PI * 2 + p * 4;
            const r = 6 + ring * 1.2;
            base[i * 3] = Math.cos(angle) * r;
            base[i * 3 + 1] = -2 + Math.sin(p * 20 + ring) * 3;
            base[i * 3 + 2] = Math.sin(angle) * r;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            lerpColor(crimson, deepRed, p, ca, i * 3);
            lerpColor(deepRed, gold, Math.sin(p * 8) * 0.5 + 0.5, cb, i * 3);
            ph[i] = ring * 0.5 + p * 6;
            sp[i] = 0.8 + Math.random() * 0.2;
            ly[i] = 0.6 + Math.random() * 0.3;
        });

        super(scene, [
            new THREE.Points(canopyGeo, createGlowParticleMaterial({
                pointSize: 0.028, noiseFreq: 0.25, flowSpeed: 0.2, flowStrength: 0.2, pulseStrength: 0.25, bloomBoost: 1.3
            })),
            new THREE.Points(bassGeo, createGlowParticleMaterial({
                pointSize: 0.032, noiseFreq: 0.65, flowSpeed: 1.0, flowStrength: 1.2, pulseStrength: 0.7, bloomBoost: 2.0
            }))
        ]);
        this._collapse = 0;
    }

    update(time, audioData) {
        const bass = audioBass(audioData);
        if (bass > 0.55) this._collapse = 1;
        this._collapse *= 0.92;
        this._pulse = bass * 1.8 + this._collapse * 0.5;
        this._setUniforms(time, audioData);
        this.meshes[0].material.uniforms.uPulseStrength.value = 0.25 + this._collapse * 0.6;
        this.meshes[1].rotation.y = time * 0.08;
    }
}

// ═══════════════════════════════════════════════════════════════
// 6. NOISE ROCK — 扩散花粉云
// ═══════════════════════════════════════════════════════════════
class NoiseRockComponent extends GenerativeComponent {
    constructor(scene) {
        const deepBlue = hexToRgb('#0A1628');
        const neonGreen = hexToRgb('#39FF14');
        const lime = hexToRgb('#00FF66');

        const coreGeo = buildGlowGeometry(pc(25000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = Math.pow(Math.random(), 0.8) * 2.5;
            base[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
            base[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
            base[i * 3 + 2] = Math.cos(phi) * r;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            lerpColor(deepBlue, deepBlue, 0, ca, i * 3);
            lerpColor(deepBlue, [0.05, 0.1, 0.2], Math.random(), cb, i * 3);
            ph[i] = Math.random() * Math.PI * 2;
            sp[i] = 0.05;
            ly[i] = 0.6;
        });

        const pollenGeo = buildGlowGeometry(pc(75000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = 2 + Math.pow(Math.random(), 0.35) * 22;
            base[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
            base[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.7;
            base[i * 3 + 2] = Math.cos(phi) * r;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            const t = (r - 2) / 22;
            lerpColor(deepBlue, neonGreen, Math.pow(t, 0.6), ca, i * 3);
            lerpColor(neonGreen, lime, t, cb, i * 3);
            ph[i] = Math.random() * Math.PI * 2;
            sp[i] = 0.5 + t * 0.5;
            ly[i] = 0.3 + (1 - t) * 0.4;
        });

        super(scene, [
            new THREE.Points(coreGeo, createGlowParticleMaterial({
                pointSize: 0.04, noiseFreq: 0.8, flowSpeed: 0.5, flowStrength: 0.3, pulseStrength: 0.1
            })),
            new THREE.Points(pollenGeo, createGlowParticleMaterial({
                pointSize: 0.022, noiseFreq: 0.9, flowSpeed: 1.2, flowStrength: 1.6, pulseStrength: 0.5, bloomBoost: 1.7
            }))
        ]);
        this._burst = 0;
    }

    update(time, audioData) {
        const treble = audioTreble(audioData);
        const bass = audioBass(audioData);
        if (treble > 0.45 || bass > 0.6) this._burst = Math.min(1, this._burst + 0.15);
        this._burst *= 0.97;
        this._pulse = this._burst + treble;
        this._setUniforms(time, audioData);
        const pollen = this.meshes[1];
        pollen.material.uniforms.uFlowStrength.value = 0.6 + this._burst * 2.5;
        pollen.material.uniforms.uFlowSpeed.value = 0.6 + this._burst * 1.5;
        pollen.scale.setScalar(1 + this._burst * 0.8);
        this.meshes[0].scale.setScalar(1 - this._burst * 0.5);
    }
}

// ═══════════════════════════════════════════════════════════════
// 7. BRITPOP — 发光巨大灌木与离子扩散
// ═══════════════════════════════════════════════════════════════
class BritpopComponent extends GenerativeComponent {
    constructor(scene) {
        const grey = hexToRgb('#708090');
        const greyBlue = hexToRgb('#6B8E9F');
        const iceBlue = hexToRgb('#87CEEB');
        const atmosBlue = hexToRgb('#4A6FA5');

        const shrubGeo = buildGlowGeometry(pc(65000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const baseR = 2 + Math.pow(Math.random(), 1.8) * 9;
            const noise = Math.sin(theta * 6) * Math.cos(phi * 5) * 1.5;
            const r = baseR + noise;
            base[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
            base[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.8 - 1;
            base[i * 3 + 2] = Math.cos(phi) * r;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            const edge = baseR / 11;
            lerpColor(grey, greyBlue, edge, ca, i * 3);
            lerpColor(greyBlue, atmosBlue, Math.pow(edge, 0.7), cb, i * 3);
            ph[i] = Math.random() * Math.PI * 2;
            sp[i] = 0.12 + edge * 0.15;
            ly[i] = 0.35 + (1 - edge) * 0.3;
        });

        const ionGeo = buildGlowGeometry(pc(35000), (i, base, ca, cb, ph, sp, ly, pos) => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = 9 + Math.random() * 8;
            base[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
            base[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.5 - 1;
            base[i * 3 + 2] = Math.cos(phi) * r;
            pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = base[i * 3 + 2];
            const t = (r - 9) / 8;
            lerpColor(greyBlue, iceBlue, t, ca, i * 3);
            lerpColor(iceBlue, atmosBlue, 1 - t, cb, i * 3);
            ph[i] = Math.random() * Math.PI * 2;
            sp[i] = 0.2 + t * 0.2;
            ly[i] = 0.2 + t * 0.3;
        });

        super(scene, [
            new THREE.Points(shrubGeo, createGlowParticleMaterial({
                pointSize: 0.03, noiseFreq: 0.2, flowSpeed: 0.15, flowStrength: 0.22, pulseStrength: 0.1, bloomBoost: 1.1
            })),
            new THREE.Points(ionGeo, createGlowParticleMaterial({
                pointSize: 0.024, noiseFreq: 0.35, flowSpeed: 0.3, flowStrength: 0.55, pulseStrength: 0.15, bloomBoost: 1.3
            }))
        ]);
    }

    update(time, audioData) {
        const intensity = audioScale(audioData);
        this._pulse = Math.sin(time * 0.8) * 0.2 * intensity;
        this._setUniforms(time, audioData);
        const breathe = 1 + Math.sin(time * 0.6) * 0.03 * intensity;
        this.meshes[0].scale.setScalar(breathe);
        this.meshes[1].rotation.y = time * 0.03;
    }
}

// ─── Legacy aliases (other styles in H5 menu) ───────────────────
class SeaLilyComponent extends PsychedelicRockComponent {}
class FractalCanopyComponent extends PostPunkComponent {}
class FluidFlockComponent extends DreamPopComponent {}
class NebulaComponent extends DreamPopComponent {}
class RockGridComponent extends MathRockComponent {}
class IceStormComponent extends NoiseRockComponent {}
class BrownianFieldComponent extends NoiseRockComponent {}
class SacredGeometryComponent extends DreamPopComponent {}
class NoiseCrystalComponent extends NoiseRockComponent {}
class GravityTotemComponent extends PostPunkComponent {}
class GlitchPhantasmComponent extends ShoegazeComponent {}
class ZenSandComponent extends BritpopComponent {}
class FluidBranchesComponent extends MathRockComponent {}
class FlowerClustersComponent extends DreamPopComponent {}
class GlowShrubComponent extends BritpopComponent {}

[
    ShoegazeComponent, PsychedelicRockComponent, DreamPopComponent, MathRockComponent,
    PostPunkComponent, NoiseRockComponent, BritpopComponent
].forEach(C => { C.prototype.destroy = GenerativeComponent.prototype.destroy; });

// ─── Style → Component mapping ──────────────────────────────────
const STYLE_COMPONENTS = {
    'Shoegaze': ShoegazeComponent,
    'Psychedelic Rock': PsychedelicRockComponent,
    'Dream Pop': DreamPopComponent,
    'Math Rock': MathRockComponent,
    'Post Punk': PostPunkComponent,
    'Post-Punk': PostPunkComponent,
    'Noise Rock': NoiseRockComponent,
    'Britpop': BritpopComponent,
    'Post-Rock': MathRockComponent,
    'Psychedelic Progressive Electronic': PsychedelicRockComponent,
    'Krautrock': MathRockComponent,
    'Tribal Rock': NoiseRockComponent,
    'Dub': DreamPopComponent
};

const BLOOM_PROFILES = {
    'Shoegaze': { strength: 1.6, radius: 0.55, threshold: 0.12 },
    'Psychedelic Rock': { strength: 1.5, radius: 0.5, threshold: 0.14 },
    'Dream Pop': { strength: 1.3, radius: 0.45, threshold: 0.16 },
    'Math Rock': { strength: 1.7, radius: 0.5, threshold: 0.1 },
    'Post Punk': { strength: 1.8, radius: 0.55, threshold: 0.1 },
    'Post-Punk': { strength: 1.8, radius: 0.55, threshold: 0.1 },
    'Noise Rock': { strength: 1.9, radius: 0.6, threshold: 0.08 },
    'Britpop': { strength: 1.1, radius: 0.4, threshold: 0.18 },
    'Post-Rock': { strength: 1.5, radius: 0.48, threshold: 0.13 }
};

const LAYER_WEIGHTS = [
    { scale: 1, opacity: 1, x: 0 },
    { scale: 0.75, opacity: 0.6, x: -4 },
    { scale: 0.5, opacity: 0.3, x: 4 }
];

// ─── Public API for H5 embedding ────────────────────────────────
window.MusicVision = {
    STYLE_COMPONENTS,
    LAYER_WEIGHTS,
    BLOOM_PROFILES,
    BloomEngine,
    setSpiritCombineMode,
    setMobileMode,
    pc,
    createGlowParticleMaterial,
    buildGlowGeometry,
    ShoegazeComponent,
    PsychedelicRockComponent,
    DreamPopComponent,
    MathRockComponent,
    PostPunkComponent,
    NoiseRockComponent,
    BritpopComponent,
    audioScale,
    audioBass,
    audioTreble
};
