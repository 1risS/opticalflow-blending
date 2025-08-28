class FlowZone {
  constructor (x, y, u, v) {
    this.x = x
    this.y = y
    this.u = u // Flujo horizontal
    this.v = v // Flujo vertical
  }
}

class FlowCalculator {
  constructor (step = 8) {
    this.step = step // "Resolución" de la "grilla" del flujo óptico. Se puede ajustar desde sketch.js.
  }

  calculate (oldPixels, newPixels, width, height) {
    let zones = []
    let step = this.step

    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        let dx = 0,
          dy = 0
        let score = 0

        // Calcular el vector de flujo
        for (let j = -step; j <= step; j++) {
          for (let i = -step; i <= step; i++) {
            let oldIndex = ((y + j) * width + (x + i)) * 4
            let newIndex = ((y + j) * width + (x + i)) * 4

            let oldGray =
              (oldPixels[oldIndex] +
                oldPixels[oldIndex + 1] +
                oldPixels[oldIndex + 2]) /
              3
            let newGray =
              (newPixels[newIndex] +
                newPixels[newIndex + 1] +
                newPixels[newIndex + 2]) /
              3

            let diff = oldGray - newGray
            dx += i * diff
            dy += j * diff
            score += Math.abs(diff)
          }
        }
        // esta condición permite ajustar la sensibilidad de la detección de movimiento.
        if (score > 100000) {
          zones.push(new FlowZone(x, y, dx / score, dy / score))
        }
      }
    }

    this.zones = zones // Almacenar zonas
  }
}
