import React, { useState } from 'react'
import { sb, fmt, calcPrecios, detectarEstacion, composicionDeTemporada } from '../lib/nucleo.js'

export function ComparadorPage({temporada,config,todasTemporadas}){
  const[compararCon,setCompararCon]=useState('')
  const[datos,setDatos]=useState([])
  const[loading,setLoading]=useState(false)
  const[busqueda,setBusqueda]=useState('')
  const candidatas=(todasTemporadas||[]).filter(t=>t.id!==temporada.id&&detectarEstacion(t.nombre)===detectarEstacion(temporada.nombre))

  async function cargarComparacion(otraId){
    if(!otraId){setDatos([]);return}
    setLoading(true)
    const{data:cfgOtra}=await sb.schema('costos').from('config').select('*').eq('temporada_id',otraId).limit(1)
    const configOtra=cfgOtra?.[0]||config
    const cargarTemp=async(tempId,cfg)=>{
      const{data:arts}=await sb.schema('costos').from('articulos').select('*').eq('temporada_id',tempId)
      if(!(arts||[]).length)return{}
      const[{data:t},{data:a},{data:p}]=await Promise.all([
        composicionDeTemporada('articulo_telas','precios_tela',tempId),
        composicionDeTemporada('articulo_avios','precios_avios',tempId),
        composicionDeTemporada('articulo_percha','precios_perchas',tempId),
      ])
      const mT={},mA={},mP={}
      ;(t||[]).forEach(x=>{(mT[x.articulo_id]=mT[x.articulo_id]||[]).push(x)})
      ;(a||[]).forEach(x=>{(mA[x.articulo_id]=mA[x.articulo_id]||[]).push(x)})
      ;(p||[]).forEach(x=>{(mP[x.articulo_id]=mP[x.articulo_id]||[]).push(x)})
      const out={}
      ;(arts||[]).forEach(art=>{
        const det={telas:mT[art.id]||[],avios:mA[art.id]||[],percha:mP[art.id]||[]}
        out[art.codigo]={...art,precios:calcPrecios(det,art.confeccion,cfg)}
      })
      return out
    }
    const[actual,otra]=await Promise.all([cargarTemp(temporada.id,config),cargarTemp(otraId,configOtra)])
    const codigos=[...new Set([...Object.keys(actual),...Object.keys(otra)])].sort()
    const filas=codigos.map(cod=>{
      const a=actual[cod],o=otra[cod]
      // ?? y no ||: un artículo cargado con costo 0 existe, no es "no existe"
      const costoA=a?.precios?.costo??null, costoO=o?.precios?.costo??null
      const varia=(costoA!=null&&costoO!=null&&costoO!==0)?((costoA-costoO)/costoO*100):null
      return{codigo:cod,descripcion:a?.descripcion||o?.descripcion||'',costoActual:costoA,costoOtra:costoO,varia}
    })
    setDatos(filas)
    setLoading(false)
  }

  const nombreOtra=candidatas.find(t=>t.id===compararCon)?.nombre||''
  const filtrados=datos.filter(d=>!busqueda||d.codigo.toLowerCase().includes(busqueda.toLowerCase())||d.descripcion.toLowerCase().includes(busqueda.toLowerCase()))

  return(
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">📊 Comparar temporadas</div><div className="page-sub">{temporada.nombre}</div></div>
      </div>
      {candidatas.length===0?(
        <div className="empty"><div className="empty-title">No hay otra temporada de la misma estación para comparar</div></div>
      ):(
        <>
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
            <label style={{fontSize:14,color:'var(--text2)'}}>Comparar con:</label>
            <select className="form-input" style={{width:220}} value={compararCon} onChange={e=>{setCompararCon(e.target.value);cargarComparacion(e.target.value)}}>
              <option value="">Elegir temporada...</option>
              {candidatas.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          {compararCon&&<input className="form-input" placeholder="🔍 Buscar código o descripción..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{marginBottom:16}}/>}
          {loading?<div className="loading">⏳ Calculando...</div>:datos.length>0&&(
            <div className="card" style={{overflow:'hidden'}}>
              <table>
                <thead><tr>
                  <th>Artículo</th>
                  <th style={{textAlign:'right'}}>{nombreOtra}</th>
                  <th style={{textAlign:'right'}}>{temporada.nombre}</th>
                  <th style={{textAlign:'right'}}>Variación</th>
                </tr></thead>
                <tbody>
                  {filtrados.map(d=>(
                    <tr key={d.codigo}>
                      <td><div style={{fontWeight:700}}>{d.codigo}</div><div style={{fontSize:12,color:'var(--text2)'}}>{d.descripcion}</div></td>
                      <td style={{textAlign:'right',color:'var(--text2)'}}>{d.costoOtra!=null?fmt(d.costoOtra):<span style={{color:'var(--text3)',fontSize:12}}>no existe</span>}</td>
                      <td style={{textAlign:'right',fontWeight:700}}>{d.costoActual!=null?fmt(d.costoActual):<span style={{color:'var(--text3)',fontSize:12}}>no existe</span>}</td>
                      <td style={{textAlign:'right'}}>
                        {d.varia!==null
                          ?<span style={{fontWeight:800,color:d.varia>0?'#dc2626':d.varia<0?'#16a34a':'var(--text3)'}}>
                            {d.varia>0?'+':''}{d.varia.toFixed(1)}%
                          </span>
                          :<span style={{color:'var(--text3)'}}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
