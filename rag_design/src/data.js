// Sample conversation + KB data for the prototype.
// Mirrors the user's actual RAG app: a knowledge base with several docs,
// and a conversation about Hirson / Mondial Guitare from one of them.

window.RAG_DATA = {
  knowledgeBases: [
    {
      id: 'kb-1',
      name: 'Hirson & Recherche',
      docs: 7,
      size: '1.3 KB',
      docsList: [
        { id: 'd1', name: 'Student Internship Planning', type: 'sheet', pages: 1, chunks: 12 },
        { id: 'd2', name: 'Stage Report on BioImag…', type: 'doc', pages: 1, chunks: 2 },
        { id: 'd3', name: 'AVEC OU SANS FIEL, LES CHEVALIERS…', type: 'web', pages: 1, chunks: 5, active: true },
        { id: 'd4', name: 'Alternance — Data Analyst', type: 'web', pages: 1, chunks: 1 },
        { id: 'd5', name: 'Master MAE Course Structure', type: 'pdf', pages: 2, chunks: 2 },
        { id: 'd6', name: 'Profil d\u2019ingénieur en informatique', type: 'pdf', pages: 1, chunks: 3 },
        { id: 'd7', name: 'Instructions for Warehouse Ops', type: 'pdf', pages: 2, chunks: 5 },
      ],
    },
  ],
  activeDoc: {
    title: 'AVEC OU SANS FIEL, LES CHEVALIERS FONT L\u2019UNANIMITÉ.',
    subtitle: 'Le blog de Jean-Jacques THOMAS',
    pages: 1,
    chunks: 5,
    url: 'jjthomas-hirson.blogspot.com',
  },
  messages: [
    {
      id: 'm1',
      role: 'user',
      content: 'ça parle de quoi, fais moi un résumé',
      timestamp: '14:32',
    },
    {
      id: 'm2',
      role: 'assistant',
      content:
        'Le texte présente des événements récents à Hirson, notamment un concert de Daniel Guichard et un spectacle intitulé « Mondial Guitare ». Il mentionne également des commentaires du maire, Jean-Jacques Thomas, sur la vie citoyenne et les activités culturelles dans la commune. Le blog semble se concentrer sur des événements locaux, des spectacles et des réflexions sur la communauté.',
      timestamp: '14:32',
      sources: [
        {
          id: 's1',
          docTitle: 'AVEC OU SANS FIEL, LES CHEVALIERS…',
          chunk: 'Le blog de Jean-Jacques Thomas, maire d\u2019Hirson, couvre la vie citoyenne, les spectacles locaux comme Mondial Guitare et les concerts (Daniel Guichard) ainsi que les activités culturelles dans la commune.',
          page: 1,
          relevance: 0.92,
        },
      ],
      model: 'GPT-4o-mini',
      tokens: 312,
      duration: '1.8s',
    },
    {
      id: 'm3',
      role: 'user',
      content: 'quels genres d\u2019événement ?',
      timestamp: '14:34',
    },
    {
      id: 'm4',
      role: 'assistant',
      content:
        'Les événements mentionnés incluent des concerts, comme celui de Daniel Guichard, et des spectacles tels que « Mondial Guitare ». Il y a aussi des références à des activités culturelles et des performances artistiques, ainsi qu\u2019à des compétitions sportives, comme les championnats de France des clubs.',
      timestamp: '14:34',
      sources: [
        {
          id: 's2',
          docTitle: 'AVEC OU SANS FIEL, LES CHEVALIERS…',
          chunk: 'Concerts (Daniel Guichard), spectacles (Mondial Guitare), activités culturelles diverses et championnats sportifs régionaux des clubs amateurs.',
          page: 1,
          relevance: 0.88,
        },
      ],
      model: 'GPT-4o-mini',
      tokens: 287,
      duration: '1.4s',
    },
  ],
  suggestions: [
    'Cite les personnes mentionnées dans ce document',
    'Quels lieux sont évoqués ?',
    'Résume en 3 points clés',
    'Y a-t-il des dates précises ?',
  ],
  recentChats: [
    { id: 'c1', title: 'Résumé blog Hirson', time: 'Aujourd\u2019hui', active: true },
    { id: 'c2', title: 'Analyse plan stage M2', time: 'Hier' },
    { id: 'c3', title: 'Comparaison alternances', time: 'Hier' },
    { id: 'c4', title: 'Profil ingénieur info', time: 'Mer.' },
    { id: 'c5', title: 'Warehouse ops parsing', time: '15 mai' },
  ],
};
