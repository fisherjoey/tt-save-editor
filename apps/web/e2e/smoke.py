from playwright.sync_api import sync_playwright
import os

FIXTURE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "packages", "core", "test", "fixtures", "slot0_thirdparty_100pct.sav")
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://localhost:4173")
    page.wait_for_load_state("networkidle")

    assert "TT Save Editor" in page.content(), "title missing"
    assert page.locator(".dropzone").count() == 1, "dropzone missing"
    print("PASS: page renders, dropzone present")

    # upload a real save via the hidden file input
    page.locator("input[type=file]").first.set_input_files(FIXTURE)
    page.wait_for_selector(".meta", timeout=8000)
    meta = page.locator(".meta").inner_text()
    print("meta panel:\n", meta)
    assert "++Dinner+mainline" in meta, "branch not shown"
    assert "Build version" in meta, "build version row missing"

    # fields scanned and listed
    page.wait_for_selector("table.fields", timeout=8000)
    nfields = page.locator("table.fields tbody tr").count()
    print(f"PASS: save loaded, {nfields} fields rendered")

    # apply downgrade to 1281204 and confirm success message
    page.locator(".downgrade input.mono").first.fill("1281204")
    page.locator("button.primary", has_text="Apply downgrade").click()
    page.wait_for_selector(".downgrade .ok", timeout=5000)
    ok = page.locator(".downgrade .ok").inner_text()
    print("downgrade result:", ok)
    assert "1281204" in ok

    # trigger a download and verify bytes come back the right size
    with page.expect_download() as dl_info:
        page.locator(".downloadbar button.primary").first.click()
    dl = dl_info.value
    path = dl.path()
    size = os.path.getsize(path)
    print(f"PASS: downloaded {dl.suggested_filename} ({size} bytes)")
    assert size == os.path.getsize(FIXTURE), "downloaded size != original"

    browser.close()

if errors:
    print("CONSOLE/PAGE ERRORS:", errors)
    raise SystemExit(1)
print("\nALL UI CHECKS PASSED")
