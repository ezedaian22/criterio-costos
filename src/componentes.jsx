import React, { useState, useEffect } from 'react'
import { sb, fmt, guardar, getPrecios, perchaPorDefecto, getTemporadas } from './lib/nucleo.js'

export function BuscadorFijo({indice,onElegir}){
  const[q,setQ]=useState('')
  const[abierto,setAbierto]=useState(false)
  const caja=React.useRef(null)

  useEffect(()=>{
    const fuera=e=>{if(caja.current&&!caja.current.contains(e.target))setAbierto(false)}
    document.addEventListener('mousedown',fuera)
    return()=>document.removeEventListener('mousedown',fuera)
  },[])

  const t=q.trim().toLowerCase()
  const res=!t?[]:indice.filter(a=>
    a.codigo.toLowerCase().includes(t)||(a.descripcion||'').toLowerCase().includes(t)
  ).slice(0,12)

  function elegir(a){
    setQ('');setAbierto(false)
    onElegir(a.id)
  }

  return(
    <div className="buscador-fijo">
      <div className="buscador-caja" ref={caja}>
        <input
          className="form-input buscador-input"
          placeholder="🔎 Ir a un artículo — código o descripción"
          value={q}
          onChange={e=>{setQ(e.target.value);setAbierto(true)}}
          onFocus={()=>setAbierto(true)}
          onKeyDown={e=>{
            if(e.key==='Escape'){setQ('');setAbierto(false);e.target.blur()}
            if(e.key==='Enter'&&res.length)elegir(res[0])
          }}/>
        {q&&<button className="buscador-limpiar" onClick={()=>{setQ('');setAbierto(false)}} title="Limpiar">×</button>}
        {abierto&&t&&(
          <div className="buscador-lista">
            {res.length===0
              ?<div className="buscador-vacio">Sin resultados para “{q}”</div>
              :res.map(a=>(
                <div key={a.id} className="buscador-item" onClick={()=>elegir(a)}>
                  <span className="buscador-cod">{a.codigo}</span>
                  <span className="buscador-desc">{a.descripcion||'Sin descripción'}</span>
                  <span className="buscador-ir">↵</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Crea la planilla y falla con un mensaje entendible en vez de un TypeError.

export function TelaEditInline({tela,telasList,onSave,onCancel}){
  const[tid,setTid]=useState(tela.precio_tela_id)
  const[cant,setCant]=useState(String(tela.cantidad))
  return(
    <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
      <select value={tid} onChange={e=>setTid(e.target.value)}
        style={{padding:'5px 8px',border:'1.5px solid var(--azul)',borderRadius:6,fontSize:12,maxWidth:160}}>
        {telasList.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>
      <input type="number" value={cant} onChange={e=>setCant(e.target.value)}
        style={{width:70,padding:'5px 8px',border:'1.5px solid var(--azul)',borderRadius:6,fontSize:13,fontWeight:700}}/>
      <button className="btn btn-sm btn-primary" onClick={()=>onSave(tid,cant)}>✓</button>
      <button className="btn btn-sm btn-outline" onClick={onCancel}>✕</button>
    </div>
  )
}


export function AvioEditInline({avio,aviosList,onSave,onCancel}){
  const[aid,setAid]=useState(avio.precio_avio_id)
  const[cant,setCant]=useState(String(avio.cantidad))
  return(
    <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
      <select value={aid} onChange={e=>setAid(e.target.value)}
        style={{padding:'5px 8px',border:'1.5px solid var(--azul)',borderRadius:6,fontSize:12,maxWidth:160}}>
        {aviosList.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
      <input type="number" value={cant} onChange={e=>setCant(e.target.value)}
        style={{width:70,padding:'5px 8px',border:'1.5px solid var(--azul)',borderRadius:6,fontSize:13,fontWeight:700}}/>
      <button className="btn btn-sm btn-primary" onClick={()=>onSave(aid,cant)}>✓</button>
      <button className="btn btn-sm btn-outline" onClick={onCancel}>✕</button>
    </div>
  )
}


export function FotoUp({artId,url,onSave}){
  const[subiendo,setSubiendo]=useState(false)
  const[u,setU]=useState(url)
  const[err,setErr]=useState('')
  const[grande,setGrande]=useState(false)
  async function subir(e){
    const f=e.target.files[0];if(!f)return
    setSubiendo(true);setErr('')
    const ext=f.name.split('.').pop()
    const path=`${artId}-${Date.now()}.${ext}`
    const{error}=await sb.storage.from('fotos-costos').upload(path,f,{upsert:true})
    if(error){
      setErr(error.message||'Error al subir')
    } else {
      const{data}=sb.storage.from('fotos-costos').getPublicUrl(path)
      await sb.schema('costos').from('articulos').update({foto_url:data.publicUrl}).eq('id',artId)
      setU(data.publicUrl);onSave()
    }
    setSubiendo(false)
  }
  return(
    <div>
      {grande&&(
        <div onClick={()=>setGrande(false)} style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(0,0,0,0.85)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'}}>
          <img src={u} alt="" style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,objectFit:'contain',boxShadow:'0 8px 40px rgba(0,0,0,0.5)'}}/>
          <div style={{position:'absolute',top:20,right:24,color:'#fff',fontSize:28,fontWeight:700,cursor:'pointer'}}>×</div>
        </div>
      )}
      <label style={{cursor:'pointer',display:'block'}}>
        <input type="file" accept="image/*" onChange={subir} style={{display:'none'}}/>
        {u?(
          <div style={{position:'relative',display:'inline-block'}}>
            <img src={u} alt="" onClick={e=>{e.preventDefault();setGrande(true)}}
              style={{width:90,height:90,borderRadius:10,objectFit:'cover',border:'2px solid var(--border)',cursor:'zoom-in',transition:'transform 0.15s'}}
              onMouseEnter={e=>e.target.style.transform='scale(1.06)'}
              onMouseLeave={e=>e.target.style.transform='scale(1)'}/>
            <label style={{position:'absolute',bottom:0,right:0,background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:11,padding:'2px 6px',borderRadius:'0 0 8px 0',cursor:'pointer',lineHeight:'20px'}}>
              ✏️
              <input type="file" accept="image/*" onChange={subir} style={{display:'none'}}/>
            </label>
          </div>
        ):(
          <div style={{width:90,height:90,borderRadius:10,background:'var(--surface2)',border:'2px dashed var(--border)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}>
            <span style={{fontSize:28}}>📷</span><span style={{fontSize:10,color:'var(--text3)'}}>Agregar foto</span>
          </div>
        )}
      </label>
      {subiendo&&<div style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:4}}>Subiendo...</div>}
      {err&&<div style={{fontSize:11,color:'var(--rojo)',marginTop:4,maxWidth:90}}>{err}</div>}
    </div>
  )
}


export function ModalAdd({tipo,artId,tempId,onClose,onSave}){
  const[items,setItems]=useState([])
  const[selId,setSelId]=useState('')
  const[cantidad,setCantidad]=useState(tipo==='percha'?'1':tipo==='avio'?'1':'')
  const[loading,setLoading]=useState(false)
  const tablaMap={tela:'precios_tela',avio:'precios_avios',percha:'precios_perchas'}
  const insMap={tela:'articulo_telas',avio:'articulo_avios',percha:'articulo_percha'}
  const fkMap={tela:'precio_tela_id',avio:'precio_avio_id',percha:'precio_percha_id'}
  const tabla=tablaMap[tipo],ins=insMap[tipo],fk=fkMap[tipo]
  const titulo={tela:'Agregar tela',avio:'Agregar avío',percha:'Agregar percha'}[tipo]
  useEffect(()=>{getPrecios(tabla,tempId).then(d=>setItems(d.sort((a,b)=>a.nombre.localeCompare(b.nombre))))},[])
  async function guardar(){
    if(!selId)return
    setLoading(true)
    await sb.schema('costos').from(ins).insert({articulo_id:artId,[fk]:selId,cantidad:Number(cantidad)||1})
    setLoading(false);onSave()
  }
  const sel=items.find(i=>i.id===selId)
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">{titulo}</div><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{tipo==='tela'?'Tipo de tela':tipo==='avio'?'Avío':'Percha'}</label>
            <select className="form-select" value={selId} onChange={e=>setSelId(e.target.value)}>
              <option value="">Seleccioná...</option>
              {items.map(i=><option key={i.id} value={i.id}>{i.nombre}{i.precio?' — '+fmt(i.precio):''}{i.unidad?' /'+i.unidad:''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cantidad{tipo==='tela'&&sel?' ('+sel.unidad+')':''}</label>
            <input type="number" className="form-input" value={cantidad} onChange={e=>setCantidad(e.target.value)} step="0.01" min="0.01"/>
          </div>
          {sel&&cantidad&&<div style={{padding:'10px 14px',background:'var(--azul-bg)',borderRadius:8,fontSize:14,fontWeight:600}}>
            Total: {fmt(Number(cantidad)*(sel.precio||0))}
          </div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" style={{flex:1,minHeight:44}} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:2,minHeight:44}} onClick={guardar} disabled={loading||!selId}>
            {loading?'Guardando...':'✅ Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}


export function ModalNuevoArt({temporada,onClose,onSave,articulos}){
  const ultimoGuardado=temporada.ultimo_codigo??null
  const sugerido=ultimoGuardado?String(ultimoGuardado+1):''
  const[codigo,setCodigo]=useState(sugerido)
  const[desc,setDesc]=useState('')
  const[conf,setConf]=useState('')
  const[loading,setLoading]=useState(false)
  const[error,setError]=useState('')

  async function guardar(){
    if(!codigo){setError('El código es obligatorio');return}
    const yaExiste=(articulos||[]).some(a=>a.codigo.trim()===codigo.trim())
    if(yaExiste){setError(`El código ${codigo} ya existe en esta temporada`);return}
    setLoading(true);setError('')
    const{data:nuevo,error:err}=await sb.schema('costos').from('articulos').insert({temporada_id:temporada.id,codigo:codigo.trim(),descripcion:desc,confeccion:Number(conf)||0}).select().single()
    if(err){setError('Error al guardar: '+err.message);setLoading(false);return}
    if(nuevo){
      // Percha por defecto: la más usada en esta temporada. Antes estaba fijo el
      // nombre "Percha 300" y si no existía, el artículo quedaba sin percha en silencio.
      const percha=await perchaPorDefecto(temporada.id)
      if(percha) await sb.schema('costos').from('articulo_percha').insert({articulo_id:nuevo.id,precio_percha_id:percha,cantidad:1})
      else alert('El artículo se creó, pero esta temporada todavía no tiene perchas cargadas.\nAgregale la percha desde el detalle del artículo.')
      // Último código usado: queda en la base, compartido por todos los equipos
      const n=parseInt(codigo.trim(),10)
      if(!isNaN(n)) await sb.schema('costos').from('temporadas').update({ultimo_codigo:n}).eq('id',temporada.id)
    }
    setLoading(false);onSave()
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Nuevo artículo</div><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          {ultimoGuardado&&<div style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>Último código registrado: <b>{ultimoGuardado}</b></div>}
          <div className="form-group">
            <label className="form-label">Código *</label>
            <input className="form-input" value={codigo} onChange={e=>{setCodigo(e.target.value);setError('')}} autoFocus
              style={{borderColor:error?'var(--rojo)':undefined}}/>
            {error&&<div style={{color:'var(--rojo)',fontSize:12,marginTop:4}}>{error}</div>}
          </div>
          <div className="form-group"><label className="form-label">Descripción</label><input className="form-input" placeholder="Ej: chaleco polar con tapa cierre" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Confección ($)</label><input type="number" className="form-input" placeholder="0" value={conf} onChange={e=>setConf(e.target.value)}/></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" style={{flex:1,minHeight:44}} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:2,minHeight:44}} onClick={guardar} disabled={loading||!codigo}>{loading?'Guardando...':'✅ Crear artículo'}</button>
        </div>
      </div>
    </div>
  )
}


export function EditInline({valor,onSave,onCancel}){
  const[v,setV]=useState(String(valor||''))
  return(
    <div style={{display:'flex',gap:6,alignItems:'center'}}>
      <input type="number" value={v} onChange={e=>setV(e.target.value)} style={{width:100,padding:'5px 8px',border:'1.5px solid var(--azul)',borderRadius:6,fontSize:14,fontWeight:700}} autoFocus onKeyDown={e=>e.key==='Enter'&&onSave(v)}/>
      <button className="btn btn-sm btn-primary" onClick={()=>onSave(v)}>✓</button>
      <button className="btn btn-sm btn-outline" onClick={onCancel}>✕</button>
    </div>
  )
}


export function ModalNuevoPrecio({tipo,titulo,tempId,onClose,onSave}){
  const[nombre,setNombre]=useState('')
  const[precio,setPrecio]=useState('')
  const[unidad,setUnidad]=useState('kg')
  const[loading,setLoading]=useState(false)
  const esTela=tipo==='precios_tela'
  async function guardar(){
    if(!nombre)return
    setLoading(true)
    const d={temporada_id:tempId,nombre,precio:Number(precio)||0}
    if(esTela)d.unidad=unidad
    await sb.schema('costos').from(tipo).insert(d)
    setLoading(false);onSave()
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Agregar a {titulo}</div><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" placeholder="Ej: polar" value={nombre} onChange={e=>setNombre(e.target.value)} autoFocus/></div>
          <div className={esTela?'form-row':''}>
            <div className="form-group"><label className="form-label">Precio ($)</label><input type="number" className="form-input" placeholder="0" value={precio} onChange={e=>setPrecio(e.target.value)}/></div>
            {esTela&&<div className="form-group"><label className="form-label">Unidad</label><select className="form-select" value={unidad} onChange={e=>setUnidad(e.target.value)}><option value="kg">kg</option><option value="m">m</option><option value="u">u</option></select></div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" style={{flex:1,minHeight:44}} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:2,minHeight:44}} onClick={guardar} disabled={loading||!nombre}>{loading?'Guardando...':'✅ Agregar'}</button>
        </div>
      </div>
    </div>
  )
}


export function ModalNuevaTemp({onClose,onSave,sugerido,temporadas,estacion}){
  const[nombre,setNombre]=useState(sugerido||'')
  const[clonarDe,setClonarDe]=useState('')
  const[loading,setLoading]=useState(false)
  const[progreso,setProgreso]=useState('')
  const candidatas=(temporadas||[]).filter(t=>detectarEstacion(t.nombre)===estacion)

  async function guardar(){
    if(!nombre)return
    setLoading(true)
    if(!clonarDe){await onSave(nombre);setLoading(false);return}
    // Clonar
    try{
      setProgreso('Creando temporada...')
      const{data:nueva,error}=await sb.schema('costos').from('temporadas').insert({nombre,activa:false}).select().single()
      if(error||!nueva){alert('Error al crear temporada');setLoading(false);return}
      const origenId=clonarDe

      // 1. Config
      setProgreso('Copiando configuración...')
      const{data:cfg}=await sb.schema('costos').from('config').select('*').eq('temporada_id',origenId).limit(1)
      if(cfg&&cfg.length){
        const c=cfg[0]
        await sb.schema('costos').from('config').insert({
          temporada_id:nueva.id,precio_corte:c.precio_corte,margen_greguera:c.margen_greguera,
          margen_balbi:c.margen_balbi,descuento_sucati:c.descuento_sucati,margen_propio:c.margen_propio
        })
      }

      // 2. Telas / Avíos / Perchas — con precio_anterior y actualizado=false
      setProgreso('Copiando telas, avíos y perchas...')
      const[{data:telas},{data:avios},{data:perchas}]=await Promise.all([
        sb.schema('costos').from('precios_tela').select('*').eq('temporada_id',origenId),
        sb.schema('costos').from('precios_avios').select('*').eq('temporada_id',origenId),
        sb.schema('costos').from('precios_perchas').select('*').eq('temporada_id',origenId),
      ])
      const mapTela={},mapAvio={},mapPercha={}
      if(telas?.length){
        const{data:nuevas}=await sb.schema('costos').from('precios_tela').insert(
          telas.map(t=>({temporada_id:nueva.id,nombre:t.nombre,precio:t.precio,unidad:t.unidad,precio_anterior:t.precio,actualizado:false}))
        ).select()
        ;(nuevas||[]).forEach(n=>{const o=telas.find(t=>t.nombre===n.nombre);if(o)mapTela[o.id]=n.id})
      }
      if(avios?.length){
        const{data:nuevos}=await sb.schema('costos').from('precios_avios').insert(
          avios.map(a=>({temporada_id:nueva.id,nombre:a.nombre,precio:a.precio,precio_anterior:a.precio,actualizado:false}))
        ).select()
        ;(nuevos||[]).forEach(n=>{const o=avios.find(a=>a.nombre===n.nombre);if(o)mapAvio[o.id]=n.id})
      }
      if(perchas?.length){
        const{data:nuevas}=await sb.schema('costos').from('precios_perchas').insert(
          perchas.map(p=>({temporada_id:nueva.id,nombre:p.nombre,precio:p.precio,precio_anterior:p.precio,actualizado:false}))
        ).select()
        ;(nuevas||[]).forEach(n=>{const o=perchas.find(p=>p.nombre===n.nombre);if(o)mapPercha[o.id]=n.id})
      }

      // 3. Artículos
      setProgreso('Copiando artículos...')
      const{data:arts}=await sb.schema('costos').from('articulos').select('*').eq('temporada_id',origenId)
      if(arts?.length){
        const{data:nuevosArts}=await sb.schema('costos').from('articulos').insert(
          arts.map(a=>({
            temporada_id:nueva.id,codigo:a.codigo,descripcion:a.descripcion,confeccion:a.confeccion,
            categoria:a.categoria,notas_taller:a.notas_taller,foto_url:a.foto_url,precio_venta_manual:a.precio_venta_manual
          }))
        ).select()
        const mapArt={}
        ;(nuevosArts||[]).forEach(n=>{const o=arts.find(a=>a.codigo===n.codigo);if(o)mapArt[o.id]=n.id})

        // 4. Relaciones
        setProgreso('Copiando composición de artículos...')
        const filaDe=t=>sb.schema('costos').from(t).select('*,articulos!inner(temporada_id)').eq('articulos.temporada_id',origenId)
        const[{data:at},{data:aa},{data:ap}]=await Promise.all([
          filaDe('articulo_telas'),filaDe('articulo_avios'),filaDe('articulo_percha'),
        ])
        const insT=(at||[]).filter(x=>mapArt[x.articulo_id]&&mapTela[x.precio_tela_id])
          .map(x=>({articulo_id:mapArt[x.articulo_id],precio_tela_id:mapTela[x.precio_tela_id],cantidad:x.cantidad}))
        const insA=(aa||[]).filter(x=>mapArt[x.articulo_id]&&mapAvio[x.precio_avio_id])
          .map(x=>({articulo_id:mapArt[x.articulo_id],precio_avio_id:mapAvio[x.precio_avio_id],cantidad:x.cantidad}))
        const insP=(ap||[]).filter(x=>mapArt[x.articulo_id]&&mapPercha[x.precio_percha_id])
          .map(x=>({articulo_id:mapArt[x.articulo_id],precio_percha_id:mapPercha[x.precio_percha_id],cantidad:x.cantidad}))
        if(insT.length)await sb.schema('costos').from('articulo_telas').insert(insT)
        if(insA.length)await sb.schema('costos').from('articulo_avios').insert(insA)
        if(insP.length)await sb.schema('costos').from('articulo_percha').insert(insP)
      }
      setProgreso('')
      setLoading(false)
      alert(`✅ Temporada "${nombre}" creada con ${arts?.length||0} artículos.\n\nRecordá actualizar los precios de telas y avíos — están marcados como pendientes.`)
      onSave(nombre,true)
    }catch(e){
      setLoading(false);setProgreso('')
      alert('Error al clonar: '+e.message)
    }
  }

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">Nueva temporada</div><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="form-input" placeholder="Ej: Verano 2027" value={nombre} onChange={e=>setNombre(e.target.value)} autoFocus/>
          </div>
          {candidatas.length>0&&(
            <div className="form-group">
              <label className="form-label">Clonar desde (opcional)</label>
              <select className="form-input" value={clonarDe} onChange={e=>setClonarDe(e.target.value)}>
                <option value="">Empezar vacía</option>
                {candidatas.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                {clonarDe
                  ?'Se copiarán artículos, telas, avíos, perchas y configuración. Los precios quedarán marcados como pendientes de actualizar.'
                  :'La temporada se creará sin artículos ni precios.'}
              </div>
            </div>
          )}
          {progreso&&<div style={{fontSize:13,color:'var(--azul)',fontWeight:600,padding:'8px 0'}}>⏳ {progreso}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" style={{flex:1,minHeight:44}} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:2,minHeight:44}} onClick={guardar} disabled={loading||!nombre}>{loading?'Creando...':'✅ Crear temporada'}</button>
        </div>
      </div>
    </div>
  )
}
