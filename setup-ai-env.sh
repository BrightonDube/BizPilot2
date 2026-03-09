#!/bin/bash
# The Ultimate WSL2 AI Engineering Setup Script

echo "========================================================"
echo " 1. Updating System & Installing Core Dependencies"
echo "========================================================"
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
sudo apt install -y curl wget git jq unzip software-properties-common build-essential python3-pip python3-venv python-is-python3 ffmpeg postgresql-client

echo "========================================================"
echo " 2. Installing NVM & Node.js (LTS)"
echo "========================================================"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Explicitly load NVM into this script's session so npm commands work immediately
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install --lts
nvm use --lts
nvm alias default 'lts/*'

echo "========================================================"
echo " 3. Installing GitHub CLI"
echo "========================================================"
sudo mkdir -p -m 755 /etc/apt/keyrings
wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb[arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh -y

echo "========================================================"
echo " 4. Installing DigitalOcean CLI (doctl)"
echo "========================================================"
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin
rm doctl-1.104.0-linux-amd64.tar.gz

echo "========================================================"
echo " 5. Installing Node-based AI & Infra CLIs"
echo "========================================================"
npm install -g @railway/cli
npm install -g supabase
npm install -g @anthropic-ai/claude-code
npm install -g gemini-chat-cli
npm install -g dotenv-cli

echo "========================================================"
echo " 6. Installing Ollama (Local LLM Engine)"
echo "========================================================"
curl -fsSL https://ollama.com/install.sh | sh

echo "========================================================"
echo " ✅ SETUP COMPLETE!"
echo "========================================================"
echo ""
echo "IMPORTANT: Please close this terminal window and open a new one to ensure all paths are loaded."
echo ""
echo "Once you open a new terminal, run these commands to authenticate your tools:"
echo "1. GitHub & Copilot:    gh auth login && gh extension install github/gh-copilot"
echo "2. DigitalOcean:        doctl auth init"
echo "3. Railway:             railway login"
echo "4. Supabase:            supabase login"
echo "5. Claude:              claude"
