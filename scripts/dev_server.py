"""Local development server: the site and the configurator on ONE origin.

    python scripts/dev_server.py            # http://localhost:8000/

  /sayanmramor-site/...  ->  this repository (the site)
  /calculator/...        ->  the configurator checkout to test (by default
                             D:\\calculator\\.worktrees\\rate-catalog-subcategories,
                             override with --calculator or SAYAN_CALCULATOR_ROOT)
  /                      ->  redirect to /sayanmramor-site/index.html

A plain `python -m http.server --directory D:\\` can only serve one folder,
so /calculator/ there is whatever D:\\calculator happens to be (its master
checkout) -- not the configurator being worked on. This script maps each
public prefix to its own repository instead, so the canonical URLs
(/calculator/sayanmramor-calculator.html?product=..&stone=..,
/sayanmramor-site/showroom.html?product=..) work exactly as in production.

Development only: standard library, nothing is copied, nothing is written.
Responses are sent with Cache-Control: no-store so an edited file is never
served stale; opening http://localhost:8000/ also clears anything a browser
cached from an older local server (Clear-Site-Data: "cache").
"""
import argparse
import http.server
import os
import posixpath
import sys
import urllib.parse

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CALCULATOR_ROOT = r"D:\calculator\.worktrees\rate-catalog-subcategories"
HOME = "/sayanmramor-site/index.html"


def safe_join(root, relative):
    """Join a URL path below root; None for any part that could leave it
    ('..', a drive, a backslash path) -- such a request is simply not found."""
    parts = []
    for word in relative.split("/"):
        if not word or word == os.curdir:
            continue
        if word == os.pardir or os.path.dirname(word) or ":" in word or "\\" in word:
            return None
        parts.append(word)
    return os.path.join(root, *parts)


def make_handler(mounts):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def translate_path(self, path):
            path = posixpath.normpath(urllib.parse.unquote(urllib.parse.urlsplit(path).path))
            trailing = self.path.split("?", 1)[0].endswith("/")
            for prefix, root in mounts:
                if path == prefix or path.startswith(prefix + "/"):
                    target = safe_join(root, path[len(prefix):])
                    if target is None:
                        break
                    return target + os.sep if trailing and not target.endswith(os.sep) else target
            # Outside the two mounts: nothing to serve.
            return os.path.join(SITE_ROOT, "__no_such_path__")

        def send_head(self):
            if urllib.parse.urlsplit(self.path).path == "/":
                self.send_response(302)
                self.send_header("Location", HOME)
                # A browser that once got these URLs from the old single-root
                # server may still hold D:\calculator (master) pages as
                # "fresh". Opening http://localhost:8000/ clears this origin's
                # HTTP cache first. Only here: on a real page it would race
                # the page's own downloads and break them.
                self.send_header("Clear-Site-Data", '"cache"')
                self.end_headers()
                return None
            return super().send_head()

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Serve the site and the configurator on one local origin.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--calculator", default=os.environ.get("SAYAN_CALCULATOR_ROOT", DEFAULT_CALCULATOR_ROOT),
                        help="configurator checkout served at /calculator/")
    args = parser.parse_args()

    calculator_root = os.path.abspath(args.calculator)
    if not os.path.isfile(os.path.join(calculator_root, "sayanmramor-calculator.html")):
        sys.exit("Not a configurator checkout (no sayanmramor-calculator.html): " + calculator_root)
    mounts = [("/sayanmramor-site", SITE_ROOT), ("/calculator", calculator_root)]

    server = http.server.ThreadingHTTPServer(("", args.port), make_handler(mounts))
    print("Serving on http://localhost:%d/" % args.port)
    for prefix, root in mounts:
        print("  %-19s -> %s" % (prefix + "/", root))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
