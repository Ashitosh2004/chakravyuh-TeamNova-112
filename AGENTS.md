<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules
- Simulation/game/quiz logic lives in pure modules under `src/engines/` with tests in `src/test/engines.test.ts`; UI components only render engine output — keeps engines testable and reusable by the backend.
- Learning content (courses, quizzes, challenges, catalog) is typed data in `src/content/`; add lessons there, not in components — easy to extend and later serve from the API.
- All backend calls go through `src/services/api.ts` (endpoints in `docs/API_CONTRACT.md`); no Lovable Cloud/Supabase — the Zcode backend owns auth, data and AI.
- Auth uses backend httpOnly cookies; the browser stores only non-sensitive profile, preferences and device-local progress (zustand persist). Without `VITE_API_BASE_URL` the app runs an explicitly labelled development mode — never fake authentication, AI replies or remote saves.
- User code runs only in the ChakraScript interpreter (`src/engines/interpreter.ts`) — never eval/Function.
- Signed-in pages are `src/routes/_authenticated.*` behind a client session gate in `_authenticated.tsx`, which renders the AppShell.
- tsconfig keeps `strict` but disables `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` — they added noise across data-heavy engine code.
