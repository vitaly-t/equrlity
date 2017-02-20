// Copyright 2008 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Functions for converting UTF-8 encoded strings to Uint8Arrays and back.
 */

/**
 * Convert a string into a UTF-8 encoded (unsigned) byte array
 * @param str String to convert
 * @returns {Uint8Array} Unsigned byte array corresponding to input
 */
export function stringToUtf8ByteArray(str: string): Uint8Array {
    const outBytes: Array<number> = [],
        strLength = str.length;
    let p = 0;
    for (let i = 0; i < strLength; ++i) {
        const c = str.charCodeAt(i);
        if (c < 128)
            outBytes[p++] = c;
        else if (c < 2048) {
            outBytes[p++] = (c >> 6) | 192;
            outBytes[p++] = (c & 63) | 128;
        } else if (
            ((c & 0xFC00) == 0xD800) && (i + 1) < strLength &&
            ((str.charCodeAt(i + 1) & 0xFC00) == 0xDC00)) {
            // Surrogate Pair
            const k = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
            outBytes[p++] = (k >> 18) | 240;
            outBytes[p++] = ((k >> 12) & 63) | 128;
            outBytes[p++] = ((k >> 6) & 63) | 128;
            outBytes[p++] = (k & 63) | 128;
        } else {
            outBytes[p++] = (c >> 12) | 224;
            outBytes[p++] = ((c >> 6) & 63) | 128;
            outBytes[p++] = (c & 63) | 128;
        }
    }
    return new Uint8Array(outBytes);
}

/**
 * Convert a UTF-8 encoded byte array into a string
 * @param byteArray An array of bytes that is to be converted
 * @returns {string} A UTF-8 string corresponding to the specified input
 */
export function utf8ByteArrayToString(byteArray: Uint8Array): string {
    const outChars: Array<string> = [];
    let pos = 0, c = 0;
    while (pos < byteArray.length) {
        const c1 = byteArray[pos++] & 0xFF;
        if (c1 < 128)
            outChars[c++] = String.fromCharCode(c1);
        else if (c1 > 191 && c1 < 224)
            outChars[c++] = String.fromCharCode((c1 & 31) << 6 | byteArray[pos++] & 63);
        else if (c1 > 239 && c1 < 365) {
            // Surrogate Pair
            const c2 = byteArray[pos++];
            const c3 = byteArray[pos++];
            const c4 = byteArray[pos++];
            const u = ((c1 & 7) << 18 | (c2 & 63) << 12 | (c3 & 63) << 6 | c4 & 63) - 0x10000;
            outChars[c++] = String.fromCharCode(0xD800 + (u >> 10));
            outChars[c++] = String.fromCharCode(0xDC00 + (u & 1023));
        } else
            outChars[c++] =
                String.fromCharCode((c1 & 15) << 12 | (byteArray[pos++] & 63) << 6 | byteArray[pos++] & 63);
    }
    return outChars.join('');
}