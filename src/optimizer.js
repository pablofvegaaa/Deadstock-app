/*
 * MOTOR DE OPTIMIZACIÓN DE DEADSTOCK — versión JavaScript
 *
 * Replica el modelo de programación lineal entera implementado en Python
 * con PuLP. Resuelve la asignación óptima de unidades de cada SKU a cada
 * canal de salida, maximizando una función objetivo ponderada
 * (económico + ecológico + regulatorio) sujeta a restricciones.
 *
 * Usa la librería javascript-lp-solver.
 */

import solver from 'javascript-lp-solver'

// ─── DEFINICIÓN DE LOS 6 CANALES DE SALIDA ───
// Mismos parámetros que el modelo Python (paso2_modelo.py)
export const CANALES = {
  Outlet: {
    nombre: 'Outlet propio',
    tasaRecup: 0.50, costeLog: 0.50, co2: 8, capacidad: 0.30, rReg: 0.90,
    color: '#1F4E78',
  },
  B2B: {
    nombre: 'B2B saldos',
    tasaRecup: 0.25, costeLog: 0.30, co2: 6, capacidad: 0.50, rReg: 0.85,
    color: '#2E75B6',
  },
  Exportacion: {
    nombre: 'Exportación no-UE',
    tasaRecup: 0.30, costeLog: 1.00, co2: 5, capacidad: 0.40, rReg: 0.85,
    color: '#5B9BD5',
  },
  Donacion: {
    nombre: 'Donación',
    tasaRecup: 0.10, costeLog: 0.40, co2: 9, capacidad: 0.30, rReg: 0.80,
    color: '#9DC3E6',
  },
  Reutilizacion: {
    nombre: 'Reutilización',
    tasaRecup: 0.35, costeLog: 1.50, co2: 11, capacidad: 0.30, rReg: 1.00,
    color: '#2E7D32',
  },
  Reciclaje: {
    nombre: 'Reciclaje',
    tasaRecup: 0.03, costeLog: 0.50, co2: 4, capacidad: 1.00, rReg: 0.40,
    color: '#A5A5A5',
  },
}

// ─── MODIFICADOR DE ANTIGÜEDAD POR CANAL ───
// Multiplica la tasa de recuperación según las temporadas de antigüedad
export const FACTOR_ANTIGUEDAD = {
  Outlet:        { 0: 1.00, 1: 0.85, 2: 0.55, 3: 0.30, 4: 0.15 },
  B2B:           { 0: 1.00, 1: 0.95, 2: 0.85, 3: 0.70, 4: 0.55 },
  Exportacion:   { 0: 1.00, 1: 0.95, 2: 0.90, 3: 0.80, 4: 0.70 },
  Donacion:      { 0: 1.00, 1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00 },
  Reutilizacion: { 0: 1.00, 1: 0.95, 2: 0.90, 3: 0.85, 4: 0.80 },
  Reciclaje:     { 0: 1.00, 1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00 },
}

export const CATEGORIAS = ['Camiseta', 'Vaquero', 'Vestido', 'Abrigo', 'Calzado', 'Accesorio']
export const ESTADOS = ['Nuevo', 'Devolucion', 'Deterioro']

const LISTA_CANALES = Object.keys(CANALES)

/*
 * Resuelve el modelo de optimización.
 *
 * @param skus  array de objetos { id, categoria, unidades, pvp,
 *                                 costeProduccion, antiguedad, estado }
 * @param pesos objeto { economico, ecologico, regulatorio } — suman 1
 * @returns objeto con la asignación y las métricas de impacto
 */
export function optimizar(skus, pesos) {
  if (!skus.length) return null

  const totalUnidades = skus.reduce((s, k) => s + k.unidades, 0)
  if (totalUnidades === 0) return null

  // ── Máximos teóricos para normalizar (escala 0-1) ──
  const maxTasa = Math.max(...LISTA_CANALES.map((j) => CANALES[j].tasaRecup))
  const maxCo2 = Math.max(...LISTA_CANALES.map((j) => CANALES[j].co2))
  const maxReg = Math.max(...LISTA_CANALES.map((j) => CANALES[j].rReg))

  const zEconMax =
    skus.reduce((s, k) => s + k.pvp * k.unidades, 0) * maxTasa
  const zEcoMax = totalUnidades * maxCo2
  const zRegMax = totalUnidades * maxReg

  // ── Construcción del modelo para javascript-lp-solver ──
  // Variables: x_<skuIdx>_<canal> = unidades del SKU i al canal j
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

      // Coeficientes de cada componente para esta variable
      const ingresoUnit = sku.pvp * canal.tasaRecup * fa - canal.costeLog
      const co2Unit = canal.co2
      const regUnit = canal.rReg

      // Coeficiente en la función objetivo (ponderado y normalizado)
      const coefObjetivo =
        pesos.economico * (ingresoUnit / zEconMax) +
        pesos.ecologico * (co2Unit / zEcoMax) +
        pesos.regulatorio * (regUnit / zRegMax)

      const varName = `x_${i}_${j}`

      model.variables[varName] = {
        objetivo: coefObjetivo,
        [`asignacion_${i}`]: 1,        // para R1
        [`capacidad_${j}`]: 1,         // para R2
      }
      model.ints[varName] = 1          // R4: variable entera
    })

    // ── R1: asignación íntegra de cada SKU ──
    model.constraints[`asignacion_${i}`] = { equal: sku.unidades }
  })

  // ── R2: capacidad máxima de cada canal ──
  LISTA_CANALES.forEach((j) => {
    model.constraints[`capacidad_${j}`] = {
      max: CANALES[j].capacidad * totalUnidades,
    }
  })

  // ── R3: prendas con deterioro no pueden ir a Outlet ──
  // Se implementa fijando a 0 esas variables (límite superior 0)
  skus.forEach((sku, i) => {
    if (sku.estado === 'Deterioro') {
      const varName = `x_${i}_Outlet`
      // restricción individual: esa variable <= 0
      model.constraints[`r3_${i}`] = { max: 0 }
      model.variables[varName][`r3_${i}`] = 1
    }
  })

  // ── Resolver ──
  const resultado = solver.Solve(model)

  if (!resultado.feasible) {
    return { feasible: false }
  }

  // ── Extraer la asignación ──
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

  // ── Calcular las métricas de impacto ──
  const metricas = calcularImpacto(skus, asignacion)

  // ── Reparto agregado por canal ──
  const repartoPorCanal = {}
  LISTA_CANALES.forEach((j) => { repartoPorCanal[j] = 0 })
  asignacion.forEach((a) => { repartoPorCanal[a.canal] += a.unidades })

  return {
    feasible: true,
    asignacion,
    repartoPorCanal,
    totalUnidades,
    metricas,
  }
}

/*
 * Calcula el impacto económico, ecológico y regulatorio de una asignación,
 * y lo compara con el baseline (60% outlet + 40% destrucción).
 */
export function calcularImpacto(skus, asignacion) {
  const skuPorId = {}
  skus.forEach((k) => { skuPorId[k.id] = k })
  const totalUnidades = skus.reduce((s, k) => s + k.unidades, 0)

  // ── Impacto del MODELO ──
  let ingresoModelo = 0
  let co2Modelo = 0
  let unidadesCircuito = 0
  let unidadesJerarquiaAlta = 0
  const canalesJerarquiaAlta = ['Reutilizacion', 'Outlet', 'Exportacion', 'B2B']
  const canalesCircuito = ['Reutilizacion', 'Outlet', 'Exportacion', 'B2B', 'Donacion']

  asignacion.forEach((a) => {
    const sku = skuPorId[a.skuId]
    const canal = CANALES[a.canal]
    const fa = FACTOR_ANTIGUEDAD[a.canal][sku.antiguedad]
    ingresoModelo += a.unidades * (sku.pvp * canal.tasaRecup * fa - canal.costeLog)
    co2Modelo += a.unidades * canal.co2
    if (canalesCircuito.includes(a.canal)) unidadesCircuito += a.unidades
    if (canalesJerarquiaAlta.includes(a.canal)) unidadesJerarquiaAlta += a.unidades
  })

  // ── Impacto del BASELINE: 60% outlet + 40% destrucción ──
  let ingresoBaseline = 0
  let co2Baseline = 0
  skus.forEach((sku) => {
    const uOutlet = sku.unidades * 0.6
    const fa = FACTOR_ANTIGUEDAD.Outlet[sku.antiguedad]
    ingresoBaseline += uOutlet * (sku.pvp * CANALES.Outlet.tasaRecup * fa - CANALES.Outlet.costeLog)
    co2Baseline += uOutlet * CANALES.Outlet.co2
    // el 40% restante se destruye: ingreso 0, co2 0
  })

  const ahorro = ingresoModelo - ingresoBaseline
  const co2Extra = co2Modelo - co2Baseline

  return {
    ingresoModelo,
    ingresoBaseline,
    ahorro,
    mejoraPct: ingresoBaseline > 0 ? (ahorro / ingresoBaseline) * 100 : 0,
    co2Modelo,
    co2Baseline,
    co2Extra,
    unidadesCircuito,
    pctJerarquiaAlta: (unidadesJerarquiaAlta / totalUnidades) * 100,
  }
}
