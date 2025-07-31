// Debug script to check menu items
import { getModuleMenuItems } from './utils/permissions';

// Test with different user roles
const roles = ['admin', 'hr_manager', 'finance_manager', 'employee'];

console.log('=== Menu Items Debug ===');

roles.forEach(role => {
  console.log(`\n--- ${role.toUpperCase()} ---`);
  const menuItems = getModuleMenuItems(role);
  
  menuItems.forEach(item => {
    console.log(`📁 ${item.text}`);
    if (item.subItems) {
      item.subItems.forEach(subItem => {
        console.log(`  └── ${subItem.name} (${subItem.path})`);
        if (subItem.subItems) {
          subItem.subItems.forEach(subSubItem => {
            console.log(`      └── ${subSubItem.name} (${subSubItem.path})`);
          });
        }
      });
    }
  });
});

// Check specific talent acquisition items
console.log('\n=== Talent Acquisition Items ===');
const hrManagerMenu = getModuleMenuItems('hr_manager');
const talentAcquisition = hrManagerMenu.find(item => item.text === 'HR Module')?.subItems?.find(sub => sub.name === 'Talent Acquisition');

if (talentAcquisition) {
  console.log('✅ Talent Acquisition found');
  talentAcquisition.subItems.forEach(item => {
    console.log(`  └── ${item.name} (${item.path})`);
  });
} else {
  console.log('❌ Talent Acquisition not found');
} 