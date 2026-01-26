# Vendor Dependencies Packaging Solution

This document describes the implementation of packaging vendor dependencies (bun, uv, node) for the Electron application, similar to the claude-agent-desktop approach.

## Overview

The solution packages runtime dependencies (bun, uv, node) with the Electron application to ensure users don't need to install these dependencies separately. This approach:

1. Downloads platform-specific binaries during build
2. Packages them with the application
3. Sets up enhanced PATH at runtime
4. Uses SDK's `executable` parameter for optimal performance

## Architecture

### 1. Dependency Download (`scripts/download-vendor-deps.js`)

- Downloads platform-specific binaries from official releases
- Supports macOS (ARM64/x64), Linux (x64), and Windows (x64)
- Extracts and prepares binaries for packaging

### 2. Packaging Configuration (`electron-builder.json`)

```json
"asarUnpack": [
    "vendor/**/*"
]
```

This ensures vendor binaries are unpacked and accessible at runtime.

### 3. Runtime Path Management (`src/electron/utils/packaging.ts`)

Key functions:
- `buildEnhancedPath()`: Builds PATH with vendor binaries
- `getExecutablePath()`: Gets platform-specific executable path
- `getSDKExecutableOptions()`: Provides SDK execution options
- `validateExecutable()`: Validates executable availability

### 4. SDK Integration (`src/electron/libs/runner/index.ts`)

```typescript
// Get SDK execution options
const sdkExecutableOptions = getSDKExecutableOptions();

// Pass to SDK query
const q = query({
  // ... other options
  executable: sdkExecutableOptions.executable,
  env: {
    ...mergedEnv,
    ...sdkExecutableOptions.env
  }
});
```

## Usage

### Building with Vendor Dependencies

```bash
# Download dependencies (runs automatically before build)
npm run download:vendor

# Build application
npm run build

# Package for specific platform
npm run dist:mac-arm64
npm run dist:win
npm run dist:linux
```

### Runtime Behavior

1. **Development Mode**: Uses system PATH executables
2. **Packaged Mode**:
   - Uses vendor binaries from `app.asar.unpacked/vendor/`
   - Sets enhanced PATH with vendor binary directories
   - Prefers bun (fastest), falls back to node

### Configuration

The system automatically:
- Detects platform and architecture
- Chooses optimal executable (bun > node)
- Sets up required environment variables
- Validates executable availability

## Platform Support

| Platform | Architecture | bun | uv | node |
|----------|--------------|-----|----|------|
| macOS    | ARM64        | ✓   | ✓  | ✓    |
| macOS    | x64          | ✓   | ✓  | ✓    |
| Linux    | x64          | ✓   | ✓  | ✓    |
| Windows  | x64          | ✓   | ✓  | ✓    |

## Versions

Current vendor dependency versions:
- **bun**: v1.1.38
- **uv**: 0.4.29
- **node**: v20.18.0

Update `scripts/download-vendor-deps.js` to use different versions.

## Troubleshooting

### Validation

Check dependency status in packaged app:

```typescript
import { getValidationReport } from './packaging';

const report = await getValidationReport();
console.log(report);
```

### Common Issues

1. **Binary not found**
   - Check `app.asar.unpacked/vendor/` exists
   - Verify platform-specific binary paths
   - Check file permissions (especially on macOS/Linux)

2. **Executable validation fails**
   - Run with `--enable-logging` to see detailed logs
   - Check antivirus software isn't blocking execution
   - Verify binary architecture matches system

3. **PATH issues**
   - Enhanced PATH is logged at debug level
   - Check log output for `[Packaging]` messages

## Benefits

1. **Zero User Setup**: No need to install node, bun, or uv
2. **Consistent Runtime**: Known-good versions across all installations
3. **Performance**: Uses fastest available runtime (bun)
4. **Reliability**: Fallback mechanisms ensure operation
5. **Security**: Controlled, verified binaries

## Future Improvements

1. **Delta Updates**: Only download changed binaries
2. **Architecture Detection**: Automatic best-architecture selection
3. **Caching**: Local cache for development builds
4. **Version Management**: Runtime version switching
5. **Security**: Binary signature verification

## Implementation Notes

This solution addresses the common pain point of requiring users to install runtime dependencies. By packaging everything together, we provide a seamless experience similar to native applications while maintaining the flexibility of scriptable runtimes. The approach is inspired by claude-agent-desktop's successful implementation but adapted for our specific needs with additional validation and error handling.