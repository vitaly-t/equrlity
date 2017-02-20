export function checkForKeyPair(keys: string[]): boolean {
  const hasPublicKey: boolean = keys.indexOf('publicKey') >= 0;
  const hasPrivateKey: boolean = keys.indexOf('privateKey') >= 0;
  return hasPublicKey && hasPrivateKey;
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"])
}

export async function getPrivateKeyJWK(keypair: CryptoKeyPair): Promise<JsonWebKey> {
  const privateKey = await keypair.privateKey;
  return await window.crypto.subtle.exportKey("jwk", privateKey);
}

export async function getPublicKeyJWK(keypair: CryptoKeyPair): Promise<JsonWebKey> {
  const publicKey = await keypair.publicKey;
  return await window.crypto.subtle.exportKey("jwk", publicKey);
}

export async function importPrivateKeyfromJWK(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function signData(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  return await window.crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" }, }, key, data)
}