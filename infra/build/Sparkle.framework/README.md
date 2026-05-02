# Sparkle.framework

Binary framework files are intentionally not committed.

Pinned release:

- Version: `2.9.1`
- Release: https://github.com/sparkle-project/Sparkle/releases/tag/2.9.1
- Archive: https://github.com/sparkle-project/Sparkle/releases/download/2.9.1/Sparkle-2.9.1.tar.xz
- SHA256: `c0dde519fd2a43ddfc6a1eb76aec284d7d888fe281414f9177de3164d98ba4c7`

Install locally from the repo root:

```bash
curl -L -o /tmp/Sparkle-2.9.1.tar.xz \
  https://github.com/sparkle-project/Sparkle/releases/download/2.9.1/Sparkle-2.9.1.tar.xz
shasum -a 256 /tmp/Sparkle-2.9.1.tar.xz
tar -xJf /tmp/Sparkle-2.9.1.tar.xz -C infra/build ./Sparkle.framework
```
