# App builder contract

Preview is the product. The user sees the running app in the browser, not a plan.

- Dev server: `npm run dev` via `/workspace/startup.sh`, bound to `0.0.0.0:8080`. Do not start a second Vite. Do not recreate `vite.config.ts`.
- Keep `PreviewHostBridge`, `AuthProvider`, and the branding injector. Auth and the database stay off unless the user asks for accounts.
- Do not write `.env` files or paste tokens into chat. Secrets go on the host's secret screen.
- Do not delete `public/__grok__` or `server/`.
- Verify with `tsc --noEmit`, `node scripts/browser-smoke.mjs`, and `npm run build` before calling the preview done.
- TanStack Start must stay at `>= 1.168.60`.

## NBA matchup — Part 0 and Part 9

These rules sit on top of the app-builder contract above. They do not replace the preview port, the scaffold, or the branding injector.

Done means a public page that opens with no Grok or Claude login, a 20-minute writer that is not this chat, the engine in `core/` rather than a description, and an honest list of what was not proven.

- Do not call a preview, a hand refresh, or a sandbox loop a production cron pass.
- Do not deploy onto the Worker name `withered-sky-f341` unless it is verified as this project and the owner approves the replace.
- Do not ask for a token in chat. Cloudflare and GitHub Action secrets are set in the host's secret screen.
- Every number on the board traces to `core/` or to the ESPN pull. If it does not, label it UNVERIFIED.
- A model-versus-market gap is not an edge. The status line stays: "This engine has not yet been run or backtested. Every number in the spec is a starting prior to be re-estimated by the walk-forward backtest."
- Do not invent endpoints, limits, or backtest results. ESPN stays at a low request count. The runtime does not call a connector, the xAI API, or a chat.
- `/loop` is not the app scheduler. Production schedulers are Cloudflare cron, GitHub Actions, and Netlify only.
- The literal PDF marker "END OF MASTER PROMPT" was not on page 44. Do not invent the missing close. Appendix C ended after "What I could not verify."
