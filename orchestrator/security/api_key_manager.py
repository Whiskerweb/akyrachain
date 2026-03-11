"""AES-256-GCM encryption/decryption for user LLM API keys."""

import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import get_settings


def _get_key() -> bytes:
    hex_key = get_settings().api_key_encryption_key
    return bytes.fromhex(hex_key)


def encrypt_api_key(plaintext: str) -> str:
    """Encrypt an API key. Returns base64(nonce + ciphertext)."""
    key = _get_key()
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_api_key(encrypted: str) -> str:
    """Decrypt an API key from base64(nonce + ciphertext)."""
    key = _get_key()
    raw = base64.b64decode(encrypted)
    nonce = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
