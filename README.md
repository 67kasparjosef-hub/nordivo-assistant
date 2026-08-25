# NORDIVO — Reklamační asistent

AI asistent pro zákaznickou podporu a reklamace, postavený na Claude (Anthropic API).
Data v `data/nordivo-data.json` jsou **zcela fiktivní** — projekt slouží jako testovací/ukázková implementace, kterou lze napojit na reálný e-shop.

## Struktura projektu

```
nordivo-assistant/
├── server/
│   └── index.js          # Express backend — drží API klíč, volá Anthropic, servíruje frontend
├── public/
│   └── index.html         # Chat widget (frontend), volá pouze /api/chat na vlastním serveru
├── data/
│   └── nordivo-data.json  # Fiktivní databáze e-shopu (zákazníci, objednávky, reklamace…)
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Proč je tu backend?

Anthropic API klíč se **nikdy** nesmí objevit v kódu, který běží v prohlížeči — kdokoliv by ho mohl vyčíst ze zdrojového kódu stránky a zneužít na váš účet. Server (`server/index.js`) proto:

1. drží klíč v proměnné prostředí (`.env`, nikdy v gitu),
2. na požadavek z frontendu doplní systémový prompt s daty e-shopu a pravidly komunikace,
3. zavolá Anthropic Messages API a vrátí frontendu jen hotovou odpověď.

## Rychlý start

```bash
npm install
cp .env.example .env
# do .env doplňte ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Otevřete `http://localhost:3000`.

## Nasazení do GitHubu

```bash
cd nordivo-assistant
git init
git add .
git commit -m "Initial commit: NORDIVO reklamační asistent"
git branch -M main
git remote add origin https://github.com/<vas-ucet>/<nazev-repa>.git
git push -u origin main
```

`.env` se díky `.gitignore` nikdy nenahraje — klíč zůstane jen u vás.

## Nasazení do provozu

Backend je běžná Node/Express aplikace, takže půjde nasadit prakticky kamkoliv, kde lze spustit `npm start` a nastavit proměnné prostředí, např.:

- **Render** / **Railway** / **Fly.io** — nejjednodušší, stačí propojit GitHub repo a doplnit `ANTHROPIC_API_KEY` v nastavení proměnných prostředí.
- **VPS** (např. přes PM2 nebo Docker).

Frontend (`public/index.html`) není potřeba hostovat zvlášť — Express ho servíruje automaticky.

## Napojení na skutečný e-shop

Aktuálně se při každém dotazu načte **celý** `data/nordivo-data.json` a vloží se do promptu (viz `loadShopData()` a `buildSystemPrompt()` v `server/index.js`). To je v pořádku pro pár desítek testovacích záznamů, ale pro reálný e-shop to není vhodné ani bezpečné (cizí zákazník by se mohl v teorii doptat na data někoho jiného). Doporučený postup:

1. **Autentizace zákazníka** — než se asistent zeptá na cokoliv citlivého, ověřte přihlášeného uživatele (session/JWT) a do promptu vkládejte **jen jeho vlastní** objednávky a reklamace, ne celou databázi.
2. **Napojení na e-shopové API** — v `loadShopData()` nahraďte čtení JSON souboru voláním na váš skutečný systém:
   - Shoptet, Shopify, WooCommerce → jejich REST/GraphQL API,
   - vlastní e-shop → přímý dotaz do vaší databáze (Postgres/MySQL/…).
3. **Tool use místo natvrdo vloženého kontextu** (doporučeno pro větší katalog) — místo vkládání celé databáze do system promptu dejte Claude k dispozici "nástroje" jako `hledej_objednavku(cislo)` nebo `over_reklamaci(cislo)`. Model si sám vyžádá jen data, která potřebuje, a vy je natáhnete z DB až v tu chvíli. To se řeší přes pole `tools` v Anthropic Messages API — víc v [dokumentaci k tool use](https://docs.claude.com).
4. **Zápis zpět** — pokud chcete, aby asistent uměl reklamaci opravdu založit nebo předat pracovníkovi (ne jen navrhnout), přidejte v backendu funkci, která zapíše do vaší databáze/helpdesku, a napojte ji jako další tool.

## Řešení problémů (Troubleshooting)

### Chat hlásí „Omlouváme se, došlo k technické chybě při spojení“

Tuhle hlášku zobrazí frontend jen tehdy, když se **vůbec nedovolal** na backend, nebo backend vrátil něco, co nejde přečíst jako JSON. Nejde tedy nutně o problém s Claude/Anthropic API — nejčastější příčiny v pořadí pravděpodobnosti:

1. **Stránka je otevřená přímo jako soubor** (dvojklik na `public/index.html`, adresa v prohlížeči začíná `file://`). V tomto případě `fetch('/api/chat')` nemá kam se připojit — v aktuální verzi vás na to aplikace rovnou upozorní hláškou v chatu. **Řešení:** spusťte `npm start` a otevřete `http://localhost:3000` (ne soubor přímo).
2. **Backend neběží nebo spadl při startu** — zkontrolujte terminál, kde jste pustili `npm start`. Musí tam být řádek `[NORDIVO] Asistent běží na http://localhost:3000`. Pokud tam je chybová hláška (např. `Cannot find module 'express'`), spusťte `npm install` znovu.
3. **`npm install` nebylo spuštěno** / `node_modules` chybí — bez něj server vůbec nenaběhne.
4. **Frontend a backend běží na různých portech** (např. jste `public/index.html` otevřeli přes VS Code Live Server na portu 5500, zatímco backend běží na 3000) — v aktuální verzi je zapnuté CORS, takže by to mělo fungovat i tak, ale doporučené je vždy používat adresu, kterou vypisuje samotný server (`http://localhost:PORT`).

### Jak si to ověřit krok za krokem

1. V terminálu spusťte `npm start` a počkejte na `[NORDIVO] Asistent běží na http://localhost:3000`.
2. Otevřete `http://localhost:3000/api/health` přímo v prohlížeči (nebo `curl http://localhost:3000/api/health`). Měli byste vidět JSON typu:
   ```json
   { "ok": true, "apiKeyConfigured": true, "model": "claude-sonnet-5", "dataFileReadable": true }
   ```
   Pokud `apiKeyConfigured` je `false`, `.env` nemá platný `ANTHROPIC_API_KEY` (nebo jste po úpravě `.env` server nerestartovali — proměnné prostředí se načítají jen při startu).
3. Otevřete `http://localhost:3000` (hlavní chat) a v prohlížeči otevřete konzoli (F12 → Console). Po odeslání zprávy sledujte:
   - v konzoli prohlížeče případné `[NORDIVO] ...` chybové řádky s detailem,
   - v terminálu se serverem řádky `[NORDIVO] POST /api/chat` a případně `[NORDIVO] Anthropic API chyba: <status> <text>` — status `401` znamená neplatný API klíč, `429` vyčerpaný kredit/limit.
4. Pošlete zprávu v chatu — nová verze buď odpoví, nebo ukáže konkrétnější chybu (ne jen obecnou hlášku) — např. „Server nemá nastavený ANTHROPIC_API_KEY“ nebo „Chyba při komunikaci s AI modelem“.

Pokud po těchto krocích chyba přetrvává, pošlete přesně to, co se objeví v (a) terminálu se serverem a (b) konzoli prohlížeče (F12) — s tím se dá už přesně diagnostikovat, protože to jsou v tuto chvíli jediná místa, kde se skutečná příčina zapisuje.

## Bezpečnostní pravidla, která asistent dodržuje

Zakotvená v system promptu (`buildSystemPrompt` v `server/index.js`):

- nikdy nezobrazuje interní poznámky zaměstnanců (`internal_note`),
- nikdy sám neschvaluje vrácení peněz ani výměnu jen na základě tvrzení zákazníka,
- nevymýšlí si objednávky, reklamace ani produkty, které nejsou v datech,
- ověřuje totožnost a čísla dokladů před zásadními kroky.

Při napojení na reálná data tato pravidla v promptu zachovejte a doplňte je o vlastní (např. GDPR, konkrétní eskalační procesy).
