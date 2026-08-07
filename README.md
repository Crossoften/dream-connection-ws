# dream-connection-ws

API do **Dream Connection®** — decodificação emocional dos sonhos.
[NestJS](https://nestjs.com/) + [Prisma](https://www.prisma.io/) + MySQL 8, sobre o boilerplate padrão da casa.

## Domínio

| Módulo | Rotas | O que faz |
| --- | --- | --- |
| `auth` | `POST /v1/login` · `POST /v1/register` | JWT (guard global; `@IsPublic()` para rotas abertas) |
| `dreamer` | `GET/PUT /v1/dreamer/profile` · `POST/DELETE /v1/dreamer/people` · `GET /v1/dreamer/anamnesis/next` · `POST /v1/dreamer/anamnesis/answers` | Ficha anamnéstica + **anamnese contínua** (perguntas servidas de 5 em 5) |
| `dreams` | `POST /v1/dreams` · `PUT /v1/dreams/:id/elements` · `POST /v1/dreams/:id/insight` · `GET /v1/dreams` | Fluxo completo: registro → extração de elementos (IA) → atribuições → insight (IA) → diário. Atualiza dicionário e streak |
| `dictionary` | `GET /v1/dictionary` | Dicionário simbólico individual (nunca compartilhado) |
| `journey` | `GET /v1/journey/dashboard` | Painel: emoção do mês, últimos 7 dias, distribuição, símbolos recorrentes |
| `nps` | `GET /v1/nps/status` · `POST /v1/nps` | Caixinha de avaliação a cada 5 sonhos |
| `ai` | — | `GeminiService`: extração + insight com retry/deadline, modelos reserva e **fallback local** (o app nunca fica sem resposta) |

Swagger em `http://localhost:3010/docs`.

## IA (Gemini)

- Metodologia no prompt (`src/modules/ai/gemini.service.ts`): leitura acolhedora e levemente
  mística, **sempre subjetiva** — nunca previsão, nunca diagnóstico; usa somente as associações
  do próprio sonhador + ficha + contexto do dia.
- Envelope enviado por sonho: relato, associações (palavra → significado → emoção), emoção
  principal/secundária, passado/presente/futuro, evento do dia, ficha anamnéstica, respostas da
  anamnese contínua e movimentos dos últimos sonhos.
- Tokens de entrada/saída ficam gravados em `insights` (controle de custo por usuário/plano).
- Config no `.env`: `GEMINI_API_KEY`, `GEMINI_MODEL` (padrão `gemini-3.5-flash`),
  `GEMINI_FALLBACK_MODELS`.

## Rodando local

```bash
cp example.env .env            # preencha DB, JWT e GEMINI_API_KEY
docker compose up -d db        # MySQL 8 (porta externa ${DB_PORT}, ex.: 3311)
npm install
npx prisma migrate dev
npm run seed                   # admin, usuário de teste, textos e perguntas da anamnese
npm run start:dev              # http://localhost:3010
```

## Modelo de dados (resumo)

`User` (plano, streak, provider) → `DreamerProfile` (ficha) · `Person` (círculo) ·
`AnamnesisQuestion/Answer` (anamnese contínua) · `Dream` → `DreamElement[]` (palavra, tipo,
significado, emoção) → `Insight` (leitura da IA + tokens) · `DictionaryEntry` (dicionário
pessoal, contagem) · `NpsResponse`. Enum central: `EmotionKey` com as 12 emoções.
