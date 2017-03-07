'use strict';

import * as asn1 from 'asn1.js';
import * as BN from 'bn.js';
import * as crypto from 'crypto';
import * as jwkToPem from 'jwk-to-pem';

const EcdsaDerSig = asn1.define('ECPrivateKey', function () {
  return this.seq().obj(
    this.key('r').int(),
    this.key('s').int()
  );
});

function concatSigToAsn1Sig(concatSigBuffer) {
  const r = new BN(concatSigBuffer.slice(0, 32).toString('hex'), 16, 'be');
  const s = new BN(concatSigBuffer.slice(32).toString('hex'), 16, 'be');
  return EcdsaDerSig.encode({ r, s }, 'der');
}

export function ecdsaVerify(jwk, signature, data) {
  const key = jwkToPem(jwk);
  let decodedSignature = new Buffer(signature, 'base64');
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  const asn1sig = concatSigToAsn1Sig(decodedSignature);
  return verify.verify(key, new Buffer(asn1sig, 'hex'));
}

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

export function validateContentSignature(key: JsonWebKey, content: any, signature: any): boolean {  //@@GS need to tighten up these any types
  if (!signature) {
    console.log("missing signature")
    return false;
  }
  if (!key) {
    console.log("missing key")
    return false;
  }
  try {
    let verified = ecdsaVerify(key, signature, content);
    if (!verified) return false;
  } catch (e) {
    console.log("Verification error: " + e.toString());
    return false
  }
  return true;
}

