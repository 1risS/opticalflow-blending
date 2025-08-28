var w = 900
var h = 600
var capture
var previousPixels
var flow
var step = 32
var img
var imgBuffer // buffer del tamaño del canvas para restaurar
var restoreIndex = 0 // índice para restauración progresiva

function preload () {
  img = loadImage('jujuy.jpeg')
}

function setup () {
  let canvas = createCanvas(w, h)
  canvas.parent('canvas-container')
  // Crear buffer con la imagen original escalada al canvas
  imgBuffer = createGraphics(w, h)
  imgBuffer.image(img, 0, 0, w, h)
  image(imgBuffer, 0, 0, w, h) // Dibujar la imagen original solo una vez
  // Inicializar la captura de video desde la cámara
  capture = createCapture(
    {
      audio: false,
      video: {
        width: w,
        height: h,
        facingMode: { exact: 'environment' } // Forzar cámara trasera
      }
    },
    function () {
      console.log('Capture ready.')
    }
  )
  capture.elt.setAttribute('playsinline', '')
  capture.hide() // No mostrar la webcam
  flow = new FlowCalculator(step)
}

function draw () {
  // Ya no se dibuja la imagen de fondo aquí, para que los efectos sean acumulativos

  capture.loadPixels()
  if (capture.pixels.length > 0) {
    if (previousPixels) {
      flow.calculate(
        previousPixels,
        capture.pixels,
        capture.width,
        capture.height
      )
    }
    previousPixels = capture.pixels.slice()

    // Calcular centroide de zonas con movimiento significativo
    if (flow && flow.zones && flow.zones.length > 0) {
      let sumX = 0,
        sumY = 0,
        sumU = 0,
        sumV = 0,
        count = 0
      for (let zone of flow.zones) {
        let speed = Math.sqrt(zone.u * zone.u + zone.v * zone.v)
        if (speed > 0.5) {
          sumX += zone.x
          sumY += zone.y
          sumU += zone.u
          sumV += zone.v
          count++
        }
      }
      if (count > 0) {
        let cx = sumX / count
        let cy = sumY / count
        let cu = sumU / count
        let cv = sumV / count
        // Efecto: desplazamiento de píxeles solo en el centroide
        push()
        let r = 54 // área más pequeña
        let sx = constrain(cx - r / 2, 0, w - r)
        let sy = constrain(cy - r / 2, 0, h - r)
        let temp = get(sx, sy, r, r)
        let dx = constrain(cu * 10, -r / 2, r / 2)
        let dy = constrain(cv * 10, -r / 2, r / 2)
        tint(255, 180)
        image(temp, sx + dx, sy + dy, r, r)
        noTint()
        pop()
        // Restauración local (blend/lerp) en la zona afectada
        loadPixels()
        imgBuffer.loadPixels()
        let blendFactor = 0.08 // Ajusta la velocidad de restauración local (más alto = más rápido)
        for (let y = sy; y < sy + r; y++) {
          for (let x = sx; x < sx + r; x++) {
            let idx = 4 * (Math.floor(x) + Math.floor(y) * width)
            pixels[idx] = lerp(pixels[idx], imgBuffer.pixels[idx], blendFactor)
            pixels[idx + 1] = lerp(
              pixels[idx + 1],
              imgBuffer.pixels[idx + 1],
              blendFactor
            )
            pixels[idx + 2] = lerp(
              pixels[idx + 2],
              imgBuffer.pixels[idx + 2],
              blendFactor
            )
            // pixels[idx+3] = 255;
          }
        }
        updatePixels()
      }
    }
    // Restauración progresiva exacta: restaurar 1/180 del canvas por frame
    loadPixels()
    imgBuffer.loadPixels()
    let totalPixels = pixels.length / 4
    let pixelsPerFrame = Math.ceil(totalPixels / 180)
    for (let p = 0; p < pixelsPerFrame; p++) {
      let idx = (restoreIndex + p) % totalPixels
      let i = idx * 4
      pixels[i] = imgBuffer.pixels[i] // R
      pixels[i + 1] = imgBuffer.pixels[i + 1] // G
      pixels[i + 2] = imgBuffer.pixels[i + 2] // B
      pixels[i + 3] = imgBuffer.pixels[i + 3] // A
    }
    restoreIndex = (restoreIndex + pixelsPerFrame) % totalPixels
    updatePixels()
  }
}
