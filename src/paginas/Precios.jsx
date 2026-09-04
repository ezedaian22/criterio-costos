import React, { useState, useEffect } from 'react'
import { sb, fmt, guardar, getPrecios } from '../lib/nucleo.js'
import { EditInline, ModalNuevoPrecio } from '../componentes.jsx'

export function PreciosPage({tipo,titulo,icono,temporada}){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[editando,setEditando]=useState(null)
  const[modalNuevo,setModalNuevo]=useState(false)
  const[busqueda,setBusqueda]=useState('')
  const[soloPendientes,setSoloPendientes]=useState(false)
  useEffect(()=>{cargar()},[temporada.id,tipo])
  async function cargar(){setLoading(true);const d=await getPrecios(tipo,temporada.id);setItems(d.sort((a,b)=>a.nombre.localeCompare(b.nombre)));setLoading(false)}
  async function guardarEdit(item,precio){
    if(!await guardar(sb.schema('costos').from(tipo).update({precio:Number(precio),actualizado:true}).eq('id',item.id),`el precio de ${item.nombre}`))return
    setEditando(null);cargar()
  }
  async function marcarOk(item){
    if(!await guardar(sb.schema('costos').from(tipo).update({actualizado:true}).eq('id',item.id),`la revisión de ${item.nombre}`))return
    cargar()
  }
  async function del(id){if(!confirm('¿Eliminar?'))return;if(await guardar(sb.schema('costos').from(tipo).delete().eq('id',id),'el borrado'))cargar()}

  const pendientes=items.filter(i=>i.actualizado===false)
  let filtrados=items.filter(i=>!busqueda||i.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  if(soloPendientes)filtrados=filtrados.filter(i=>i.actualizado===false)

  return(
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">{icono} {titulo}</div><div className="page-sub">{temporada.nombre} · {items.length} ítems</div></div>
        <button className="btn btn-primary" onClick={()=>setModalNuevo(true)} disabled={temporada.cerrada}>+ Agregar</button>
      </div>

      {pendientes.length>0&&(
        <div style={{marginBottom:14,padding:'12px 16px',background:'#fffbeb',border:'1.5px solid #fbbf24',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:'#92400e'}}>⚠️ {pendientes.length} de {items.length} pendientes de actualizar</div>
            <div style={{fontSize:12,color:'#a16207',marginTop:2}}>
              {items.length-pendientes.length} actualizado{items.length-pendientes.length!==1?'s':''} · Los precios muestran el valor de la temporada anterior
            </div>
          </div>
          <button onClick={()=>setSoloPendientes(v=>!v)} className="btn btn-sm btn-outline" style={{borderColor:'#fbbf24',color:'#92400e'}}>
            {soloPendientes?'Ver todos':'Ver solo pendientes'}
          </button>
        </div>
      )}

      <input className="form-input" placeholder="🔍 Buscar por nombre..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{marginBottom:16}}/>
      {loading?<div className="loading">⏳ Cargando...</div>:filtrados.length===0?(
        <div className="empty"><div className="empty-icon">{icono}</div><div className="empty-title">{busqueda||soloPendientes?'Sin resultados':'Sin ítems todavía'}</div></div>
      ):(
        <div className="card" style={{overflow:'hidden'}}>
          {filtrados.map(item=>{
            const pend=item.actualizado===false
            const ant=item.precio_anterior
            const varia=ant&&ant>0?((item.precio-ant)/ant*100):null
            return(
            <div key={item.id} className="precio-item" style={{background:pend?'#fffdf5':undefined}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:6}}>
                  {pend?<span style={{color:'#d97706',fontSize:12}}>⏳</span>:<span style={{color:'#16a34a',fontSize:13}}>✓</span>}
                  {item.nombre}
                </div>
                {item.unidad&&<div style={{fontSize:11,color:'var(--text3)'}}>por {item.unidad}</div>}
                {ant!=null&&ant!==item.precio&&(
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
                    antes: {fmt(ant)}
                    {varia!==null&&<span style={{marginLeft:6,fontWeight:700,color:varia>0?'#dc2626':'#16a34a'}}>
                      {varia>0?'+':''}{varia.toFixed(0)}%
                    </span>}
                  </div>
                )}
              </div>
              {editando?.id===item.id?(
                <EditInline valor={item.precio} onSave={v=>guardarEdit(item,v)} onCancel={()=>setEditando(null)}/>
              ):(
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <b style={{fontSize:15,color:pend?'var(--text2)':undefined}}>{fmt(item.precio)}</b>
                  {pend&&<button onClick={()=>marcarOk(item)} title="Marcar como revisado sin cambiar el precio"
                    style={{background:'#dcfce7',color:'#16a34a',border:'none',borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:700,cursor:'pointer'}}>✓ OK</button>}
                  {!temporada.cerrada&&<button className="btn-icon" onClick={()=>setEditando(item)}>✏️</button>}
                  {!temporada.cerrada&&<button className="btn-icon" onClick={()=>del(item.id)}>🗑</button>}
                </div>
              )}
            </div>
          )})}
        </div>
      )}
      {modalNuevo&&<ModalNuevoPrecio tipo={tipo} titulo={titulo} tempId={temporada.id} onClose={()=>setModalNuevo(false)} onSave={()=>{setModalNuevo(false);cargar()}}/>}
    </div>
  )
}
