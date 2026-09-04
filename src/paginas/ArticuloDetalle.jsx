import React, { useState, useEffect } from 'react'
import { sb, fmt, guardar, getArticuloDetalle, calcPrecios } from '../lib/nucleo.js'
import { FotoUp, ModalAdd, EditInline, TelaEditInline, AvioEditInline } from '../componentes.jsx'
import { SimuladorModal } from './Simulador.jsx'

export function ArticuloDetalle({art,temporada,config,onBack}){
  const[det,setDet]=useState({telas:[],avios:[],percha:[]})
  const[conf,setConf]=useState(art.confeccion||0)
  const[codigo,setCodigo]=useState(art.codigo)
  const[descripcion,setDescripcion]=useState(art.descripcion||'')
  const[notas_taller,setNotasTaller]=useState(art.notas_taller||'')
  const[precios,setPrecios]=useState(art.precios||{})
  const[loading,setLoading]=useState(true)
  const[editConf,setEditConf]=useState(false)
  const[confInput,setConfInput]=useState(String(art.confeccion||0))
  const[editCodigo,setEditCodigo]=useState(false)
  const[codigoInput,setCodigoInput]=useState(art.codigo)
  const[editDesc,setEditDesc]=useState(false)
  const[descInput,setDescInput]=useState(art.descripcion||'')
  const[editTaller,setEditTaller]=useState(false)
  const[tallerInput,setTallerInput]=useState(art.notas_taller||'')
  const[mTela,setMTela]=useState(false)
  const[mAvio,setMAvio]=useState(false)
  const[mPercha,setMPercha]=useState(false)
  const[editandoCantidad,setEditandoCantidad]=useState(null)
  const[telasList,setTelasList]=useState([])
  const[aviosList,setAviosList]=useState([])
  const[otrasTemps,setOtrasTemps]=useState([]) // {id,nombre,tieneArticulo}
  const[compartiendo,setCompartiendo]=useState(false)

  useEffect(()=>{cargar();verificarOtrasTemps()},[art.id])
  useEffect(()=>{setPrecios(calcPrecios(det,conf,config))},[det,conf,config])

  async function cargar(){
    setLoading(true)
    const d=await getArticuloDetalle(art.id)
    setDet(d)
    setLoading(false)
  }
  async function verificarOtrasTemps(){
    const{data:temps}=await sb.schema('costos').from('temporadas').select('*')
    const otras=(temps||[]).filter(t=>t.id!==art.temporada_id)
    const veri=await Promise.all(otras.map(async t=>{
      const{data}=await sb.schema('costos').from('articulos').select('id').eq('temporada_id',t.id).eq('codigo',art.codigo)
      return{...t,tieneArticulo:!!(data&&data.length)}
    }))
    setOtrasTemps(veri)
  }
  async function compartirCon(tempId,tempNombre){
    if(!confirm(`¿Compartir "${codigo}" con ${tempNombre}?\nSe copiará con las mismas telas, avíos y confección.`))return
    setCompartiendo(true)
    const{data:nuevo}=await sb.schema('costos').from('articulos').insert({
      temporada_id:tempId,codigo:art.codigo,descripcion:art.descripcion,
      confeccion:art.confeccion,categoria:art.categoria,notas_taller:art.notas_taller
    }).select().single()
    if(!nuevo){setCompartiendo(false);alert('Error al crear');return}
    // Copiar telas por nombre
    for(const t of det.telas){
      const nombre=t.precios_tela?.nombre;if(!nombre)continue
      const{data:p}=await sb.schema('costos').from('precios_tela').select('id').eq('temporada_id',tempId).ilike('nombre',nombre).limit(1)
      if(p&&p.length) await sb.schema('costos').from('articulo_telas').insert({articulo_id:nuevo.id,precio_tela_id:p[0].id,cantidad:t.cantidad})
    }
    // Copiar avíos por nombre
    for(const a of det.avios){
      const nombre=a.precios_avios?.nombre;if(!nombre)continue
      const{data:p}=await sb.schema('costos').from('precios_avios').select('id').eq('temporada_id',tempId).ilike('nombre',nombre).limit(1)
      if(p&&p.length) await sb.schema('costos').from('articulo_avios').insert({articulo_id:nuevo.id,precio_avio_id:p[0].id,cantidad:a.cantidad})
    }
    // Copiar percha por nombre
    for(const p of det.percha){
      const nombre=p.precios_perchas?.nombre;if(!nombre)continue
      const{data:pr}=await sb.schema('costos').from('precios_perchas').select('id').eq('temporada_id',tempId).ilike('nombre',nombre).limit(1)
      if(pr&&pr.length) await sb.schema('costos').from('articulo_percha').insert({articulo_id:nuevo.id,precio_percha_id:pr[0].id,cantidad:1})
    }
    setCompartiendo(false)
    verificarOtrasTemps()
    alert(`✅ Artículo ${codigo} copiado a ${tempNombre}`)
  }
  async function cargarTelas(){
    if(telasList.length)return
    const{data}=await sb.schema('costos').from('precios_tela').select('*').eq('temporada_id',art.temporada_id)
    setTelasList((data||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre)))
  }
  async function cargarAvios(){
    if(aviosList.length)return
    const{data}=await sb.schema('costos').from('precios_avios').select('*').eq('temporada_id',art.temporada_id)
    setAviosList((data||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre)))
  }
  async function guardarConf(){
    const v=Number(confInput)||0
    if(!await guardar(sb.schema('costos').from('articulos').update({confeccion:v}).eq('id',art.id),'la confección'))return
    setConf(v);setEditConf(false)
  }
  async function guardarCodigo(){
    const v=codigoInput.trim()
    if(!v)return
    if(!await guardar(sb.schema('costos').from('articulos').update({codigo:v}).eq('id',art.id),'el código'))return
    setCodigo(v);setEditCodigo(false)
  }
  async function guardarDescripcion(){
    const v=descInput.trim()
    if(!await guardar(sb.schema('costos').from('articulos').update({descripcion:v}).eq('id',art.id),'la descripción'))return
    setDescripcion(v);setEditDesc(false)
  }
  async function guardarTaller(){
    const v=tallerInput.trim()
    if(!await guardar(sb.schema('costos').from('articulos').update({notas_taller:v||null}).eq('id',art.id),'las notas de taller'))return
    setNotasTaller(v);setEditTaller(false)
  }
  async function guardarCantidad(tabla,id,valor){
    const v=Number(valor)||0
    if(!await guardar(sb.schema('costos').from(tabla).update({cantidad:v}).eq('id',id),'la cantidad'))return
    setEditandoCantidad(null)
    cargar()
  }
  async function guardarTela(id,precio_tela_id,cantidad){
    if(!await guardar(sb.schema('costos').from('articulo_telas').update({precio_tela_id,cantidad:Number(cantidad)||0}).eq('id',id),'la tela'))return
    setEditandoCantidad(null)
    cargar()
  }
  async function guardarAvio(id,precio_avio_id,cantidad){
    if(!await guardar(sb.schema('costos').from('articulo_avios').update({precio_avio_id,cantidad:Number(cantidad)||0}).eq('id',id),'el avío'))return
    setEditandoCantidad(null)
    cargar()
  }
  async function delTela(id){if(await guardar(sb.schema('costos').from('articulo_telas').delete().eq('id',id),'el borrado de la tela'))cargar()}
  async function delAvio(id){if(await guardar(sb.schema('costos').from('articulo_avios').delete().eq('id',id),'el borrado del avío'))cargar()}
  async function delPercha(id){if(await guardar(sb.schema('costos').from('articulo_percha').delete().eq('id',id),'el borrado de la percha'))cargar()}

  async function eliminarArticulo(){
    if(!confirm(`¿Eliminar el artículo ${codigo}? Esta acción no se puede deshacer.`))return
    await sb.schema('costos').from('articulo_telas').delete().eq('articulo_id',art.id)
    await sb.schema('costos').from('articulo_avios').delete().eq('articulo_id',art.id)
    await sb.schema('costos').from('articulo_percha').delete().eq('articulo_id',art.id)
    await sb.schema('costos').from('articulos').delete().eq('id',art.id)
    onBack()
  }

  async function duplicarArticulo(){
    const nuevoCodigo=prompt(`Duplicar artículo ${codigo}\n\nIngresá el código para el nuevo artículo:`)
    if(!nuevoCodigo||!nuevoCodigo.trim())return
    const nc=nuevoCodigo.trim()
    // Verificar que no exista
    const{data:existe}=await sb.schema('costos').from('articulos').select('id').eq('temporada_id',art.temporada_id).eq('codigo',nc)
    if(existe&&existe.length>0){alert(`El código ${nc} ya existe en esta temporada.`);return}
    // Crear nuevo artículo
    const{data:nuevo}=await sb.schema('costos').from('articulos').insert({
      temporada_id:art.temporada_id,codigo:nc,descripcion:art.descripcion,
      confeccion:art.confeccion,categoria:art.categoria,notas_taller:art.notas_taller
    }).select().single()
    if(!nuevo){alert('Error al crear el artículo');return}
    // Copiar telas, avíos y percha
    const[{data:telas},{data:avios},{data:percha}]=await Promise.all([
      sb.schema('costos').from('articulo_telas').select('precio_tela_id,cantidad').eq('articulo_id',art.id),
      sb.schema('costos').from('articulo_avios').select('precio_avio_id,cantidad').eq('articulo_id',art.id),
      sb.schema('costos').from('articulo_percha').select('precio_percha_id,cantidad').eq('articulo_id',art.id),
    ])
    await Promise.all([
      ...(telas||[]).map(t=>sb.schema('costos').from('articulo_telas').insert({articulo_id:nuevo.id,precio_tela_id:t.precio_tela_id,cantidad:t.cantidad})),
      ...(avios||[]).map(a=>sb.schema('costos').from('articulo_avios').insert({articulo_id:nuevo.id,precio_avio_id:a.precio_avio_id,cantidad:a.cantidad})),
      ...(percha||[]).map(p=>sb.schema('costos').from('articulo_percha').insert({articulo_id:nuevo.id,precio_percha_id:p.precio_percha_id,cantidad:p.cantidad})),
    ])
    alert(`✅ Artículo ${nc} creado con todo el contenido de ${codigo}. Buscalo en la lista para modificar lo que necesites.`)
    onBack()
  }

  const[simular,setSimular]=useState(false)

  return(
    <div className="page" style={{padding:'14px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:6,color:'var(--text2)',background:'none',border:'none',cursor:'pointer',fontSize:14}}>← Volver</button>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setSimular(true)} style={{display:'flex',alignItems:'center',gap:6,color:'#7c3aed',background:'none',border:'1.5px solid #7c3aed',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:13,fontWeight:600}}>🧪 Simular</button>
          <button onClick={duplicarArticulo} style={{display:'flex',alignItems:'center',gap:6,color:'var(--azul)',background:'none',border:'1.5px solid var(--azul)',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:13,fontWeight:600}}>⧉ Duplicar</button>
          <button onClick={eliminarArticulo} style={{display:'flex',alignItems:'center',gap:6,color:'var(--rojo)',background:'none',border:'1.5px solid var(--rojo)',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:13,fontWeight:600}}>🗑 Eliminar</button>
        </div>
      </div>

      {simular&&<SimuladorModal det={det} conf={conf} config={config} codigo={codigo} onClose={()=>setSimular(false)}/>}

      <div style={{display:'flex',gap:14,marginBottom:14,alignItems:'flex-start'}}>
        <FotoUp artId={art.id} url={art.foto_url} onSave={cargar}/>
        <div style={{flex:1,minWidth:0}}>
          {editCodigo?(
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
              <input className="form-input" value={codigoInput} onChange={e=>setCodigoInput(e.target.value)} style={{fontSize:17,fontWeight:800,padding:'4px 8px',width:150}} autoFocus/>
              <button className="btn btn-sm btn-primary" onClick={guardarCodigo}>✓</button>
              <button className="btn btn-sm btn-outline" onClick={()=>{setCodigoInput(codigo);setEditCodigo(false)}}>✕</button>
            </div>
          ):(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
              <div style={{fontSize:22,fontWeight:800}}>{codigo}</div>
              <button className="btn-icon" onClick={()=>setEditCodigo(true)}>✏️</button>
            </div>
          )}
          {editDesc?(
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
              <input className="form-input" value={descInput} onChange={e=>setDescInput(e.target.value)} style={{fontSize:13,padding:'4px 8px'}} autoFocus/>
              <button className="btn btn-sm btn-primary" onClick={guardarDescripcion}>✓</button>
              <button className="btn btn-sm btn-outline" onClick={()=>{setDescInput(descripcion);setEditDesc(false)}}>✕</button>
            </div>
          ):(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <div style={{fontSize:14,color:'var(--text2)'}}>{descripcion||'Sin descripción'}</div>
              <button className="btn-icon" onClick={()=>setEditDesc(true)}>✏️</button>
            </div>
          )}
          {editTaller?(
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
              <input className="form-input" value={tallerInput} onChange={e=>setTallerInput(e.target.value)}
                placeholder="Ej: Taller Marta, Eva..." style={{fontSize:13,padding:'4px 8px'}} autoFocus/>
              <button className="btn btn-sm btn-primary" onClick={guardarTaller}>✓</button>
              <button className="btn btn-sm btn-outline" onClick={()=>{setTallerInput(notas_taller);setEditTaller(false)}}>✕</button>
            </div>
          ):(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{fontSize:12}}>🏭</span>
              <span style={{fontSize:13,color:notas_taller?'var(--text1)':'var(--text3)',fontStyle:notas_taller?'normal':'italic'}}>
                {notas_taller||'Sin talleres asignados'}
              </span>
              <button className="btn-icon" onClick={()=>setEditTaller(true)}>✏️</button>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
            <span className="tag tag-azul">{temporada.nombre}</span>
            {otrasTemps.map(t=>(
              t.tieneArticulo
                ?<span key={t.id} style={{fontSize:11,background:'#f0fdf4',color:'#16a34a',padding:'3px 10px',borderRadius:20,fontWeight:600,border:'1px solid #bbf7d0'}}>✓ También en {t.nombre}</span>
                :<button key={t.id} onClick={()=>compartirCon(t.id,t.nombre)} disabled={compartiendo}
                  style={{fontSize:11,background:'#fff7ed',color:'#ea580c',padding:'3px 10px',borderRadius:20,fontWeight:600,border:'1px solid #fed7aa',cursor:'pointer'}}>
                  {compartiendo?'Copiando...':'↗ Compartir con '+t.nombre}
                </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(96px,1fr))',gap:8,marginBottom:14}}>
        {[
          {l:'Costo',v:precios.costo,c:'precio-costo'},
          {l:'Precio Venta',v:precios.precioVenta,c:'precio-venta',pct:'@'+(config?.margen_propio??config?.margen_greguera??100)+'%'},
          {l:'G. Reguera',v:precios.greguera,c:'precio-greguera',pct:'@'+(config?.margen_greguera??100)+'%'},
          {l:'Balbi',v:precios.balbi,c:'precio-balbi',pct:'@'+(config?.margen_balbi??50)+'%'},
          {l:'Sucati',v:precios.sucati,c:'precio-sucati',pct:'-'+(config?.descuento_sucati??15)+'%'},
        ].map(p=>(
          <div key={p.l} className="card" style={{padding:'8px 10px'}}>
            <div style={{fontSize:10,fontWeight:600,color:'var(--text2)',textTransform:'uppercase',marginBottom:2}}>{p.l}</div>
            <div className={p.c} style={{fontSize:16,fontWeight:800}}>{fmt(p.v)}</div>
            {p.pct&&<div className="pct-tag">{p.pct}</div>}
          </div>
        ))}
      </div>

      {loading?<div className="loading">⏳ Cargando...</div>:(
        <div className="detalle-grid">
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card">
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <b style={{fontSize:14}}>🧵 Telas</b><button className="btn btn-sm btn-outline" onClick={()=>setMTela(true)}>+ Agregar</button>
              </div>
              {det.telas.length===0?<div style={{padding:14,textAlign:'center',color:'var(--text2)',fontSize:13}}>Sin telas</div>
                :det.telas.map(t=>(
                <div key={t.id} className="precio-item">
                  <div><div style={{fontWeight:600,fontSize:13}}>{t.precios_tela?.nombre}</div>
                    {!(editandoCantidad?.tabla==='articulo_telas'&&editandoCantidad?.id===t.id)&&
                      <div style={{fontSize:11,color:'var(--text2)'}}>{t.cantidad} {t.precios_tela?.unidad||'kg'} × {fmt(t.precios_tela?.precio)}</div>}
                  </div>
                  {editandoCantidad?.tabla==='articulo_telas'&&editandoCantidad?.id===t.id?(
                    <TelaEditInline
                      tela={t} telasList={telasList}
                      onSave={(tid,cant)=>guardarTela(t.id,tid,cant)}
                      onCancel={()=>setEditandoCantidad(null)}/>
                  ):(
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <b style={{fontSize:13}}>{fmt(t.cantidad*(t.precios_tela?.precio||0))}</b>
                      <button className="btn-icon" onClick={()=>{cargarTelas();setEditandoCantidad({tabla:'articulo_telas',id:t.id})}}>✏️</button>
                      <button className="btn-icon" onClick={()=>delTela(t.id)}>🗑</button>
                    </div>
                  )}
                </div>
              ))}
              <div style={{padding:'7px 14px',background:'var(--surface2)',fontSize:12,fontWeight:700,display:'flex',justifyContent:'space-between'}}>
                <span>Total telas</span><span>{fmt(precios.totalTela)}</span>
              </div>
            </div>

            <div className="card">
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <b style={{fontSize:14}}>🪡 Avíos</b><button className="btn btn-sm btn-outline" onClick={()=>setMAvio(true)}>+ Agregar</button>
              </div>
              {det.avios.length===0?<div style={{padding:14,textAlign:'center',color:'var(--text2)',fontSize:13}}>Sin avíos</div>
                :det.avios.map(a=>(
                <div key={a.id} className="precio-item">
                  <div><div style={{fontWeight:600,fontSize:13}}>{a.precios_avios?.nombre}</div>
                    {!(editandoCantidad?.tabla==='articulo_avios'&&editandoCantidad?.id===a.id)&&
                      <div style={{fontSize:11,color:'var(--text2)'}}>{a.cantidad} × {fmt(a.precios_avios?.precio)}</div>}
                  </div>
                  {editandoCantidad?.tabla==='articulo_avios'&&editandoCantidad?.id===a.id?(
                    <AvioEditInline
                      avio={a} aviosList={aviosList}
                      onSave={(aid,cant)=>guardarAvio(a.id,aid,cant)}
                      onCancel={()=>setEditandoCantidad(null)}/>
                  ):(
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <b style={{fontSize:13}}>{fmt(a.cantidad*(a.precios_avios?.precio||0))}</b>
                      <button className="btn-icon" onClick={()=>{cargarAvios();setEditandoCantidad({tabla:'articulo_avios',id:a.id})}}>✏️</button>
                      <button className="btn-icon" onClick={()=>delAvio(a.id)}>🗑</button>
                    </div>
                  )}
                </div>
              ))}
              <div style={{padding:'7px 14px',background:'var(--surface2)',fontSize:12,fontWeight:700,display:'flex',justifyContent:'space-between'}}>
                <span>Total avíos</span><span>{fmt(precios.totalAvios)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:14}}>✂️ Producción</div>
            <div className="precio-item">
              <span style={{fontWeight:600,fontSize:13}}>Corte</span>
              <b style={{fontSize:13}}>{fmt(config?.precio_corte||0)}</b>
            </div>
            <div className="precio-item">
              <div><div style={{fontWeight:600,fontSize:13}}>Confección</div><div style={{fontSize:10,color:'var(--text3)'}}>manual por artículo</div></div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {editConf?(
                  <>
                    <input type="number" value={confInput} onChange={e=>setConfInput(e.target.value)}
                      style={{width:85,padding:'5px 8px',border:'1.5px solid var(--azul)',borderRadius:6,fontSize:13,fontWeight:700}} autoFocus/>
                    <button className="btn btn-sm btn-primary" onClick={guardarConf}>✓</button>
                    <button className="btn btn-sm btn-outline" onClick={()=>setEditConf(false)}>✕</button>
                  </>
                ):(
                  <><b style={{fontSize:13}}>{fmt(conf)}</b><button className="btn-icon" onClick={()=>{setConfInput(String(conf));setEditConf(true)}}>✏️</button></>
                )}
              </div>
            </div>
            <div style={{padding:'8px 14px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <b style={{fontSize:14}}>🧲 Percha</b><button className="btn btn-sm btn-outline" onClick={()=>setMPercha(true)}>{det.percha.length?'Cambiar':'+ Agregar'}</button>
            </div>
            {det.percha.map(p=>(
              <div key={p.id} className="precio-item" style={{paddingLeft:22}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{p.precios_perchas?.nombre}</div>
                  {!(editandoCantidad?.tabla==='articulo_percha'&&editandoCantidad?.id===p.id)&&
                    <div style={{fontSize:11,color:'var(--text2)'}}>{p.cantidad} × {fmt(p.precios_perchas?.precio)}</div>}
                </div>
                {editandoCantidad?.tabla==='articulo_percha'&&editandoCantidad?.id===p.id?(
                  <EditInline valor={p.cantidad} onSave={v=>guardarCantidad('articulo_percha',p.id,v)} onCancel={()=>setEditandoCantidad(null)}/>
                ):(
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <b style={{fontSize:13}}>{fmt(p.cantidad*(p.precios_perchas?.precio||0))}</b>
                    <button className="btn-icon" onClick={()=>setEditandoCantidad({tabla:'articulo_percha',id:p.id})}>✏️</button>
                    <button className="btn-icon" onClick={()=>delPercha(p.id)}>🗑</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{padding:'9px 14px',background:'var(--surface2)',fontWeight:800,display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)'}}>
              <span style={{fontSize:13}}>COSTO TOTAL</span><span style={{fontSize:16}}>{fmt(precios.costo)}</span>
            </div>
          </div>
        </div>
      )}
      {mTela&&<ModalAdd tipo="tela" artId={art.id} tempId={temporada.id} onClose={()=>setMTela(false)} onSave={()=>{setMTela(false);cargar()}}/>}
      {mAvio&&<ModalAdd tipo="avio" artId={art.id} tempId={temporada.id} onClose={()=>setMAvio(false)} onSave={()=>{setMAvio(false);cargar()}}/>}
      {mPercha&&<ModalAdd tipo="percha" artId={art.id} tempId={temporada.id} onClose={()=>setMPercha(false)} onSave={()=>{setMPercha(false);cargar()}}/>}
    </div>
  )
}
