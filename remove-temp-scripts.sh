#!/bin/bash

# Script to remove temporary User Tracking fix scripts

echo "🗑️  Removing temporary User Tracking fix scripts..."
echo ""

# List of temporary scripts to remove
TEMP_SCRIPTS=(
    "fix-all-issues.sh"
    "fix-server-complete.sh"
    "deploy-tracking-fix.sh"
    "diagnose-tracking-issue.sh"
    "fix-tracking-complete.sh"
    "test-tracking-route.sh"
    "fix-tracking-routes.sh"
    "update-nginx-tracking.sh"
    "fix-nginx-tracking.sh"
)

REMOVED=0
NOT_FOUND=0

for script in "${TEMP_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        rm -f "$script"
        echo "   ✅ Removed: $script"
        ((REMOVED++))
    else
        echo "   ⚠️  Not found: $script"
        ((NOT_FOUND++))
    fi
done

echo ""
echo "✅ Cleanup complete!"
echo "   Removed: $REMOVED scripts"
echo "   Not found: $NOT_FOUND scripts"
echo ""
echo "💡 Optional: Review and remove nginx utility scripts if not needed:"
echo "   - check-nginx-config.sh"
echo "   - check-nginx-sites.sh"
echo "   - read-nginx-config.sh"
echo "   - reload-nginx.sh"
echo "   - upload-nginx-config.sh"
echo "   - fix-nginx-config.sh"
echo "   - fix-nginx-simple.sh"
echo "   - fix_nginx.py"
echo "   - test-deployment.sh"
