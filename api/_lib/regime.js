/* ============================================================
   NAVLOG AMAZÔNIA — classificação do regime do rio (cópia server-side)
   ============================================================
   Espelha EXATAMENTE o array NIVEL_REGIMES de js/app.js (mesmos cortes,
   mesma ordem) — só existe aqui porque as funções serverless da Vercel
   rodam em Node, sem acesso ao js/app.js do site. Se um dia mudar os
   cortes/cores em js/app.js, replicar a mudança aqui também.
   ============================================================ */

var NIVEL_REGIMES = [
  { ate: 15,   label: 'seca_severa', nome: 'Seca severa'          },
  { ate: 19,   label: 'seca',        nome: 'Seca'                 },
  { ate: 27,   label: 'normal',      nome: 'Normal'                },
  { ate: 27.5, label: 'atencao',     nome: 'Atenção'               },
  { ate: 29,   label: 'alerta',      nome: 'Alerta (cheia)'        },
  { ate: 99,   label: 'emergencia',  nome: 'Emergência (cheia)'    }
];

function classificarNivel(nivel) {
  for (var i = 0; i < NIVEL_REGIMES.length; i++) {
    if (nivel <= NIVEL_REGIMES[i].ate) return NIVEL_REGIMES[i];
  }
  return NIVEL_REGIMES[NIVEL_REGIMES.length - 1];
}

module.exports = { NIVEL_REGIMES: NIVEL_REGIMES, classificarNivel: classificarNivel };
