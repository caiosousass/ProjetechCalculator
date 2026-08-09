/* Projetech Calc — acesso aberto ao mercado
 * Requer, nesta ordem: supabase.min.js, supabase-config.js, auth.js
 *
 * Duas camadas independentes:
 *   PTAuth  — login SÓ do administrador (ver o painel). Usa Supabase Auth.
 *   PTVisit — identificação do visitante e registro de cada entrada (sem senha),
 *             com fila offline que sobe quando a internet volta.
 *
 * Se supabase-config.js estiver vazio, tudo aqui vira no-op e o app fica 100% livre.
 */
(function () {
  var cfg = window.PT_SUPABASE || {};
  var configured = !!(cfg.url && cfg.anonKey);
  var api = { configured: configured, client: null };

  if (configured && typeof supabase !== 'undefined') {
    api.client = supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }

  /* ================= ADMIN ================= */
  var ADM = 'pt_admin';

  api.session = async function () {
    if (!api.client) return null;
    var r = await api.client.auth.getSession();
    return (r.data && r.data.session) || null;
  };

  api.profile = async function (session) {
    if (!api.client) return null;
    var s = session || (await api.session());
    if (!s) return null;
    var r = await api.client.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    if (r.error) return null;
    return r.data;
  };

  api.signIn = async function (email, senha) {
    if (!api.client) throw new Error('Login não configurado.');
    var r = await api.client.auth.signInWithPassword({ email: email, password: senha });
    if (r.error) throw r.error;
    var prof = await api.profile(r.data.session);
    if (!prof || !prof.is_admin) {
      await api.client.auth.signOut();
      localStorage.removeItem(ADM);
      throw new Error('Esta conta não é de administrador.');
    }
    localStorage.setItem(ADM, '1');
    return r.data.session;
  };

  api.signOut = async function () {
    localStorage.removeItem(ADM);
    if (api.client) { try { await api.client.auth.signOut(); } catch (e) {} }
    location.replace('login.html');
  };

  // Usado no admin.html: exige sessão válida E is_admin.
  api.protectAdmin = async function () {
    if (!configured) { location.replace('index.html'); return null; }
    var s = await api.session();
    if (!s) { localStorage.removeItem(ADM); location.replace('login.html'); return null; }
    var prof = await api.profile(s);
    if (!prof || !prof.is_admin) { location.replace('index.html'); return null; }
    localStorage.setItem(ADM, '1');
    return { session: s, profile: prof };
  };

  window.PTAuth = api;

  /* ================= VISITANTE ================= */
  var IDK   = 'pt_visitor';        // identidade { device, nome, area, cidade, contato }
  var QK    = 'pt_visit_queue';    // entradas ainda não enviadas (offline)
  var LASTK = 'pt_last_visit';     // instante da última entrada contada
  var DIRTY = 'pt_visitor_dirty';  // cadastro do visitante ainda não subiu
  var THROTTLE = 30 * 60 * 1000;   // 30 min: recarregar a página não conta como nova entrada

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'd-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  var vis = {};

  vis.identity = function () {
    try { return JSON.parse(localStorage.getItem(IDK) || 'null'); } catch (e) { return null; }
  };
  vis.hasIdentity = function () { var i = vis.identity(); return !!(i && i.device); };

  // Chamado na tela de entrada (acesso.html). Salva a identidade no aparelho,
  // marca o cadastro como pendente e já conta a primeira entrada. O envio (e o
  // reenvio, se estiver offline) fica por conta de flush().
  vis.register = async function (data) {
    var prev = vis.identity() || {};
    var device = prev.device || uuid();
    var rec = { device: device, nome: data.nome, area: data.area, cidade: data.cidade, contato: data.contato };
    localStorage.setItem(IDK, JSON.stringify(rec));
    localStorage.setItem(DIRTY, '1');
    await vis.logVisit(true);   // enfileira a 1ª visita e chama flush (que também sobe o cadastro)
    return rec;
  };

  function queueGet(){ try { return JSON.parse(localStorage.getItem(QK) || '[]'); } catch (e) { return []; } }
  function queueSet(a){ localStorage.setItem(QK, JSON.stringify(a.slice(-300))); }

  // Registra uma entrada. force ignora o intervalo anti-refresh (usado no 1º acesso).
  vis.logVisit = async function (force) {
    var id = vis.identity();
    if (!id || !id.device) return;
    var last = +(localStorage.getItem(LASTK) || 0);
    if (!force && (Date.now() - last) < THROTTLE) return;
    localStorage.setItem(LASTK, String(Date.now()));
    var v = { p_device: id.device, p_nome: id.nome, p_area: id.area, p_cidade: id.cidade,
              p_ua: navigator.userAgent, p_ocorreu: new Date().toISOString() };
    var q = queueGet(); q.push(v); queueSet(q);
    await vis.flush();
  };

  // Sobe o que estiver pendente: o cadastro do visitante e a fila de entradas.
  // Importante: o supabase-js NÃO lança erro em falha de rede — devolve {error}.
  // Por isso conferimos res.error antes de tirar o item da fila; senão a entrada
  // feita offline seria descartada em vez de reenviada.
  vis.flush = async function () {
    if (!api.client || !navigator.onLine) return;

    if (localStorage.getItem(DIRTY)) {
      var id = vis.identity();
      if (id && id.device) {
        try {
          var r1 = await api.client.rpc('registrar_visitante', {
            p_device: id.device, p_nome: id.nome, p_area: id.area, p_cidade: id.cidade, p_contato: id.contato
          });
          if (!(r1 && r1.error)) localStorage.removeItem(DIRTY);
        } catch (e) { /* tenta de novo depois */ }
      } else {
        localStorage.removeItem(DIRTY);
      }
    }

    var q = queueGet();
    while (q.length) {
      try {
        var r2 = await api.client.rpc('registrar_visita', q[0]);
        if (r2 && r2.error) break;   // falhou (rede/servidor): mantém na fila
        q.shift(); queueSet(q);
      } catch (e) { break; }
    }
  };

  window.PTVisit = vis;
  window.addEventListener('online', function () { vis.flush(); });
})();
