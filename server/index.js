// server/index.js
// Backend pro NORDIVO reklamačního asistenta.
// Drží Anthropic API klíč BEZPEČNĚ na serveru — frontend na něj nemá přístup.
// Frontend posílá historii zpráv na POST /api/chat, server doplní systémový
// prompt (pravidla + data e-shopu) a zavolá Anthropic Messages API.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// CORS: povoluje volání i v případě, že frontend někdy poběží na jiném
// originu/portu než backend (např. Live Server na :5500 a backend na :3000).
// Pro produkci lze omezit přes proměnnou ALLOWED_ORIGIN v .env.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));

app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

if (!ANTHROPIC_API_KEY) {
  console.warn(
    '[NORDIVO] VAROVÁNÍ: ANTHROPIC_API_KEY není nastaven. Zkopírujte .env.example do .env, doplňte klíč a server restartujte.'
  );
} else {
  console.log(`[NORDIVO] API klíč načten (${ANTHROPIC_API_KEY.slice(0, 10)}…, délka ${ANTHROPIC_API_KEY.length}). Model: ${ANTHROPIC_MODEL}`);
}

// Data e-shopu. V produkci nahraďte živým dotazem do vaší databáze / e-shop API
// (viz komentář ve funkci loadShopData níže).
const DATA_PATH = path.join(__dirname, '..', 'data', 'nordivo-data.json');

function loadShopData() {
  // TODO (produkce): místo čtení statického JSON souboru sem doplňte dotaz
  // na váš skutečný systém (Shoptet/Shopify/WooCommerce API, vlastní DB...),
  // ideálně jen pro konkrétního přihlášeného zákazníka, ne celou databázi.
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

function buildSystemPrompt(shopData) {
  return `Jsi AI reklamační asistent e-shopu NORDIVO.cz. Komunikuješ výhradně česky, profesionálně, vstřícně a stručně (běžně 3-8 vět, delší jen pokud je potřeba vypsat více údajů).

DATABÁZE E-SHOPU (jediný zdroj pravdy, nic si nedomýšlej mimo tato data):
${JSON.stringify(shopData, null, 1)}

ZÁVAZNÁ PRAVIDLA:
1. Pracuj pouze s daty výše. Nikdy si nevymýšlej zákazníky, objednávky, produkty, čísla reklamací ani stavy, které v datech nejsou.
2. Pole "internal_note" u reklamace je INTERNÍ POZNÁMKA ZAMĚSTNANCE — nikdy ji nezobrazuj ani neparafrázuj zákazníkovi doslova. Můžeš z ní nanejvýš odvodit obecnou informaci o stavu (např. "produkt je na servisní diagnostice").
3. Nikdy sám neschvaluj vrácení peněz, výměnu ani jiné zásadní rozhodnutí jen na základě tvrzení zákazníka. Ověř identitu, číslo reklamace a objednávky, sděl stav a vysvětli, že finální rozhodnutí u sporných kroků provádí pracovník reklamačního oddělení — řekni, že požadavek zaznamenáváš k vyřízení.
4. Pokud zákazník neuvede číslo objednávky/reklamace, zkus dohledat podle jména nebo e-mailu. Při nejednoznačnosti požádej o upřesnění.
5. Pokud reklamaci/objednávku/produkt v datech nenajdeš, řekni to a nabídni ověření čísla nebo založení nové reklamace.
6. Pokud zákazník popisuje novou závadu, pomoz ji zařadit do jednoho z definovaných typů reklamace a odhadni prioritu (NÍZKÁ = kosmetické vady; NORMÁLNÍ = nefunkční příslušenství, výpadky připojení, problémy s nabíjením; VYSOKÁ = zařízení nejde zapnout, opakovaně selhává, přehřívá se, bezpečnostní riziko, poškození při doručení).
7. Při sdělování stavu reklamace použij **tučně** pro čísla a klíčové údaje, piš přirozeně.
8. Nikdy nepřidávej fiktivní kontakty, čísla ani sliby (např. konkrétní datum vyřízení), pokud nejsou v datech.
9. Piš stručně a mobilně čitelně — krátké odstavce, odrážky pro výčty.
10. Mimo-tématické dotazy zdvořile nasměruj zpět k reklamacím/objednávkám NORDIVO.cz.`;
}

// Rychlá diagnostika bez nutnosti procházet chat — otevřete v prohlížeči
// http://localhost:3000/api/health nebo `curl http://localhost:3000/api/health`.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: Boolean(ANTHROPIC_API_KEY),
    model: ANTHROPIC_MODEL,
    dataFileReadable: fs.existsSync(DATA_PATH)
  });
});

app.post('/api/chat', async (req, res) => {
  console.log(`[NORDIVO] POST /api/chat — ${new Date().toISOString()}`);
  try {
    if (!ANTHROPIC_API_KEY) {
      console.error('[NORDIVO] Chybí ANTHROPIC_API_KEY — požadavek zamítnut.');
      return res.status(500).json({ error: 'Server nemá nastavený ANTHROPIC_API_KEY. Zkontrolujte soubor .env a restartujte server.' });
    }

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      console.error('[NORDIVO] Neplatné tělo požadavku, "messages" chybí nebo je prázdné:', req.body);
      return res.status(400).json({ error: 'Chybí pole "messages".' });
    }

    const shopData = loadShopData();
    const systemPrompt = buildSystemPrompt(shopData);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[NORDIVO] Anthropic API chyba:', response.status, errText);
      return res.status(502).json({ error: 'Chyba při komunikaci s AI modelem.' });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n');

    console.log('[NORDIVO] Odpověď od Anthropic API v pořádku, délka odpovědi:', reply.length);
    res.json({ reply: reply || 'Omlouvám se, odpověď se nepodařilo zpracovat.' });
  } catch (err) {
    // Sem se dostaneme typicky při výpadku sítě mezi serverem a api.anthropic.com,
    // nebo pokud server běží na Node < 18 a global fetch neexistuje.
    console.error('[NORDIVO] Chyba serveru při volání Anthropic API:', err);
    res.status(500).json({ error: 'Interní chyba serveru: ' + (err.message || 'neznámá chyba') });
  }
});

// Servíruje frontend (public/index.html a statické soubory)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Cokoliv, co nebylo obslouženo výše (neexistující API cesta apod.),
// musí vrátit JSON, ne výchozí HTML chybovou stránku Expressu — jinak
// frontendu spadne response.json() a zobrazí generickou chybu spojení.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Neznámá API cesta: ${req.method} ${req.originalUrl}` });
});

// Globální error handler — i neočekávaná chyba (např. špatně sestavené
// JSON tělo požadavku) se vrátí jako JSON, nikdy jako HTML stránka.
app.use((err, req, res, next) => {
  console.error('[NORDIVO] Neošetřená chyba:', err);
  res.status(500).json({ error: 'Neočekávaná chyba serveru: ' + (err.message || 'neznámá chyba') });
});

app.listen(PORT, () => {
  console.log(`[NORDIVO] Asistent běží na http://localhost:${PORT}`);
  console.log(`[NORDIVO] Diagnostika: http://localhost:${PORT}/api/health`);
  if (!ANTHROPIC_API_KEY) {
    console.log('[NORDIVO] >>> Chat nebude fungovat, dokud nenastavíte ANTHROPIC_API_KEY v .env a server nerestartujete. <<<');
  }
});
