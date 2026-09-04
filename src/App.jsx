import React, { useState, useEffect } from 'react'
import { sb, getTemporadas, getConfig, porCodigo, detectarEstacion } from './lib/nucleo.js'
import { BuscadorFijo, ModalNuevaTemp } from './componentes.jsx'
import { ArticulosPage } from './paginas/Articulos.jsx'
import { ListaPreciosPage } from './paginas/ListaPrecios.jsx'
import { PreciosPage } from './paginas/Precios.jsx'
import { ComparadorPage } from './paginas/Comparador.jsx'
import { ConfigPage } from './paginas/Config.jsx'

export default function App(){
  const[pantalla,setPantalla]=useState('caratula')
  const[estacion,setEstacion]=useState(null)
  const[tab,setTab]=useState('articulos')
  const[temporadas,setTemporadas]=useState([])
  const[temporada,setTemporada]=useState(null)
  const[config,setConfig]=useState(null)
  const[loading,setLoading]=useState(true)
  const[mTemp,setMTemp]=useState(false)
  const[mCambiar,setMCambiar]=useState(false)
  // Buscador global: índice liviano de la temporada para saltar a un artículo
  // desde cualquier pantalla, incluso estando dentro de otro artículo.
  const[indice,setIndice]=useState([])
  const[pedido,setPedido]=useState(null)

  useEffect(()=>{
    getTemporadas().then(ts=>{setTemporadas(ts);setLoading(false)})
  },[])

  useEffect(()=>{
    if(!temporada){setIndice([]);return}
    sb.schema('costos').from('articulos').select('id,codigo,descripcion')
      .eq('temporada_id',temporada.id)
      .then(({data})=>setIndice((data||[]).sort(porCodigo)))
  },[temporada?.id])

  async function elegirTemporada(t){
    setTemporada(t)
    setConfig(await getConfig(t.id))
    setPantalla('app')
    setMCambiar(false)
    setMTemp(false)
  }

  // Relee las temporadas y refresca la que está abierta, para que el
  // "último código" (que ahora vive en la base) se vea al instante.
  async function refrescarTemporadas(){
    const ts=await getTemporadas()
    setTemporadas(ts)
    if(temporada){
      const actual=ts.find(x=>x.id===temporada.id)
      if(actual)setTemporada(actual)
    }
  }

  async function crearTemporada(nombre,yaCreada){
    if(!yaCreada) await sb.schema('costos').from('temporadas').insert({nombre,activa:false})
    const ts=await getTemporadas()
    setTemporadas(ts)
    const nueva=ts.find(t=>t.nombre===nombre)
    if(nueva)elegirTemporada(nueva)
  }

  async function elegirEstacion(est){
    setEstacion(est)
    const lista=temporadas.filter(t=>detectarEstacion(t.nombre)===est)
    if(lista.length===1){
      elegirTemporada(lista[0])
    } else if(lista.length===0){
      setMTemp(true)
    } else {
      // multiple → show picker inline on carátula
      setPantalla('picker')
    }
  }

  if(loading)return React.createElement('div',{className:'loading'},'⏳ Cargando...')

  if(pantalla==='caratula'){
    return(
      <div className="caratula">
        <div className="caratula-logo">Criterio <span>Costos</span></div>
        <div className="caratula-sub">Elegí la temporada</div>
        <div className="caratula-estaciones">
          <button className="estacion-card" onClick={()=>elegirEstacion('invierno')}>
            <span>❄️</span><div>Invierno</div>
          </button>
          <button className="estacion-card" onClick={()=>elegirEstacion('verano')}>
            <span>☀️</span><div>Verano</div>
          </button>
        </div>
        {mTemp&&<ModalNuevaTemp sugerido={estacion==='invierno'?'Invierno ':'Verano '} temporadas={temporadas} estacion={estacion} onClose={()=>setMTemp(false)} onSave={crearTemporada}/>}
      </div>
    )
  }

  if(pantalla==='picker'){
    const lista=temporadas.filter(t=>detectarEstacion(t.nombre)===estacion)
    return(
      <div className="caratula">
        <button onClick={()=>setPantalla('caratula')} style={{position:'absolute',top:18,left:18,display:'flex',alignItems:'center',gap:6,color:'var(--text2)',background:'none',border:'none',cursor:'pointer',fontSize:14}}>← Volver</button>
        <div className="caratula-logo" style={{fontSize:26,marginBottom:4}}>{estacion==='invierno'?'❄️ Invierno':'☀️ Verano'}</div>
        <div className="caratula-sub">Elegí una temporada o creá una nueva</div>
        <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:360}}>
          {lista.map(t=>(
            <button key={t.id} className="btn btn-outline" style={{minHeight:48,fontSize:15}} onClick={()=>elegirTemporada(t)}>{t.nombre}</button>
          ))}
          <button className="btn btn-primary" style={{minHeight:48}} onClick={()=>setMTemp(true)}>+ Nueva temporada</button>
        </div>
        {mTemp&&<ModalNuevaTemp sugerido={estacion==='invierno'?'Invierno ':'Verano '} temporadas={temporadas} estacion={estacion} onClose={()=>setMTemp(false)} onSave={crearTemporada}/>}
      </div>
    )
  }

  const tabs=['articulos','lista','telas','avios','perchas','comparar','config']
  const tabLabel={articulos:'📦 Artículos',lista:'🏷️ Lista',telas:'🧵 Telas',avios:'🪡 Avíos',perchas:'🧲 Perchas',comparar:'📊 Comparar',config:'⚙️ Config'}

  return(
    <div>
      <nav className="nav">
        <div className="nav-brand" style={{cursor:'pointer'}} onClick={()=>setPantalla('caratula')}>Criterio <span>Costos</span></div>
        {tabs.map(t=>(
          <div key={t} className={`nav-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{tabLabel[t]}</div>
        ))}
        <div className="nav-sel" style={{position:'relative'}}>
          <span className="tag tag-azul" style={{cursor:'pointer'}} onClick={()=>setMCambiar(v=>!v)}>{temporada?.nombre} ▾</span>
          {mCambiar&&(
            <div style={{position:'absolute',right:0,top:'calc(100% + 8px)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 4px 20px rgba(0,0,0,0.12)',minWidth:230,zIndex:200,padding:8}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',padding:'4px 10px 8px'}}>
                {estacion==='invierno'?'❄️ Temporadas de Invierno':'☀️ Temporadas de Verano'}
              </div>
              {temporadas.filter(t=>detectarEstacion(t.nombre)===estacion).map(t=>(
                <div key={t.id} onClick={()=>elegirTemporada(t)}
                  style={{padding:'9px 12px',borderRadius:7,cursor:'pointer',fontWeight:t.id===temporada?.id?700:400,background:t.id===temporada?.id?'var(--azul-bg)':'transparent',color:t.id===temporada?.id?'var(--azul)':'var(--text1)',fontSize:14}}>{t.nombre}</div>
              ))}
              <div style={{borderTop:'1px solid var(--border)',marginTop:6,paddingTop:6}}>
                <div onClick={()=>{setMCambiar(false);setMTemp(true)}} style={{padding:'9px 12px',borderRadius:7,cursor:'pointer',color:'var(--azul)',fontWeight:600,fontSize:14}}>+ Nueva temporada</div>
                <div onClick={()=>{setMCambiar(false);setPantalla('caratula')}} style={{padding:'9px 12px',borderRadius:7,cursor:'pointer',color:'var(--text2)',fontSize:14}}>↩ Cambiar estación</div>
              </div>
            </div>
          )}
          {mTemp&&<ModalNuevaTemp sugerido={estacion==='invierno'?'Invierno ':'Verano '} temporadas={temporadas} estacion={estacion} onClose={()=>setMTemp(false)} onSave={crearTemporada}/>}
        </div>
      </nav>
      {temporada&&<BuscadorFijo indice={indice} onElegir={id=>{setTab('articulos');setPedido(id)}}/>}
      {!temporada?<div className="empty"><div className="empty-title">Sin temporadas</div></div>
        :tab==='articulos'?<ArticulosPage temporada={temporada} config={config} todasTemporadas={temporadas} pedido={pedido} onPedidoListo={()=>setPedido(null)} onTemporadaCambio={refrescarTemporadas}/>
        :tab==='lista'?<ListaPreciosPage temporada={temporada} config={config}/>
        :tab==='telas'?<PreciosPage tipo="precios_tela" titulo="Precios de Telas" icono="🧵" temporada={temporada}/>
        :tab==='avios'?<PreciosPage tipo="precios_avios" titulo="Precios de Avíos" icono="🪡" temporada={temporada}/>
        :tab==='perchas'?<PreciosPage tipo="precios_perchas" titulo="Precios de Perchas" icono="🧲" temporada={temporada}/>
        :tab==='comparar'?<ComparadorPage temporada={temporada} config={config} todasTemporadas={temporadas}/>
        :<ConfigPage temporada={temporada} config={config} onSave={setConfig} temporadas={temporadas} onTemporadas={ts=>{setTemporadas(ts)}} onTemporadaCambio={refrescarTemporadas}/>
      }
    </div>
  )
}
