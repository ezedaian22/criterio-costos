import React from 'react'
import { fmt, round500 } from '../lib/nucleo.js'

export function SimuladorModal({det,conf,config,codigo,onClose}){
  const{useState:us,useMemo:um}=React
  // Copia editable de los valores reales
  const[telas,setTelas]=us(()=>(det.telas||[]).map(t=>({
    id:t.id,nombre:t.precios_tela?.nombre||'',
    precio:t.precios_tela?.precio||0,
    cantidad:t.cantidad,
    unidad:t.precios_tela?.unidad||'kg'
  })))
  const[avios,setAvios]=us(()=>(det.avios||[]).map(a=>({
    id:a.id,nombre:a.precios_avios?.nombre||'',
    precio:a.precios_avios?.precio||0,
    cantidad:a.cantidad
  })))
  const[percha]=us(()=>(det.percha||[]).map(p=>({
    nombre:p.precios_perchas?.nombre||'',
    precio:p.precios_perchas?.precio||0
  })))
  const[confSim,setConf]=us(conf||0)
  const[corteSim,setCorte]=us(config?.precio_corte||0)

  const precios=um(()=>{
    const t=telas.reduce((s,t)=>s+(Number(t.cantidad)||0)*(Number(t.precio)||0),0)
    const a=avios.reduce((s,a)=>s+(Number(a.cantidad)||0)*(Number(a.precio)||0),0)
    const p=percha.reduce((s,p)=>s+(Number(p.precio)||0),0)
    const costo=t+a+p+(Number(corteSim)||0)+(Number(confSim)||0)
    const gr=(config?.margen_greguera??100)/100
    const ba=(config?.margen_balbi??50)/100
    const su=(config?.descuento_sucati??15)/100
    const pv=(config?.margen_propio??config?.margen_greguera??100)/100
    return{costo,greguera:costo*(1+gr),balbi:costo*(1+ba),sucati:costo*(1+gr)*(1-su),precioVenta:round500(costo*(1+pv))}
  },[telas,avios,confSim,corteSim])

  const setTela=(idx,key,val)=>setTelas(prev=>prev.map((t,i)=>i===idx?{...t,[key]:val}:t))
  const setAvio=(idx,key,val)=>setAvios(prev=>prev.map((a,i)=>i===idx?{...a,[key]:val}:a))

  return(
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'var(--bg)',borderRadius:14,width:'100%',maxWidth:680,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>

        {/* Header fijo */}
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--violeta-bg)',borderRadius:'14px 14px 0 0'}}>
          <div style={{fontWeight:800,fontSize:16,color:'var(--violeta)'}}>🧪 Simulador — {codigo}</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--text2)'}}>×</button>
        </div>

        {/* Tarjetas de precios fijas */}
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',background:'#fff'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:8}}>
            {[
              {l:'Costo',v:precios.costo,c:'#1a1a18'},
              {l:'Precio Venta',v:precios.precioVenta,c:'#7c3aed'},
              {l:'G. Reguera',v:precios.greguera,c:'#2563eb'},
              {l:'Balbi',v:precios.balbi,c:'#16a34a'},
              {l:'Sucati',v:precios.sucati,c:'#d97706'},
            ].map(p=>(
              <div key={p.l} style={{background:'var(--surface2)',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>{p.l}</div>
                <div style={{fontSize:17,fontWeight:800,color:p.c}}>{fmt(p.v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contenido scrollable */}
        <div style={{flex:1,minHeight:0,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>

          {/* Telas */}
          <div className="card" style={{overflow:'visible',flexShrink:0}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:13,background:'var(--surface2)'}}>🧵 Telas</div>
            {telas.map((t,i)=>(
              <div key={t.id} style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',gap:12,alignItems:'center',flexShrink:0,minHeight:60}}>
                <div style={{flex:2,fontWeight:600,fontSize:13}}>{t.nombre}<span style={{color:'var(--text3)',fontWeight:400,fontSize:11,marginLeft:4}}>({t.unidad})</span></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>Precio/{t.unidad}</div>
                  <input type="number" value={t.precio===0?'0':t.precio} onChange={e=>setTela(i,'precio',e.target.value)}
                    style={{width:'100%',padding:'6px 8px',border:'2px solid #7c3aed',borderRadius:6,fontSize:13,fontWeight:700,background:'white',display:'block'}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>Cantidad</div>
                  <input type="number" value={t.cantidad===0?'0':t.cantidad} onChange={e=>setTela(i,'cantidad',e.target.value)}
                    style={{width:'100%',padding:'6px 8px',border:'2px solid #7c3aed',borderRadius:6,fontSize:13,fontWeight:700,background:'white',display:'block'}}/>
                </div>
                <div style={{width:80,textAlign:'right',fontWeight:800,fontSize:14}}>{fmt((Number(t.cantidad)||0)*(Number(t.precio)||0))}</div>
              </div>
            ))}
            {telas.length===0&&<div style={{padding:12,textAlign:'center',color:'var(--text3)',fontSize:13}}>Sin telas</div>}
          </div>

          {/* Avíos */}
          <div className="card" style={{overflow:'visible',flexShrink:0}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:13,background:'var(--surface2)'}}>🪡 Avíos</div>
            {avios.map((a,i)=>(
              <div key={a.id} style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',gap:12,alignItems:'center',flexShrink:0,minHeight:60}}>
                <div style={{flex:2,fontWeight:600,fontSize:13}}>{a.nombre}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>Precio/u</div>
                  <input type="number" value={a.precio===0?'0':a.precio} onChange={e=>setAvio(i,'precio',e.target.value)}
                    style={{width:'100%',padding:'6px 8px',border:'2px solid #7c3aed',borderRadius:6,fontSize:13,fontWeight:700,background:'white',display:'block'}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>Cantidad</div>
                  <input type="number" value={a.cantidad===0?'0':a.cantidad} onChange={e=>setAvio(i,'cantidad',e.target.value)}
                    style={{width:'100%',padding:'6px 8px',border:'2px solid #7c3aed',borderRadius:6,fontSize:13,fontWeight:700,background:'white',display:'block'}}/>
                </div>
                <div style={{width:80,textAlign:'right',fontWeight:800,fontSize:14}}>{fmt((Number(a.cantidad)||0)*(Number(a.precio)||0))}</div>
              </div>
            ))}
            {avios.length===0&&<div style={{padding:12,textAlign:'center',color:'var(--text3)',fontSize:13}}>Sin avíos</div>}
          </div>

          {/* Producción */}
          <div className="card" style={{overflow:'visible',flexShrink:0}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:13,background:'var(--surface2)'}}>✂️ Producción</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'12px 14px'}}>
              <div>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:4,fontWeight:600}}>CORTE ($)</div>
                <input type="number" value={corteSim} onChange={e=>setCorte(e.target.value)}
                  style={{width:'100%',padding:'8px 10px',border:'1.5px solid var(--violeta)',borderRadius:8,fontSize:14,fontWeight:700}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:4,fontWeight:600}}>CONFECCIÓN ($)</div>
                <input type="number" value={confSim} onChange={e=>setConf(e.target.value)}
                  style={{width:'100%',padding:'8px 10px',border:'1.5px solid var(--violeta)',borderRadius:8,fontSize:14,fontWeight:700}}/>
              </div>
            </div>
            {percha.length>0&&(
              <div style={{padding:'0 14px 12px',color:'var(--text2)',fontSize:13}}>
                🧲 {percha[0].nombre}: {fmt(percha[0].precio)} <span style={{color:'var(--text3)',fontSize:11}}>(fijo)</span>
              </div>
            )}
          </div>

          <div style={{textAlign:'center',color:'var(--text3)',fontSize:12,paddingBottom:8}}>Los cambios no se guardan — es solo una simulación</div>
        </div>
      </div>
    </div>
  )
}
