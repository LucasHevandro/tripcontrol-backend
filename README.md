# TripControl API

Backend da aplicação TripControl, uma plataforma para planejamento colaborativo de viagens com participantes, despesas, pagamentos, reservas e roteiro.

## Tecnologias

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT e refresh token
- Passport
- Swagger/OpenAPI
- Class Validator
- Multer
- Helmet
- Resend

## Módulos

- `auth`: cadastro, login, Google Login, refresh token, logout e usuário autenticado.
- `users`: perfil, senha, preferências e avatar.
- `trips`: criação, listagem, detalhes, dashboard, atualização e remoção de viagens.
- `participants`: participantes, convites, entrada por token, saldos e notificações de acerto.
- `expenses`: despesas, divisão igual/customizada/individual, comprovantes e pagamentos entre participantes.
- `reservations`: reservas de hotel, voo, carro e passeio.
- `roadmap`: roteiro diário de atividades.
- `email`: envio de convites e lembretes.
- `prisma`: conexão com banco e client gerado.

## Requisitos

- Node.js compatível com NestJS 11
- Yarn ou npm
- PostgreSQL

## Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3001
DATABASE_URL=postgresql://usuario:senha@localhost:5432/tripcontrol
JWT_SECRET=uma-string-longa-com-no-minimo-32-caracteres
JWT_REFRESH_SECRET=outra-string-longa-com-no-minimo-32-caracteres
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
RESEND_API_KEY=
EMAIL_FROM=
```

Para subir um PostgreSQL local:

```bash
docker compose up -d
```

Instale dependências e prepare o banco:

```bash
yarn install
yarn prisma generate
yarn prisma migrate dev
```

## Execução

```bash
yarn start:dev
```

A API sobe em `http://localhost:3001/api/v1` por padrão.

Swagger:

```text
http://localhost:3001/api/docs
```

## Scripts

```bash
yarn build
yarn test
yarn test:e2e
yarn lint
yarn format
```

## Segurança

- Senhas são armazenadas com `bcrypt`.
- Refresh tokens são armazenados como hash SHA-256, não em texto puro.
- Rotas privadas usam JWT guard.
- DTOs são validados globalmente com whitelist e bloqueio de campos extras.
- Helmet é habilitado no bootstrap da aplicação.

## Fluxo Financeiro

- Despesas podem ser divididas igualmente, customizadas por participante ou marcadas como individuais.
- Ao editar valor, tipo de divisão ou participantes de uma despesa, os splits são recalculados.
- Pagamentos registrados entre participantes reduzem os saldos pendentes.
- Cálculos de saldo usam consultas em lote para evitar leituras repetidas por participante.

## Testes

A suíte atual cobre os principais fluxos de domínio:

- autenticação e hash de refresh token;
- criação de viagem com organizador;
- cálculo de splits de despesas;
- registro de pagamentos;
- cálculo de acertos entre participantes.
