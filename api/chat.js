export default async function handler(req, res) {
  if (req.method!== 'POST') return res.status(405).json({error: 'Method not allowed'});
  const { message, shop } = req.body || {};
  const shopDomain = req.query.shop || shop || '813343.myshoptet.com';
  if (!message) return res.status(400).json({reply: "Napiš dotaz."});
  try {
    let productsText = "";
    try {
      const feedRes = await fetch(`https://${shopDomain}/export/productsComplete.xml`, { headers: { 'User-Agent': 'NORDIVO-bot' } });
      if (!feedRes.ok) throw new Error('feed');
      const xml = await feedRes.text();
      const items = [...xml.matchAll(/<SHOPITEM>([\s\S]*?)<\/SHOPITEM>/g)].slice(0,20);
      const products = items.map(m=>{
        const b=m[1];
        const name=(b.match(/<PRODUCT>(.*?)<\/PRODUCT>/)||[])[1]||'Produkt';
        const price=(b.match(/<PRICE_VAT>(.*?)<\/PRICE_VAT>/)||[])[1]||'';
        const url=(b.match(/<URL>(.*?)<\/URL>/)||[])[1]||`https://${shopDomain}`;
        return `- ${name} - ${price} Kč - ${url}`;
      });
      productsText=products.join('\n');
    } catch { productsText=`Katalog: https://${shopDomain}`; }
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Jsi AI pro ${shopDomain}. Produkty:\n${productsText}` },
          { role: 'user', content: message }
        ],
        max_tokens: 700
      })
    });
    const data = await openaiRes.json();
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || `Mrkni na https://${shopDomain}` });
  } catch(e){ return res.status(200).json({reply:`Chyba: ${e.message}`}); }
}
