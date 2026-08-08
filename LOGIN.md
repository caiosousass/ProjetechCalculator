# Login e monitoramento de acesso

O app usa o [Supabase](https://supabase.com) (plano gratuito) para login com e-mail/senha
e para registrar quem entrou. Enquanto `supabase-config.js` estiver vazio, **nada muda**:
o app abre livre, sem tela de login.

## Passo a passo (uma vez só)

### 1. Criar o projeto
1. Entre em https://supabase.com e crie uma conta.
2. **New project** → dê um nome (ex.: `projetech-calc`), escolha uma senha de banco
   (guarde, mas você não vai precisar dela no dia a dia) e a região **South America (São Paulo)**.
3. Espere ~2 minutos até o projeto ficar pronto.

### 2. Criar as tabelas
1. No menu lateral: **SQL Editor** → **New query**.
2. Cole o conteúdo inteiro de `supabase-setup.sql` e clique em **Run**.
3. Antes de rodar, confira a **última linha** do arquivo: ela define quem é o administrador.
   Troque o e-mail se o seu for outro.

### 3. Ligar o app
1. No Supabase: **Project Settings** → **API**.
2. Copie **Project URL** e a chave **anon public**.
3. Cole em `supabase-config.js`:

```js
window.PT_SUPABASE = {
  url: 'https://SEU-PROJETO.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

A chave `anon` é pública de propósito — ela sozinha não dá acesso a nada, porque as
políticas RLS do passo 2 é que decidem quem lê o quê. **Nunca** coloque aqui a chave
`service_role`.

### 4. Criar o seu usuário
1. No Supabase: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Preencha e-mail e senha e marque **Auto Confirm User** (senão o login recusa por
   e-mail não confirmado).
3. Faça o mesmo para cada pessoa da equipe.
4. Rode de novo a última linha do `supabase-setup.sql` (o `update ... set is_admin = true`)
   com o seu e-mail, para virar administrador.

Pronto. Ao abrir o app, quem não estiver logado cai em `login.html`; você, como admin,
vê o atalho **Administração** no menu lateral.

## O que o painel de admin mostra

- **Usuários** — nome, e-mail, se é admin, se está bloqueado e o último acesso.
- **Acessos** — data/hora, usuário e aparelho (iOS/Android/Windows + navegador),
  filtrável por período.
- **Bloquear/desbloquear** — impede a entrada pelo app na hora.

## Limites que você precisa conhecer

- **O código do app continua público.** O repositório é público e o site é estático, então
  o login controla *quem usa a interface*, não *quem lê o código*. Para fechar o código
  também, o repositório precisa virar privado e o site sair do GitHub Pages.
- **Bloquear ≠ apagar.** O bloqueio é verificado pelo app. Para cortar o acesso de forma
  definitiva, apague ou desative o usuário no painel do Supabase.
- **Offline.** Quem já entrou continua usando o app sem internet (a sessão fica salva no
  aparelho). O registro de acesso desse momento não é gravado, por não haver conexão.
- **Registro de acesso.** Uma linha por login, mais uma por reabertura do app — no máximo
  uma por hora por aparelho, para o log não virar spam.

## Criar usuários direto pelo app

Hoje a criação é feita pelo painel do Supabase (2 cliques). Dá para trazer isso pra dentro
do admin do app, mas exige uma *Edge Function* no Supabase, porque criar usuário precisa da
chave `service_role`, que não pode ficar no site. É um passo a mais de instalação — peça
quando quiser.
