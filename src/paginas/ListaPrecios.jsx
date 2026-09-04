import React, { useState, useEffect } from 'react'
import { sb, fmt, guardar, getArticulos, composicionDeTemporada, calcPrecios, crearPlanilla, CATEGORIAS, detectarCategoria } from '../lib/nucleo.js'

export function ListaPreciosPage({temporada,config}){
  const[articulos,setArticulos]=useState([])
  const[loading,setLoading]=useState(true)
  const[editandoId,setEditandoId]=useState(null)
  const[editandoCat,setEditandoCatId]=useState(null)
  const[busqueda,setBusqueda]=useState('')
  const[subiendo,setSubiendo]=useState(false)
  const gTokenRef=React.useRef(null)

  useEffect(()=>{cargar()},[temporada.id])

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

  async function exportarSheets(){
    try{
      // Verificar precios pendientes
      const[{data:tp},{data:ap}]=await Promise.all([
        sb.schema('costos').from('precios_tela').select('id').eq('temporada_id',temporada.id).eq('actualizado',false),
        sb.schema('costos').from('precios_avios').select('id').eq('temporada_id',temporada.id).eq('actualizado',false),
      ])
      const pendTelas=(tp||[]).length, pendAvios=(ap||[]).length
      if(pendTelas+pendAvios>0){
        const msg=`⚠️ Hay precios sin actualizar en esta temporada:\n\n`+
          (pendTelas?`• ${pendTelas} tela${pendTelas!==1?'s':''}\n`:'')+
          (pendAvios?`• ${pendAvios} avío${pendAvios!==1?'s':''}\n`:'')+
          `\nLos costos pueden estar desactualizados. ¿Exportar igual?`
        if(!confirm(msg))return
      }
      setSubiendo(true)
      const token=await obtenerToken()
      const grupos2={}
      articulos.forEach(a=>{const cat=a.categoria||'Sin categoría';if(!grupos2[cat])grupos2[cat]=[];grupos2[cat].push(a)})
      const todas=[...[...CATEGORIAS,'Sin categoría'].filter(c=>grupos2[c]),...Object.keys(grupos2).filter(c=>![...CATEGORIAS,'Sin categoría'].includes(c))]
      const rows=[
        ['LAVALLE COMERCIAL S.R.L.'],
        ['Ecuador 425 - Cap. Fed.'],
        ['Tel / fax: 4865-0192'],
        [`LISTA DE PRECIOS ${temporada.nombre.toUpperCase()}`],
        [new Date().toLocaleDateString('es-AR')],
        [],
        ['ARTÍCULO','DESCRIPCIÓN','PRECIO','-10%','-17%'],
        []
      ]
      const catRowIdxs=[]
      todas.forEach(cat=>{
        rows.push([])
        catRowIdxs.push(rows.length-1)
        rows.push([cat.toUpperCase()])
        grupos2[cat].forEach(a=>{
          const pv=a.precio_venta_manual!=null?a.precio_venta_manual:(a.precios?.precioVenta||0)
          rows.push([a.codigo,a.descripcion||'',pv||0,Math.round((pv||0)*0.9)||0,Math.round((pv||0)*0.83)||0])
        })
      })
      const sheet=await crearPlanilla(token,`Lista de Precios — ${temporada.nombre} — ${new Date().toLocaleDateString('es-AR')}`)
      const sid=sheet.spreadsheetId
      const sheetId=sheet.sheets[0].properties.sheetId
      const range=`A1:E${rows.length}`
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${range}?valueInputOption=USER_ENTERED`,{
        method:'PUT',
        headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({range,majorDimension:'ROWS',values:rows})
      })
      const requests=[
        // Eliminar todas las columnas después de la E para que imprima limpio
        {deleteDimension:{range:{sheetId,dimension:'COLUMNS',startIndex:5,endIndex:26}}},
        // Anchos de columna
        {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:80},fields:'pixelSize'}},
        {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:1,endIndex:2},properties:{pixelSize:320},fields:'pixelSize'}},
        {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:2,endIndex:5},properties:{pixelSize:110},fields:'pixelSize'}},
        // Encabezado oscuro (fila 7, índice 6)
        {repeatCell:{range:{sheetId,startRowIndex:6,endRowIndex:7},cell:{userEnteredFormat:{backgroundColor:{red:0.1,green:0.1,blue:0.09},textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}},
        // Título bold
        {repeatCell:{range:{sheetId,startRowIndex:3,endRowIndex:4},cell:{userEnteredFormat:{textFormat:{bold:true,fontSize:12}}},fields:'userEnteredFormat(textFormat)'}},
        // Formato $ en columnas C, D, E (índices 2,3,4)
        {repeatCell:{range:{sheetId,startRowIndex:8,endRowIndex:rows.length,startColumnIndex:2,endColumnIndex:5},
          cell:{userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'"$"#,##0'}}},
          fields:'userEnteredFormat(numberFormat)'}},
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
      setSubiendo(false)
    }catch(e){
      setSubiendo(false)
      alert('No se pudo exportar a Sheets.\n\n'+(e?.message||e))
    }
  }

  async function cargar(){
    setLoading(true)
    const arts=await getArticulos(temporada.id)
    const[{data:telas},{data:avios},{data:perchas}]=await Promise.all([
      composicionDeTemporada('articulo_telas','precios_tela',temporada.id),
      composicionDeTemporada('articulo_avios','precios_avios',temporada.id),
      composicionDeTemporada('articulo_percha','precios_perchas',temporada.id),
    ])
    const mapTelas={},mapAvios={},mapPercha={}
    ;(telas||[]).forEach(t=>{(mapTelas[t.articulo_id]=mapTelas[t.articulo_id]||[]).push(t)})
    ;(avios||[]).forEach(a=>{(mapAvios[a.articulo_id]=mapAvios[a.articulo_id]||[]).push(a)})
    ;(perchas||[]).forEach(p=>{(mapPercha[p.articulo_id]=mapPercha[p.articulo_id]||[]).push(p)})
    const con=arts.map(a=>{
      const det={telas:mapTelas[a.id]||[],avios:mapAvios[a.id]||[],percha:mapPercha[a.id]||[]}
      return{...a,detalle:det,precios:calcPrecios(det,a.confeccion,config)}
    })
    const sinCat=con.filter(a=>!a.categoria)
    if(sinCat.length){
      await Promise.all(sinCat.map(a=>{
        const cat=detectarCategoria(a.descripcion)
        return sb.schema('costos').from('articulos').update({categoria:cat}).eq('id',a.id)
      }))
      sinCat.forEach(a=>{a.categoria=detectarCategoria(a.descripcion)})
    }
    setArticulos(con)
    setLoading(false)
  }

  async function guardarPrecio(id,valor){
    const v=valor===''?null:Number(valor)
    if(!await guardar(sb.schema('costos').from('articulos').update({precio_venta_manual:v}).eq('id',id),'el precio de venta'))return
    setArticulos(arts=>arts.map(a=>a.id===id?{...a,precio_venta_manual:v}:a))
    setEditandoId(null)
  }

  async function guardarCategoria(id,cat){
    if(!await guardar(sb.schema('costos').from('articulos').update({categoria:cat}).eq('id',id),'la categoría'))return
    setArticulos(arts=>arts.map(a=>a.id===id?{...a,categoria:cat}:a))
    setEditandoCatId(null)
  }

  async function exportarExcel(){
    // Se carga recién acá: son 1,1 MB que no tiene sentido bajar si nunca
    // se exporta a Excel.
    const{default:ExcelJS}=await import('exceljs')
    const wb=new ExcelJS.Workbook()
    wb.creator='Criterio Costos'
    wb.created=new Date()
    const ws=wb.addWorksheet('Lista de Precios')

    // Anchos de columna: A vacía, B código, C descripción, D-F vacías, G precio, H -10%, I -17%
    ws.columns=[
      {width:3},{width:11},{width:44},{width:4},{width:4},{width:4},{width:13},{width:13},{width:13}
    ]

    const addRow=(vals,opts={})=>{
      const r=ws.addRow(vals)
      if(opts.bold)r.font={bold:true,size:opts.size||11}
      if(opts.size&&!opts.bold)r.font={size:opts.size}
      if(opts.bg){
        r.eachCell({includeEmpty:true},(cell)=>{
          cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:opts.bg}}
        })
      }
      if(opts.border){
        r.eachCell({includeEmpty:false},(cell)=>{
          cell.border={bottom:{style:'thin',color:{argb:'FFB0B0B0'}}}
        })
      }
      if(opts.align){
        r.eachCell({includeEmpty:false},(cell,col)=>{
          cell.alignment={horizontal:col>=7?'right':'left',vertical:'middle'}
        })
      }
      return r
    }

    // Header empresa
    addRow([null,'LAVALLE COMERCIAL S.R.L.']).font={bold:true,size:13}
    addRow([null,'Ecuador 425- Cap. Fed. (2412)']).font={size:10,color:{argb:'FF444444'}}
    addRow([null,'Tel / fax: 4865-0192']).font={size:10,color:{argb:'FF444444'}}
    addRow([null,'E-mail: lavallecom@hotmail.com']).font={size:10,color:{argb:'FF444444'}}
    const titleRow=ws.addRow([null,`LISTA DE PRECIOS ${temporada.nombre.toUpperCase()}`])
    titleRow.font={bold:true,size:12}
    ws.addRow([null,new Date().toLocaleDateString('es-AR')]).font={size:10,color:{argb:'FF666666'}}
    ws.addRow([])

    const border={top:{style:'thin',color:{argb:'FFB0B0B0'}},left:{style:'thin',color:{argb:'FFB0B0B0'}},bottom:{style:'thin',color:{argb:'FFB0B0B0'}},right:{style:'thin',color:{argb:'FFB0B0B0'}}}
    const borderBold={top:{style:'medium',color:{argb:'FF555555'}},left:{style:'medium',color:{argb:'FF555555'}},bottom:{style:'medium',color:{argb:'FF555555'}},right:{style:'medium',color:{argb:'FF555555'}}}

    // Encabezados de columnas
    const hRow=ws.addRow([null,'ARTÍCULO','DESCRIPCIÓN',null,null,null,'PRECIO','-10%','-17%'])
    hRow.font={bold:true,size:11}
    hRow.eachCell({includeEmpty:true},(cell,col)=>{
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A18'}}
      cell.font={bold:true,color:{argb:'FFFFFFFF'},size:11}
      cell.alignment={horizontal:col>=7?'right':'left',vertical:'middle'}
      cell.border=borderBold
    })
    hRow.height=22
    ws.addRow([])

    // Grupos
    const grupos2={}
    articulos.forEach(a=>{const cat=a.categoria||'Sin categoría';if(!grupos2[cat])grupos2[cat]=[];grupos2[cat].push(a)})
    const todas=[...[...CATEGORIAS,'Sin categoría'].filter(c=>grupos2[c]),...Object.keys(grupos2).filter(c=>![...CATEGORIAS,'Sin categoría'].includes(c))]

    todas.forEach(cat=>{
      ws.addRow([])
      const catRow=ws.addRow([null,cat.toUpperCase()])
      catRow.font={bold:true,size:11,color:{argb:'FF1A1A18'}}
      catRow.height=18
      catRow.eachCell({includeEmpty:true},(cell)=>{
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8E8E4'}}
        cell.border=borderBold
      })

      grupos2[cat].forEach((a,i)=>{
        const pv=a.precio_venta_manual!=null?a.precio_venta_manual:(a.precios?.precioVenta||0)
        const gr=Math.round(pv*0.9)
        const su=Math.round(pv*0.83)
        const dRow=ws.addRow([null,a.codigo,a.descripcion||'',null,null,null,pv||null,gr||null,su||null])
        dRow.height=16
        if(i%2===1){
          dRow.eachCell({includeEmpty:true},(cell)=>{
            cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F7F5'}}
          })
        }
        dRow.eachCell({includeEmpty:true},(cell)=>{cell.border=border})
        ;[7,8,9].forEach(c=>{
          const cell=dRow.getCell(c)
          cell.alignment={horizontal:'right'}
          if(cell.value) cell.numFmt='#,##0'
        })
        dRow.getCell(2).font={bold:true}
      })
    })

    // Descargar
    const buffer=await wb.xlsx.writeBuffer()
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url
    a.download=`Lista_${temporada.nombre.replace(/ /g,'_')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtrados=articulos.filter(a=>!busqueda||a.codigo.toLowerCase().includes(busqueda.toLowerCase())||(a.descripcion||'').toLowerCase().includes(busqueda.toLowerCase()))
  const grupos={}
  filtrados.forEach(a=>{const cat=a.categoria||'Sin categoría';if(!grupos[cat])grupos[cat]=[];grupos[cat].push(a)})
  const catsOrdenadas=[...[...CATEGORIAS,'Sin categoría'].filter(c=>grupos[c]),...Object.keys(grupos).filter(c=>![...CATEGORIAS,'Sin categoría'].includes(c))]

  return(
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">🏷️ Lista de Precios</div><div className="page-sub">{temporada.nombre} · {articulos.length} artículos</div></div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-outline" onClick={exportarExcel}>⬇️ Excel</button>
          <button className="btn btn-primary" onClick={exportarSheets} disabled={subiendo}>{subiendo?'Creando...':'📊 Exportar a Sheets'}</button>
        </div>
      </div>
      <input className="form-input" placeholder="🔍 Buscar código o descripción..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{marginBottom:16}}/>
      {loading?<div className="loading">⏳ Cargando...</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          {catsOrdenadas.map(cat=>(
            <div key={cat} className="card" style={{overflow:'hidden'}}>
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:'.5px',color:'var(--text2)',background:'var(--surface2)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>{cat}</span><span style={{fontWeight:400,fontSize:12}}>{grupos[cat].length} art.</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th style={{padding:'8px 12px',fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',textAlign:'left',borderBottom:'1px solid var(--border)'}}>Art.</th>
                  <th style={{padding:'8px 12px',fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',textAlign:'left',borderBottom:'1px solid var(--border)'}}>Descripción</th>
                  <th style={{padding:'8px 12px',fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',textAlign:'left',borderBottom:'1px solid var(--border)'}}>Categoría</th>
                  <th style={{padding:'8px 12px',fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',textAlign:'right',borderBottom:'1px solid var(--border)'}}>Precio Venta</th>
                </tr></thead>
                <tbody>
                  {grupos[cat].map(a=>{
                    const pvCalc=a.precios?.precioVenta
                    const pvFinal=a.precio_venta_manual!=null?a.precio_venta_manual:pvCalc
                    const esManual=a.precio_venta_manual!=null
                    return(
                      <tr key={a.id} style={{borderBottom:'1px solid var(--border)'}}>
                        <td style={{padding:'10px 12px',fontWeight:700,fontSize:14}}>{a.codigo}</td>
                        <td style={{padding:'10px 12px',fontSize:13,color:'var(--text2)'}}>{a.descripcion}</td>
                        <td style={{padding:'10px 12px'}}>
                          {editandoCat===a.id?(
                            <select autoFocus className="form-input" style={{padding:'4px 8px',fontSize:12}}
                              defaultValue={a.categoria||''}
                              onChange={e=>guardarCategoria(a.id,e.target.value)}
                              onBlur={()=>setEditandoCatId(null)}>
                              <option value="">Sin categoría</option>
                              {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                          ):(
                            <span onClick={()=>setEditandoCatId(a.id)} style={{fontSize:12,color:a.categoria?'var(--text2)':'var(--text3)',cursor:'pointer',padding:'3px 8px',borderRadius:6,border:'1px dashed var(--border)',display:'inline-block'}}>
                              {a.categoria||'+ categoría'}
                            </span>
                          )}
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right'}}>
                          {editandoId===a.id?(
                            <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                              <input type="number" autoFocus defaultValue={pvFinal||''} onBlur={e=>guardarPrecio(a.id,e.target.value)}
                                style={{width:100,padding:'5px 8px',border:'1.5px solid var(--azul)',borderRadius:6,fontSize:13,fontWeight:700,textAlign:'right'}}/>
                              {esManual&&<button className="btn-icon" onClick={()=>guardarPrecio(a.id,'')}>↺</button>}
                            </div>
                          ):(
                            <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                              <span className="precio-venta" style={{fontSize:16,cursor:'pointer'}} onClick={()=>setEditandoId(a.id)}>{fmt(pvFinal)}</span>
                              {esManual&&<span style={{fontSize:10,background:'var(--violeta-bg)',color:'var(--violeta)',padding:'2px 6px',borderRadius:10,fontWeight:700}}>manual</span>}
                              <button className="btn-icon" onClick={()=>setEditandoId(a.id)}>✏️</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {catsOrdenadas.length===0&&<div className="empty"><div className="empty-title">Sin artículos cargados todavía</div></div>}
        </div>
      )}
    </div>
  )
}
