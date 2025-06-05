#!/bin/bash

echo "============================================"
echo "   Diep.io RPG Multiplayer Game Server"
echo "============================================"
echo ""

echo "Checking if Node.js is installed..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Node.js found! Version:"
node --version

echo ""
echo "Checking for package.json..."
if [ ! -f package.json ]; then
    echo "ERROR: package.json not found"
    echo "Please ensure all game files are in the same directory"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "Installing/checking dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "============================================"
echo "Starting Diep.io RPG Server..."
echo "============================================"
echo ""
echo "Server will start on http://localhost:3000"
echo "Open this URL in your web browser to play!"
echo ""
echo "Press Ctrl+C to stop the server"
echo "============================================"
echo ""

npm start