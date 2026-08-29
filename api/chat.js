export default async function handler(req, res) {
  if (req.method!== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const { message } = req.body || {};
  if (!message) return res.status(400).json({reply: "Dostal jsem prázdnou zprávu, napiš prosím dotaz."});

  try {
    // 1. Stáhnout feed ze Shoptetu
    let productsText = "";
    try {
      const feedRes = await fetch('https://813343.myshoptet.com/export/products.xml', { headers: { 'User-Agent': 'NORDIVO-bot' } });
      if (!feedRes.ok) throw new Error('feed fail');
      const xml = await feedRes.text();
      // jednoduchý parser
      const items = [...xml.matchAll(/<SHOPITEM>([\s\S]*?)<\/SHOPITEM>/g)].slice(0, 25);
      const products = items.map(m => {
        const block = m[1];
        const name = (block.match(/<PRODUCT>(.*?)<\/PRODUCT>/)||[])[1]||'Produkt';
        const price = (block.match(/<PRICE_VAT>(.*?)<\/PRICE_VAT>/)||[])[1]||'';
        const url = (block.match(/<URL>(.*?)<\/URL>/)||[])[1]||'https://813343.myshoptet.com';
        return `- ${name} - ${price} Kč - ${url}`;
      });
      productsText = products.join('\n');
    } catch (e) {
      productsText = "Katalog: https://813343.myshoptet.com - módní oblečení a doplňky NORDIVO";
    }

    // 2. Zavolat OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Jsi NORDIVO asistent pro 813343.myshoptet.com. Odpovídej česky, stručně, přátelsky. Znáš tyto produkty:\n${productsText}\nVždy přidej odkaz na e-shop a když se ptá na co prodáváte, vypiš 5-8 produktů s cenou a odkazem. Ceny jsou v Kč.` },
          { role: 'user', content: message }
        ],
        max_tokens: 600
      })
    });

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || `Podívej se na naši nabídku zde: https://813343.myshoptet.com\n\n${productsText.slice(0,800)}`;

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(200).json({ reply: `Omlouvám se, chyba: ${err.message}. Mrkni přímo na https://813343.myshoptet.com` });
  }
}
