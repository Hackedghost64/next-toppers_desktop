const crypto = require('crypto');

/**
 * VideoCrypt Key and IV derivation reverse-engineered from Next Toppers Android app
 * (com.appsquadz.educrypt.player.utils.e.createDataSource)
 * 
 * Token format: <prefix>_<something>_<numeric_seed>_...
 * IV charset: "?\\:><{}@#Vjekl/4"
 * Key charset: "!*@#)($^%1fgv&C="
 * Cipher: AES/CBC/NoPadding
 */
function deriveVideoCryptKeyAndIv(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('VideoCrypt token must be a non-empty string');
  }

  const parts = token.split('_');
  if (parts.length < 3) {
    throw new Error(`Invalid VideoCrypt token format: expected at least 3 parts separated by '_', got: ${token}`);
  }

  const seed = parts[2];
  const IV_CHARS = "?\\:><{}@#Vjekl/4";
  const KEY_CHARS = "!*@#)($^%1fgv&C=";

  let ivStr = '';
  let keyStr = '';

  for (let i = 0; i < seed.length; i++) {
    const digit = parseInt(seed[i], 10);
    if (isNaN(digit)) {
      throw new Error(`Invalid non-numeric character '${seed[i]}' in VideoCrypt seed: ${seed}`);
    }
    ivStr += IV_CHARS[digit];
    keyStr += KEY_CHARS[digit];
  }

  return {
    key: Buffer.from(keyStr, 'utf8'),
    iv: Buffer.from(ivStr, 'utf8'),
    keyString: keyStr,
    ivString: ivStr,
    seed
  };
}

/**
 * Decrypts an AES-128-CBC buffer without padding (used by VideoCrypt chunk streaming)
 */
function decryptVideoCryptBuffer(encryptedBuffer, key, iv) {
  // Ensure buffer length is a multiple of 16 for AES block cipher
  const validLength = Math.floor(encryptedBuffer.length / 16) * 16;
  const chunkToDecrypt = encryptedBuffer.subarray(0, validLength);
  const remainder = encryptedBuffer.subarray(validLength);

  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(chunkToDecrypt),
    decipher.final()
  ]);

  return remainder.length > 0 ? Buffer.concat([decrypted, remainder]) : decrypted;
}

module.exports = {
  deriveVideoCryptKeyAndIv,
  decryptVideoCryptBuffer
};
