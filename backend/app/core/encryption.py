"""Encryption utilities for sensitive data at rest.

Provides encryption/decryption for:
- POS API keys
- External service credentials
- Other sensitive database fields

Security:
- Uses Fernet (symmetric encryption)
- Encryption key stored in environment variable
- Fails safely if encryption key not configured
"""

import os
import logging
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    Service for encrypting/decrypting sensitive data.
    
    Usage:
        encryption = EncryptionService()
        encrypted = encryption.encrypt("my-api-key")
        decrypted = encryption.decrypt(encrypted)
    
    Environment:
        DB_ENCRYPTION_KEY: Base64-encoded 32-byte key
        Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    """
    
    def __init__(self):
        """Initialize encryption service with key from environment."""
        self._cipher = None
        self._initialized = False
        
        # Get encryption key from environment
        key = os.getenv("DB_ENCRYPTION_KEY")
        
        if not key:
            logger.warning(
                "DB_ENCRYPTION_KEY not set. Encryption disabled. "
                "Generate key with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
            return
        
        try:
            self._cipher = Fernet(key.encode() if isinstance(key, str) else key)
            self._initialized = True
            logger.info("Encryption service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            self._cipher = None
            self._initialized = False
    
    def is_enabled(self) -> bool:
        """Check if encryption is enabled and working."""
        return self._initialized and self._cipher is not None
    
    def encrypt(self, plaintext: Optional[str]) -> Optional[str]:
        """
        Encrypt plaintext string.
        
        Args:
            plaintext: String to encrypt
            
        Returns:
            Base64-encoded encrypted string, or None if plaintext is None
            Returns plaintext if encryption not configured (with warning)
        """
        if plaintext is None:
            return None
        
        if not self.is_enabled():
            logger.warning("Encryption not enabled - storing plaintext (SECURITY RISK)")
            return plaintext
        
        try:
            encrypted_bytes = self._cipher.encrypt(plaintext.encode('utf-8'))
            return encrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            # Fail securely - don't store unencrypted
            raise ValueError("Failed to encrypt sensitive data")
    
    def decrypt(self, ciphertext: Optional[str]) -> Optional[str]:
        """
        Decrypt encrypted string.
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string, or None if ciphertext is None
            Returns ciphertext if encryption not configured (assumes already plaintext)
        """
        if ciphertext is None:
            return None
        
        if not self.is_enabled():
            # Assume it's plaintext if encryption not configured
            return ciphertext
        
        try:
            decrypted_bytes = self._cipher.decrypt(ciphertext.encode('utf-8'))
            return decrypted_bytes.decode('utf-8')
        except InvalidToken:
            # Might be plaintext from before encryption was enabled
            logger.warning("Failed to decrypt - assuming legacy plaintext")
            return ciphertext
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return None


# Global encryption service instance
encryption_service = EncryptionService()


def encrypt_field(plaintext: Optional[str]) -> Optional[str]:
    """Convenience function to encrypt a field."""
    return encryption_service.encrypt(plaintext)


def decrypt_field(ciphertext: Optional[str]) -> Optional[str]:
    """Convenience function to decrypt a field."""
    return encryption_service.decrypt(ciphertext)
