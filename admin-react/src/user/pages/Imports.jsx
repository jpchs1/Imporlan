import { Navigate } from 'react-router-dom';
import { FILTRO_IMPORTACION } from './expedientes/lib';

/**
 * "Mis importaciones" ya no es una sección: es el filtro "En importación" de
 * Expedientes (etapa Compra o Logística). La ruta se mantiene porque hay
 * correos y marcadores que apuntan a #/imports.
 */
export default function Imports() {
  return <Navigate to={`/expedientes?filtro=${FILTRO_IMPORTACION}`} replace />;
}
