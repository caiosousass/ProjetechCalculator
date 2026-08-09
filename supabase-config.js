/* Projetech Calc — configuração do Supabase (login + monitoramento de acesso)
 *
 * Enquanto estes dois campos estiverem vazios o app funciona exatamente como
 * antes: sem tela de login, sem registro de acesso. Basta preencher para ligar.
 *
 * Onde achar os valores: painel do Supabase → Project Settings → API
 *   url     → "Project URL"        (ex.: https://abcdefgh.supabase.co)
 *   anonKey → chave "anon public"  (é pública por natureza; quem protege os
 *             dados são as políticas RLS criadas em supabase-setup.sql)
 *
 * NÃO coloque aqui a chave "service_role" — essa dá acesso total ao banco e
 * este arquivo é publicado junto com o site.
 */
window.PT_SUPABASE = {
  url: 'https://vqevroeubsihgenjulyt.supabase.co',
  anonKey: 'sb_publishable_rF8UW0Cv6925v5a7QQUQew_54QoeYSj',

  /* enforce: false → login.html e admin.html funcionam (dá p/ testar), mas o app
   *                  continua aberto como está hoje. Ninguém corre risco de ficar
   *                  trancado do lado de fora.
   * enforce: true  → o login passa a valer: sem entrar, não abre a calculadora
   *                  (e a tela de senha única sai de cena).
   * Vire para true só depois de confirmar que o login funciona. */
  enforce: false
};
