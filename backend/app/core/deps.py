from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import jwt
import os

security = HTTPBearer()

WORKOS_CLIENT_ID = os.getenv("WORKOS_CLIENT_ID")
WORKOS_API_KEY = os.getenv("WORKOS_API_KEY")
WORKOS_JWKS_URL = f"https://api.workos.com/sso/jwks/{WORKOS_CLIENT_ID}" if WORKOS_CLIENT_ID else None

async def get_workos_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not WORKOS_CLIENT_ID:
        raise HTTPException(status_code=500, detail="WORKOS_CLIENT_ID not configured")

    # 1. Extract token from Authorization header
    token = credentials.credentials

    try:
        # 2. Fetch JWKS (public keys) from WorkOS
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(WORKOS_JWKS_URL)
            response.raise_for_status()
            jwks = response.json()

        # 3. Get key ID from token header
        header = jwt.get_unverified_header(token)
        kid = header.get('kid')

        if not kid:
            raise HTTPException(status_code=401, detail="Token missing key ID")

        # 4. Find matching public key from JWKS
        public_key = None
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break

        if not public_key:
            raise HTTPException(status_code=401, detail="No matching public key found")

        # 5. Verify token signature and decode
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=f"https://api.workos.com/user_management/{WORKOS_CLIENT_ID}",
            options={"verify_aud": False}
        )

        # 6. Extract user info
        user_id = payload.get("sub")
        email = payload.get("email")

        # If email not in token, fetch from WorkOS API
        if not email and user_id and WORKOS_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    user_response = await client.get(
                        f"https://api.workos.com/user_management/users/{user_id}",
                        headers={"Authorization": f"Bearer {WORKOS_API_KEY}"}
                    )
                    if user_response.status_code == 200:
                        email = user_response.json().get("email")
            except Exception:
                pass

        if not email:
            email = f"{user_id}@workos.user"

        return {
            "id": user_id,
            "email": email,
            "first_name": payload.get("given_name"),
            "last_name": payload.get("family_name")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch JWKS: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
