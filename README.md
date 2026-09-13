# ✈️ TripControl — Backend API

> Planejar viagens com os amigos deve ser tão gostoso quanto a viagem em si.

O **TripControl** é uma plataforma feita para descomplicar o planejamento colaborativo de viagens. Ele cuida de tudo que acontece nos bastidores: divisão justa de despesas, organização de roteiros, gerenciamento de reservas e controle de saldos — sem planilhas confusas ou perrengues financeiros.

Este repositório contém a **API REST**, construída com NestJS, Prisma e PostgreSQL.

---

## 🌟 O que a API faz?

- 🗺️ **Gestão de Viagens**: crie viagens, defina datas, destinos, orçamento previsto e acompanhe o status.
- 👥 **Participantes & Convites**: convide amigos por e-mail ou link compartilhável, com suporte a organizadores, membros e dependentes.
- 💸 **Divisão de Despesas Inteligente**: divida contas igualmente, com valores personalizados ou marque gastos individuais. Comprovantes podem ser anexados.
- ⚖️ **Acertos Financeiros**: calcula automaticamente "quem deve quanto para quem", permitindo registrar pagamentos parciais ou totais.
- 📍 **Roteiro do Dia a Dia**: monte a programação diária com horários, locais e estimativas de custo para cada atividade.
- 🏨 **Central de Reservas**: guarde informações e confirmações de voos, hospedagens, passeios e aluguel de carros num único lugar.
- 📄 **Relatórios em PDF**: gere relatórios detalhados para exportar o resumo de despesas e finanças da viagem.
- 🔐 **Autenticação Confiável**: login tradicional (com hash seguro), login via Google, refresh tokens e recuperação de senha por e-mail.

---

## 🛠️ Tecnologias Utilizadas

- **NestJS 11** & **TypeScript** — arquitetura limpa, escalável e tipagem forte.
- **PostgreSQL** — banco de dados relacional confiável.
- **Prisma ORM** — modelagem e queries ágeis com migrações automatizadas.
- **Docker Compose** — ambiente de banco de dados local pronto para uso.
- **Passport & JWT** — controle de sessão com access e refresh tokens.
- **Swagger / OpenAPI** — documentação interativa para testar todas as rotas.

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- **Node.js** (v18+)
- **Yarn** (ou npm)
- **Docker** e Docker Compose instalados

### 1. Instale as dependências
```bash
yarn install
```

### 2. Configure as variáveis de ambiente
Copie o arquivo de exemplo para criar o seu `.env`:
```bash
cp .env.example .env
```
Se você for usar o PostgreSQL via Docker (passo 3), a string de conexão padrão do `.env` é:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tripcontrol?schema=public"
```

### 3. Suba o banco de dados
Com o Docker aberto, rode:
```bash
docker compose up -d
```
Isso vai iniciar uma instância do PostgreSQL configurada para o projeto na porta `5432`.

### 4. Aplique as migrações do banco
```bash
yarn prisma migrate dev
```
*(Opcional: você também pode rodar `yarn prisma db seed` caso tenha dados iniciais de teste).*

### 5. Inicie a API
```bash
yarn start:dev
```

Pronto! A API estará rodando em:
- 🌐 **API Base:** `http://localhost:3001/api/v1`
- 📚 **Documentação Swagger:** `http://localhost:3001/api/docs`

---

## 💻 Comandos Mais Usados

| Comando | Para que serve |
|---|---|
| `yarn start:dev` | Inicia a aplicação com hot-reload ativo |
| `yarn prisma studio` | Abre uma interface gráfica no navegador para visualizar e editar o banco |
| `yarn prisma migrate dev` | Aplica alterações do schema no banco de desenvolvimento |
| `yarn test` | Executa a suíte de testes unitários |
| `yarn test:e2e` | Executa os testes de ponta a ponta |
| `yarn lint` | Analisa o código em busca de erros de linting |
| `yarn build` | Compila o código TypeScript para a pasta `dist` |

---

## 🤝 Conectando com o Frontend

Por padrão, a API já vem configurada para aceitar requisições de `http://localhost:3000` via CORS. Se o seu frontend estiver em outra porta ou domínio, basta ajustar a variável `FRONTEND_URL` no arquivo `.env`.

---

<p align="center">
  Feito com 💙 para tornar viagens em grupo muito mais tranquilas!
</p>
