/*
 * Password gate for the whole site, run by Vercel on its servers before any file is sent.
 * The browser shows its sign-in box; any username works, the password must match SITE_PASSWORD,
 * which is set in Vercel (Project > Settings > Environment Variables), never in this repo.
 * If SITE_PASSWORD is missing the site stays closed rather than open.
 */
export const config = { matcher: '/:path*' };

const REALM = 'AIB CFO command center';

// Same time whatever the input, so the password cannot be guessed from response times
function same(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function passwordFrom(header) {
  if (!header || !header.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(':');
    return colon < 0 ? null : decoded.slice(colon + 1);
  } catch (e) {
    return null;
  }
}

export default function middleware(request) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return new Response('Site password is not configured.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const given = passwordFrom(request.headers.get('authorization'));
  if (given !== null && same(given, expected)) {
    // Let the request through to the site (what @vercel/functions' next() returns)
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  return new Response('Password required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="' + REALM + '", charset="UTF-8"', 'Cache-Control': 'no-store' }
  });
}
