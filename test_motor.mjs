// Test: comparar motor JS con un caso conocido
import { optimizar } from './src/optimizer.js'

// 5 SKUs de prueba
const skus = [
  { id: 'C1', categoria: 'Camiseta', unidades: 200, pvp: 25, costeProduccion: 6, antiguedad: 0, estado: 'Nuevo' },
  { id: 'C2', categoria: 'Camiseta', unidades: 150, pvp: 28, costeProduccion: 7, antiguedad: 2, estado: 'Nuevo' },
  { id: 'A1', categoria: 'Abrigo',   unidades: 80,  pvp: 150, costeProduccion: 45, antiguedad: 0, estado: 'Nuevo' },
  { id: 'A2', categoria: 'Abrigo',   unidades: 40,  pvp: 180, costeProduccion: 50, antiguedad: 4, estado: 'Deterioro' },
  { id: 'V1', categoria: 'Vaquero',  unidades: 100, pvp: 60, costeProduccion: 18, antiguedad: 1, estado: 'Devolucion' },
]

const pesos = { economico: 0.5, ecologico: 0.25, regulatorio: 0.25 }
const r = optimizar(skus, pesos)

console.log('Factible:', r.feasible)
console.log('Total unidades:', r.totalUnidades)
console.log('\nReparto por canal:')
Object.entries(r.repartoPorCanal).forEach(([c, u]) => {
  if (u > 0) console.log(`  ${c}: ${u} (${(u/r.totalUnidades*100).toFixed(1)}%)`)
})
console.log('\nMétricas:')
console.log('  Ingreso modelo:', Math.round(r.metricas.ingresoModelo), 'EUR')
console.log('  Ingreso baseline:', Math.round(r.metricas.ingresoBaseline), 'EUR')
console.log('  Ahorro:', Math.round(r.metricas.ahorro), 'EUR')
console.log('  Mejora:', r.metricas.mejoraPct.toFixed(1), '%')
console.log('  CO2 evitado modelo:', Math.round(r.metricas.co2Modelo), 'kg')
console.log('  % jerarquia alta:', r.metricas.pctJerarquiaAlta.toFixed(1), '%')

// Verificar R3: el abrigo A2 (deterioro) NO debe estar en Outlet
const a2outlet = r.asignacion.find(a => a.skuId === 'A2' && a.canal === 'Outlet')
console.log('\nR3 (A2 deterioro no va a Outlet):', a2outlet ? 'FALLA' : 'OK')
