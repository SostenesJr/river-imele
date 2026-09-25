/* ============================================================
   NAVLOG AMAZÔNIA — helper compartilhado pra chamar o Supabase (REST)
   a partir das funções serverless da Vercel (api/cron/*, api/*),
   sempre usando a chave "service_role" (nunca a "anon" do site).
   ============================================================ */

async function sbFetch(path, opts) {
  var url = process.env.SUPABASE_URL + '/rest/v1/' + path;
  var headers = Object.assign({
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  }, (opts && opts.headers) || {});
  var res = await fetch(url, Object.assign({}, opts, { headers: headers }));
  if (!res.ok) {
    var body = await res.text().catch(function () { return ''; });
    throw new Error('Supabase ' + res.status + ': ' + body);
  }
  return res.status === 204 ? null : res.json();
}

module.exports = { sbFetch: sbFetch };
