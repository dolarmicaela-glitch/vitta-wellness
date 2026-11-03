export function adapt(handler) {
  return async request => {
    if (Number(request.headers.get('content-length')) > 6000) return new Response('Solicitud demasiado grande.', { status: 413 });
    const result = await handler({
      httpMethod: request.method,
      headers: Object.fromEntries(request.headers),
      queryStringParameters: Object.fromEntries(new URL(request.url).searchParams),
      body: ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? '' : await request.text()
    });
    return new Response(result.statusCode === 204 ? null : result.body, { status: result.statusCode, headers: result.headers });
  };
}
