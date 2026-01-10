#!/bin/bash
# Local testing script

set -e

echo "🧪 Testing PR Reviewer locally..."

# 1. Check Bun
echo "📦 Checking Bun..."
if ! command -v bun &> /dev/null; then
    echo "❌ Bun not installed. Install from https://bun.sh"
    exit 1
fi
echo "✅ Bun $(bun --version)"

# 2. Check Python
echo "🐍 Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not installed"
    exit 1
fi
echo "✅ Python $(python3 --version)"

# 3. Install Bun dependencies
echo "📦 Installing Bun dependencies..."
bun install

# 4. Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip install -r python/requirements.txt

# 5. Test Python token manager
echo "🔢 Testing Python token manager..."
echo '{"files": [{"filename": "test.py", "status": "modified", "patch": "test", "additions": 1, "deletions": 0}], "model": "gpt-4o"}' | python3 python/token_manager.py
if [ $? -eq 0 ]; then
    echo "✅ Python token manager works"
else
    echo "❌ Python token manager failed"
    exit 1
fi

# 6. Run Python tests
echo "🧪 Running Python tests..."
cd python && python3 -m pytest test_token_manager.py -v
cd ..

# 7. Type check TypeScript
echo "🔍 Type checking TypeScript..."
bun run typecheck

echo ""
echo "✨ All tests passed!"
echo ""
echo "To use locally, set these environment variables:"
echo "  export GITHUB_TOKEN='your_token'"
echo "  export INPUT_GITHUB_TOKEN='your_token'"
echo "  export INPUT_OPENAI_API_KEY='your_openai_key'"
echo ""
echo "Then run: bun src/main.ts"
