"""Static contract checks for the hosted web bundle.

The dashboard is a plain JS bundle, so these tests pin integration contracts
that otherwise only fail in a browser against a deployed API.
"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text()


def test_cloud_fetch_preserves_api_compat_paths_when_api_base_is_set():
    source = _read("web/js/cloud.js")

    assert "path.replace(/^\\/api/, '/v1')" not in source
    assert "apiBase + normalizedPath" in source


def test_pair_page_calls_versioned_device_routes_explicitly():
    source = _read("web/js/pair.js")

    assert "Cloud.fetch('/v1/devices')" in source
    assert "Cloud.fetch('/v1/devices/pair-init'" in source


def test_market_refunds_use_opaque_purchase_ids_not_numeric_spend_ids_only():
    source = _read("web/js/market.js")

    assert "Number(item.spend_id)" not in source
    assert "item.inventory_id" in source
    assert "inventory_id" in source
