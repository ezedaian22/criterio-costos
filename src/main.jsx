import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './estilos.css'

// La rueda del mouse sobre un campo ENFOCADO le cambia el valor sin que nadie
// lo pida: en un <select> salta de opción, en un <input type="number"> suma o
// resta. Como varios campos de esta app se guardan solos —la categoría apenas
// cambia el select, el precio de venta al salir del campo—, alcanzaba con
// pasar el mouse girando la rueda para modificar datos en silencio.
// Así quedaron 10 artículos mal categorizados (polleras, un blazer y un
// chaleco archivados como "Musculosas").
// Se frena acá, en un solo lugar, para que valga también en los campos que se
// agreguen más adelante. Solo afecta al campo que se está editando.
document.addEventListener('wheel', e => {
  const activo = document.activeElement
  if (!activo || activo !== e.target) return
  const esNumero = activo.tagName === 'INPUT' && activo.type === 'number'
  const esLista = activo.tagName === 'SELECT'
  if (esNumero || esLista) e.preventDefault()
}, { passive: false })

// createRoot: la API de React 18. Antes se usaba ReactDOM.render, que corre
// en modo compatibilidad y quedo deprecada.
createRoot(document.getElementById('root')).render(<App />)
