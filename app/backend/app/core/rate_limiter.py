"""Central slowapi limiter instance.

Keeping limiter in a dedicated module avoids circular imports between
`app.main` and endpoint modules that use limiter decorators.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
