import { createClient } from '@supabase/supabase-js'

// Clave publica (anon) de Supabase. Va en el navegador por diseno: la
// proteccion real son las politicas RLS y el login, no ocultar esta clave.
const CLAVE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGZncWR5Ymp1aHNlaHlodXl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDM4OTEsImV4cCI6MjA5MzgxOTg5MX0.Pek-PptrKcUYh6jCKocnhqO4umbUx5LWtgwrE4WzjF4'

export const sb = createClient('https://dptfgqdybjuhsehyhuyy.supabase.co', CLAVE_ANON)

export const fmt=v=>v!=null?'$'+Math.round(v).toLocaleString('es-AR'):'—'
export const round500=v=>Math.round(v/500)*500

// Toda escritura pasa por acá. Si la base rechaza el cambio, se avisa y se
// devuelve false para que la pantalla NO muestre el dato como guardado.
export async function guardar(promesa,queSeGuardaba){
  try{
    const{error}=await promesa
    if(error){
      alert(`No se pudo guardar ${queSeGuardaba}.\n\nLa base respondió: ${error.message||error}\n\nEl cambio NO quedó registrado. Revisá la conexión y probá de nuevo.`)
      return false
    }
    return true
  }catch(e){
    alert(`No se pudo guardar ${queSeGuardaba}.\n\n${e.message||e}\n\nEl cambio NO quedó registrado.`)
    return false
  }
}

export async function getTemporadas(){const{data}=await sb.schema('costos').from('temporadas').select('*');return data||[]}
export async function getConfig(id){const{data}=await sb.schema('costos').from('config').select('*').eq('temporada_id',id).limit(1);return data?.[0]||null}
export async function getPrecios(tabla,id){const{data}=await sb.schema('costos').from(tabla).select('*').eq('temporada_id',id);return data||[]}
// Orden numérico: 128, 138, 156, 1332 — no alfabético (128, 1332, 138)
export const porCodigo=(a,b)=>a.codigo.localeCompare(b.codigo,'es',{numeric:true,sensitivity:'base'})
export async function getArticulos(id){const{data}=await sb.schema('costos').from('articulos').select('*').eq('temporada_id',id);return(data||[]).sort(porCodigo)}
// Trae la composición de TODA una temporada en una sola consulta de largo fijo.
// Antes se enumeraban los ids de cada artículo dentro de la URL: con 319 artículos
// medía 11.909 caracteres y a ~440 la consulta se cortaba, devolviendo costos incompletos.
export function composicionDeTemporada(tabla,tablaPrecios,temporadaId){
  return sb.schema('costos').from(tabla)
    .select(`*,${tablaPrecios}(*),articulos!inner(temporada_id)`)
    .eq('articulos.temporada_id',temporadaId)
}
export async function getArticuloDetalle(id){
  const[{data:telas},{data:avios},{data:percha}]=await Promise.all([
    sb.schema('costos').from('articulo_telas').select('*,precios_tela(*)').eq('articulo_id',id),
    sb.schema('costos').from('articulo_avios').select('*,precios_avios(*)').eq('articulo_id',id),
    sb.schema('costos').from('articulo_percha').select('*,precios_perchas(*)').eq('articulo_id',id),
  ])
  return{telas:telas||[],avios:avios||[],percha:percha||[]}
}

export function calcPrecios(det,confeccion,config){
  const t=(det.telas||[]).reduce((s,t)=>s+(t.cantidad*(t.precios_tela?.precio||0)),0)
  const a=(det.avios||[]).reduce((s,a)=>s+(a.cantidad*(a.precios_avios?.precio||0)),0)
  const p=(det.percha||[]).reduce((s,p)=>s+(p.cantidad*(p.precios_perchas?.precio||0)),0)
  const corte=config?.precio_corte??0
  const costo=t+a+p+corte+(confeccion??0)
  const gr=(config?.margen_greguera??100)/100
  const ba=(config?.margen_balbi??50)/100
  const su=(config?.descuento_sucati??15)/100
  const pv=(config?.margen_propio??config?.margen_greguera??100)/100
  return{costo,greguera:costo*(1+gr),balbi:costo*(1+ba),sucati:costo*(1+gr)*(1-su),precioVenta:round500(costo*(1+pv)),totalTela:t,totalAvios:a,totalPercha:p,corte}
}

// Buscador fijo debajo de la barra. Permite saltar de un artículo a otro sin
// volver atrás ni reescribir la búsqueda.

export async function crearPlanilla(token,titulo){
  const res=await fetch('https://sheets.googleapis.com/v4/spreadsheets',{
    method:'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({properties:{title:titulo}})
  })
  if(!res.ok){
    let detalle=''
    try{detalle=(await res.json())?.error?.message||''}catch(e){}
    if(res.status===401||res.status===403)
      throw new Error('Google rechazó el permiso para crear la planilla. Cerrá sesión de Google y volvé a autorizar.'+(detalle?`\n\n(${detalle})`:''))
    if(res.status===429)
      throw new Error('Google está limitando los pedidos por exceso de uso. Esperá unos minutos y probá de nuevo.')
    throw new Error(`Google no pudo crear la planilla (error ${res.status}).`+(detalle?`\n\n${detalle}`:''))
  }
  const sheet=await res.json()
  if(!sheet?.spreadsheetId)throw new Error('Google respondió sin identificador de planilla. No se pudo crear.')
  return sheet
}


export function detectarEstacion(nombre){
  const n=(nombre||'').toLowerCase()
  if(n.includes('invierno'))return 'invierno'
  if(n.includes('verano'))return 'verano'
  return 'otra'
}


export const CATEGORIAS=[
  'Pantalones','Calzas','Shorts / Bermudas','Remeras','Musculosas','Blusas',
  'Camisas / Chombas','Vestidos','Soleros','Monos / Kimonos','Camperas',
  'Chalecos','Tapados','Buzos / Sweaters','Polerones','Sacos',
  'Pilotines','Spolverinos','Ponchos','Blazers','Polleras','Conjuntos','Otros'
]

// Elige la percha que más se usa en la temporada. Sin nombres fijos en el código:
// si mañana la percha se llama distinto, sigue funcionando.

export async function perchaPorDefecto(temporadaId){
  const{data:perchas}=await sb.schema('costos').from('precios_perchas').select('id,nombre').eq('temporada_id',temporadaId)
  if(!perchas||!perchas.length)return null
  if(perchas.length===1)return perchas[0].id
  const{data:usos}=await sb.schema('costos').from('articulo_percha')
    .select('precio_percha_id,articulos!inner(temporada_id)').eq('articulos.temporada_id',temporadaId)
  const conteo={}
  ;(usos||[]).forEach(u=>{conteo[u.precio_percha_id]=(conteo[u.precio_percha_id]||0)+1})
  const masUsada=perchas.slice().sort((a,b)=>(conteo[b.id]||0)-(conteo[a.id]||0))[0]
  return masUsada.id
}


export function detectarCategoria(desc){
  if(!desc)return 'Otros'
  // Se quitan los acentos antes de comparar: "Pantalón chupin" no coincidía con
  // 'pantalon' y terminaba en "Otros". Lo mismo pasaba con murciélago y demás.
  const d=desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  if(d.includes('pilotin')||d.includes('piloto')||d.includes('rompeviento'))return 'Pilotines'
  if(d.includes('tapado'))return 'Tapados'
  if(d.includes('campera'))return 'Camperas'
  if(d.includes('poleron')||d.includes('media polera'))return 'Polerones'
  if(d.includes('polera'))return 'Polerones'
  if(d.includes('buzo')||d.includes('sweater')||d.includes('sweter')||d.includes('canguro'))return 'Buzos / Sweaters'
  if(d.includes('saco')||d.includes('cuello polar')||d.includes('cuello peluche'))return 'Sacos'
  if(d.startsWith('capa')||d.includes(' capa '))return 'Sacos'
  if(d.includes('chaleco'))return 'Chalecos'
  if(d.includes('calza'))return 'Calzas'
  if(d.includes('pantalon')||d.includes('palazzo')||d.includes('babucha')||d.includes('jogger'))return 'Pantalones'
  if(d.includes('short')||d.includes('bermuda')||d.includes('capri'))return 'Shorts / Bermudas'
  if(d.includes('vestido'))return 'Vestidos'
  if(d.includes('solero'))return 'Soleros'
  if(d.includes('musculosa'))return 'Musculosas'
  if(d.includes('blusa'))return 'Blusas'
  if(d.includes('remeron')||d.includes('remera')||d.includes('murcielago'))return 'Remeras'
  if(d.includes('chomba')||d.includes('camisa'))return 'Camisas / Chombas'
  if(d.includes('mono')||d.includes('kimono')||d.includes('jardinero'))return 'Monos / Kimonos'
  if(d.includes('poncho'))return 'Ponchos'
  if(d.includes('blazer'))return 'Blazers'
  if(d.includes('spolverino'))return 'Spolverinos'
  if(d.includes('pollera'))return 'Polleras'
  if(d.includes('conjunto'))return 'Conjuntos'
  return 'Otros'
}
