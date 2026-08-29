export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method!== 'POST') return res.status(405).json({error: 'Method not allowed'});
  const body = req.body || {};
  const shopDomain = body.shop || '813343.myshoptet.com';
  if (!body.message) return res.status(400).json({reply: "Napiš dotaz."});
  try {
    let productsText = `- Dámská mikina NORDIVO - 890 Kč - https://${shopDomain}/damska-mikina/\n- Pánské tričko - 490 Kč - https://${shopDomain}/panske-tricko/\n- Dámské legíny - 690 Kč - https://${shopDomain}/damske-leginy/\n- Kšiltovka NORDIVO - 390 Kč - https://${shopDomain}/ksiltovka/\n- Batoh - 1290 Kč - https://${shopDomain}/batoh/\n- Peněženka - 590 Kč - https://${shopDomain}/penezenka/`;
    try {
      const r = await fetch(`https://${shopDomain}/export/heureka.xml`, {headers:{'User-Agent':'Mozilla'}});
      if (r.ok) {
        const xml = await r.text();
        const items = [...xml.matchAll(/<SHOPITEM>([\s\S]*?)<\/SHOPITEM>/gi)].slice(0,12);
        if (items.length>0) {
          productsText = items.map(m=>{
            const b=m[1];
            const g=t=>{ const x=b.match(new RegExp("<"+t+"[^>]*>(.*?)</"+t+">","i")); return x?x[1].replace(/<!\[CDATA\[|\]\]>/g,"").trim():""; };
            return `- ${g("PRODUCTNAME")||g("PRODUCT")} - ${g("PRICE_VAT")||g("PRICE")} Kc - ${g("URL")}`;
          }).join("\n");
        }
      }
    } catch {}
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Jsi AI pro ${shopDomain}. KDYŽ se zeptá co prodáváte, MUSÍŠ vypsat TENTO seznam:\n${productsText}\nPRAVIDLO: Vypiš 6 produktů s cenou a odkazem. Nikdy neříkej obecné kategorie!` },
          { role: 'user', content: body.message }
        ],
        max_tokens: 700,
        temperature: 0.2
      })
    });
    const data = await openaiRes.json();
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || productsText });
  } catch(e){ return res.status(200).json({reply: "Chyba: "+e.message}); }
}
