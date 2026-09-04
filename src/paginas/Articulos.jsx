import React, { useState, useEffect } from 'react'
import { sb, fmt, getArticulos, getArticuloDetalle, composicionDeTemporada, calcPrecios, crearPlanilla } from '../lib/nucleo.js'
import { ModalNuevoArt } from '../componentes.jsx'
import { ArticuloDetalle } from './ArticuloDetalle.jsx'

export function ArticulosPage({temporada,config,todasTemporadas,pedido,onPedidoListo}){
  const[articulos,setArticulos]=useState([])
  const[loading,setLoading]=useState(true)
  const[busqueda,setBusqueda]=useState('')
  const[busquedaGlobal,setBusquedaGlobal]=useState(false)
  const[resultadosOtros,setResultadosOtros]=useState([])
  const[buscandoGlobal,setBuscandoGlobal]=useState(false)
  const[modalNuevo,setModalNuevo]=useState(false)
  const[seleccionado,setSeleccionado]=useState(null)
  const[verIncompletos,setVerIncompletos]=useState(false)
  const[modoSel,setModoSel]=useState(false)
  const[selecc,setSelecc]=useState(new Set())
  const[precioTipo,setPrecioTipo]=useState('precioVenta')
  const[exportando,setExportando]=useState(false)
  const gTokenRef=React.useRef(null)

  useEffect(()=>{cargar()},[temporada.id])
  useEffect(()=>{
    if(!busqueda){setResultadosOtros([]);return}
    const timer=setTimeout(()=>buscarEnOtras(),400)
    return()=>clearTimeout(timer)
  },[busqueda])

  // El buscador fijo pidió abrir un artículo: lo abrimos apenas esté cargado.
  useEffect(()=>{
    if(!pedido||loading)return
    const a=articulos.find(x=>x.id===pedido)
    if(a){setArtOtraTemp(null);setSeleccionado(a)}
    else alert('Ese artículo ya no está en esta temporada.')
    onPedidoListo&&onPedidoListo()
  },[pedido,loading,articulos])

  async function cargar(){
    setLoading(true)
    const arts=await getArticulos(temporada.id)
    // 3 consultas masivas, filtradas por temporada en el servidor.
    // No se enumeran los ids: la dirección queda de largo fijo y no hay techo de artículos.
    const[{data:telas},{data:avios},{data:perchas}]=await Promise.all([
      composicionDeTemporada('articulo_telas','precios_tela',temporada.id),
      composicionDeTemporada('articulo_avios','precios_avios',temporada.id),
      composicionDeTemporada('articulo_percha','precios_perchas',temporada.id),
    ])
    // Agrupar por articulo_id
    const mapTelas={},mapAvios={},mapPercha={}
    ;(telas||[]).forEach(t=>{(mapTelas[t.articulo_id]=mapTelas[t.articulo_id]||[]).push(t)})
    ;(avios||[]).forEach(a=>{(mapAvios[a.articulo_id]=mapAvios[a.articulo_id]||[]).push(a)})
    ;(perchas||[]).forEach(p=>{(mapPercha[p.articulo_id]=mapPercha[p.articulo_id]||[]).push(p)})
    const con=arts.map(a=>{
      const det={telas:mapTelas[a.id]||[],avios:mapAvios[a.id]||[],percha:mapPercha[a.id]||[]}
      return{...a,detalle:det,precios:calcPrecios(det,a.confeccion,config)}
    })
    setArticulos(con)
    setLoading(false)
  }

  const[artOtraTemp,setArtOtraTemp]=useState(null) // {art, temporada, config}

  async function abrirArtOtraTemp(a,temp){
    // Cargar detalle completo + config de esa temporada
    const[{data:cfg},det]=await Promise.all([
      sb.schema('costos').from('config').select('*').eq('temporada_id',temp.id).limit(1),
      getArticuloDetalle(a.id)
    ])
    const{data:artCompleto}=await sb.schema('costos').from('articulos').select('*').eq('id',a.id).single()
    const configOtra=cfg?.[0]||null
    setArtOtraTemp({
      art:{...artCompleto,detalle:det,precios:calcPrecios(det,artCompleto.confeccion,configOtra)},
      temporada:temp,
      config:configOtra
    })
  }

  async function buscarEnOtras(){    if(!busqueda)return
    setBuscandoGlobal(true)
    const otras=(todasTemporadas||[]).filter(t=>t.id!==temporada.id)
    if(!otras.length){setResultadosOtros([]);setBuscandoGlobal(false);return}
    const ids=otras.map(t=>t.id)
    // Se filtra en el servidor. Antes bajaba el catálogo entero de todas las
    // temporadas con cada tecla y recién después filtraba en el navegador.
    // Se limpian los caracteres que romperían la sintaxis del filtro.
    const q=busqueda.trim().replace(/[,()*:%\\"']/g,' ').trim()
    if(!q){setResultadosOtros([]);setBuscandoGlobal(false);return}
    const{data:arts}=await sb.schema('costos').from('articulos')
      .select('id,codigo,descripcion,temporada_id')
      .in('temporada_id',ids)
      .or(`codigo.ilike.%${q}%,descripcion.ilike.%${q}%`)
      .limit(50)
    const resultados=otras.map(t=>({
      temporada:t,
      articulos:(arts||[]).filter(a=>a.temporada_id===t.id)
    })).filter(r=>r.articulos.length)
    setResultadosOtros(resultados)
    setBuscandoGlobal(false)
  }

  const esIncompleto=a=>{
    const sinTelas=!a.detalle?.telas?.length
    const telaCero=a.detalle?.telas?.some(t=>!t.cantidad||t.cantidad===0)
    const sinConf=!a.confeccion||a.confeccion===0
    const sinFoto=!a.foto_url
    return{incompleto:sinTelas||telaCero||sinConf||sinFoto,sinTelas,telaCero,sinConf,sinFoto}
  }
  const incompletos=articulos.filter(a=>esIncompleto(a).incompleto)
  const filtrados=articulos.filter(a=>!busqueda||a.codigo.toLowerCase().includes(busqueda.toLowerCase())||(a.descripcion||'').toLowerCase().includes(busqueda.toLowerCase()))

  // Vive en la base (temporadas.ultimo_codigo): es el mismo para todos los
  // equipos. Antes estaba en el navegador y cada máquina veía un número distinto.
  const ultimoNumerico=temporada.ultimo_codigo??null

  function toggleSel(id,e){e.stopPropagation();setSelecc(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})}
  function toggleTodos(){setSelecc(selecc.size===filtrados.length?new Set():new Set(filtrados.map(a=>a.id)))}
  function salirModo(){setModoSel(false);setSelecc(new Set())}

  function getPrecio(a,tipo){
    if(tipo==='precioVenta') return a.precio_venta_manual!=null?a.precio_venta_manual:(a.precios?.precioVenta||0)
    const map={costo:'costo',greguera:'greguera',balbi:'balbi',sucati:'sucati'}
    return a.precios?.[map[tipo]]||0
  }

  const PRECIO_LABELS={precioVenta:'Precio Venta',costo:'Costo',greguera:'G. Reguera',balbi:'Balbi',sucati:'Sucati'}

  async function obtenerToken(){
    return new Promise((resolve,reject)=>{
      if(gTokenRef.current&&Date.now()<gTokenRef.current.expiry){resolve(gTokenRef.current.token);return}
      const client=window.google.accounts.oauth2.initTokenClient({
        client_id:'51651260606-i84b1cun6hv8d87m31n6husdvvvrc5hr.apps.googleusercontent.com',
        scope:'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        callback:(resp)=>{
          if(resp.error){reject(resp.error);return}
          gTokenRef.current={token:resp.access_token,expiry:Date.now()+3500000}
          resolve(resp.access_token)
        }
      })
      client.requestAccessToken()
    })
  }

  async function exportarSeleccion(){
    const arts=articulos.filter(a=>selecc.has(a.id))
    if(!arts.length)return
    try{
      setExportando(true)
      const token=await obtenerToken()
      const label=PRECIO_LABELS[precioTipo]
      const fecha=new Date().toLocaleDateString('es-AR')
      const rows=[
        ['LAVALLE COMERCIAL S.R.L.'],
        [`Lista personalizada — ${temporada.nombre}`],
        [`Precio: ${label} — ${fecha}`],
        [],
        ['ARTÍCULO','DESCRIPCIÓN',label],
        []
      ]
      const grupos={}
      arts.forEach(a=>{const cat=a.categoria||'Sin categoría';if(!grupos[cat])grupos[cat]=[];grupos[cat].push(a)})
      const catRowIdxs=[]
      Object.keys(grupos).forEach(cat=>{
        rows.push([])
        catRowIdxs.push(rows.length-1)
        rows.push([cat.toUpperCase()])
        grupos[cat].forEach(a=>{
          const pv=Math.round(getPrecio(a,precioTipo))
          rows.push([a.codigo,a.descripcion||'',pv||0])
        })
      })
      const sheet=await crearPlanilla(token,`Lista ${label} — ${temporada.nombre} — ${fecha}`)
      const sid=sheet.spreadsheetId
      const sheetId=sheet.sheets[0].properties.sheetId
      const range=`A1:C${rows.length}`
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?valueInputOption=USER_ENTERED`,{
        method:'PUT',
        headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({range,majorDimension:'ROWS',values:rows})
      })
      const requests=[
        {deleteDimension:{range:{sheetId,dimension:'COLUMNS',startIndex:3,endIndex:26}}},
        {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:80},fields:'pixelSize'}},
        {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:1,endIndex:2},properties:{pixelSize:360},fields:'pixelSize'}},
        {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:2,endIndex:3},properties:{pixelSize:120},fields:'pixelSize'}},
        {repeatCell:{range:{sheetId,startRowIndex:4,endRowIndex:5},cell:{userEnteredFormat:{backgroundColor:{red:0.1,green:0.1,blue:0.09},textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}},
        {repeatCell:{range:{sheetId,startRowIndex:6,endRowIndex:rows.length,startColumnIndex:2,endColumnIndex:3},cell:{userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'"$"#,##0'}}},fields:'userEnteredFormat(numberFormat)'}},
      ]
      catRowIdxs.forEach(r=>{
        requests.push({repeatCell:{range:{sheetId,startRowIndex:r+1,endRowIndex:r+2},cell:{userEnteredFormat:{backgroundColor:{red:0.91,green:0.91,blue:0.89},textFormat:{bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}})
      })
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}:batchUpdate`,{
        method:'POST',
        headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({requests})
      })
      window.open(`https://docs.google.com/spreadsheets/d/${sid}`,'_blank')
      salirModo()
      setExportando(false)
    }catch(e){setExportando(false);alert('No se pudo exportar a Sheets.\n\n'+(e?.message||e))}
  }

  if(artOtraTemp)return(
    <div>
      <div style={{background:'#fffbeb',borderBottom:'1.5px solid #fbbf24',padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:13,color:'#92400e',fontWeight:600}}>
          👁️ Viendo un artículo de <b>{artOtraTemp.temporada.nombre}</b> — estás trabajando en {temporada.nombre}
        </span>
        <button onClick={()=>setArtOtraTemp(null)} className="btn btn-sm btn-outline" style={{borderColor:'#fbbf24',color:'#92400e'}}>← Volver a {temporada.nombre}</button>
      </div>
      <ArticuloDetalle key={artOtraTemp.art.id} art={artOtraTemp.art} temporada={artOtraTemp.temporada} config={artOtraTemp.config} onBack={()=>setArtOtraTemp(null)}/>
    </div>
  )

  // key: al saltar de un artículo a otro desde el buscador, React tiene que rearmar
  // la ficha entera. Sin esto quedaban el código, la descripción y la foto del
  // artículo anterior encima de los datos del nuevo.
  if(seleccionado)return <ArticuloDetalle key={seleccionado.id} art={seleccionado} temporada={temporada} config={config} onBack={()=>{setSeleccionado(null);cargar()}}/>

  return(
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Artículos</div>
          <div className="page-sub">
            {temporada.nombre} · {articulos.length} artículos
            {ultimoNumerico&&<span style={{marginLeft:10,color:'var(--azul)',fontWeight:700}}>· último código: {ultimoNumerico} → siguiente: {ultimoNumerico+1}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {!modoSel
            ?<><button className="btn btn-outline" onClick={()=>setModoSel(true)}>☑️ Seleccionar</button>
               <button className="btn btn-primary" onClick={()=>setModalNuevo(true)}>+ Nuevo artículo</button></>
            :<><button className="btn btn-outline" onClick={salirModo}>✕ Cancelar</button>
               <button className="btn btn-outline" onClick={toggleTodos} style={{fontSize:12}}>{selecc.size===filtrados.length?'Deseleccionar todos':'Seleccionar todos'}</button></>
          }
        </div>
      </div>

      {!loading&&incompletos.length>0&&(
        <div style={{marginBottom:16,border:'1.5px solid #fbbf24',borderRadius:10,overflow:'hidden'}}>
          <div onClick={()=>setVerIncompletos(v=>!v)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'#fffbeb',cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:16}}>⚠️</span>
              <span style={{fontWeight:700,fontSize:14,color:'#92400e'}}>Artículos incompletos</span>
              <span style={{background:'#fbbf24',color:'#fff',borderRadius:20,fontSize:11,fontWeight:700,padding:'2px 8px'}}>{incompletos.length}</span>
            </div>
            <span style={{color:'#92400e',fontSize:13}}>{verIncompletos?'▲ Ocultar':'▼ Ver'}</span>
          </div>
          {verIncompletos&&(
            <div style={{background:'#fff'}}>
              {incompletos.map((a,i)=>{
                const {sinTelas,telaCero,sinConf,sinFoto}=esIncompleto(a)
                const motivos=[]
                if(sinTelas)motivos.push('sin tela')
                if(telaCero)motivos.push('cantidad de tela en 0')
                if(sinConf)motivos.push('sin confección')
                if(sinFoto)motivos.push('sin foto')
                return(
                  <div key={a.id} onClick={()=>setSeleccionado(a)}
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderTop:'1px solid #fde68a',cursor:'pointer',background:i%2===0?'#fffdf5':'#fff'}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:14}}>{a.codigo}</span>
                      <span style={{fontSize:13,color:'var(--text2)',marginLeft:10}}>{a.descripcion}</span>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      {motivos.map(m=><span key={m} style={{fontSize:11,background:'#fef3c7',color:'#92400e',padding:'2px 8px',borderRadius:20,fontWeight:600}}>{m}</span>)}
                      <span style={{color:'var(--azul)',fontSize:16}}>›</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div style={{marginBottom:16}}>
        <input className="form-input" placeholder="🔍 Buscar por código o descripción..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
        {buscandoGlobal&&<div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>Buscando en todas las temporadas...</div>}
        {resultadosOtros.length>0&&(
          <div style={{marginTop:10,border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
            {resultadosOtros.map(({temporada:t,articulos:arts})=>(
              <div key={t.id}>
                <div style={{padding:'8px 12px',background:'var(--surface2)',fontSize:12,fontWeight:700,color:'var(--text2)',borderBottom:'1px solid var(--border)'}}>
                  📅 {t.nombre} — {arts.length} resultado{arts.length!==1?'s':''}
                </div>
                {arts.map(a=>(
                  <div key={a.id} onClick={()=>abrirArtOtraTemp(a,t)}
                    style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <div>
                      <span style={{fontWeight:700,marginRight:8}}>{a.codigo}</span>
                      <span style={{fontSize:13,color:'var(--text2)'}}>{a.descripcion}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:11,background:'var(--azul-bg)',color:'var(--azul)',padding:'2px 8px',borderRadius:10,fontWeight:600}}>{t.nombre}</span>
                      <span style={{color:'var(--azul)',fontSize:16}}>›</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {loading?<div className="loading">⏳ Cargando...</div>:filtrados.length===0?(
        <div className="empty">
          <div className="empty-icon">📦</div>
          <div className="empty-title">{busqueda?'Sin resultados':'Sin artículos todavía'}</div>
          {!busqueda&&<button className="btn btn-primary" style={{marginTop:16}} onClick={()=>setModalNuevo(true)}>+ Crear primer artículo</button>}
        </div>
      ):(
        <div className="card" style={{overflow:'hidden'}}>
          <table>
            <thead><tr>
              {modoSel&&<th style={{width:36,textAlign:'center'}}><input type="checkbox" checked={selecc.size===filtrados.length&&filtrados.length>0} onChange={toggleTodos}/></th>}
              <th>Artículo</th>
              <th style={{textAlign:'right'}}>Costo</th>
              <th style={{textAlign:'right'}}>Precio Venta<div className="pct-tag">@{config?.margen_propio??config?.margen_greguera??100}%</div></th>
              <th style={{textAlign:'right'}}>G. Reguera<div className="pct-tag">@{config?.margen_greguera??100}%</div></th>
              <th style={{textAlign:'right'}}>Balbi<div className="pct-tag">@{config?.margen_balbi??50}%</div></th>
              <th style={{textAlign:'right'}}>Sucati<div className="pct-tag">-{config?.descuento_sucati??15}%</div></th>
              <th></th>
            </tr></thead>
            <tbody>
              {filtrados.map(a=>(
                <tr key={a.id} style={{cursor:'pointer',background:selecc.has(a.id)?'var(--azul-bg)':undefined}} onClick={()=>modoSel?toggleSel(a.id,{stopPropagation:()=>{}}):setSeleccionado(a)}>
                  {modoSel&&<td style={{textAlign:'center'}} onClick={e=>toggleSel(a.id,e)}><input type="checkbox" checked={selecc.has(a.id)} onChange={()=>{}}/></td>}
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      {a.foto_url
                        ?<img src={a.foto_url} alt="" style={{width:40,height:40,borderRadius:6,objectFit:'cover'}}/>
                        :<div style={{width:40,height:40,borderRadius:6,background:'var(--surface2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>👕</div>
                      }
                      <div>
                        <div style={{fontWeight:700}}>{a.codigo}</div>
                        <div style={{fontSize:12,color:'var(--text2)'}}>{a.descripcion}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{textAlign:'right'}}>
                    <span className="precio-costo">{fmt(a.precios?.costo)}</span>
                    {a.detalle?.telas?.length>0&&(
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
                        {a.detalle.telas.map(t=>`${t.cantidad} ${t.precios_tela?.unidad||'kg'}`).join(' + ')}
                      </div>
                    )}
                  </td>
                  <td style={{textAlign:'right'}}><span className="precio-venta">{fmt(a.precios?.precioVenta)}</span></td>
                  <td style={{textAlign:'right'}}><span className="precio-greguera">{fmt(a.precios?.greguera)}</span></td>
                  <td style={{textAlign:'right'}}><span className="precio-balbi">{fmt(a.precios?.balbi)}</span></td>
                  <td style={{textAlign:'right'}}><span className="precio-sucati">{fmt(a.precios?.sucati)}</span></td>
                  <td><span style={{color:'var(--azul)',fontSize:18}}>›</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modoSel&&selecc.size>0&&(
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'var(--text1)',padding:'14px 20px',display:'flex',alignItems:'center',gap:12,zIndex:100,boxShadow:'0 -4px 20px rgba(0,0,0,0.2)'}}>
          <span style={{color:'#fff',fontWeight:700,fontSize:15,flex:1}}>{selecc.size} artículo{selecc.size!==1?'s':''} seleccionado{selecc.size!==1?'s':''}</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <label style={{color:'#aaa',fontSize:13}}>Precio:</label>
            <select value={precioTipo} onChange={e=>setPrecioTipo(e.target.value)}
              style={{padding:'6px 10px',borderRadius:8,border:'none',fontSize:14,fontWeight:600,background:'#333',color:'#fff'}}>
              <option value="precioVenta">Precio Venta</option>
              <option value="costo">Costo</option>
              <option value="greguera">G. Reguera</option>
              <option value="balbi">Balbi</option>
              <option value="sucati">Sucati</option>
            </select>
          </div>
          <button onClick={exportarSeleccion} disabled={exportando}
            style={{background:'#4ade80',color:'#000',border:'none',borderRadius:8,padding:'10px 18px',fontWeight:700,fontSize:14,cursor:'pointer'}}>
            {exportando?'Creando...':'📊 Exportar a Sheets'}
          </button>
        </div>
      )}

      {modalNuevo&&<ModalNuevoArt temporada={temporada} articulos={articulos} onClose={()=>setModalNuevo(false)} onSave={()=>{setModalNuevo(false);cargar();onTemporadaCambio&&onTemporadaCambio()}}/>}
    </div>
  )
}
