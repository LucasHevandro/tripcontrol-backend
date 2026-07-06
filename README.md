# ✈️ TripControl API

Backend da aplicação **TripControl**, uma plataforma para planejamento colaborativo de viagens, gerenciamento de participantes, controle de despesas, reservas e organização do roteiro.

O projeto foi desenvolvido utilizando **NestJS**, **Prisma** e **PostgreSQL**, seguindo uma arquitetura modular e boas práticas para construção de APIs REST.

---

# Tecnologias

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Passport
- Swagger (OpenAPI)
- Class Validator
- Class Transformer
- Multer
- Helmet

---

# Arquitetura

```
src
├── auth
├── common
├── expenses
├── invites
├── prisma
├── reservations
├── roadmap
├── trips
├── users
└── generated
```

Cada módulo é responsável por uma área de negócio da aplicação.

Exemplo:

- **Auth** → autenticação e autorização
- **Users** → gerenciamento de usuários
- **Trips** → gerenciamento de viagens
- **Expenses** → controle financeiro
- **Reservations** → hospedagem, transporte e reservas
- **Roadmap** → roteiro de atividades
- **Invites** → convite de participantes

---

# Funcionalidades

## Autenticação

- Cadastro de usuário
- Login
- Refresh Token
- Alteração de senha
- Perfil do usuário

---

## Viagens

- Criar viagem
- Editar viagem
- Excluir viagem
- Listar viagens
- Compartilhar viagem através de convite
- Definir orçamento
- Tipo de viagem
- Status da viagem

---

## Participantes

- Adicionar participantes
- Remover participantes
- Aceitar convite
- Controle de permissões

---

## Despesas

- Cadastro de despesas
- Categorias
- Pagador da despesa
- Divisão igualitária
- Divisão personalizada
- Histórico financeiro
- Resumo de gastos

---

## Reservas

Suporte para diferentes tipos de reservas.

Exemplos:

- Hotel
- Airbnb
- Passagens
- Aluguel de veículo
- Outros

---

## Roteiro

- Cadastro de atividades
- Organização por data
- Horários
- Localização
- Observações

---

# Banco de Dados

O projeto utiliza **PostgreSQL** com **Prisma ORM**.

Principais entidades:

- User
- RefreshToken
- Trip
- TripParticipant
- Expense
- ExpenseSplit
- Reservation
- RoadmapItem
- Invite

---

# Instalação

## Clone o projeto

```bash
git clone <repositorio>

cd tripcontrol-backend
```

---

## Instale as dependências

```bash
npm install
```

---

## Configure o arquivo .env

Crie um arquivo `.env` na raiz do projeto.

Exemplo:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/tripcontrol"

JWT_SECRET=seu_jwt_secret

JWT_REFRESH_SECRET=seu_refresh_secret

JWT_EXPIRES_IN=15m

JWT_REFRESH_EXPIRES_IN=30d

FRONTEND_URL=http://localhost:3000
```

---

# Banco de Dados

Gerar o client Prisma

```bash
npx prisma generate
```

Executar migrations

```bash
npx prisma migrate dev
```

Caso queira visualizar o banco:

```bash
npx prisma studio
```

---

# Executando o projeto

Modo desenvolvimento

```bash
npm run start:dev
```

Modo produção

```bash
npm run build

npm run start:prod
```

---

# Swagger

Após iniciar a aplicação, a documentação estará disponível em:

```
http://localhost:3000/api
```

*(A URL pode variar conforme a configuração do projeto.)*

---

# Scripts

Iniciar aplicação

```bash
npm run start
```

Modo desenvolvimento

```bash
npm run start:dev
```

Build

```bash
npm run build
```

Lint

```bash
npm run lint
```

Formatar código

```bash
npm run format
```

Testes

```bash
npm test
```

Cobertura

```bash
npm run test:cov
```

---

# Fluxo de autenticação

```
Register
      │
      ▼
 Login
      │
      ▼
Access Token
      │
      ▼
Requisições autenticadas
      │
      ▼
Refresh Token
      │
      ▼
Novo Access Token
```

---

# Segurança

A API utiliza:

- JWT Authentication
- Refresh Token
- Password Hash (bcrypt)
- Helmet
- Validação de DTOs
- Guards do NestJS
- Pipes de validação

---

# Organização do projeto

O projeto segue arquitetura modular do NestJS.

Cada módulo contém:

```
module

controller

service

dto

entities (quando necessário)

guards

decorators
```

---

# Convenções

- Controllers possuem apenas responsabilidade HTTP.
- Services concentram toda regra de negócio.
- DTOs realizam validações de entrada.
- Prisma é responsável pelo acesso ao banco.
- Todas as rotas protegidas utilizam JWT.

---

# Roadmap

Funcionalidades previstas para versões futuras:

- Notificações Push
- Compartilhamento em tempo real
- Chat entre participantes
- Integração com Google Maps
- Integração com Google Calendar
- Upload para armazenamento em nuvem
- Conversão automática de moedas
- Controle offline
- Dashboard financeiro
- Relatórios de viagem