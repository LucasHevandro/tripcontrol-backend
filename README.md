# ✈️ TripControl API

> O backend que faz o TripControl funcionar — cuidando de tudo que acontece nos bastidores para que planejar viagens em grupo seja simples e sem dor de cabeça.

O TripControl é uma plataforma de planejamento colaborativo de viagens. Aqui você encontra o código da API que gerencia participantes, despesas, pagamentos, reservas, roteiros e muito mais.

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
|---|---|
| Framework | NestJS 11 + TypeScript |
| Banco de Dados | PostgreSQL + Prisma ORM |
| Autenticação | JWT (access + refresh token) · Passport · Google Login |
| Documentação | Swagger / OpenAPI |
| Validação | Class Validator + Class Transformer |
| Upload | Multer |
| Segurança | Helmet · bcrypt · SHA-256 |
| E-mail | Resend |

---

## 📦 Módulos

O projeto é organizado em módulos bem definidos, cada um com sua responsabilidade:

- **Auth** — Cadastro, login, login com Google, refresh token, logout e identificação do usuário autenticado.
- **Users** — Perfil do usuário, alteração de senha, preferências e upload de avatar.
- **Trips** — Criação, listagem, detalhes, dashboard, edição e remoção de viagens.
- **Participants** — Gerenciamento de participantes, convites, entrada por link/token, saldos e notificações de acerto financeiro.
- **Expenses** — Registro de despesas com divisão igual, customizada ou individual. Inclui comprovantes e pagamentos entre participantes.
- **Reservations** — Reservas de hotel, voo, aluguel de carro e passeios.
- **Roadmap** — Roteiro diário com atividades organizadas por dia de viagem.
- **Email** — Envio de convites e lembretes por e-mail via Resend.
- **Prisma** — Módulo de conexão com o banco e client gerado pelo Prisma.

---

## 🗺️ Modelo de dados

```mermaid
erDiagram
    USER ||--o{ TRIP_PARTICIPANT : "participa de"
    USER ||--o{ REFRESH_TOKEN : possui
    USER ||--o{ INVITE : envia
    USER ||--o{ EXPENSE : paga

    TRIP ||--o{ TRIP_PARTICIPANT : tem
    TRIP ||--o{ EXPENSE : tem
    TRIP ||--o{ RESERVATION : tem
    TRIP ||--o{ ROADMAP_ACTIVITY : tem
    TRIP ||--o{ INVITE : tem
    TRIP ||--o{ PAYMENT : tem

    TRIP_PARTICIPANT ||--o{ EXPENSE_SPLIT : "deve em"
    TRIP_PARTICIPANT ||--o{ PAYMENT : "paga (fromParticipant)"
    TRIP_PARTICIPANT ||--o{ PAYMENT : "recebe (toParticipant)"
    TRIP_PARTICIPANT }o--o| TRIP_PARTICIPANT : "patrocina (sponsorId)"

    EXPENSE ||--o{ EXPENSE_SPLIT : divide

    USER {
        string id PK
        string email UK
        string password "null se login via Google"
        string googleId UK
    }
    TRIP {
        string id PK
        string status "PLANNING | ONGOING | COMPLETED"
        decimal budget
    }
    TRIP_PARTICIPANT {
        string id PK
        string tripId FK
        string userId FK
        string sponsorId FK "nível único, ver seção de IDs abaixo"
        string role "ORGANIZER | MEMBER"
    }
    EXPENSE {
        string id PK
        string tripId FK
        string paidById FK "User.id"
        decimal amount
        string splitType "EQUAL | CUSTOM | INDIVIDUAL"
    }
    EXPENSE_SPLIT {
        string id PK
        string expenseId FK
        string participantId FK "TripParticipant.id"
        decimal amount
    }
    PAYMENT {
        string id PK
        string fromParticipantId FK "TripParticipant.id"
        string toParticipantId FK "TripParticipant.id"
        decimal amount
    }
    RESERVATION {
        string id PK
        string tripId FK
        string category "HOTEL | FLIGHT | CAR | TOUR"
        json details "campos variam por categoria"
    }
    ROADMAP_ACTIVITY {
        string id PK
        string tripId FK
        string title
        date date
    }
    INVITE {
        string id PK
        string tripId FK
        string invitedBy FK "User.id"
        string status "PENDING | ACCEPTED | EXPIRED"
    }
    REFRESH_TOKEN {
        string id PK
        string userId FK
        string token UK "hash SHA-256"
    }
```

### `TripParticipant.id` vs `User.id` — qual usar onde

O ponto que mais gera confusão no código: existem dois "ids de pessoa" diferentes, e a API mistura os dois de propósito conforme o contexto.

| Campo | Referencia | Onde aparece |
|---|---|---|
| `User.id` | a conta/pessoa em si, independente da viagem | `Expense.paidById`, `Invite.invitedBy`, o campo `id` que a API expõe pra cada participante em `GET /participants` |
| `TripParticipant.id` | a participação de uma pessoa numa viagem específica | `ExpenseSplit.participantId`, `Payment.fromParticipantId`/`toParticipantId`, `TripParticipant.sponsorId` |

Por quê os dois existem: a mesma pessoa (`User`) pode participar de várias viagens, e `TripParticipant` é o registro dessa participação em uma viagem específica — é nele que saldos, splits e o vínculo de dependente (`sponsorId`) se apoiam, porque fazem sentido só *dentro* de uma viagem. Já `Expense.paidById` e `Invite.invitedBy` referenciam `User.id` diretamente porque essas ações pertencem à pessoa, não a uma participação específica.

Na prática: os endpoints REST (`/participants`, `/expenses` etc.) sempre falam em `User.id` no corpo da requisição e resposta — o frontend nunca precisa saber que `TripParticipant.id` existe. A tradução entre os dois acontece dentro dos services (ex: `participants.service.ts`, `expenses.service.ts`), geralmente via `tripId_userId` (a chave composta única de `TripParticipant`).

---

## ⚡ Início Rápido

### Pré-requisitos

- **Node.js** compatível com NestJS 11
- **Yarn** (ou npm, se preferir)
- **PostgreSQL** rodando localmente ou via Docker

### 1. Clone e instale as dependências

```bash
git clone <url-do-repositorio>
cd tripcontrol-backend
yarn install
```

### 2. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (ou copie o `.env.example`):

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

### 3. Suba o banco de dados

Se quiser usar Docker, é só rodar:

```bash
docker compose up -d
```

### 4. Prepare o Prisma e rode as migrations

```bash
yarn prisma generate
yarn prisma migrate dev
```

### 5. Inicie o servidor 🚀

```bash
yarn start:dev
```

A API estará disponível em **http://localhost:3001/api/v1**

Para explorar os endpoints com o Swagger, acesse:
**http://localhost:3001/api/docs**

---

## 📋 Scripts Disponíveis

| Comando | O que faz |
|---|---|
| `yarn start:dev` | Inicia o servidor em modo de desenvolvimento (com hot reload) |
| `yarn build` | Compila o projeto para produção |
| `yarn start:prod` | Roda a versão compilada |
| `yarn test` | Executa os testes unitários |
| `yarn test:e2e` | Executa os testes end-to-end |
| `yarn test:cov` | Gera relatório de cobertura de testes |
| `yarn lint` | Verifica e corrige problemas de lint |
| `yarn format` | Formata o código com Prettier |

---

## 🚀 Deploy

O deploy roda no Railway, com um serviço de PostgreSQL apontado via `DATABASE_URL`.

- **Migrations**: o Railway já está configurado para rodar `prisma migrate deploy` automaticamente a cada subida do banco/serviço — não é necessário (nem recomendado) rodar `migrate dev` em produção, esse comando é só para desenvolvimento local.
- **Uploads (`uploads/avatars`, `uploads/receipts`)**: o filesystem do Railway não é persistente entre deploys por padrão. É necessário anexar um **Volume** ao serviço, montado no caminho `uploads/` da aplicação — sem isso, avatares e comprovantes enviados são perdidos a cada novo deploy.

---

## 🔒 Segurança

A segurança não foi um detalhe de última hora — ela está presente em cada camada:

- **Senhas** são armazenadas com hash bcrypt (nunca em texto puro).
- **Refresh tokens** são salvos como hash SHA-256 no banco, garantindo que mesmo com acesso ao banco, os tokens não possam ser reutilizados.
- **Rotas privadas** são protegidas por JWT guard via Passport.
- **DTOs** são validados globalmente com whitelist e bloqueio automático de campos desconhecidos — nada passa sem ser esperado.
- **Rate limiting** (`@nestjs/throttler`) protege `/auth/login` e `/auth/register` contra força bruta (5 tentativas/minuto por IP), com um limite global mais permissivo (20/minuto) no restante da API.
- **Helmet** está habilitado no bootstrap da aplicação, adicionando headers de segurança HTTP.

---

## 💰 Fluxo Financeiro

O controle financeiro é uma das partes mais importantes do TripControl. Veja como funciona:

1. **Divisão flexível** — Despesas podem ser divididas igualmente entre todos, com valores customizados por participante, ou marcadas como individuais.
2. **Recálculo automático** — Ao editar o valor, o tipo de divisão ou os participantes de uma despesa, os splits são recalculados automaticamente.
3. **Pagamentos entre participantes** — Pagamentos registrados entre participantes reduzem os saldos pendentes em tempo real.
4. **Performance** — Os cálculos de saldo usam consultas em lote, evitando leituras repetidas por participante e mantendo tudo rápido mesmo com muitos dados.

---

## 🧪 Testes

A suíte de testes cobre os principais fluxos de domínio para garantir que nada quebre silenciosamente:

- ✅ Autenticação e hash de refresh token
- ✅ Criação de viagem com organizador
- ✅ Cálculo de splits de despesas
- ✅ Registro de pagamentos
- ✅ Cálculo de acertos entre participantes

```bash
# Rode os testes
yarn test

# Veja a cobertura
yarn test:cov
```

---

## 📄 Licença

Projeto privado — uso restrito.
