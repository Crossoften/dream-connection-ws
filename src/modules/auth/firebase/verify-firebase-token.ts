import { createPublicKey, verify, KeyObject } from 'crypto';

/**
 * Valida um ID token do Firebase Authentication sem dependências extras:
 * confere a assinatura RS256 com as chaves públicas do Firebase e as
 * claims exigidas pela documentação (iss, aud, exp, iat, sub).
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CLOCK_SKEW_S = 60;

let cachedKeys: Map<string, KeyObject> | null = null;
let cacheExpiresAt = 0;

async function getKeys(forceRefresh = false): Promise<Map<string, KeyObject>> {
  if (!forceRefresh && cachedKeys && Date.now() < cacheExpiresAt) return cachedKeys;

  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new Error(`Falha ao baixar chaves do Firebase (HTTP ${response.status}).`);

  const { keys } = (await response.json()) as { keys: Array<{ kid: string } & Record<string, any>> };
  cachedKeys = new Map(keys.map((jwk) => [jwk.kid, createPublicKey({ key: jwk as any, format: 'jwk' })]));

  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cacheExpiresAt = Date.now() + maxAge * 1000;
  return cachedKeys;
}

function decodePart(part: string): any {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

export class InvalidFirebaseTokenError extends Error {}

export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<Record<string, any>> {
  const parts = String(idToken ?? '').split('.');
  if (parts.length !== 3) throw new InvalidFirebaseTokenError('Formato inválido.');

  let header: any;
  let claims: any;
  try {
    header = decodePart(parts[0]);
    claims = decodePart(parts[1]);
  } catch {
    throw new InvalidFirebaseTokenError('Formato inválido.');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new InvalidFirebaseTokenError('Algoritmo inválido.');

  // Chave nova (rotação do Google): recarrega uma vez antes de recusar.
  let key = (await getKeys()).get(header.kid);
  if (!key) key = (await getKeys(true)).get(header.kid);
  if (!key) throw new InvalidFirebaseTokenError('Chave de assinatura desconhecida.');

  const signatureOk = verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    key,
    Buffer.from(parts[2], 'base64url'),
  );
  if (!signatureOk) throw new InvalidFirebaseTokenError('Assinatura inválida.');

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new InvalidFirebaseTokenError('Emissor inválido.');
  if (claims.aud !== projectId) throw new InvalidFirebaseTokenError('Audiência inválida.');
  if (!claims.sub || typeof claims.sub !== 'string') throw new InvalidFirebaseTokenError('Usuário ausente.');
  if (Number(claims.exp) + CLOCK_SKEW_S < now) throw new InvalidFirebaseTokenError('Token expirado.');
  if (Number(claims.iat) - CLOCK_SKEW_S > now) throw new InvalidFirebaseTokenError('Token emitido no futuro.');

  return claims;
}
