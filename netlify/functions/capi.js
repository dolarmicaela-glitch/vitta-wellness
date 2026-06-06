const https = require('https');

const PIXEL_ID = '2038687353391421';

exports.handler = async (event) => {
  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Token no configurado' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  // Obtener IP real del visitante
  const clientIp = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
                || event.headers['client-ip']
                || '';

  const payload = JSON.stringify({
    data: [{
      event_name: body.eventName || 'PageView',
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: body.url || '',
      action_source: 'website',
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: event.headers['user-agent'] || '',
        ...(body.fbc  && { fbc:  body.fbc  }),
        ...(body.fbp  && { fbp:  body.fbp  }),
        ...(body.em   && { em:   body.em   }), // email hasheado (futuro)
      }
    }],
    test_event_code: body.testCode || undefined
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ success: true, meta: JSON.parse(data) })
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: e.message })
      });
    });

    req.write(payload);
    req.end();
  });
};
