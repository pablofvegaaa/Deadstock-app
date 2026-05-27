import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import {
  optimizar, CANALES, CATEGORIAS, ESTADOS,
} from './optimizer.js'

const EMOJI = {
  Camiseta: '👕', Vaquero: '👖', Vestido: '👗',
  Abrigo: '🧥', Calzado: '👟', Accesorio: '🧣',
}

const PRESETS = {
  Equilibrado: { economico: 50, ecologico: 25, regulatorio: 25 },
  Premium:     { economico: 25, ecologico: 35, regulatorio: 40 },
  Presionada:  { economico: 80, ecologico: 10, regulatorio: 10 },
  Regulada:    { economico: 20, ecologico: 20, regulatorio: 60 },
}

let skuCounter = 1
function nuevoSku(categoria) {
  return {
    id: `${categoria.slice(0, 3).toUpperCase()}-${String(skuCounter++).padStart(2, '0')}`,
    categoria,
    unidades: 100,
    pvp: 40,
    costeProduccion: 10,
    antiguedad: 0,
    estado: 'Nuevo',
  }
}

export default function App() {
  const [paso, setPaso] = useState(1)
  const [categoriasActivas, setCategoriasActivas] = useState([])
  const [skus, setSkus] = useState([])
  const [pesos, setPesos] = useState({ economico: 50, ecologico: 25, regulatorio: 25 })
  const [resultado, setResultado] = useState(null)
  const [feeAbierto, setFeeAbierto] = useState(false)

  const sumaPesos = pesos.economico + pesos.ecologico + pesos.regulatorio

  // ─── Gestión de categorías ───
  function toggleCategoria(cat) {
    if (categoriasActivas.includes(cat)) {
      setCategoriasActivas(categoriasActivas.filter((c) => c !== cat))
      setSkus(skus.filter((s) => s.categoria !== cat))
    } else {
      setCategoriasActivas([...categoriasActivas, cat])
      setSkus([...skus, nuevoSku(cat)])
    }
  }

  function addSku(cat) {
    setSkus([...skus, nuevoSku(cat)])
  }

  function removeSku(id) {
    setSkus(skus.filter((s) => s.id !== id))
  }

  function updateSku(id, campo, valor) {
    setSkus(skus.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)))
  }

  // ─── Pesos ───
  function aplicarPreset(nombre) {
    setPesos(PRESETS[nombre])
  }

  const presetActivo = Object.keys(PRESETS).find(
    (n) => JSON.stringify(PRESETS[n]) === JSON.stringify(pesos),
  )

  // ─── Cálculo ───
  function calcular() {
    const skusValidos = skus.filter((s) => s.unidades > 0)
    const pesosNorm = {
      economico: pesos.economico / 100,
      ecologico: pesos.ecologico / 100,
      regulatorio: pesos.regulatorio / 100,
    }
    const r = optimizar(skusValidos, pesosNorm)
    setResultado(r)
    setPaso(4)
  }

  const totalUnidades = useMemo(
    () => skus.reduce((s, k) => s + Number(k.unidades || 0), 0),
    [skus],
  )

  const puedeCalcular =
    skus.length > 0 && totalUnidades > 0 && sumaPesos === 100

  return (
    <div className="app">
      {/* HEADER */}
      <div className="header">
        <div className="logo-mark">♻</div>
        <div className="logo-text">ReWear Routing</div>
      </div>
      <p className="tagline">
        Optimizador de deadstock textil · motor de decisión multicriterio
      </p>

      {/* STEPPER */}
      <div className="stepper">
        {[
          { n: 1, t: 'Categorías' },
          { n: 2, t: 'Inventario' },
          { n: 3, t: 'Perfil de marca' },
          { n: 4, t: 'Resultados' },
        ].map((s) => (
          <div
            key={s.n}
            className={`step-pill ${paso === s.n ? 'active' : ''} ${
              paso > s.n ? 'done' : ''
            }`}
          >
            <span className="step-num">{paso > s.n ? '✓' : s.n}</span>
            {s.t}
          </div>
        ))}
      </div>

      {/* PASO 1 — CATEGORÍAS */}
      {paso === 1 && (
        <div className="card fade-up">
          <div className="card-title">¿Qué tipo de producto tienes en deadstock?</div>
          <div className="card-sub">
            Selecciona las secciones con las que vas a trabajar. Después
            añadirás las referencias concretas de cada una.
          </div>
          <div className="cat-grid">
            {CATEGORIAS.map((cat) => {
              const activa = categoriasActivas.includes(cat)
              const n = skus.filter((s) => s.categoria === cat).length
              return (
                <button
                  key={cat}
                  className={`cat-toggle ${activa ? 'on' : ''}`}
                  onClick={() => toggleCategoria(cat)}
                >
                  <span className="cat-emoji">{EMOJI[cat]}</span>
                  {cat}
                  {activa && <span className="cat-count">{n} ref.</span>}
                </button>
              )
            })}
          </div>
          <div className="nav-row">
            <span />
            <button
              className="btn-secondary"
              disabled={categoriasActivas.length === 0}
              onClick={() => setPaso(2)}
              style={{
                opacity: categoriasActivas.length === 0 ? 0.4 : 1,
              }}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* PASO 2 — INVENTARIO POR SKU */}
      {paso === 2 && (
        <div className="card fade-up">
          <div className="card-title">Tu inventario, referencia a referencia</div>
          <div className="card-sub">
            Para cada sección, añade tantas referencias (SKU) como
            necesites con sus datos.
          </div>

          {categoriasActivas.map((cat) => {
            const skusCat = skus.filter((s) => s.categoria === cat)
            return (
              <div key={cat} className="section-block">
                <div className="section-head">
                  <span>
                    {EMOJI[cat]} Sección {cat}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    {skusCat.length} referencia(s)
                  </span>
                </div>
                <div className="section-body">
                  <div className="sku-row head">
                    <span>SKU</span>
                    <span>Unidades</span>
                    <span>PVP (€)</span>
                    <span>Antigüedad</span>
                    <span>Estado</span>
                    <span />
                  </div>
                  {skusCat.map((sku) => (
                    <div key={sku.id} className="sku-row">
                      <span className="sku-tag">{sku.id}</span>
                      <input
                        type="number"
                        min="0"
                        value={sku.unidades}
                        onChange={(e) =>
                          updateSku(sku.id, 'unidades', Number(e.target.value))
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        value={sku.pvp}
                        onChange={(e) =>
                          updateSku(sku.id, 'pvp', Number(e.target.value))
                        }
                      />
                      <select
                        value={sku.antiguedad}
                        onChange={(e) =>
                          updateSku(sku.id, 'antiguedad', Number(e.target.value))
                        }
                      >
                        <option value={0}>0 temp.</option>
                        <option value={1}>1 temp.</option>
                        <option value={2}>2 temp.</option>
                        <option value={3}>3 temp.</option>
                        <option value={4}>4+ temp.</option>
                      </select>
                      <select
                        value={sku.estado}
                        onChange={(e) =>
                          updateSku(sku.id, 'estado', e.target.value)
                        }
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn-icon"
                        onClick={() => removeSku(sku.id)}
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn-add-sku"
                    onClick={() => addSku(cat)}
                  >
                    + Añadir referencia a {cat}
                  </button>
                </div>
              </div>
            )
          })}

          <div className="nav-row">
            <button className="btn-secondary" onClick={() => setPaso(1)}>
              ← Volver
            </button>
            <button
              className="btn-secondary"
              disabled={totalUnidades === 0}
              onClick={() => setPaso(3)}
              style={{ opacity: totalUnidades === 0 ? 0.4 : 1 }}
            >
              Continuar → ({totalUnidades.toLocaleString()} uds.)
            </button>
          </div>
        </div>
      )}

      {/* PASO 3 — PERFIL DE MARCA */}
      {paso === 3 && (
        <div className="card fade-up">
          <div className="card-title">El perfil estratégico de tu marca</div>
          <div className="card-sub">
            Ajusta cuánto pesa cada criterio en la decisión. Los tres
            valores deben sumar 100%.
          </div>

          <div className="preset-row">
            {Object.keys(PRESETS).map((nombre) => (
              <button
                key={nombre}
                className={`preset-btn ${
                  presetActivo === nombre ? 'active' : ''
                }`}
                onClick={() => aplicarPreset(nombre)}
              >
                {nombre}
              </button>
            ))}
          </div>

          {[
            { key: 'economico', label: 'Económico', desc: 'recuperar valor' },
            { key: 'ecologico', label: 'Ecológico', desc: 'evitar emisiones' },
            { key: 'regulatorio', label: 'Regulatorio', desc: 'jerarquía de residuos' },
          ].map((p) => (
            <div key={p.key} className="slider-block">
              <div className="slider-label">
                <span>
                  {p.label}{' '}
                  <span style={{ color: 'var(--text-faint)' }}>
                    — {p.desc}
                  </span>
                </span>
                <span className="slider-value">{pesos[p.key]}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={pesos[p.key]}
                onChange={(e) =>
                  setPesos({ ...pesos, [p.key]: Number(e.target.value) })
                }
                style={{
                  background: `linear-gradient(90deg, var(--accent) ${pesos[p.key]}%, var(--bg-input) ${pesos[p.key]}%)`,
                }}
              />
            </div>
          ))}

          <div className={`weight-sum ${sumaPesos === 100 ? 'ok' : 'bad'}`}>
            {sumaPesos === 100
              ? '✓ Los pesos suman 100%'
              : `Los pesos suman ${sumaPesos}% — ajusta hasta llegar a 100%`}
          </div>

          <div className="nav-row">
            <button className="btn-secondary" onClick={() => setPaso(2)}>
              ← Volver
            </button>
            <button
              className="btn-primary"
              style={{ width: 'auto', padding: '12px 28px' }}
              disabled={!puedeCalcular}
              onClick={calcular}
            >
              Optimizar mi deadstock
            </button>
          </div>
        </div>
      )}

      {/* PASO 4 — DASHBOARD */}
      {paso === 4 && resultado && (
        <Dashboard
          resultado={resultado}
          feeAbierto={feeAbierto}
          setFeeAbierto={setFeeAbierto}
          onVolver={() => setPaso(3)}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────── */
/* DASHBOARD DE RESULTADOS                                   */
/* ─────────────────────────────────────────────────────── */
function Dashboard({ resultado, feeAbierto, setFeeAbierto, onVolver }) {
  if (!resultado.feasible) {
    return (
      <div className="card fade-up">
        <div className="card-title">No se ha encontrado solución</div>
        <div className="card-sub">
          Revisa los datos del inventario e inténtalo de nuevo.
        </div>
        <button className="btn-secondary" onClick={onVolver}>
          ← Volver
        </button>
      </div>
    )
  }

  const { repartoPorCanal, totalUnidades, metricas } = resultado

  // Datos para el donut
  const dataDonut = Object.entries(repartoPorCanal)
    .filter(([, u]) => u > 0)
    .map(([canal, u]) => ({
      name: CANALES[canal].nombre,
      canal,
      value: u,
      color: CANALES[canal].color,
    }))

  const fmtEur = (n) =>
    n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
  const performanceFee = metricas.ahorro * 0.2

  // Para la barra comparativa
  const maxIngreso = Math.max(metricas.ingresoModelo, metricas.ingresoBaseline)

  return (
    <div className="fade-up">
      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi eco">
          <div className="kpi-label">Ahorro económico</div>
          <div className="kpi-value">
            {fmtEur(metricas.ahorro)}
            <span className="kpi-unit"> €</span>
          </div>
          <div className="kpi-sub">
            <strong>+{metricas.mejoraPct.toFixed(0)}%</strong> sobre la
            práctica habitual
          </div>
        </div>
        <div className="kpi co2">
          <div className="kpi-label">CO₂ evitado</div>
          <div className="kpi-value">
            {(metricas.co2Extra / 1000).toFixed(1)}
            <span className="kpi-unit"> t</span>
          </div>
          <div className="kpi-sub">
            frente a destruir el 40% del stock
          </div>
        </div>
        <div className="kpi reg">
          <div className="kpi-label">Jerarquía alta</div>
          <div className="kpi-value">
            {metricas.pctJerarquiaAlta.toFixed(0)}
            <span className="kpi-unit"> %</span>
          </div>
          <div className="kpi-sub">
            del inventario en canales prioritarios
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Donut de reparto */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ fontSize: 17 }}>
            Reparto óptimo por canal
          </div>
          <div className="card-sub" style={{ marginBottom: 8 }}>
            {totalUnidades.toLocaleString()} unidades asignadas
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataDonut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={2}
                  stroke="none"
                >
                  {dataDonut.map((d) => (
                    <Cell key={d.canal} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            {dataDonut.map((d) => (
              <div key={d.canal} className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: d.color }}
                />
                {d.name}
                <span className="legend-val">
                  {((d.value / totalUnidades) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparativa */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ fontSize: 17 }}>
            Modelo vs. práctica habitual
          </div>
          <div className="card-sub" style={{ marginBottom: 16 }}>
            Práctica habitual: 60% outlet + 40% destrucción
          </div>

          <div className="compare-row">
            <div className="compare-label">
              <span>Valor recuperado — práctica habitual</span>
              <span>{fmtEur(metricas.ingresoBaseline)} €</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(metricas.ingresoBaseline / maxIngreso) * 100}%`,
                  background: 'var(--text-faint)',
                }}
              />
            </div>
          </div>

          <div className="compare-row">
            <div className="compare-label">
              <span>Valor recuperado — modelo optimizado</span>
              <span>{fmtEur(metricas.ingresoModelo)} €</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(metricas.ingresoModelo / maxIngreso) * 100}%`,
                  background:
                    'linear-gradient(90deg, var(--accent), var(--blue))',
                }}
              >
                +{fmtEur(metricas.ahorro)} €
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-input)',
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text-dim)',
            }}
          >
            Aplicar el modelo permite recuperar{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {fmtEur(metricas.ahorro)} €
            </strong>{' '}
            adicionales y evitar{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {(metricas.co2Extra / 1000).toFixed(1)} toneladas
            </strong>{' '}
            de CO₂ frente a la gestión habitual del deadstock.
          </div>
        </div>
      </div>

      {/* Performance fee desplegable */}
      <div style={{ marginTop: 20 }}>
        <div
          className="fee-toggle"
          onClick={() => setFeeAbierto(!feeAbierto)}
        >
          <span>💼 Ver coste del servicio (performance fee)</span>
          <span>{feeAbierto ? '▲' : '▼'}</span>
        </div>
        {feeAbierto && (
          <div className="fee-body fade-up">
            El servicio se remunera mediante un{' '}
            <strong>performance fee del 20%</strong> sobre el ahorro
            económico acreditado. Para este inventario:
            <div style={{ marginTop: 12 }}>
              Coste del servicio:{' '}
              <span className="fee-amount">
                {fmtEur(performanceFee)} €
              </span>
            </div>
            <div style={{ marginTop: 6 }}>
              Beneficio neto para la marca:{' '}
              <strong style={{ color: 'var(--accent)' }}>
                {fmtEur(metricas.ahorro - performanceFee)} €
              </strong>
            </div>
          </div>
        )}
      </div>

      <div className="nav-row" style={{ marginTop: 20 }}>
        <button className="btn-secondary" onClick={onVolver}>
          ← Ajustar perfil
        </button>
      </div>
    </div>
  )
}
