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

const ESTADO_DEFAULT_APP = {
  paso: 1,
  categoriasActivas: [],
  skus: [],
  practicaHabitual: { Outlet: 60, Destruccion: 40, B2B: 0, Donacion: 0 },
  pesos: { economico: 50, ecologico: 25, regulatorio: 25 },
  tolerancias: { canibalizacion: 'media', imagen: 'media' },
  resultado: null,
  feeAbierto: false,
  seccionesAbiertas: {},
}

let skuCounter = 1
function nuevoSku(categoria) {
  return {
    id: `${categoria.slice(0, 3).toUpperCase()}-${String(skuCounter++).padStart(2, '0')}`,
    categoria,
    unidades: 100,
    pvp: 40,
    antiguedad: 0,
    estado: 'Nuevo',
  }
}

export default function App() {
  const [paso, setPaso] = useState(1)
  const [categoriasActivas, setCategoriasActivas] = useState([])
  const [skus, setSkus] = useState([])
  const [practicaHabitual, setPracticaHabitual] = useState({
    Outlet: 60, B2B: 0, Exportacion: 0, Donacion: 0, Destruccion: 40,
  })
  const [pesos, setPesos] = useState({ economico: 50, ecologico: 25, regulatorio: 25 })
  const [tolerancias, setTolerancias] = useState({ canibalizacion: 'media', imagen: 'media' })
  const [resultado, setResultado] = useState(null)
  const [feeAbierto, setFeeAbierto] = useState(false)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({})

  const sumaPesos = pesos.economico + pesos.ecologico + pesos.regulatorio
  const sumaPractica = Object.values(practicaHabitual).reduce((s, v) => s + v, 0)

  function reiniciar() {
    setPaso(1)
    setCategoriasActivas([])
    setSkus([])
    setPracticaHabitual({ Outlet: 60, B2B: 0, Exportacion: 0, Donacion: 0, Destruccion: 40 })
    setPesos({ economico: 50, ecologico: 25, regulatorio: 25 })
    setTolerancias({ canibalizacion: 'media', imagen: 'media' })
    setResultado(null)
    setFeeAbierto(false)
    setSeccionesAbiertas({})
    skuCounter = 1
  }

  function toggleCategoria(cat) {
    if (categoriasActivas.includes(cat)) {
      setCategoriasActivas(categoriasActivas.filter((c) => c !== cat))
      setSkus(skus.filter((s) => s.categoria !== cat))
    } else {
      setCategoriasActivas([...categoriasActivas, cat])
      setSkus([...skus, nuevoSku(cat)])
    }
  }

  function addSku(cat) { setSkus([...skus, nuevoSku(cat)]) }
  function removeSku(id) { setSkus(skus.filter((s) => s.id !== id)) }
  function updateSku(id, campo, valor) {
    setSkus(skus.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)))
  }

  function aplicarPreset(nombre) { setPesos(PRESETS[nombre]) }

  const presetActivo = Object.keys(PRESETS).find(
    (n) => JSON.stringify(PRESETS[n]) === JSON.stringify(pesos),
  )

  function calcular() {
    const skusValidos = skus.filter((s) => s.unidades > 0)
    const pesosNorm = {
      economico: pesos.economico / 100,
      ecologico: pesos.ecologico / 100,
      regulatorio: pesos.regulatorio / 100,
    }
    // Convertir práctica habitual a fracciones
    const baseline = {}
    Object.entries(practicaHabitual).forEach(([c, p]) => {
      if (p > 0) baseline[c] = p / 100
    })
    const r = optimizar(skusValidos, pesosNorm, tolerancias, baseline)
    setResultado(r)
    setPaso(5)
  }

  const totalUnidades = useMemo(
    () => skus.reduce((s, k) => s + Number(k.unidades || 0), 0),
    [skus],
  )

  const puedeCalcular =
    skus.length > 0 &&
    totalUnidades > 0 &&
    sumaPesos === 100 &&
    sumaPractica === 100

  const PASOS = [
    { n: 1, t: 'Categorías' },
    { n: 2, t: 'Inventario' },
    { n: 3, t: 'Práctica habitual' },
    { n: 4, t: 'Perfil de marca' },
    { n: 5, t: 'Resultados' },
  ]

  return (
    <div className="app">
      <div className="header">
        <div className="logo-mark">↻</div>
        <div className="logo-text">StockLoop</div>
      </div>
      <p className="tagline">
        Optimizador de deadstock textil · motor de decisión multicriterio
      </p>

      <div className="stepper">
        {PASOS.map((s) => (
          <div
            key={s.n}
            className={`step-pill ${paso === s.n ? 'active' : ''} ${paso > s.n ? 'done' : ''}`}
          >
            <span className="step-num">{paso > s.n ? '✓' : s.n}</span>
            {s.t}
          </div>
        ))}
      </div>

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
              style={{ opacity: categoriasActivas.length === 0 ? 0.4 : 1 }}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="card fade-up">
          <div className="card-title">Tu inventario, referencia a referencia</div>
          <div className="card-sub">
            Para cada sección, añade tantas referencias (SKU) como necesites
            con sus datos. El motor decidirá a qué canal mandar cada una.
          </div>

          {categoriasActivas.map((cat) => {
            const skusCat = skus.filter((s) => s.categoria === cat)
            return (
              <div key={cat} className="section-block">
                <div className="section-head">
                  <span>{EMOJI[cat]} Sección {cat}</span>
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
                      <input type="number" min="0" value={sku.unidades}
                        onChange={(e) => updateSku(sku.id, 'unidades', Number(e.target.value))} />
                      <input type="number" min="0" value={sku.pvp}
                        onChange={(e) => updateSku(sku.id, 'pvp', Number(e.target.value))} />
                      <select value={sku.antiguedad}
                        onChange={(e) => updateSku(sku.id, 'antiguedad', Number(e.target.value))}>
                        <option value={0}>0 temp.</option>
                        <option value={1}>1 temp.</option>
                        <option value={2}>2 temp.</option>
                        <option value={3}>3 temp.</option>
                        <option value={4}>4+ temp.</option>
                      </select>
                      <select value={sku.estado}
                        onChange={(e) => updateSku(sku.id, 'estado', e.target.value)}>
                        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <button className="btn-icon" onClick={() => removeSku(sku.id)} title="Eliminar">
                        ✕
                      </button>
                    </div>
                  ))}
                  <button className="btn-add-sku" onClick={() => addSku(cat)}>
                    + Añadir referencia a {cat}
                  </button>
                </div>
              </div>
            )
          })}

          <div className="nav-row">
            <button className="btn-secondary" onClick={() => setPaso(1)}>← Volver</button>
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

      {paso === 3 && (
        <div className="card fade-up">
          <div className="card-title">¿Cómo gestionas tu deadstock actualmente?</div>
          <div className="card-sub">
            Reparte tu práctica habitual entre estos destinos. El motor lo
            usará como referencia para calcular el ahorro que generaría
            optimizar la decisión.
          </div>

          {[
            { k: 'Outlet',      label: 'Outlet propio' },
            { k: 'B2B',         label: 'B2B saldos / mayoristas' },
            { k: 'Exportacion', label: 'Exportación no-UE' },
            { k: 'Donacion',    label: 'Donación' },
            { k: 'Destruccion', label: 'Destrucción / vertedero' },
          ].map((c) => (
            <div key={c.k} className="bh-row">
              <span className="bh-label">{c.label}</span>
              <input
                type="number"
                min="0"
                max="100"
                value={practicaHabitual[c.k] || 0}
                onChange={(e) => setPracticaHabitual({
                  ...practicaHabitual, [c.k]: Number(e.target.value)
                })}
              />
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={practicaHabitual[c.k] || 0}
                onChange={(e) => setPracticaHabitual({
                  ...practicaHabitual, [c.k]: Number(e.target.value)
                })}
                style={{
                  background: `linear-gradient(90deg, var(--text-faint) ${practicaHabitual[c.k] || 0}%, var(--bg-input) ${practicaHabitual[c.k] || 0}%)`,
                }}
              />
            </div>
          ))}

          <div className={`bh-sum ${sumaPractica === 100 ? 'ok' : 'bad'}`}>
            {sumaPractica === 100
              ? '✓ Los porcentajes suman 100%'
              : `Los porcentajes suman ${sumaPractica}% — deben sumar 100%`}
          </div>

          <div className="nav-row">
            <button className="btn-secondary" onClick={() => setPaso(2)}>← Volver</button>
            <button
              className="btn-secondary"
              disabled={sumaPractica !== 100}
              onClick={() => setPaso(4)}
              style={{ opacity: sumaPractica !== 100 ? 0.4 : 1 }}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {paso === 4 && (
        <div className="card fade-up">
          <div className="card-title">El perfil estratégico de tu marca</div>
          <div className="card-sub">
            Define cuánto pesa cada criterio en la decisión y tu tolerancia
            al riesgo. Los tres pesos deben sumar 100%.
          </div>

          <div className="preset-row">
            {Object.keys(PRESETS).map((nombre) => (
              <button
                key={nombre}
                className={`preset-btn ${presetActivo === nombre ? 'active' : ''}`}
                onClick={() => aplicarPreset(nombre)}
              >
                {nombre}
              </button>
            ))}
          </div>

          {[
            { key: 'economico',   label: 'Económico',   desc: 'recuperar valor' },
            { key: 'ecologico',   label: 'Ecológico',   desc: 'evitar emisiones' },
            { key: 'regulatorio', label: 'Regulatorio', desc: 'jerarquía de residuos' },
          ].map((p) => (
            <div key={p.key} className="slider-block">
              <div className="slider-label">
                <span>
                  {p.label}{' '}
                  <span style={{ color: 'var(--text-faint)' }}>— {p.desc}</span>
                </span>
                <span className="slider-value">{pesos[p.key]}%</span>
              </div>
              <input
                type="range"
                min="0" max="100" step="5"
                value={pesos[p.key]}
                onChange={(e) => setPesos({ ...pesos, [p.key]: Number(e.target.value) })}
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

          <div style={{ marginTop: 28, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
            Tolerancia al riesgo
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
            Cuanta menor sea tu tolerancia, más penaliza el modelo los canales
            con ese tipo de riesgo asociado.
          </div>

          <div className="tol-grid">
            <div className="tol-block">
              <div className="tol-block-title">Canibalización</div>
              <div className="tol-block-desc">
                Riesgo de que el outlet/B2B reste ventas a precio completo.
              </div>
              <div className="tol-options">
                {['baja', 'media', 'alta'].map((n) => (
                  <button
                    key={n}
                    className={`tol-opt ${tolerancias.canibalizacion === n ? 'active' : ''}`}
                    onClick={() => setTolerancias({ ...tolerancias, canibalizacion: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="tol-block">
              <div className="tol-block-title">Imagen de marca</div>
              <div className="tol-block-desc">
                Riesgo de que la marca aparezca en lugares no deseados (ej. mercados no-UE).
              </div>
              <div className="tol-options">
                {['baja', 'media', 'alta'].map((n) => (
                  <button
                    key={n}
                    className={`tol-opt ${tolerancias.imagen === n ? 'active' : ''}`}
                    onClick={() => setTolerancias({ ...tolerancias, imagen: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="nav-row" style={{ marginTop: 24 }}>
            <button className="btn-secondary" onClick={() => setPaso(3)}>← Volver</button>
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

      {paso === 5 && resultado && (
        <Dashboard
          resultado={resultado}
          skus={skus}
          feeAbierto={feeAbierto}
          setFeeAbierto={setFeeAbierto}
          seccionesAbiertas={seccionesAbiertas}
          setSeccionesAbiertas={setSeccionesAbiertas}
          onVolver={() => setPaso(4)}
          onReiniciar={reiniciar}
        />
      )}
    </div>
  )
}

function Dashboard({ resultado, skus, feeAbierto, setFeeAbierto, seccionesAbiertas, setSeccionesAbiertas, onVolver, onReiniciar }) {
  if (!resultado.feasible) {
    return (
      <div className="card fade-up">
        <div className="card-title">No se ha encontrado solución</div>
        <div className="card-sub">Revisa los datos del inventario.</div>
        <button className="btn-secondary" onClick={onVolver}>← Volver</button>
      </div>
    )
  }

  const { repartoPorCanal, totalUnidades, metricas, asignacion } = resultado

  const dataDonut = Object.entries(repartoPorCanal)
    .filter(([, u]) => u > 0)
    .map(([canal, u]) => ({
      name: CANALES[canal].nombre,
      canal,
      value: u,
      color: CANALES[canal].color,
    }))

  const fmtEur = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
  const performanceFee = metricas.ahorro * 0.2

  const maxIngreso = Math.max(metricas.ingresoModelo, metricas.ingresoBaseline)

  // Agrupar asignación por categoría
  const categoriasUsadas = [...new Set(skus.map((s) => s.categoria))]
  const asigPorCategoria = {}
  categoriasUsadas.forEach((cat) => {
    asigPorCategoria[cat] = {}
    const skusCat = skus.filter((s) => s.categoria === cat)
    skusCat.forEach((sku) => {
      asigPorCategoria[cat][sku.id] = asignacion.filter((a) => a.skuId === sku.id)
    })
  })

  return (
    <div className="fade-up">
      <div className="kpi-grid">
        <div className="kpi eco">
          <div className="kpi-label">Ahorro económico</div>
          <div className="kpi-value">
            {fmtEur(metricas.ahorro)}<span className="kpi-unit"> €</span>
          </div>
          <div className="kpi-sub">
            <strong>+{metricas.mejoraPct.toFixed(0)}%</strong> sobre tu práctica habitual
          </div>
        </div>
        <div className="kpi co2">
          <div className="kpi-label">CO₂ evitado adicional</div>
          <div className="kpi-value">
            {(metricas.co2Extra / 1000).toFixed(1)}<span className="kpi-unit"> t</span>
          </div>
          <div className="kpi-sub">frente a tu gestión actual</div>
        </div>
        <div className="kpi reg">
          <div className="kpi-label">Alto valor circular</div>
          <div className="kpi-value">
            {metricas.pctAltoValor.toFixed(0)}<span className="kpi-unit"> %</span>
          </div>
          <div className="kpi-sub">en canales prioritarios de la jerarquía UE</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ fontSize: 17 }}>Reparto óptimo global</div>
          <div className="card-sub" style={{ marginBottom: 8 }}>
            {totalUnidades.toLocaleString()} unidades asignadas
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataDonut} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={52} outerRadius={84}
                  paddingAngle={2} stroke="none">
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
                <span className="legend-dot" style={{ background: d.color }} />
                {d.name}
                <span className="legend-val">{((d.value / totalUnidades) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ fontSize: 17 }}>
            Modelo vs. tu práctica habitual
          </div>
          <div className="card-sub" style={{ marginBottom: 16 }}>
            Valor económico que recuperas con cada enfoque
          </div>

          <div className="compare-row">
            <div className="compare-label">
              <span>Práctica habitual</span>
              <span>{fmtEur(metricas.ingresoBaseline)} €</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill"
                style={{
                  width: `${(metricas.ingresoBaseline / maxIngreso) * 100}%`,
                  background: 'var(--text-faint)',
                }} />
            </div>
          </div>

          <div className="compare-row">
            <div className="compare-label">
              <span>Modelo optimizado</span>
              <span>{fmtEur(metricas.ingresoModelo)} €</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill"
                style={{
                  width: `${(metricas.ingresoModelo / maxIngreso) * 100}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--blue))',
                }}>
                +{fmtEur(metricas.ahorro)} €
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 20, padding: 16, borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-input)', fontSize: 14, lineHeight: 1.6,
            color: 'var(--text-dim)',
          }}>
            Aplicar el modelo permite recuperar{' '}
            <strong style={{ color: 'var(--accent)' }}>{fmtEur(metricas.ahorro)} €</strong>{' '}
            adicionales y evitar{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {(metricas.co2Extra / 1000).toFixed(1)} toneladas
            </strong>{' '}
            de CO₂.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, marginBottom: 12, fontFamily: 'Fraunces, serif', fontSize: 19, fontWeight: 600 }}>
        Detalle por sección
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 14 }}>
        Pulsa una sección para ver a qué canal va cada referencia.
      </div>

      {categoriasUsadas.map((cat) => {
        const abierto = !!seccionesAbiertas[cat]
        const skusCat = skus.filter((s) => s.categoria === cat)
        const unidadesCat = skusCat.reduce((s, k) => s + k.unidades, 0)
        return (
          <div key={cat} className="section-card">
            <div className="section-card-head"
              onClick={() => setSeccionesAbiertas({ ...seccionesAbiertas, [cat]: !abierto })}>
              <span style={{ fontSize: 22 }}>{EMOJI[cat]}</span>
              <span className="section-card-title">{cat}</span>
              <span className="section-card-meta">
                {skusCat.length} ref. · {unidadesCat.toLocaleString()} uds.
              </span>
              <span style={{ color: 'var(--text-faint)' }}>{abierto ? '▲' : '▼'}</span>
            </div>
            {abierto && (
              <div className="section-card-body">
                {skusCat.map((sku) => {
                  const flujos = asigPorCategoria[cat][sku.id] || []
                  return (
                    <div key={sku.id} className="sku-asignacion">
                      <span className="sku-asig-tag">{sku.id}</span>
                      <div className="sku-asig-flow">
                        {flujos.length === 0
                          ? <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>Sin asignación</span>
                          : flujos.map((f, idx) => (
                            <span key={idx} className="flow-chip"
                              style={{ background: CANALES[f.canal].color }}>
                              {CANALES[f.canal].nombre}
                              <span className="flow-chip-units">{f.unidades.toLocaleString()}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ marginTop: 24 }}>
        <div className="fee-toggle" onClick={() => setFeeAbierto(!feeAbierto)}>
          <span>💼 Ver coste del servicio (performance fee)</span>
          <span>{feeAbierto ? '▲' : '▼'}</span>
        </div>
        {feeAbierto && (
          <div className="fee-body fade-up">
            El servicio se remunera mediante un <strong>performance fee del 20%</strong>{' '}
            sobre el ahorro económico acreditado. Para este inventario:
            <div style={{ marginTop: 12 }}>
              Coste del servicio:{' '}
              <span className="fee-amount">{fmtEur(performanceFee)} €</span>
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

      <div className="nav-row" style={{ marginTop: 24 }}>
        <button className="btn-secondary" onClick={onVolver}>← Ajustar perfil</button>
        <button className="btn-primary" style={{ width: 'auto', padding: '12px 28px' }} onClick={onReiniciar}>
          ↻ Empezar de nuevo
        </button>
      </div>
    </div>
  )
}
