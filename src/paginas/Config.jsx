import React, { useState } from 'react'
import { sb, fmt, guardar, round500, getTemporadas, detectarEstacion } from '../lib/nucleo.js'
import { ModalNuevaTemp } from '../componentes.jsx'

export function ConfigPage({temporada,config,onSave,temporadas,onTemporadas,onTemporadaCambio}){
  const[form,setForm]=useState({precio_corte:config?.precio_corte||400,margen_greguera:config?.margen_greguera||100,margen_balbi:config?.margen_balbi||50,descuento_sucati:config?.descuento_sucati||15,margen_propio:config?.margen_propio??config?.margen_greguera??100})
  const[ultimoCod,setUltimoCod]=useState(temporada.ultimo_codigo!=null?String(temporada.ultimo_codigo):'')
  const[guardando,setGuardando]=useState(false)
  const[ok,setOk]=useState(false)
  const[mTemp,setMTemp]=useState(false)
  const[pctConf,setPctConf]=useState('')
  const[aplicandoConf,setAplicandoConf]=useState(false)
  const[cerrada,setCerrada]=useState(temporada.cerrada||false)

  async function guardarConfig(){
    setGuardando(true)
    const n=ultimoCod.trim()===''?null:parseInt(ultimoCod.trim(),10)
    if(!await guardar(sb.schema('costos').from('temporadas').update({ultimo_codigo:isNaN(n)?null:n}).eq('id',temporada.id),'el último código')){
      setGuardando(false);return
    }
    if(config){
      const{data,error}=await sb.schema('costos').from('config').update(form).eq('id',config.id).select().single()
      if(error){setGuardando(false);alert('No se pudo guardar la configuración.\n\n'+error.message);return}
      onSave(data)
    }else{
      const{data,error}=await sb.schema('costos').from('config').insert({...form,temporada_id:temporada.id}).select().single()
      if(error){setGuardando(false);alert('No se pudo guardar la configuración.\n\n'+error.message);return}
      onSave(data)
    }
    onTemporadaCambio&&onTemporadaCambio()
    setGuardando(false);setOk(true);setTimeout(()=>setOk(false),2000)
  }

  async function aplicarAumentoConf(){
    const pct=Number(pctConf)
    if(!pct){alert('Ingresá un porcentaje');return}
    const{data:arts}=await sb.schema('costos').from('articulos').select('id,confeccion').eq('temporada_id',temporada.id)
    const conConf=(arts||[]).filter(a=>a.confeccion>0)
    if(!conConf.length){alert('No hay artículos con confección cargada');return}
    if(!confirm(`¿Aplicar ${pct>0?'+':''}${pct}% de aumento a la confección de ${conConf.length} artículos?\n\nEjemplo: $2.000 → $${Math.round(2000*(1+pct/100)).toLocaleString('es-AR')}`))return
    setAplicandoConf(true)
    // Una sola operación en la base: o cambian todos, o no cambia ninguno.
    // Antes era un pedido por artículo y nadie revisaba si alguno fallaba.
    const{data:cuantos,error}=await sb.schema('costos').rpc('aumentar_confeccion',{p_temporada:temporada.id,p_pct:pct})
    setAplicandoConf(false)
    if(error){
      alert(`No se pudo aplicar el aumento.\n\n${error.message}\n\nNo se modificó ningún artículo.`)
      return
    }
    setPctConf('')
    alert(`✅ Confección actualizada en ${cuantos} artículo${cuantos===1?'':'s'}`)
  }

  async function toggleCerrada(){
    const nueva=!cerrada
    const msg=nueva
      ?`¿Cerrar "${temporada.nombre}"?\n\nNo se van a poder editar precios ni artículos hasta que la reabras.`
      :`¿Reabrir "${temporada.nombre}" para edición?`
    if(!confirm(msg))return
    await sb.schema('costos').from('temporadas').update({cerrada:nueva}).eq('id',temporada.id)
    setCerrada(nueva)
    const ts=await getTemporadas()
    onTemporadas(ts)
    alert(nueva?'🔒 Temporada cerrada':'🔓 Temporada reabierta')
  }

  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const ej=10000
  const pv=round500(ej*(1+form.margen_propio/100))
  const gr=ej*(1+form.margen_greguera/100)
  const ba=ej*(1+form.margen_balbi/100)
  const su=gr*(1-form.descuento_sucati/100)
  return(
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Configuración</div>
          <div className="page-sub">{temporada.nombre} {cerrada&&<span style={{color:'#dc2626',fontWeight:700}}>· 🔒 CERRADA</span>}</div>
        </div>
        <button className="btn btn-outline" onClick={()=>setMTemp(true)}>+ Nueva temporada</button>
      </div>

      {cerrada&&(
        <div style={{marginBottom:16,padding:'12px 16px',background:'#fef2f2',border:'1.5px solid #fca5a5',borderRadius:10,fontSize:13,color:'#991b1b'}}>
          🔒 Esta temporada está cerrada. Los precios y artículos son de solo lectura para proteger los datos históricos.
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,marginBottom:16}}>Parámetros globales</div>
          <div className="form-group">
            <label className="form-label">Último código usado</label>
            <input type="number" className="form-input" value={ultimoCod} onChange={e=>setUltimoCod(e.target.value)} placeholder="Ej: 2314"/>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>
              {ultimoCod?`Próximo artículo: ${parseInt(ultimoCod)+1}`:'Ingresá el último código para que se sugiera el siguiente al crear uno nuevo'}
            </div>
          </div>
          <div className="sep"/>
          <div className="form-group"><label className="form-label">Precio de corte ($)</label><input type="number" className="form-input" value={form.precio_corte} onChange={e=>set('precio_corte',Number(e.target.value))}/><div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>Se aplica a todos los artículos</div></div>
          <div className="sep"/>
          <div className="form-group"><label className="form-label">Margen Precio Venta (%)</label><input type="number" className="form-input" value={form.margen_propio} onChange={e=>set('margen_propio',Number(e.target.value))}/><div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>Tu precio de referencia. Se redondea a múltiplos de $500</div></div>
          <div className="form-group"><label className="form-label">Margen G. Reguera (%)</label><input type="number" className="form-input" value={form.margen_greguera} onChange={e=>set('margen_greguera',Number(e.target.value))}/></div>
          <div className="form-group"><label className="form-label">Margen Balbi (%)</label><input type="number" className="form-input" value={form.margen_balbi} onChange={e=>set('margen_balbi',Number(e.target.value))}/></div>
          <div className="form-group"><label className="form-label">Descuento Sucati (%)</label><input type="number" className="form-input" value={form.descuento_sucati} onChange={e=>set('descuento_sucati',Number(e.target.value))}/></div>
          <button className="btn btn-primary" style={{width:'100%',minHeight:44}} onClick={guardarConfig} disabled={guardando}>{ok?'✅ Guardado':guardando?'Guardando...':'Guardar configuración'}</button>
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,marginBottom:16}}>Vista previa (costo $10.000)</div>
          {[{l:'Precio Venta',v:pv,c:'precio-venta'},{l:'G. Reguera',v:gr,c:'precio-greguera'},{l:'Balbi',v:ba,c:'precio-balbi'},{l:'Sucati',v:su,c:'precio-sucati'}].map(p=>(
            <div key={p.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:14,color:'var(--text2)'}}>{p.l}</span>
              <span className={p.c} style={{fontSize:20,fontWeight:800}}>{fmt(p.v)}</span>
            </div>
          ))}

          <div style={{marginTop:24,paddingTop:20,borderTop:'2px solid var(--border)'}}>
            <div style={{fontWeight:700,marginBottom:6}}>✂️ Aumento masivo de confección</div>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>Aplica el porcentaje a la confección de todos los artículos de esta temporada</div>
            <div style={{display:'flex',gap:8}}>
              <input type="number" className="form-input" placeholder="Ej: 15" value={pctConf} onChange={e=>setPctConf(e.target.value)} disabled={cerrada} style={{flex:1}}/>
              <button className="btn btn-primary" onClick={aplicarAumentoConf} disabled={aplicandoConf||!pctConf||cerrada}>
                {aplicandoConf?'Aplicando...':'Aplicar %'}
              </button>
            </div>
          </div>

          <div style={{marginTop:24,paddingTop:20,borderTop:'2px solid var(--border)'}}>
            <div style={{fontWeight:700,marginBottom:6}}>{cerrada?'🔓':'🔒'} {cerrada?'Reabrir':'Cerrar'} temporada</div>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
              {cerrada
                ?'La temporada está protegida. Reabrila si necesitás modificar algo.'
                :'Protege los precios y artículos de esta temporada contra ediciones accidentales.'}
            </div>
            <button onClick={toggleCerrada} className="btn btn-outline" style={{width:'100%',minHeight:40,borderColor:cerrada?'#16a34a':'#dc2626',color:cerrada?'#16a34a':'#dc2626'}}>
              {cerrada?'🔓 Reabrir temporada':'🔒 Cerrar temporada'}
            </button>
          </div>
        </div>
      </div>
      {mTemp&&<ModalNuevaTemp temporadas={temporadas} estacion={detectarEstacion(temporada.nombre)} onClose={()=>setMTemp(false)} onSave={async(nombre,yaCreada)=>{
        if(!yaCreada) await sb.schema('costos').from('temporadas').insert({nombre,activa:false})
        const ts=await getTemporadas();onTemporadas(ts);setMTemp(false)
      }}/>}
    </div>
  )
}
