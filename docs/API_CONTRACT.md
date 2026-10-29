# CHAKRAVYUH — Provisional API Contract (for the Zcode backend)

Status: **provisional**. The frontend calls these endpoints through `src/services/api.ts`. None exist yet.

- Base URL: `VITE_API_BASE_URL` (e.g. `https://api.example.com`). When unset, the app runs in a clearly-labelled development mode and backend-only features show an "unavailable" state.
- Auth: httpOnly session cookies set by the backend. Requests use `credentials: "include"`. The browser never stores tokens or passwords.
- Errors: JSON `{ "message": string, "code"?: string, "details"?: object }`.
  - 400/422 → `validation`, 401/403 → `unauthorized` (frontend clears session, redirects to login), 404 → `not_found`, 429 → `rate_limited`, 5xx → `server`. Client-side: `timeout` (20 s default, 60 s for AI), `network`, `aborted`.

## Auth
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | /api/v1/auth/register | – | `{ displayName, email, password }` | `{ user: User }` + session cookie |
| POST | /api/v1/auth/login | – | `{ email, password }` | `{ user: User }` + cookie. 401 on bad credentials |
| POST | /api/v1/auth/logout | yes | – | 204 |
| POST | /api/v1/auth/forgot-password | – | `{ email }` | `{ message }` (always 200 to avoid account enumeration) |
| GET | /api/v1/auth/me | yes | – | `{ user: User }` / 401 |
| POST | /api/v1/auth/refresh | refresh cookie | – | `{ user: User }` / 401 |

`User = { id, email, displayName, level: "beginner"|"intermediate"|"advanced" }`

## Profile
| PATCH | /api/v1/users/me | yes | `{ displayName?, level? }` | `User` |

## AI assistant
| POST | /api/v1/ai/chat | yes | `ChatRequest` | `ChatResponse` |

```ts
ChatRequest = { conversationId?: string; message: string (1–4000 chars); level;
  context?: { courseId?, lessonId?, simulationId?, challengeId?, code?, quizQuestionId? } }
ChatResponse = { conversationId: string; messageId: string; content: string /* markdown-ish, ``` code fences */;
  suggestions?: { label: string; href: string }[] }
```
Errors: 429 rate limit, 503 provider unavailable. Provider keys live only on the server. Streaming (SSE) may be added later as `POST /api/v1/ai/chat/stream`.

## Courses (optional — content currently bundled in the frontend)
| GET | /api/v1/courses | – | – | `Course[]` (shape: `src/content/types.ts`) |

## Coding challenges
| GET | /api/v1/challenges | yes | – | `ChallengeSummary[]` |
| GET | /api/v1/challenges/:id | yes | – | `Challenge` without hidden tests |
| POST | /api/v1/challenges/:id/run | yes | `{ code }` | `{ results: { name, passed, detail }[] }` (visible tests) |
| POST | /api/v1/challenges/:id/submit | yes | `{ code }` | `{ passed, total, score }` — authoritative, includes hidden tests |

Language: ChakraScript (Arduino-style C subset), reference interpreter in `src/engines/interpreter.ts`. The server must run the same rules with its own hidden tests; client results are practice only.

## Quizzes
| GET | /api/v1/quizzes | yes | – | `QuizSummary[]` |
| GET | /api/v1/quizzes/:id | yes | – | quiz without answers |
| POST | /api/v1/quizzes/:id/submit | yes | `{ answers: Record<questionId, AnswerValue>, timeTakenSec }` | `{ attemptId, score, accuracy, byTopic, perQuestion }` |

## Progress & achievements
| GET | /api/v1/progress | yes | – | `{ lessonsCompleted: string[], quizAttempts, challengesPassed, simulationsUsed, scenariosCompleted }` |
| GET | /api/v1/progress/activity?days=14 | yes | – | `{ date, count }[]` |
| GET | /api/v1/achievements | yes | – | `Achievement[]` (`src/stores/progress.ts`) |
| POST | /api/v1/activities | yes | `ActivityEvent` without `at` | `{ id }` |

`ActivityEvent` types: `lesson_completed`, `quiz_attempt`, `challenge_run`, `challenge_passed`, `simulation_used`, `scenario_completed`, `game_score`.

## Search (optional)
| GET | /api/v1/search?q=&category=&difficulty= | yes | – | `SearchItem[]` |
