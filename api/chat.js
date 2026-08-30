export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    var shop = (req.query && req.query.shop) || (req.body && req.body.shop) || '813343.myshoptet.com';
    var message = (req.body && req.body.message)? req.body.message.toLowerCase() : '';
    var products = [];
    var urls = [
      'https://' + shop + '/export/products.xml',
      'https://' + shop + '/export/productsComplete.xml',
      'https://' + shop + '/export/heureka.xml'
    ];
    for (var u of urls) {
      try {
        var r = await fetch(u);
        if (!r.ok) continue;
        var xml = await r.text();
        if (xml.length < 100) continue;
        var matches = [...xml.matchAll(/<PRODUCTNAME>(.*?)<\/PRODUCTNAME>.*?<PRICE_VAT>(.*?)<\/PRICE_VAT>.*?<URL>(.*?)<\/URL>/gs)];
        if (!matches.length) {
          matches = [...xml.matchAll(/<NAME>(.*?)<\/NAME>.*?<PRICE_VAT>(.*?)<\/PRICE_VAT>.*?<URL>(.*?)<\/URL>/gs)];
        }
        if (matches.length) {
          products = matches.slice(0, 15).map(function(m) { return { name: m[1], price: m[2], url: m[3] }; });
          break;
        }
      } catch (e) {}
    }
    var reply = '';
    if (!products.length) {
      reply = 'Katalog pro ' + shop + ' se neda nacist. Zkontroluj export. Zkousene URL: ' + urls.join(', ');
    } else if (message.includes('co prodava') || message.includes('co nabiz') || message === '') {
      reply = 'Na ' + shop + ' prodavame:\n\n' + products.map(function(p) { return '- ' + p.name + ' - ' + p.price + ' Kc - ' + p.url; }).join('\n');
    } else {
      var found = products.filter(function(p) { return message.split(' ').some(function(w) { return w.length > 3 && p.name.toLowerCase().includes(w); }); });
      if (found.length) {
        reply = 'Nasel jsem:\n\n' + found.map(function(p) { return '- ' + p.name + ' - ' + p.price + ' Kc - ' + p.url; }).join('\n');
      } else {
        reply = 'Na ' + shop + ' mame:\n\n' + products.map(function(p) { return '- ' + p.name; }).join('\n');
      }
    }
    return res.status(200).json({ reply: reply });
  } catch (err) {
    return res.status(500).json({ reply: 'Chyba: ' + err.message });
  }
}
