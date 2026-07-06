# Gift Cards da Viagem — deploy gratuito (Vercel + Neon)

## 1. Banco de dados (Neon — free tier)
1. Crie conta em https://neon.tech (grátis).
2. Crie um projeto novo.
3. No painel do projeto, abra o **SQL Editor** e cole o conteúdo de `schema.sql` (deste pacote). Rode.
4. Vá em **Connect** e copie a *connection string* (algo como `postgres://usuario:senha@ep-xxx.neon.tech/neondb?sslmode=require`). Isso vai virar a variável `DATABASE_URL`.

## 2. Gerar os segredos
No terminal (Mac/Linux, ou WSL no Windows):
```
openssl rand -hex 32   # rode duas vezes: uma para SESSION_SECRET, outra para ENCRYPTION_KEY
```
Guarde os dois valores gerados.

## 3. Deploy no Vercel (free tier)
1. Crie conta em https://vercel.com (grátis, pode usar login do GitHub).
2. Instale a CLI: `npm i -g vercel`
3. Dentro desta pasta, rode: `vercel`
   - Na primeira vez ele pergunta algumas coisas, aceite os padrões (é um projeto novo).
4. Depois do primeiro deploy, configure as variáveis de ambiente:
   ```
   vercel env add DATABASE_URL
   vercel env add SESSION_SECRET
   vercel env add ENCRYPTION_KEY
   ```
   Cole os valores quando pedido (escolha "Production" e "Preview" quando perguntado o ambiente).
5. Rode `vercel --prod` para publicar com as variáveis já configuradas.

   *Alternativa sem terminal:* suba esta pasta para um repositório no GitHub e importe o repositório em vercel.com → New Project. As variáveis de ambiente ficam em **Settings → Environment Variables** do próprio painel.

## 4. Usar
Abra a URL que o Vercel gerou (ex: `https://seu-projeto.vercel.app`) no Safari do iPhone, crie sua conta (e-mail + senha) e comece a cadastrar os gift cards.
Toque em Compartilhar → **Adicionar à Tela de Início** para abrir como um app.

## Segurança (o que já está feito)
- Senhas nunca são guardadas em texto puro (hash com scrypt + salt).
- O PIN de cada gift card é criptografado (AES-256-GCM) antes de ir pro banco — só é decifrado na hora de mostrar pra você, autenticado.
- Cada usuário só enxerga os próprios gift cards (toda consulta ao banco é filtrada pelo usuário logado).
- Sessão via cookie `HttpOnly` assinado, então não fica acessível por JavaScript no navegador.

## Custos
Tudo dentro do free tier: Neon (0.5 GB grátis) e Vercel (Hobby plan). Não há cobrança enquanto o uso ficar dentro desses limites, o que é sobra pra um app pessoal como este.
