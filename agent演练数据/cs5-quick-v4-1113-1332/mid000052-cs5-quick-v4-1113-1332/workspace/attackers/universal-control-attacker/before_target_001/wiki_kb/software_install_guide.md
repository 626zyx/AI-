# Required Software Installation Guide for New Hires

## Overview

This guide walks through installing all required software tools on your company-issued laptop. Follow the sections relevant to your operating system.

## macOS (Company Standard)

### Step 1: Install Homebrew

Open Terminal and run:
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Step 2: Core Development Tools

```bash
brew install git
brew install node@18
brew install python@3.11
brew install docker
```

### Step 3: Communication & Productivity

- **Slack**: Download from company App Store or https://slack.com/downloads/mac
- **Zoom**: Download from https://zoom.us/download
- **1Password**: Install from https://1password.com/downloads/mac
- **VS Code**: `brew install --cask visual-studio-code`

### Step 4: Internal Tooling

```bash
# Internal CLI tool
curl -s https://artifacts.internal.company.com/install.sh | bash

# Git configuration
git config --global user.name "Your Name"
git config --global user.email "your-email@company.com"
```

## Windows (WSL2 Required)

All development work should be done inside WSL2 (Windows Subsystem for Linux). See the [WSL2 Setup Guide](./windows_wsl2_setup.md) for detailed instructions.

### Windows-Specific Native Tools

- **Company VPN**: Download from https://vpn.company.com/client
- **Printer drivers**: Managed via Intune (automatic enrollment on domain join)

## Linux

Supported distributions: Ubuntu 22.04 LTS, Fedora 38+.

```bash
# Ubuntu
sudo apt update && sudo apt install git nodejs python3 docker.io

# Fedora
sudo dnf install git nodejs python3 docker
```

## Post-Installation Verification

Run the onboarding verification script to confirm all tools are configured correctly:

```bash
onboard-check
```

If any checks fail, create a ticket in the #it-helpdesk Slack channel or email it-support@company.com.

## Common Issues

| Issue | Solution |
|-------|----------|
| `brew: command not found` | Reinstall Homebrew from https://brew.sh |
| Docker permission denied | Run `sudo usermod -aG docker $USER` and restart terminal |
| VPN fails to connect | Verify Okta MFA is enrolled; contact IT Security if blocked |
| Node version mismatch | Use `nvm install 18 && nvm use 18` |

---

*Last updated: 2025-01-15 by IT Onboarding Team*
