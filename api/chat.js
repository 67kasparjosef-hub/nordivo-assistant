export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }
    // prijme cokoliv co posle frontend - message, text, query, prompt
    const message = body?.message || body?.text || body?.query || body?.prompt || "";

    if (req.method === 'GET') {
      return res.status(200).json({ok:true, msg: "API bezi, posli POST s message"});
    }

    if (!message) {
      return res.status(200).json({reply: "Dostal jsem prazdnou zpravu, napis prosim dotaz"});
    }

    let produktyText = "";
    try {
      const fr = await fetch('https://813343.myshoptet.com/universal.xml');
      const xml = await fr.text();
      const parts = xml.split('<SHOPITEM>');
      let out = [];
      for (let i=1; i<parts.length && out.length<15; i++) {
        const p = parts[i];
        const n = p.match(/<PRODUCTNAME>(.*?)<\/PRODUCTNAME>/s);
        const pr = p.match(/<PRICE_VAT>(.*?)<\/PRICE_VAT>/s);
        const u = p.match(/<URL>(.*?)<\/URL>/s);
        if (!n) continue;
        const name = n[1].replace(/<!\[CDATA\[|\]\]>/g,'').trim();
        const price = pr?pr[1].replace(/<!\[CDATA\[|\]\]>/g,'').trim():'';
        const url = u?u[1].replace(/<!\[CDATA\[|\]\]>/g,'').trim():'';
        out.push(`${name} | ${price} Kc | ${url}`);
      }
      produktyText = out.join('\n');
    } catch(e){ produktyText = "Produkty: https://813343.myshoptet.com"; }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
      body: JSON.stringify({
        model:'gpt-4o-mini',
        messages:[
          {role:'system', content:`Jsi NORDIVO reklamacni asistent pro e-shop 813343.myshoptet.com. Znas produkty:\n${produktyText}\nOdpovidej cesky, strucne, s cenou a odkazem.`},
          {role:'user', content: message}
        ]
      })
    });
    const data = await r.json();
    if (data.error) return res.status(200).json({reply: "OpenAI chyba: "+data.error.message});
    const reply = data.choices?.[0]?.message?.content || "Omlouvam se, zkuste znovu";
    return res.status(200).json({reply});
  } catch(e) {
    return res.status(200).json({reply: "Chyba serveru: "+e.message});
  }
}
