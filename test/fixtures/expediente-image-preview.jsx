import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OperacionUsa from '/src/admin/pages/orders/OperacionUsa.jsx';
import { GaleriaUsa, Novedades } from '/src/user/pages/expedientes/NovedadesImportacion.jsx';
import SeccionArchivos from '/src/user/pages/expedientes/SeccionArchivos.jsx';
import Documents from '/src/user/pages/Documents.jsx';
import { FileImage } from '/src/shared/components/FileImage.jsx';
import { Lightbox } from '/src/shared/components/Lightbox.jsx';
import '/src/index.css';

const files = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  download_url: `/api/expediente_files_api.php?action=download&id=${i + 1}&exp=9999999999&sig=test-${i + 1}`,
  category: 'image',
  mime_type: i === 1 ? 'image/jpeg' : 'image/heic',
  original_name: i === 1 ? 'MISLABELLED.jpg' : `IMG_${i + 1}.HEIC`,
  visible_to_client: 1,
  description: 'Desde Estados Unidos',
}));

function App() {
  const [lb, setLb] = useState(null);
  const mode = new URLSearchParams(location.search).get('mode');
  const preview = (photos, index) => setLb({
    items: photos.map(file => ({ src: file.download_url, alt: file.original_name, downloadUrl: file.download_url })),
    index,
  });
  return (
    <main style={{ maxWidth: 1000, margin: 'auto', padding: 20 }}>
      <h1>Validación de imágenes de expediente</h1>
      {mode === 'admin' ? (
        <OperacionUsa detail={{ id: 35 }} archivos={{ files }} />
      ) : mode === 'documents' ? (
        <Documents />
      ) : mode === 'error' ? (
        <>
          <FileImage src="/api/expired" mimeType="image/heic" className="h-16 w-24" />
          <FileImage src="/api/corrupt" mimeType="image/heic" className="h-16 w-24" />
        </>
      ) : mode === 'native' ? (
        <FileImage src="/api/jpeg" originalName="valid.jpg" className="h-16 w-24" />
      ) : (
        <>
          <GaleriaUsa archivos={files} onPreview={preview} />
          <Novedades novedades={[{ id: 1, text: 'Fotos de inspección', file_ids: [1, 2] }]} files={files} onPreview={preview} />
          <SeccionArchivos files={files} onPreview={index => preview(files, index)} />
        </>
      )}
      <Lightbox
        open={!!lb}
        items={lb?.items}
        index={lb?.index}
        onIndexChange={index => setLb(value => ({ ...value, index }))}
        onClose={() => setLb(null)}
      />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
