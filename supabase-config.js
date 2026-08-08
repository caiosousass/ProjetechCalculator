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
  anonKey: ''
};
