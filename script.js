var w = 900
var h = 600
var capture
var previousPixels
var flow
var step = 32

var balls = []

// Sintetiadores Tone.js para los bordes del canvas
let leftSynth, rightSynth, topSynth, bottomSynth

let soundEnabled = false // Variable para habilitar o deshabilitar el sonido

function setup () {
  // Selecciona el contenedor donde se insertará el canvas
  let canvas = createCanvas(w, h)
  canvas.parent('canvas-container') // Asocia el canvas al contenedor

  // Inicializar la captura de video desde la cámara
  capture = createCapture(
    {
      audio: false,
      video: {
        width: w,
        height: h
      }
    },
    function () {
      console.log('Capture ready.')
    }
  )
  capture.elt.setAttribute('playsinline', '') // Para que funcione correctamente en dispositivos móviles
  capture.hide() // Oculta la vista directa del video para procesarlo en el canvas

  flow = new FlowCalculator(step) // Inicializar el calculador de flujo óptico

  // Crear sintetizadores para cada borde
  leftSynth = new Tone.Synth().toDestination()
  rightSynth = new Tone.Synth().toDestination()
  topSynth = new Tone.Synth().toDestination()
  bottomSynth = new Tone.Synth().toDestination()

  // Crear pelotas en posiciones aleatorias
  for (let i = 0; i < 20; i++) {
    balls.push(new Ball(random(width), random(height)))
  }

  // Añade event listener para el botón de sonido
  let toggleSoundButton = document.getElementById('toggle-sound')
  toggleSoundButton.addEventListener('click', toggleSound)
}

function toggleSound () {
  soundEnabled = !soundEnabled // Cambia el estado del sonido
  const toggleSoundButton = document.getElementById('toggle-sound')
  toggleSoundButton.innerHTML = soundEnabled ? 'Sonido OFF' : 'Sonido ON'
}

function draw () {
  capture.loadPixels()
  // Si hay un fotograma previo, calcular el flujo óptico
  if (capture.pixels.length > 0) {
    if (previousPixels) {
      flow.calculate(
        previousPixels,
        capture.pixels,
        capture.width,
        capture.height
      )
    }
    previousPixels = capture.pixels.slice() // Guardar el fotograma actual como el previo

    // Dibujar el video capturado en el canvas
    image(capture, 0, 0, w, h)

    // Dibujar los vectores del flujo óptico
    if (flow && flow.zones && flow.zones.length > 0) {
      for (let zone of flow.zones) {
        stroke(255, 0, 0)
        strokeWeight(2)
        fill(255, 0, 0)
        line(zone.x, zone.y, zone.x + zone.u * 1, zone.y + zone.v * 1)
      }
    }

    // Actualizar y dibujar todas las pelotas
    for (let ball of balls) {
      ball.update(flow)
      ball.display()
    }
  }
}

// Calse Ball
class Ball {
  constructor (x, y) {
    this.pos = createVector(x, y) // Posicion inicial
    this.vel = createVector(random(-2, 2), random(-2, 2)) // Velocidad inicial aleatoria
    this.size = 30 // Tamaño de la pelota
    this.bounceSoundCooldown = { left: 0, right: 0, top: 0, bottom: 0 } // Temporizadores para evitar que el sonido se reproduzca demasiado seguido
  }

  // Actualiza la posición y velocidad de la pelota
  update (flow) {
    // Si hay datos de flujo óptico, aplicar los vectores de movimiento más cercanos a las pelotas
    if (flow && flow.zones && flow.zones.length > 0) {
      let closestFlow = this.getClosestFlowZone(flow.zones)
      if (closestFlow) {
        // Acá se puede ajustar el impacto del flujo en la velocidad
        this.vel.x += closestFlow.u * 0.5 //Suma el vector de flujo horizontal a la velocidad x de la pelota.
        this.vel.y += closestFlow.v * 0.5 //Suma el vector de flujo vertical a la velocidad y de la pelota
      }
    }

    // Agregar amortiguación para reducir gradualmente la velocidad
    this.vel.mult(0.95)

    // Actualizar la posición de la pelota
    this.pos.add(this.vel)

    // Manejar las colisiones con los bordes
    this.handleEdges()
  }

  // Maneja los rebotes de la pelota contra los bordes y reproduce sonidos si está activado
  handleEdges () {
    let now = Tone.now() // Obtener el tiempo actual desde Tone.js

    // Bordes izquierdo y derecho
    if (this.pos.x <= 0) {
      this.pos.x = 0
      this.vel.x *= -1
      if (now > this.bounceSoundCooldown.left) {
        this.playSound(leftSynth, 'C4') // Nota al rebotar en el borde izquierdo
        this.bounceSoundCooldown.left = now + 0.2 // Cooldown de 200ms
      }
    } else if (this.pos.x >= width) {
      this.pos.x = width
      this.vel.x *= -1
      if (now > this.bounceSoundCooldown.right) {
        this.playSound(rightSynth, 'E4') // Nota al rebotar en el borde derecho
        this.bounceSoundCooldown.right = now + 0.2
      }
    }

    // Bordes superior e inferior
    if (this.pos.y <= 0) {
      this.pos.y = 0
      this.vel.y *= -1
      if (now > this.bounceSoundCooldown.top) {
        this.playSound(topSynth, 'G4') // Nota al rebotar en el borde superior
        this.bounceSoundCooldown.top = now + 0.2
      }
    } else if (this.pos.y >= height) {
      this.pos.y = height
      this.vel.y *= -1
      if (now > this.bounceSoundCooldown.bottom) {
        this.playSound(bottomSynth, 'B4') // Nota al rebotar en el borde inferior
        this.bounceSoundCooldown.bottom = now + 0.2
      }
    }
  }

  // Reproduce un sonido con el sintetizador indicado
  playSound (synth, note) {
    if (soundEnabled) {
      // Solo reproducir si el sonido está activado
      try {
        synth.triggerAttackRelease(note, '8n', Tone.now())
      } catch (error) {
        console.error('Audio playback error: ', error)
      }
    }
  }

  // Dibuja la pelota en el canvas
  display () {
    fill(255, 100, 200, 150) // Color con transparencia para efecto de burbuja
    noStroke()
    ellipse(this.pos.x, this.pos.y, this.size)
  }

  // Encuentra la zona de flujo más cercana a la posición de la pelota
  getClosestFlowZone (zones) {
    let closest = null
    let minDist = Infinity
    let maxDist = 100

    for (let zone of zones) {
      let d = dist(this.pos.x, this.pos.y, zone.x, zone.y)
      if (d < minDist && d < maxDist) {
        minDist = d
        closest = zone
      }
    }

    return closest
  }
}
