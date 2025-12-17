#!/usr/bin/env python3
import pexpect
import sys

server = "68.183.215.177"
user = "root"
password = "sardar1Sahab"

child = pexpect.spawn(f'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {user}@{server}', encoding='utf-8')
child.logfile = sys.stdout

child.expect(['password:', 'yes/no'], timeout=30)
if 'yes/no' in child.before + child.after:
    child.sendline('yes')
    child.expect('password:', timeout=30)

child.sendline(password)
child.expect('# ', timeout=30)

# Backup the config
child.sendline('cp /etc/nginx/sites-available/sgc-erp /etc/nginx/sites-available/sgc-erp.backup.before_fix')
child.expect('# ', timeout=30)

# Read the current config
child.sendline('cat /etc/nginx/sites-available/sgc-erp > /tmp/sgc-erp-current')
child.expect('# ', timeout=30)

# Create the updated config with client_max_body_size
config_update = """import sys
with open('/etc/nginx/sites-available/sgc-erp', 'r') as f:
    content = f.read()

# Add client_max_body_size after server_name line
if 'client_max_body_size' not in content:
    lines = content.split('\\n')
    new_lines = []
    for i, line in enumerate(lines):
        new_lines.append(line)
        if 'server_name 68.183.215.177 tovus.net www.tovus.net;' in line and i+1 < len(lines) and 'client_max_body_size' not in lines[i+1]:
            new_lines.append('    client_max_body_size 10M;')
        if 'location /api/ {' in line and i+1 < len(lines) and 'client_max_body_size' not in lines[i+1]:
            new_lines.append('        client_max_body_size 10M;')
    
    with open('/etc/nginx/sites-available/sgc-erp', 'w') as f:
        f.write('\\n'.join(new_lines))
    print('Config updated')
else:
    print('Config already has client_max_body_size')
"""

child.sendline(f"python3 -c \"{config_update.replace(chr(10), '; ').replace('    ', ' ')}\"")
child.expect('# ', timeout=30)

# Test nginx config
child.sendline('nginx -t')
child.expect('# ', timeout=30)

# Reload nginx if test passed
child.sendline('systemctl reload nginx')
child.expect('# ', timeout=30)

# Verify the changes
child.sendline("grep -n 'client_max_body_size' /etc/nginx/sites-available/sgc-erp")
child.expect('# ', timeout=30)

child.sendline('exit')
child.expect(pexpect.EOF, timeout=30)

