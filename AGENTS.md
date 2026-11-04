# Working on TioPatinhas

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing domain or persistence code.

- Never stage or commit JSON, spreadsheets, real-user backups, screenshots with personal financial data, or credentials.
- Generate local JSON manifests with `node scripts/bootstrap.mjs`; keep generated files ignored.
- Use fictitious fixtures. Run `npm run check` and `npm run build` before publishing.
- Preserve the legacy database keys so existing users retain their data. Demo storage must stay isolated.
- Append financial events; never rewrite history. Historical USD must use its saved exchange rate.
- Rebalancing proposes purchases only. Cofrinhos allocate existing wealth without increasing the total.
- Keep architecture documentation and the exported JSON contract aligned.
