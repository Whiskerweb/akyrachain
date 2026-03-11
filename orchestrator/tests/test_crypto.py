"""Tests for API key encryption/decryption."""

import os
import pytest

os.environ["API_KEY_ENCRYPTION_KEY"] = "a" * 64

from security.api_key_manager import encrypt_api_key, decrypt_api_key


def test_encrypt_decrypt_roundtrip():
    original = "sk-proj-abc123def456ghi789"
    encrypted = encrypt_api_key(original)
    assert encrypted != original  # Should be different
    decrypted = decrypt_api_key(encrypted)
    assert decrypted == original


def test_different_encryptions():
    """Same plaintext should produce different ciphertexts (random nonce)."""
    key = "sk-test-key"
    enc1 = encrypt_api_key(key)
    enc2 = encrypt_api_key(key)
    assert enc1 != enc2  # Different nonces


def test_empty_string():
    encrypted = encrypt_api_key("")
    assert decrypt_api_key(encrypted) == ""


def test_long_key():
    long_key = "sk-" + "x" * 500
    encrypted = encrypt_api_key(long_key)
    assert decrypt_api_key(encrypted) == long_key
