import React, { useState } from 'react'
import { sb, fmt, guardar, round500, getTemporadas, detectarEstacion, precioCriterio } from '../lib/nucleo.js'
import { ModalNuevaTemp } from '../componentes.jsx'
import { avisar, confirmar } from '../lib/dialogos.jsx'

export function ConfigPage({temporada,config,onSave,temporadas,onTemporadas,onTemporadaCambio}){
  const[form,setForm]=useState({precio_corte:config?.precio_corte||400,margen_greguera:config?.margen_greguera||100,margen_balbi:config?.margen_balbi||50,descuento_sucati:config?.descuento_sucati||15,descuento_criterio:config?.descuento_criterio??20,margen_propio:config?.margen_propio??config?.margen_greguera??100})
  const[ultimoCod,setUltimoCod]=useState(temporada.ultimo_codigo!=null?String(temporada.ultimo_codigo):'')
  // El corte es un solo número por temporada, así que su tilde vive en config.
  const cortePendiente=config?.corte_actualizado===false

  async function marcarCorteOk(){
    if(!config)return
    const{data,error}=await sb.schema('costos').from('config').update({corte_actualizado:true}).eq('id',config.id).select().single()
    if(error){await avisar('No se pudo marcar el corte como revisado.\n\n'+error.message);return}
    onSave(data)
  }
  const[guardando,setGuardando]=useState(false)
  const[ok,setOk]=useState(false)
  const[mTemp,setMTemp]=useState(false)
  const[pctConf,setPctConf]=useState('')
  const[aplicandoConf,setAplicandoConf]=useState(false)
  const[cerrada,setCerrada]=useState(temporada.cerrada||false)
  // Cuál es la temporada que se está produciendo. Hasta ahora este dato no se
  // podía cambiar desde ningún lado: solo se escribía en false al crear una
  // temporada, así que quedó desactualizado y la app del local leía el
  // invierno cuando se estaba haciendo verano.
  const activaActual=(temporadas||[]).find(t=>t.activa)
  const[activaId,setActivaId]=useState(activaActual?.id||'')
  const[cambiandoActiva,setCambiandoActiva]=useState(false)

  async function cambiarActiva(nuevoId){
    const elegida=(temporadas||[]).find(t=>t.id===nuevoId)
    const anterior=(temporadas||[]).find(t=>t.activa)
    if(anterior?.id===nuevoId)return
    const msg=elegida
      ? `¿Marcar "${elegida.nombre}" como la temporada que se está produciendo?${anterior?`\n\n"${anterior.nombre}" deja de estarlo.`:''}`
      : `¿Dejar sin temporada activa?${anterior?`\n\n"${anterior.nombre}" deja de estarlo.`:''}`
    if(!await confirmar(msg))return

    setCambiandoActiva(true)
    // Primero se apagan todas y después se prende la elegida, para que nunca
    // queden dos marcadas a la vez.
    for(const t of (temporadas||[]).filter(t=>t.activa)){
      if(!await guardar(sb.schema('costos').from('temporadas').update({activa:false}).eq('id',t.id),`la temporada ${t.nombre}`)){
        setCambiandoActiva(false);return
      }
    }
    if(nuevoId){
      if(!await guardar(sb.schema('costos').from('temporadas').update({activa:true}).eq('id',nuevoId),`la temporada ${elegida.nombre}`)){
        setCambiandoActiva(false);return
      }
    }
    setActivaId(nuevoId)
    const ts=await getTemporadas()
    onTemporadas(ts)
    onTemporadaCambio&&onTemporadaCambio()
    setCambiandoActiva(false)
  }

  async function guardarConfig(){
    setGuardando(true)
    const n=ultimoCod.trim()===''?null:parseInt(ultimoCod.trim(),10)
    if(!await guardar(sb.schema('costos').from('temporadas').update({ultimo_codigo:isNaN(n)?null:n}).eq('id',temporada.id),'el último código')){
      setGuardando(false);return
    }
    // El corte se da por revisado cuando se le cambia el valor, no cada vez que
    // se guarda la configuración: tocar un margen no dice nada del corte.
    const corteCambio=config&&Number(form.precio_corte)!==Number(config.precio_corte)
    const aGuardar=corteCambio?{...form,corte_actualizado:true}:form
    if(config){
      const{data,error}=await sb.schema('costos').from('config').update(aGuardar).eq('id',config.id).select().single()
      if(error){setGuardando(false);await avisar('No se pudo guardar la configuración.\n\n'+error.message);return}
      onSave(data)
    }else{
      const{data,error}=await sb.schema('costos').from('config').insert({...form,temporada_id:temporada.id}).select().single()
      if(error){setGuardando(false);await avisar('No se pudo guardar la configuración.\n\n'+error.message);return}
      onSave(data)
    }
    onTemporadaCambio&&onTemporadaCambio()
    setGuardando(false);setOk(true);setTimeout(()=>setOk(false),2000)
  }

  async function aplicarAumentoConf(){
    const pct=Number(pctConf)
    if(!pct){await avisar('Ingresá un porcentaje');return}
    const{data:arts}=await sb.schema('costos').from('articulos').select('id,confeccion').eq('temporada_id',temporada.id)
    const conConf=(arts||[]).filter(a=>a.confeccion>0)
    if(!conConf.length){await avisar('No hay artículos con confección cargada');return}
    if(!await confirmar(`¿Aplicar ${pct>0?'+':''}${pct}% de aumento a la confección de ${conConf.length} artículos?\n\nEjemplo: $2.000 → $${Math.round(2000*(1+pct/100)).toLocaleString('es-AR')}`))return
    setAplicandoConf(true)
    // Una sola operación en la base: o cambian todos, o no cambia ninguno.
    // Antes era un pedido por artículo y nadie revisaba si alguno fallaba.
    const{data:cuantos,error}=await sb.schema('costos').rpc('aumentar_confeccion',{p_temporada:temporada.id,p_pct:pct})
    setAplicandoConf(false)
    if(error){
      await avisar(`No se pudo aplicar el aumento.\n\n${error.message}\n\nNo se modificó ningún artículo.`)
      return
    }
    setPctConf('')
    await avisar(`✅ Confección actualizada en ${cuantos} artículo${cuantos===1?'':'s'}`)
  }

  async function toggleCerrada(){
    const nueva=!cerrada
    const msg=nueva
      ?`¿Cerrar "${temporada.nombre}"?\n\nNo se van a poder editar precios ni artículos hasta que la reabras.`
      :`¿Reabrir "${temporada.nombre}" para edición?`
    if(!await confirmar(msg))return
    if(!await guardar(sb.schema('costos').from('temporadas').update({cerrada:nueva}).eq('id',temporada.id),
      nueva?'el cierre de la temporada':'la reapertura de la temporada'))return
    setCerrada(nueva)
    // Refresca la lista Y la temporada en la que se está parado. Antes solo la
    // lista: Telas, Avíos y Confección miran la temporada actual para saber si
    // mostrar los lápices, y seguían dejando editar una temporada ya cerrada
    // (la base lo rechazaba igual, pero con un error en vez de no ofrecerlo).
    if(onTemporadaCambio)await onTemporadaCambio()
    else onTemporadas(await getTemporadas())
    await avisar(nueva?'🔒 Temporada cerrada':'🔓 Temporada reabierta')
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
          {/* Con la temporada cerrada todo esto queda bloqueado. El corte y los
              márgenes no son un dato más: de ellos salen TODOS los precios de la
              temporada, así que cambiarlos reescribía el registro histórico
              aunque la temporada dijera "cerrada". El fieldset deshabilita de una
              todos los campos y botones que tiene adentro. */}
          <fieldset disabled={cerrada} style={{border:0,padding:0,margin:0,minWidth:0}}>
          <div className="form-group">
            <label className="form-label">Último código usado</label>
            <input type="number" className="form-input" value={ultimoCod} onChange={e=>setUltimoCod(e.target.value)} placeholder="Ej: 2314"/>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>
              {ultimoCod?`Próximo artículo: ${parseInt(ultimoCod)+1}`:'Ingresá el último código para que se sugiera el siguiente al crear uno nuevo'}
            </div>
          </div>
          <div className="sep"/>
          <div className="form-group">
            <label className="form-label" style={{display:'flex',alignItems:'center',gap:6}}>
              {cortePendiente
                ? <span style={{color:'#d97706',fontSize:12}}>⏳</span>
                : <span style={{color:'#16a34a',fontSize:13}}>✓</span>}
              Precio de corte ($)
            </label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="number" className="form-input" value={form.precio_corte} onChange={e=>set('precio_corte',Number(e.target.value))}/>
              {cortePendiente&&(
                <button onClick={marcarCorteOk} title="Marcar como revisado sin cambiar el precio"
                  style={{background:'#dcfce7',color:'#16a34a',border:'none',borderRadius:6,padding:'8px 10px',
                    fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>✓ OK</button>
              )}
            </div>
            <div style={{fontSize:11,color:cortePendiente?'#a16207':'var(--text3)',marginTop:3}}>
              {cortePendiente
                ? 'Viene de la temporada anterior — falta recotizarlo. Se tilda solo al cambiarlo.'
                : 'Se aplica a todos los artículos'}
            </div>
          </div>
          <div className="sep"/>
          <div className="form-group"><label className="form-label">Margen Precio Venta (%)</label><input type="number" className="form-input" value={form.margen_propio} onChange={e=>set('margen_propio',Number(e.target.value))}/><div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>Tu precio de referencia. Se redondea a múltiplos de $500</div></div>
          <div className="form-group"><label className="form-label">Margen G. Reguera (%)</label><input type="number" className="form-input" value={form.margen_greguera} onChange={e=>set('margen_greguera',Number(e.target.value))}/></div>
          <div className="form-group"><label className="form-label">Margen Balbi (%)</label><input type="number" className="form-input" value={form.margen_balbi} onChange={e=>set('margen_balbi',Number(e.target.value))}/></div>
          <div className="form-group"><label className="form-label">Descuento Sucati (%)</label><input type="number" className="form-input" value={form.descuento_sucati} onChange={e=>set('descuento_sucati',Number(e.target.value))}/></div>
          <div className="form-group">
            <label className="form-label">Descuento Criterio (%)</label>
            <input type="number" className="form-input" value={form.descuento_criterio} onChange={e=>set('descuento_criterio',Number(e.target.value))}/>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>
              Se descuenta del Precio Venta, no del costo. Se redondea al múltiplo de $500 más cercano
            </div>
          </div>
          <button className="btn btn-primary" style={{width:'100%',minHeight:44}} onClick={guardarConfig} disabled={guardando}>{ok?'✅ Guardado':guardando?'Guardando...':cerrada?'🔒 Temporada cerrada':'Guardar configuración'}</button>
          </fieldset>
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,marginBottom:16}}>Vista previa (costo $10.000)</div>
          {[{l:'Precio Venta',v:pv,c:'precio-venta'},{l:'Criterio',v:precioCriterio(pv,form.descuento_criterio),c:'precio-criterio'},{l:'G. Reguera',v:gr,c:'precio-greguera'},{l:'Balbi',v:ba,c:'precio-balbi'},{l:'Sucati',v:su,c:'precio-sucati'}].map(p=>(
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
            <div style={{fontWeight:700,marginBottom:6}}>🏭 Temporada activa</div>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
              La que se está produciendo. No cambia nada dentro de esta app: la usa
              la app del local para saber de qué temporada tomar los precios.
            </div>
            <select className="form-input" value={activaId} disabled={cambiandoActiva}
              onChange={e=>cambiarActiva(e.target.value)}>
              <option value="">— ninguna —</option>
              {(temporadas||[]).map(t=>(
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
            <div style={{fontSize:11,marginTop:6,color:activaActual?'var(--verde)':'var(--amarillo)',fontWeight:600}}>
              {cambiandoActiva
                ? 'Guardando...'
                : activaActual
                  ? `Hoy se está produciendo: ${activaActual.nombre}`
                  : 'No hay ninguna marcada como activa'}
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
