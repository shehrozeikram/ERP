#!/bin/bash

echo "========================================"
echo "    SGC ERP - Payroll Cleanup Script"
echo "========================================"
echo ""
echo "This script will clear ALL payroll records"
echo "Make sure you have a backup before proceeding!"
echo ""
read -p "Press Enter to continue..."

cd "$(dirname "$0")"
node clear-all-payrolls-safe.js

echo ""
read -p "Press Enter to exit..."
