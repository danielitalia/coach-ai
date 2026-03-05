#!/bin/bash
# Script di avvio per OpenClaw
# Assicurati di avere esportato la tua variabile ANTHROPIC_API_KEY o OPENAI_API_KEY se il sistema te lo chiede.

echo "Avvio di OpenClaw in corso nell'ambiente Coach AI..."
echo "Al primo avvio usa il comando: ./start.sh onboard"
echo "---"

npx openclaw "$@"
