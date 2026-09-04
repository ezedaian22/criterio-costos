import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './estilos.css'

// createRoot: la API de React 18. Antes se usaba ReactDOM.render, que corre
// en modo compatibilidad y quedo deprecada.
createRoot(document.getElementById('root')).render(<App />)
