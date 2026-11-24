import React, { useState, useEffect } from 'react'
import { sb, fmt, guardar, getArticulos } from '../lib/nucleo.js'
import { EditInline } from '../componentes.jsx'

// La confección es el único costo que se carga artículo por artículo: la tela
// y el avío tienen un precio por temporada, así que se corrigen una vez y
// alcanza para todos. Al empezar una temporada hay que recotizar las 206.
//
// Esta pantalla es la misma idea que la de Telas, pero sobre los artículos:
// ⏳ lo que falta, ✓ lo ya revisado, se tilda solo al editar, y el botón "OK"
// para cuando el precio no cambió y solo hay que darlo por visto.
export function ConfeccionPage({ temporada }) {
  const [articulos, setArticulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)

  useEffect(() => { cargar() }, [temporada.id])

  async function cargar() {
    setLoading(true)
    setArticulos(await getArticulos(temporada.id))
    setLoading(false)
  }

  async function guardarEdit(art, valor) {
    const v = valor === '' ? 0 : Number(valor)
    if (isNaN(v)) return
    if (!await guardar(
      sb.schema('costos').from('articulos').update({ confeccion: v, confeccion_actualizada: true }).eq('id', art.id),
      `la confección de ${art.codigo}`)) return
    setEditando(null); cargar()
  }

  async function marcarOk(art) {
    if (!await guardar(
      sb.schema('costos').from('articulos').update({ confeccion_actualizada: true }).eq('id', art.id),
      `la revisión de ${art.codigo}`)) return
    cargar()
  }

  // Marcar de a una las que no cambiaron es lento cuando son decenas iguales.
  // Esto tilda exactamente lo que se está viendo en pantalla, ni uno más.
  async function marcarTodoLoVisible() {
    const ids = filtrados.filter(a => a.confeccion_actualizada === false).map(a => a.id)
    if (!ids.length) return
    // De a 80: cada id son unos 40 caracteres en la URL y mandarlos todos
    // juntos puede pasarse del largo que acepta el servidor. Ya pasó una vez
    // con la consulta de composición y falla sin avisar bien por qué.
    for (let i = 0; i < ids.length; i += 80) {
      const tanda = ids.slice(i, i + 80)
      if (!await guardar(
        sb.schema('costos').from('articulos').update({ confeccion_actualizada: true }).in('id', tanda),
        `la revisión de ${tanda.length} artículos`)) { cargar(); return }
    }
    cargar()
  }

  const pendientes = articulos.filter(a => a.confeccion_actualizada === false)
  const t = busqueda.trim().toLowerCase()
  let filtrados = articulos.filter(a => !t
    || a.codigo.toLowerCase().includes(t)
    || (a.descripcion || '').toLowerCase().includes(t))
  if (soloPendientes) filtrados = filtrados.filter(a => a.confeccion_actualizada === false)

  const pendientesVisibles = filtrados.filter(a => a.confeccion_actualizada === false).length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">✂️ Precios de Confección</div>
          <div className="page-sub">{temporada.nombre} · {articulos.length} artículos</div>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div style={{ marginBottom: 14, padding: '12px 16px', background: '#fffbeb', border: '1.5px solid #fbbf24',
          borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
              ⚠️ {pendientes.length} de {articulos.length} pendientes de actualizar
            </div>
            <div style={{ fontSize: 12, color: '#a16207', marginTop: 2 }}>
              {articulos.length - pendientes.length} actualizado{articulos.length - pendientes.length !== 1 ? 's' : ''} ·
              {' '}La confección muestra el valor de la temporada anterior
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {soloPendientes && pendientesVisibles > 0 && !temporada.cerrada && (
              <button onClick={marcarTodoLoVisible} className="btn btn-sm btn-outline"
                style={{ borderColor: '#16a34a', color: '#16a34a' }}
                title="Da por revisados los que estás viendo, sin cambiarles el precio">
                ✓ Marcar los {pendientesVisibles} de la lista
              </button>
            )}
            <button onClick={() => setSoloPendientes(v => !v)} className="btn btn-sm btn-outline"
              style={{ borderColor: '#fbbf24', color: '#92400e' }}>
              {soloPendientes ? 'Ver todos' : 'Ver solo pendientes'}
            </button>
          </div>
        </div>
      )}

      <input className="form-input" placeholder="🔍 Buscar por código o descripción..." value={busqueda}
        onChange={e => setBusqueda(e.target.value)} style={{ marginBottom: 16 }} />

      {loading ? <div className="loading">⏳ Cargando...</div> : filtrados.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">✂️</div>
          <div className="empty-title">{busqueda || soloPendientes ? 'Sin resultados' : 'Sin artículos todavía'}</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtrados.map(a => {
            const pend = a.confeccion_actualizada === false
            return (
              <div key={a.id} className="precio-item" style={{ background: pend ? '#fffdf5' : undefined }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {pend
                      ? <span style={{ color: '#d97706', fontSize: 12 }}>⏳</span>
                      : <span style={{ color: '#16a34a', fontSize: 13 }}>✓</span>}
                    {a.codigo}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{a.descripcion || 'Sin descripción'}</div>
                </div>
                {editando?.id === a.id ? (
                  <EditInline valor={a.confeccion} onSave={v => guardarEdit(a, v)} onCancel={() => setEditando(null)} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <b style={{ fontSize: 15, color: pend ? 'var(--text2)' : undefined }}>{fmt(a.confeccion)}</b>
                    {pend && !temporada.cerrada && (
                      <button onClick={() => marcarOk(a)} title="Marcar como revisado sin cambiar el precio"
                        style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6,
                          padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ OK</button>
                    )}
                    {!temporada.cerrada && <button className="btn-icon" onClick={() => setEditando(a)}>✏️</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
