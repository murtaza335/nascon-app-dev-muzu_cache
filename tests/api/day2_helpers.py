"""Part II helpers: DAY2_SALT signature recomputation (spec §5.3) and small builders."""
import hashlib
import hmac
import json
import os
import uuid

import pytest


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def day2_sig(entity_id, payload):
    salt = os.environ.get("DAY2_SALT")
    if not salt:
        pytest.skip("DAY2_SALT not exported: cannot recompute signatures")
    return hmac.new(salt.encode("utf-8"), f"{entity_id}|{canonical(payload)}".encode("utf-8"), hashlib.sha256).hexdigest()


def day1_sig(entity_id, payload):
    salt = os.environ.get("DAY1_SALT")
    if not salt:
        pytest.skip("DAY1_SALT not exported")
    return hmac.new(salt.encode("utf-8"), f"{entity_id}|{canonical(payload)}".encode("utf-8"), hashlib.sha256).hexdigest()


def uid(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


GUEST = {"Authorization": "Bearer guest_anon_tok_7721"}
