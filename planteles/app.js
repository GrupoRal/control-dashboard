/* Seed inicial (datos por defecto) */
const seed = [
  {
    id: 'h1',
    title: 'Hito 1 - Permiso de Edificación',
    desc: 'Trámite y documentación para obtener permiso de edificación.',
    priority: 'Alta',
    avance: 0,
    subhitos: [
      {
        id: 'h1s1',
        title: 'Documentos Legales',
        avance: 0,
        docs: []
      },
      {
        id: 'h1s2',
        title: 'Documentos y Planos',
        avance: 0,
        docs: []
      },
      {
        id: 'h1s3',
        title: 'Documentos y Certificados Estatales',
        avance: 0,
        docs: []
      }
    ]
  }
];
