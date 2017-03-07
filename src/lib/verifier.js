'use strict';
const asn1 = require('asn1.js');
const BN = require('bn.js');
const crypto = require('crypto');
const jwkToPem = require('jwk-to-pem');

const EcdsaDerSig = asn1.define('ECPrivateKey', function() {
    return this.seq().obj(
        this.key('r').int(),
        this.key('s').int()
    );
});

function concatSigToAsn1Sig(concatSigBuffer) {
    const r = new BN(concatSigBuffer.slice(0, 32).toString('hex'), 16, 'be');
    const s = new BN(concatSigBuffer.slice(32).toString('hex'), 16, 'be');
    return EcdsaDerSig.encode({r, s}, 'der');
}

export function ecdsaVerify(jwk, signature, data) {
    const key = jwkToPem(jwk);
    let decodedSignature = new Buffer(signature, 'base64');
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    const asn1sig = concatSigToAsn1Sig(decodedSignature);
    return verify.verify(key, new Buffer(asn1sig, 'hex'));
}