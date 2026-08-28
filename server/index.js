require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// CORS pro frontend
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin? { origin: allowedOrigin } : {}));
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim().replace(/^"|"$/g, '');
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

if (!ANTHROPIC_API_KEY) {
  console.warn('[NORDIVO VAROVANI] ANTHROPIC_API_KEY neni nastaven.');
}

const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Health check
app.get('/api/health', (req,res)=>{
  res.json({ok:true, api:!!ANTHROPIC_API_KEY, model:ANTHROPIC_MODEL});
});

// OPRAVENÝ CHAT - S PAMĚTÍ!
app.post('/api/chat', async (req,res)=>{
  try{
    if(!ANTHROPIC_API_KEY) return res.status(500).json({error:'API klic chybi'});

    // TADY JE OPRAVA - bereme CELÉ messages z frontendu
    const { messages, prompt } = req.body;
    let chatMessages = messages;

    // Pokud přijde jen prompt (starý frontend), převedeme na messages
    if(!chatMessages && prompt){
      chatMessages = [{role:'user', content: prompt}];
    }

    if(!chatMessages ||!Array.isArray(chatMessages)){
      return res.status(400).json({error:'Chybi messages'});
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({apiKey: ANTHROPIC_API_KEY});

    let systemPrompt = "Jsi prodejní asistent NORDIVO.cz. Pamatuješ si celou konverzaci, jsi přátelský a pomáháš vybrat produkt.";
    try{
      const dataPath = path.join(__dirname, '../data/nordivo-data.json');
      if(fs.existsSync(dataPath)){
        const data = JSON.parse(fs.readFileSync(dataPath,'utf8'));
        systemPrompt += "\\n\\nDATA: " + JSON.stringify(data).slice(0,8000);
      }
    }catch(e){}

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL.includes('claude')? ANTHROPIC_MODEL : 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: systemPrompt,
      messages: chatMessages
    });

    const text = response.content[0]?.text || "Omlouvám se, neodpověděl jsem.";
    res.json({ reply: text, text: text });

  }catch(err){
    console.error('[CHYBA NORDIVO]', err.message);
    res.status(500).json({error: err.message});
  }
});

app.get('/', (req,res)=>{
  const indexHtml = path.join(publicPath, 'index.html');
  if(fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res.send('NORDIVO bezi');
});

if (require.main === module) {
  app.listen(PORT, ()=>console.log('Bezi na '+PORT));
}
module.exports = app;
