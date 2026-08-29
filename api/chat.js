export default async function handler(req, res) {
  if (req.method!== 'POST') return res.status(405).json({error: 'Method not allowed'});
  const body = req.body || {};
  const shopDomain = (req.query && req.query.shop) || body.shop || '813343.myshoptet.com';
  if (!body.message) return res.status(400).json({reply: "Napiš dotaz."});
  try {
    let productsText = "";
    try {
      const urls = [
        `https://${shopDomain}/export/products.xml`,
        `https://${shopDomain}/export/heureka.xml`,
        `https://${shopDomain}/export/zbozi.xml`,
        `https://${shopDomain}/export/productsComplete.xml`
      ];
      let xml = "";
      for (const u of urls) { try { const r = await fetch(u); if (r.ok) { xml = await r.text(); break; } } catch {} }
      if (!xml) throw new Error('no feed');
      const items = [...xml.matchAll(/<SHOPITEM>([\s\S]*?)<\/SHOPITEM>/gi)].slice(0,12);
      productsText = items.map(m=>{
        const b=m[1];
        const g=t=>{ const x=b.match(new RegExp("<"+t+"[^>]*>(.*?)</"+t+">","i")); return x?x[1].replace(/<!\[CDATA\[|\]\]>/g,"").trim():""; };
        return `- ${g("PRODUCTNAME")||g("PRODUCT")} | ${g("PRICE_VAT")||g("PRICE")} Kc | ${g("URL")}`;
      }).join("\n");
    } catch { productsText = `Katalog: https://${shopDomain}`; }
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Jsi prodejce pro ${shopDomain}. VYPIS: \n${productsText}` },
          { role: 'user', content: body.message }
        ],
        max_tokens: 700
      })
    });
    const data = await openaiRes.json();
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || `Mrkni na https://${shopDomain}` });
  } catch(e){ return res.status(200).json({reply:"Chyba: "+e.message}); }
}
