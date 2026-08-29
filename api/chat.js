export default async function handler(req, res) {
  if (req.method!== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({error:'No message'});

    let produktyText = "";
    try {
      const feedRes = await fetch('https://813343.myshoptet.com/universal.xml');
      const xml = await feedRes.text();
      const matches = [...xml.matchAll(/<PRODUCTNAME>.*?CDATA\[(.*?)\].*?PRICE_VAT>(.*?)<\/PRICE_VAT>.*?URL>.*?CDATA\[(.*?)\].*?\/URL>/gs)];
      const matches2 = matches.length? matches : [...xml.matchAll(/<PRODUCTNAME>(.*?)<\/PRODUCTNAME>.*?<PRICE_VAT>(.*?)<\/PRICE_VAT>.*?<URL>(.*?)<\/URL>/gs)];
      produktyText = matches2.slice(0, 20).map(m => `- ${m[1]} | ${m[2]} Kč | ${m[3]}`).join('\n');
    } catch (e) {
      produktyText = "Produkty momentálně načítám.";
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Jsi Nordivo Assistant pro e-shop 813343.myshoptet.com. Znáš tyto produkty:\n${produktyText}\nOdpovídej česky, stručně, vždy s cenou a odkazem. Když produkt nemáš, doporuč podobný.` },
          { role: 'user', content: message }
        ]
      })
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({reply: 'OpenAI chyba: ' + data.error.message});
    const reply = data.choices?.[0]?.message?.content || 'Zadna odpoved';
    return res.status(200).json({reply});
  } catch (e) {
    return res.status(500).json({reply: 'Server error: ' + e.message});
  }
}
