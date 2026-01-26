# Vendor Dependencies Management

This directory contains scripts for downloading and managing vendor dependencies (bun, uv, node) for packaging.

## Usage

### Download Dependencies

```bash
# Download all dependencies for current platform
node scripts/download-vendor-deps.js

# The script will create a vendor directory with platform-specific binaries:
# vendor/
# ├── bun-darwin-aarch64/
# │   └── bun
# ├── uv-darwin-aarch64/
# │   └── uv
# └── node-darwin-aarch64/
#     └── bin/node
```

### Integration with Electron Builder

The `electron-builder.json` is configured to unpack the vendor directory:

```json
"asarUnpack": [
    "vendor/**/*"
]
```

This ensures the binaries are accessible in the packaged app at runtime.

### Runtime Usage

The application uses `src/electron/utils/packaging.ts` to:

1. Build enhanced PATH with vendor binaries
2. Select appropriate executable (prefer bun, fallback to node)
3. Pass executable parameter to Claude SDK

### Platform Support

- macOS (darwin-aarch64, darwin-x64)
- Linux (linux-x64)
- Windows (windows-x64)

### Version Information

Current versions:
- bun: v1.1.38
- uv: 0.4.29
- node: v20.18.0

Update the URLs in `download-vendor-deps.js` to use different versions.