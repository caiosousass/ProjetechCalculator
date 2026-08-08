/* Projetech Calc — camada de login (Supabase)
 * Requer, nesta ordem: supabase.min.js, supabase-config.js, auth.js
 *
 * Regra geral: se supabase-config.js estiver vazio, tudo aqui vira no-op e o
 * app segue aberto como sempre foi. Nada de tela de login pela metade no ar.
 */
(function () {
  var cfg = window.PT_SUPABASE || {};
  var configured = !!(cfg.url && cfg.anonKey);
  var FLAG = 'pt_logged';          // marca local, só p/ evitar piscar a tela antes do SDK carregar
  var SEEN = 'pt_last_log';        // timestamp do último registro de acesso deste aparelho

  var api = { configured: configured, client: null };

  if (configured && typeof supabase !== 'undefined') {
    api.client = supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }

  /* ---------- sessão ---------- */

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

  /* ---------- entrar / sair ---------- */

  api.signIn = async function (email, senha) {
    if (!api.client) throw new Error('Login não configurado.');
    var r = await api.client.auth.signInWithPassword({ email: email, password: senha });
    if (r.error) throw r.error;

    var prof = await api.profile(r.data.session);
    if (prof && prof.blocked) {
      await api.client.auth.signOut();
      localStorage.removeItem(FLAG);
      throw new Error('Este usuário está bloqueado. Fale com o administrador.');
    }

    localStorage.setItem(FLAG, '1');
    await api.logAccess(r.data.session);
    return r.data.session;
  };

  api.signOut = async function () {
    localStorage.removeItem(FLAG);
    localStorage.removeItem(SEEN);
    if (api.client) { try { await api.client.auth.signOut(); } catch (e) {} }
    location.replace('login.html');
  };

  /* ---------- registro de acesso ---------- */

  // Grava uma linha em access_log. Chamado no login e, no máximo 1x por hora,
  // quando o app é reaberto com sessão válida (senão o log vira spam).
  api.logAccess = async function (session) {
    if (!api.client) return;
    var s = session || (await api.session());
    if (!s) return;
    try {
      await api.client.from('access_log').insert({
        user_id: s.user.id,
        email: s.user.email,
        user_agent: navigator.userAgent
      });
      localStorage.setItem(SEEN, String(Date.now()));
    } catch (e) { /* offline ou sem permissão: não trava o app */ }
  };

  api.touch = async function (session) {
    if (!api.client || !session) return;
    try {
      await api.client.from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', session.user.id);
    } catch (e) {}
    var last = +(localStorage.getItem(SEEN) || 0);
    if (Date.now() - last > 3600e3) api.logAccess(session);   // 1h
  };

  /* ---------- proteção das páginas ---------- */

  // Usado no index.html: exige sessão válida, derruba usuário bloqueado e
  // atualiza o "último acesso". Offline, aceita a sessão guardada no aparelho.
  api.protect = async function () {
    if (!configured) return null;
    var s = await api.session();
    if (!s) { localStorage.removeItem(FLAG); location.replace('login.html'); return null; }
    localStorage.setItem(FLAG, '1');

    var prof = await api.profile(s);
    if (prof && prof.blocked) {
      alert('Seu acesso foi bloqueado pelo administrador.');
      await api.signOut();
      return null;
    }
    api.touch(s);
    return { session: s, profile: prof };
  };

  // Usado no admin.html: além de sessão válida, exige is_admin.
  api.protectAdmin = async function () {
    var ctx = await api.protect();
    if (!ctx) return null;
    if (!ctx.profile || !ctx.profile.is_admin) { location.replace('index.html'); return null; }
    return ctx;
  };

  window.PTAuth = api;
})();
