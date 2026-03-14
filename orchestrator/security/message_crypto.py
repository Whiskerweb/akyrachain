"""Message encryption/decryption for on-chain private messages.

Symmetric key derived from master_secret + sorted(sender, recipient) agent IDs.
Algorithm: AES-256-GCM with 12-byte random nonce.

- Orchestrator encrypts before storing on-chain
- Frontend decrypts using the same master_secret for human display
- Other agents never see decrypted content (perception filters by to_agent_id)
"""

import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from web3 import Web3

from config import get_settings


def _derive_key(master_secret: bytes, sender_id: int, recipient_id: int) -> bytes:
    """Derive a symmetric AES-256 key for a pair of agents."""
    low, high = sorted([sender_id, recipient_id])
    # keccak256(master_secret || low || high) — 32 bytes
    return Web3.solidity_keccak(
        ["bytes", "uint32", "uint32"],
        [master_secret, low, high],
    )[:32]


def encrypt_message(sender_id: int, recipient_id: int, plaintext: str) -> bytes:
    """Encrypt a private message for on-chain storage.

    Returns: nonce (12 bytes) + ciphertext (variable length)
    """
    settings = get_settings()
    master_secret = bytes.fromhex(settings.orchestrator_master_secret)
    key = _derive_key(master_secret, sender_id, recipient_id)
    nonce = os.urandom(12)
    aead = AESGCM(key)
    ct = aead.encrypt(nonce, plaintext.encode("utf-8"), None)
    return nonce + ct


def decrypt_message(sender_id: int, recipient_id: int, data: bytes) -> str:
    """Decrypt a private message from on-chain storage.

    Input: nonce (12 bytes) + ciphertext
    Returns: plaintext string
    """
    settings = get_settings()
    master_secret = bytes.fromhex(settings.orchestrator_master_secret)
    key = _derive_key(master_secret, sender_id, recipient_id)
    nonce, ct = data[:12], data[12:]
    aead = AESGCM(key)
    return aead.decrypt(nonce, ct, None).decode("utf-8")
