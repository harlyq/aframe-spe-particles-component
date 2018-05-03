// A-frame component for the Shader Particle Engine
let SPE = require("./lib/SPE")
let COMPONENT_NAME = "spe-particles"
let assert = (cond, msg) => { if (!cond) console.error(msg) }

assert(AFRAME, `aframe.js not available`) // global
assert(THREE, `three.js not available`) // global

let toVector3 = a => new THREE.Vector3(a.x, a.y, a.z)
let toColor = a => new THREE.Color(a)
let toVector2 = a => new THREE.Vector2(a.x, a.y)
let parseFloatArray = a => a.split(",").map(y => parseFloat(y))
let degToRad = a => parseFloat(a)/180*Math.PI
let radToDeg = a => parseFloat(a)*180/Math.PI

let uniqueEmitterID = 1

let schema = {
  enabled: {
    default: true,
    description: "enable/disable the emitter",
  },
  frustumCulled: {
    default: false,
    description: "enable/disable frustum culling",
  },

  // GROUP ATTRIBUTES
  texture: {
    type: "string",
    description: "texture to be used for each particle, may be a spritesheet",
  },
  textureFrames: {
    type: "vec2",
    default: {x: 1, y: 1},
    description: "x and y frames for a spritesheet. each particle will transition through every frame of the spritesheet over its lifetime (see textureFramesLoop)",
  },
  textureFrameCount: {
    type: "number",
    default: Number.MAX_VALUE,
    description: "number of frames in the spritesheet, defaults to textureFrames.x * textureFrames.y",
  },
  textureFrameLoop: {
    default: 1,
    description: "number of times the spritesheet should be looped over the lifetime of a particle",
  },
  // maxParticleCount: {
  //   default: 1000,
  //   description: "maximum number of particles for all emitters in this group (currently only one emitter per group)",
  // },
  blending: {
    default: "Normal",
    oneOf: ["No", "Normal", "Additive", "Subtractive", "Multiply", "Custom"],
    description: "blending mode, when drawing particles",
    parse: x => {
      let longX = x || "No"
      longX = longX.charAt(0).toUpperCase() + longX.substring(1).toLowerCase() + "Blending"
      assert(longX in THREE, `unknown blending mode "${x}"`)
      return longX
    },
    stringify: x => x.substring(-8)
  },
  hasPerspective: {
    default: true,
    description: "if true, particles will be larger the closer they are to the camera",
  },
  useTransparency: {
    default: true,
    description: "should the particles be rendered with transparency?",
  },
  alphaTest: {
    default: 0,
    min: 0,
    max: 1,
  },
  depthWrite: {
    default: false,
    description: "if true, particles write their depth into the depth buffer. this should be false if we use transparent particles",
  },
  depthTest: {
    default: true,
    description: "if true, don't render a particle's pixels if something is closer in the depth buffer",
  },
  affectedByFog: {
    default: true,
    description: "if true, the particles are affected by THREE js fog",
  },
  emitterScale: {
    default: 100,
    description: "global scaling factor for the emitter",
  },

  // EMITTER ATTRIBUTES
  relative: {
    default: "local",
    oneOf: ["local", "world"],
    description: "world relative particles move relative to the world, while local particles move relative to the emitter (i.e. if the emitter moves, all particles move with it)",
    parse: x => (x || "local").toLowerCase()
  },
  particleCount: {
    default: 100,
    description: "maximum number of particles for this emitter",
  },
  duration: {
    default: Number.MAX_VALUE, // treat MAX_VALUE as a not-set value
    description: "duration of the emitter (seconds), if not specified then continuously emit particles.  note, if the duration is set to the 'maxAge', then particles may be emitted at the end of the duration",
  },
  distribution: {
    default: "BOX",
    oneOf: ["BOX", "SPHERE", "DISC"],
    description: "distribution for particle positions, velocities and acceleration. will be overriden by specific '...Distribution' attributes",
    parse: x => (x || "BOX").toUpperCase(),
  },
  activeMultiplier: {
    default: 1,
    min: 0,
    description: "multiply the rate of particles emission, if larger than 1 then the particles will be emitted in bursts. note, very large numbers will emit all particles at once",
  },
  direction: {
    default: "forward",
    oneOf: ["forward", "backward"],
    description: "make the emitter operate forward or backward in time",
    parse: x => x.toLowerCase() === "forward" ? 1 : -1,
    stringify: x => x === 1 ? "forward" : "backward",
  },
  maxAge: {
    default: 1,
    description: "maximum age of a particle before reusing",
  },
  maxAgeSpread: {
    default: 0,
    description: "variance for the 'maxAge' attribute",
  },
  positionDistribution: {
    default: "NONE",
    oneOf: ["NONE", "BOX", "SPHERE", "DISC"],
    description: "distribution of particle positions, disc and sphere will use the radius attributes. For box particles emit at 0,0,0, for sphere they emit on the surface of the sphere and for disc on the edge of a 2D disc on the XY plane",
    parse: x => (x || "NONE").toUpperCase(),
  },
  positionSpread: {
    type: "vec3",
    description: "particles are positioned within +- of these local bounds. for sphere and disc distributions only the x axis is used",
  },
  positionOffset: {
    type: "vec3",
    description: "fixed offset to the apply to the emitter relative to its parent entity",
  },
  randomizePosition: {
    default: false,
    description: "if true, re-randomize position when re-spawning a particle, can incur a performance hit",
  },
  radius: {
    default: 1,
    min: 0,
    description: "radius of the disc or sphere emitter (ignored for box). note radius of 0 will prevent velocity and acceleration if they use a sphere or disc distribution",
  },
  radiusScale: {
    type: "vec3",
    default: { x: 1, y: 1, z: 1 },
    description: "scales the emitter for sphere and disc shapes to form oblongs and ellipses",
  },
  velocityDistribution: {
    default: "NONE",
    oneOf: ["NONE", "BOX", "SPHERE", "DISC"],
    description: "distribution of particle velocities, for disc and sphere, only the x component will be used. if set to NONE use the 'distribution' attribute for velocityDistribution",
    parse: x => (x || "NONE").toUpperCase(),
  },
  velocity: {
    type: "vec3",
    description: "for sphere and disc distributions, only the x axis is used",
  },
  velocitySpread: {
    type: "vec3",
    description: "variance for the velocity",
  },
  randomizeVelocity: {
    default: false,
    description: "if true, re-randomize velocity when re-spawning a particle, can incur a performance hit",
  },
  accelerationDistribution: {
    default: "NONE",
    oneOf: ["NONE", "BOX", "SPHERE", "DISC"],
    description: "distribution of particle acceleration, for disc and sphere, only the x component will be used. if set to NONE use the 'distribution' attribute for accelerationDistribution",
    parse: x => (x || "NONE").toUpperCase(),
  },
  acceleration: {
    type: "vec3",
    description: "for sphere and disc distributions, only the x axis is used",
  },
  accelerationSpread: {
    type: "vec3",
    description: "spread of the particle's acceleration. for sphere and disc distributions, only the x axis is used",
  },
  randomizeAcceleration: {
    default: false,
    description: "if true, re-randomize acceleration when re-spawning a particle, can incur a performance hit",
  },
  drag: {
    default: 0,
    min: 0,
    max: 1,
    description: "apply resistance to moving the particle, 0 is no resistance, 1 is full resistance, particle will stop moving at half of it's maxAge"
  },
  dragSpread: {
    default: 0,
    description: "spread to apply to the drag attribute"
  },
  randomizeDrag: {
    default: false,
    description: "if true, re-randomize drag when re-spawning a particle, can incur a performance hit",
  },
  wiggle: {
    default: 0,
    description: "extra distance the particle moves over its lifetime",
  },
  wiggleSpread: {
    default: 0,
    description: "+- spread for the wiggle attribute",
  },
  rotation: {
    default: 0,
    description: "rotation in degrees",
    parse: x => degToRad(x),
    stringify: x => radToDeg(x),
  },
  rotationSpread: {
    default: 0,
    description: "rotation variance in degrees",
    parse: x => degToRad(x),
    stringify: x => radToDeg(x),
  },
  rotationAxis: {
    type: "vec3",
    description: "local axis when using rotation",
  },
  rotationAxisSpread: {
    type: "vec3",
    description: "variance in the axis of rotation",
  },
  rotationStatic: {
    default: false,
    description: "if true, the particles are fixed at their initial rotation value. if false, the particle will rotate from 0 to the 'rotation' value",
  },
  // rotationPivot: {
  //   default: {x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE, },
  //   description: "if set rotate about this pivot, otherwise rotate about the emitter"
  // },
  randomizeRotation: {
    default: false,
    description: "if true, re-randomize rotation when re-spawning a particle, can incur a performance hit",
  },
  color: {
    type: "array",
    default: ["#fff"],
    description: "array of colors over the particle's lifetime, max 4 elements",
  },
  colorSpread: {
    type: "array",
    default: "",
    description: "spread to apply to colors, spread an array of vec3 (r g b) with 0 for no spread and 1 for max spread, note the spread will be re-applied through-out the lifetime of the particle",
    parse: x => x.split(",").map(AFRAME.utils.coordinates.parse),
    stringify: x => x.map(AFRAME.utils.coordinates.stringify).join(","),
  },
  randomizeColor: {
    default: false,
    description: "if true, re-randomize colour when re-spawning a particle, can incur a performance hit",
  },
  opacity: {
    type: "array",
    default: "1",
    description: "opacity over the particle's lifetime, max 4 elements",
    parse: parseFloatArray,
  },
  opacitySpread: {
    type: "array",
    default: "0",
    description: "spread in opacity over the particle's lifetime, max 4 elements",
    parse: parseFloatArray,
  },
  randomizeOpacity: {
    default: false,
    description: "if true, re-randomize opacity when re-spawning a particle, can incur a performance hit",
  },
  size: {
    type: "array",
    default: "1",
    description: "array of sizes over the particle's lifetime, max 4 elements",
    parse: parseFloatArray,
  },
  sizeSpread: {
    type: "array",
    default: "0",
    description: "spread in size over the particle's lifetime, max 4 elements",
    parse: parseFloatArray,
  },
  randomizeSize: {
    default: false,
    description: "if true, re-randomize size when re-spawning a particle, can incur a performance hit",
  },
  angle: {
    type: "array",
    default: "0",
    description: "2D rotation of the particle over the particle's lifetime, max 4 elements",
    parse: x => parseFloatArray(x),
  },
  angleSpread: {
    type: "array",
    default: "0",
    description: "spread in angle over the particle's lifetime, max 4 elements",
    parse: x => parseFloatArray(x),
  },
  randomizeAngle: {
    default: false,
    description: "if true, re-randomize angle when re-spawning a particle, can incur a performance hit",
  },
}

AFRAME.registerComponent(COMPONENT_NAME, {
  schema: schema,
  particleGroup: null,
  emitterID: 0,
  referenceEl: null,

  init: function () {
    this.emitterID = uniqueEmitterID++
  },

  update: function (oldData) {
    // TODO keep the system if just starting/stopping it
    this.removeParticleSystem()
    this.addParticleSystem()

    if (this.data.enabled) {
      this.startParticles()
    } else {
      this.stopParticles()
    }
  },

  remove: function () {
    this.removeParticleSystem()
  },

  tick: function (time, dt) {
    if (this.data.relative === "world") {
      let newPosition = toVector3(this.data.positionOffset).applyMatrix4(this.el.object3D.matrixWorld)
      this.particleGroup.emitters[0].position.value = newPosition
    }

    this.particleGroup.tick(dt / 1000)
  },

  addParticleSystem: function() {
    let data = this.data
    let textureLoader = new THREE.TextureLoader()
    let particleTexture = textureLoader.load(data.texture)

    assert(this.particleGroup === null)
    let groupOptions = {
      texture: {
        value: particleTexture,
        frames: toVector2(data.textureFrames),
        frameCount: data.textureFrameCount !== Number.MAX_VALUE ? data.textureFrameCount : undefined,
        loop: data.textureFrameLoop,
      },
      maxParticleCount: data.particleCount, //data.maxParticleCount,
      blending: THREE[data.blending],
      hasPerspective: data.hasPerspective,
      transparent: data.useTransparency,
      alphaTest: data.alphaTest,
      depthWrite: data.depthWrite,
      depthTest: data.depthTest,
      fog: data.affectedByFog,
      scale: data.emitterScale,
    }
    this.particleGroup = new SPE.Group(groupOptions)

    let emitterOptions = {
      type: SPE.distributions[data.distribution in SPE.distributions ? data.distribution : "BOX"],
      particleCount: data.particleCount,
      duration: data.duration !== Number.MAX_VALUE ? data.duration : null,
      // isStatic: true,
      activeMultiplier: data.activeMultiplier,
      direction: data.direction,
      maxAge: {
        value: data.maxAge,
        spread: data.maxAgeSpread,
      },
      position: {
        value: data.relative === "World" ? toVector3(this.data.positionOffset).applyMatrix4(this.el.object3D.matrixWorld) : toVector3(data.positionOffset).applyMatrix4(this.el.object3D.matrix),
        radius: data.radius,
        radiusScale: toVector3(data.radiusScale),
        spread: toVector3(data.positionSpread),
        distribution: SPE.distributions[data.positionDistribution in SPE.distributions ? data.positionDistribution : data.distribution], // default to the base distribution
        randomise: data.randomizePosition,
      },
      velocity: {
        value: toVector3(data.velocity),
        spread: toVector3(data.velocitySpread),
        distribution: SPE.distributions[data.velocityDistribution in SPE.distributions ? data.velocityDistribution : data.distribution], // default to the base distribution
        randomise: data.randomizeVelocity,
      },
      acceleration: {
        value: toVector3(data.acceleration),
        spread: toVector3(data.accelerationSpread),
        distribution: SPE.distributions[data.accelerationDistribution in SPE.distributions ? data.accelerationDistribution : data.distribution], // default to the base distribution
        randomise: data.randomizeAcceleration,
      },
      drag: {
        value: data.drag,
        spread: data.dragSpread,
        randomise: data.randomizeDrag,
      },
      wiggle: {
        value: data.wiggle,
        spread: data.wiggleSpread,
      },
      rotation: {
        axis: toVector3(data.rotationAxis),
        axisSpread: toVector3(data.rotationAxisSpread),
        angle: data.rotation,
        angleSpread: data.rotationSpread,
        static: data.rotationStatic,
        // center: data.rotationPivot,
        randomise: data.randomizeRotation,
      },
      color: {
        value: data.color.length > 0 ? data.color.map(x => toColor(x)) : [toColor("#fff")],
        spread: data.colorSpread.map(x => toVector3(x)),
        randomise: data.randomizeColor,
      },
      opacity: {
        value: data.opacity,
        spread: data.opacitySpread,
        randomise: data.randomizeOpacity,
      },
      size: {
        value: data.size,
        spread: data.sizeSpread,
        randomise: data.randomizeSize,
      },
      angle: {
        value: data.angle,
        spread: data.angleSpread,
        randomise: data.randomizeAngle,
      },
    }
    let emitter = new SPE.Emitter(emitterOptions)

    this.particleGroup.addEmitter(emitter)
    this.particleGroup.mesh.frustumCulled = data.frustumCulled // TODO this doesn't seem to work

    // World emitters are parented to the world and we set their position each frame.
    // Local emitters are parented to the DOM entity
    this.referenceEl = data.relative === "world" ? this.el.sceneEl : this.el
    this.referenceEl.setObject3D(this.getEmitterName(), this.particleGroup.mesh)
  },

  removeParticleSystem: function() {
    if (this.particleGroup) {
      this.referenceEl.removeObject3D(this.getEmitterName())
      this.particleGroup = null
    }
  },

  startParticles: function() {
    this.particleGroup.emitters.forEach(function(em) { em.enable() })
  },

  stopParticles: function() {
    this.particleGroup.emitters.forEach(function(em) { em.disable() })
  },

  getEmitterName: function() {
    return COMPONENT_NAME + this.emitterID
  }
})

function generateMarkDown(schema) {
  let str = `
| Property | Description | Default Value | Values |
| -------- | ----------- | ------------- | ------ |`

  function printValue(v, t, quote = true) {
    if (typeof v === "undefined") {
      switch (t) {
        case undefined: return "undefined"
        case "array": return []
        case "vec3": return "{x: 0, y: 0, z: 0}"
        case "vec2": return "{x: 0, y: 0}"
        case "number": return 0
        case "string": return ""
        case "color": return "white"
        default: return `unknown: ${t}`
      }
    } else if (typeof v === "object") {
      if (Array.isArray(v)) {
        return "[" + v.map(x => printValue(x)).join(", ") + "]"
      } else {
        return "{" + Object.keys(v).map(x => `${x}: ${printValue(v[x])}`).join(", ") + "}"
      }
    } else if (typeof v === "number" && v === Number.MAX_VALUE) {
      return "MAX_VALUE"
    } else if (quote && typeof v === "string") {
      return "'" + v + "'"
    } else {
      return v
    }
  }

  let sortedKeys = Object.keys(schema).sort()
  for (let key of sortedKeys) {
    let property = schema[key]
    let description = property.description
    let def = printValue(property.default, property.type)
    let type = printValue(property.oneOf ? property.oneOf : property.type, "string", false) // no quotes

    str += `\n|${key}|${description}|${def}|${type}|`
  }

  return str
}

//console.log(generateMarkDown(schema))
