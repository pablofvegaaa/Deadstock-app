/*
 * StockLoop — Motor de optimización de deadstock textil.
 *
 * Resuelve un problema de programación lineal entera que asigna
 * unidades de cada SKU a uno de los canales de salida, maximizando
 * una función objetivo ponderada (económico + ecológico + regulatorio)
 * sujeta a restricciones de capacidad, elegibilidad y descuentos por
 * tolerancia al riesgo declarada por el cliente.
 */

import solver from 'javascript-lp-solver'

// ─── HUELLA DE CARBONO POR CATEGORÍA (kg CO2 por unidad) ───
// Valores aproximados de literatura (Ellen MacArthur, EEA, ADEME).
export const HUELLA_CO2 = {
  Camiseta:  7,
  Vaquero:  25,
  Vestido:  15,
  Abrigo:   40,
  Calzado:  15,
  Accesorio: 5,
}

// ─── CANALES DE SALIDA ───
// pctCo2Evitado: fracción de la huella de la prenda que se evita
// al destinarla a este canal en lugar de destruirla.
export const CANALES = {
  Outlet: {
    nombre: 'Outlet propio',
    tasaRecup: 0.50, costeLog: 0.50, pctCo2Evitado: 0.70,
    capacidad: 0.30, rReg: 0.90,
    color: '#1F4E78',
  },
  B2B: {
    nombre: 'B2B saldos',
    tasaRecup: 0.25, costeLog: 0.30, pctCo2Evitado: 0.65,
    capacidad: 0.30, rReg: 0.85,
    color: '#2E75B6',
  },
  Exportacion: {
    nombre: 'Exportación no-UE',
    tasaRecup: 0.30, costeLog: 1.00, pctCo2Evitado: 0.60,
    capacidad: 0.30, rReg: 0.85,
    color: '#5B9BD5',
  },
  Donacion: {
    nombre: 'Donación',
    tasaRecup: 0.10, costeLog: 0.40, pctCo2Evitado: 0.75,
    capacidad: 0.40, rReg: 0.80,
    color: '#9DC3E6',
  },
  Reutilizacion: {
    nombre: 'Reutilización',
    tasaRecup: 0.35, costeLog: 1.50, pctCo2Evitado: 0.80,
    capacidad: 0.40, rReg: 1.00,
    color: '#2E7D32',
  },
  Reciclaje: {
    nombre: 'Reciclaje',
    tasaRecup: 0.03, costeLog: 0.50, pctCo2Evitado: 0.20,
    capacidad: 1.00, rReg: 0.40,
    color: '#A5A5A5',
  },
}

// ─── MODIFICADOR DE ANTIGÜEDAD POR CANAL ───
export const FACTOR_ANTIGUEDAD = {
  Outlet:        { 0: 1.00, 1: 0.85, 2: 0.55, 3: 0.30, 4: 0.15 },
  B2B:           { 0: 1.00, 1: 0.95, 2: 0.85, 3: 0.70, 4: 0.55 },
  Exportacion:   { 0: 1.00, 1: 0.95, 2: 0.90, 3: 0.80, 4: 0.70 },
  Donacion:      { 0: 1.00, 1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00 },
  Reutilizacion: { 0: 1.00, 1: 0.95, 2: 0.90, 3: 0.85, 4: 0.80 },
  Reciclaje:     { 0: 1.00, 1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00 },
}

// ─── PERFIL DE RIESGO POR CANAL (canibalización + imagen) ───
// 0 = sin riesgo, 1 = riesgo máximo
export const PERFIL_RIESGO_CANAL = {
  Outlet:        { canibalizacion: 0.9, imagen: 0.1 },
  B2B:           { canibalizacion: 0.6, imagen: 0.4 },
  Exportacion:   { canibalizacion: 0.1, imagen: 0.7 },
  Donacion:      { canibalizacion: 0.0, imagen: 0.3 },
  Reutilizacion: { canibalizacion: 0.2, imagen: 0.0 },
  Reciclaje:     { canibalizacion: 0.0, imagen: 0.1 },
}

const NIVEL_DESCUENTO = { alta: 0.05, media: 0.15, baja: 0.30 }

export const CATEGORIAS = ['Camiseta', 'Vaquero', 'Vestido', 'Abrigo', 'Calzado', 'Accesorio']
export const ESTADOS = ['Nuevo', 'Devolucion', 'Deterioro']

const LISTA_CANALES = Object.keys(CANALES)

function factorRiesgo(canal, tolerancias) {
  const perfil = PERFIL_RIESGO_CANAL[canal]
  const dCan = NIVEL_DESCUENTO[tolerancias.canibalizacion] * perfil.canibalizacion
  const dImg = NIVEL_DESCUENTO[tolerancias.imagen] * perfil.imagen
  return Math.max(0.5, 1 - dCan - dImg)
}

export function optimizar(skus, pesos, tolerancias = { canibalizacion: 'media', imagen: 'media' }, practicaHabitual = null) {
  if (!skus.length) return null
  const totalUnidades = skus.reduce((s, k) => s + k.unidades, 0)
  if (totalUnidades === 0) return null

  const factorRiesgoCanal = {}
  LISTA_CANALES.forEach((j) => {
    factorRiesgoCanal[j] = factorRiesgo(j, tolerancias)
  })

  // Máximos teóricos para normalizar
  const maxTasa = Math.max(...LISTA_CANALES.map((j) => CANALES[j].tasaRecup))
  const maxCo2EvitadoUnit = Math.max(
    ...Object.values(HUELLA_CO2).map((h) =>
      h * Math.max(...LISTA_CANALES.map((j) => CANALES[j].pctCo2Evitado)),
    ),
  )
  const maxReg = Math.max(...LISTA_CANALES.map((j) => CANALES[j].rReg))

  const zEconMax = skus.reduce((s, k) => s + k.pvp * k.unidades, 0) * maxTasa
  const zEcoMax  = totalUnidades * maxCo2EvitadoUnit
  const zRegMax  = totalUnidades * maxReg

  const model = {
    optimize: 'objetivo',
    opType: 'max',
    constraints: {},
    variables: {},
    ints: {},
  }

  skus.forEach((sku, i) => {
    LISTA_CANALES.forEach((j) => {
      const canal = CANALES[j]
      const fa = FACTOR_ANTIGUEDAD[j][sku.antiguedad]
      const fr = factorRiesgoCanal[j]

      const ingresoUnit = sku.pvp * canal.tasaRecup * fa * fr - canal.costeLog
      const co2EvitadoUnit = HUELLA_CO2[sku.categoria] * canal.pctCo2Evitado
      const regUnit = canal.rReg

      const coefObj =
        pesos.economico   * (ingresoUnit / zEconMax) +
        pesos.ecologico   * (co2EvitadoUnit / zEcoMax) +
        pesos.regulatorio * (regUnit / zRegMax)

      const varName = `x_${i}_${j}`
      model.variables[varName] = {
        objetivo: coefObj,
        [`asignacion_${i}`]: 1,
        [`capacidad_${j}`]: 1,
      }
      model.ints[varName] = 1
    })
    model.constraints[`asignacion_${i}`] = { equal: sku.unidades }
  })

  LISTA_CANALES.forEach((j) => {
    model.constraints[`capacidad_${j}`] = {
      max: CANALES[j].capacidad * totalUnidades,
    }
  })

  skus.forEach((sku, i) => {
    if (sku.estado === 'Deterioro') {
      const varName = `x_${i}_Outlet`
      model.constraints[`r3_${i}`] = { max: 0 }
      model.variables[varName][`r3_${i}`] = 1
    }
  })

  const resultado = solver.Solve(model)
  if (!resultado.feasible) return { feasible: false }

  const asignacion = []
  skus.forEach((sku, i) => {
    LISTA_CANALES.forEach((j) => {
      const v = resultado[`x_${i}_${j}`]
      if (v && v > 0.5) {
        asignacion.push({
          skuId: sku.id,
          categoria: sku.categoria,
          canal: j,
          unidades: Math.round(v),
        })
      }
    })
  })

  const repartoPorCanal = {}
  LISTA_CANALES.forEach((j) => { repartoPorCanal[j] = 0 })
  asignacion.forEach((a) => { repartoPorCanal[a.canal] += a.unidades })

  const metricas = calcularImpacto(skus, asignacion, practicaHabitual)

  return {
    feasible: true,
    asignacion,
    repartoPorCanal,
    totalUnidades,
    metricas,
    factorRiesgoCanal,
  }
}

export function calcularImpacto(skus, asignacion, practicaHabitual = null) {
  const skuPorId = {}
  skus.forEach((k) => { skuPorId[k.id] = k })
  const totalUnidades = skus.reduce((s, k) => s + k.unidades, 0)

  // baseline por defecto: 60% outlet + 40% destrucción
  const baseline = practicaHabitual || { Outlet: 0.6, Destruccion: 0.4 }

  let ingresoModelo = 0
  let co2EvitadoModelo = 0
  let unidadesAltoValor = 0
  const altoValor = ['Reutilizacion', 'Outlet', 'Exportacion', 'B2B']

  asignacion.forEach((a) => {
    const sku = skuPorId[a.skuId]
    const c = CANALES[a.canal]
    const fa = FACTOR_ANTIGUEDAD[a.canal][sku.antiguedad]
    ingresoModelo += a.unidades * (sku.pvp * c.tasaRecup * fa - c.costeLog)
    co2EvitadoModelo += a.unidades * HUELLA_CO2[sku.categoria] * c.pctCo2Evitado
    if (altoValor.includes(a.canal)) unidadesAltoValor += a.unidades
  })

  let ingresoBaseline = 0
  let co2EvitadoBaseline = 0
  skus.forEach((sku) => {
    Object.entries(baseline).forEach(([canalBase, pct]) => {
      const u = sku.unidades * pct
      if (canalBase === 'Destruccion') return
      const c = CANALES[canalBase]
      if (!c) return
      const fa = FACTOR_ANTIGUEDAD[canalBase][sku.antiguedad]
      ingresoBaseline += u * (sku.pvp * c.tasaRecup * fa - c.costeLog)
      co2EvitadoBaseline += u * HUELLA_CO2[sku.categoria] * c.pctCo2Evitado
    })
  })

  return {
    ingresoModelo,
    ingresoBaseline,
    ahorro: ingresoModelo - ingresoBaseline,
    mejoraPct: ingresoBaseline > 0 ? ((ingresoModelo - ingresoBaseline) / ingresoBaseline) * 100 : 0,
    co2EvitadoModelo,
    co2EvitadoBaseline,
    co2Extra: co2EvitadoModelo - co2EvitadoBaseline,
    pctAltoValor: (unidadesAltoValor / totalUnidades) * 100,
  }
}
