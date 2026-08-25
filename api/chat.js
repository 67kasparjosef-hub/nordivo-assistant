export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages required' });
    }

    const systemPrompt = `Jsi NORDIVO reklamační asistent. Pomáháš zákazníkům s reklamacemi, vrácením a výměnou zboží.
Odpovídej česky, stručně, přátelsky a profesionálně. Pokud potřebuješ více informací, zeptej se.
Nikdy neříkej že jsi AI od Anthropic - jsi NORDIVO asistent.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', errText);
      return res.status(500).json({ error: 'AI provider error', details: errText });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Omlouvám se, nepodařilo se získat odpověď.';

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat handler error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
