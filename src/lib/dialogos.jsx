import React, { useState, useEffect, useRef } from 'react'

// Reemplazo de los cuadros nativos del navegador (alert, confirm, prompt).
// Los nativos funcionaban, pero se ven como una ventana de Windows ajena a la
// app, bloquean la pestaña entera y en el celular quedan incómodos.
//
// Se usan igual que los de siempre, con un await adelante:
//
//   await avisar('Listo')
//   if(!await confirmar('¿Borrar?'))return
//   const nombre = await pedirTexto('¿Cómo se llama?')
//
// confirmar() devuelve true/false y pedirTexto() el texto o null si se cancela,
// como hacían confirm() y prompt().

// El host (<Dialogos/>) instala acá su forma de abrir un cuadro al montarse.
// Mientras no esté montado se cae a los nativos, así nunca se pierde un aviso.
let abrirEnPantalla = null

function abrir(pedido){
  if(!abrirEnPantalla){
    if(pedido.tipo==='confirmar')return Promise.resolve(window.confirm(pedido.mensaje))
    if(pedido.tipo==='texto')return Promise.resolve(window.prompt(pedido.mensaje,pedido.valor||''))
    window.alert(pedido.mensaje)
    return Promise.resolve(undefined)
  }
  return new Promise(resolver=>abrirEnPantalla({...pedido,resolver}))
}

export const avisar=mensaje=>abrir({tipo:'aviso',mensaje})
export const confirmar=(mensaje,opciones={})=>abrir({tipo:'confirmar',mensaje,...opciones})
export const pedirTexto=(mensaje,valor='')=>abrir({tipo:'texto',mensaje,valor})

// Los mensajes vienen escritos con \n y algunos empiezan con ✅, ⚠️, 🔒...
// Se parten en párrafos y el emoji inicial se agranda aparte.
function partir(mensaje){
  const lineas=String(mensaje??'').split('\n')
  const primera=lineas[0]||''
  const emoji=primera.match(/^([✅⚠️❌🔒🔓])\s*/)
  return {
    emoji: emoji?emoji[1]:null,
    parrafos: [emoji?primera.slice(emoji[0].length):primera, ...lineas.slice(1)],
  }
}

export function Dialogos(){
  // Cola y no uno solo: si dos avisos salen casi juntos, el segundo espera su
  // turno en vez de tapar al primero.
  const[cola,setCola]=useState([])
  const[texto,setTexto]=useState('')
  const campo=useRef(null)
  const actual=cola[0]||null

  useEffect(()=>{
    abrirEnPantalla=pedido=>setCola(c=>[...c,pedido])
    return()=>{abrirEnPantalla=null}
  },[])

  useEffect(()=>{
    if(!actual)return
    if(actual.tipo==='texto'){
      setTexto(actual.valor||'')
      // El foco va al campo, no al botón, para poder escribir de una.
      setTimeout(()=>{campo.current?.focus();campo.current?.select()},0)
    }
  },[actual])

  if(!actual)return null

  function cerrar(valor){
    actual.resolver(valor)
    setCola(c=>c.slice(1))
  }

  const cancelar=()=>cerrar(actual.tipo==='confirmar'?false:actual.tipo==='texto'?null:undefined)
  const aceptar=()=>cerrar(actual.tipo==='confirmar'?true:actual.tipo==='texto'?texto:undefined)

  function teclas(e){
    if(e.key==='Escape'){e.preventDefault();cancelar()}
    // En un texto largo Enter podría ser parte de lo que se escribe; acá los
    // campos son de una línea, así que Enter siempre confirma.
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();aceptar()}
  }

  const {emoji,parrafos}=partir(actual.mensaje)
  const peligro=actual.peligro??/no se puede deshacer|eliminar|borrar/i.test(actual.mensaje||'')

  return(
    <div className="modal-overlay" style={{zIndex:400}} onKeyDown={teclas}
         onMouseDown={e=>{if(e.target===e.currentTarget)cancelar()}}>
      <div className="modal" style={{maxWidth:440}} role="dialog" aria-modal="true">
        <div className="modal-body" style={{display:'flex',gap:14,alignItems:'flex-start'}}>
          {emoji&&<div style={{fontSize:26,lineHeight:1,flexShrink:0}}>{emoji}</div>}
          <div style={{flex:1,minWidth:0}}>
            {parrafos.map((p,i)=>p.trim()
              ?<div key={i} style={{fontSize:i===0?15:13.5,fontWeight:i===0?600:400,
                                    color:i===0?'var(--text1)':'var(--text2)',
                                    marginTop:i===0?0:8,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{p}</div>
              :null)}
            {actual.tipo==='texto'&&
              <input ref={campo} className="form-input" value={texto} autoFocus
                     onChange={e=>setTexto(e.target.value)}
                     style={{marginTop:12,width:'100%'}}/>}
          </div>
        </div>
        <div className="modal-footer" style={{justifyContent:'flex-end'}}>
          {actual.tipo!=='aviso'&&
            <button className="btn btn-outline" onClick={cancelar}>Cancelar</button>}
          <button className="btn btn-primary" autoFocus={actual.tipo!=='texto'}
                  style={peligro&&actual.tipo==='confirmar'?{background:'var(--rojo)'}:undefined}
                  onClick={aceptar}>
            {actual.tipo==='aviso'?'Entendido':actual.aceptar||'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
