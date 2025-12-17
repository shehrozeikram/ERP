#!/usr/bin/expect -f
set timeout 30
set server "68.183.215.177"
set user "root"
set password "sardar1Sahab"

spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $user@$server

expect {
    "password:" {
        send "$password\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    "# " {
        send "cp /etc/nginx/sites-available/sgc-erp /etc/nginx/sites-available/sgc-erp.backup.before_fix\r"
        expect "# "
        send "cat > /tmp/nginx_fix.sed << 'EOFSED'\n/^    server_name 68.183.215.177 tovus.net www.tovus.net;/a\\\n    client_max_body_size 10M;\n/^    location \\/api\\/ {/a\\\n        client_max_body_size 10M;\nEOFSED\r"
        expect "# "
        send "sed -i -f /tmp/nginx_fix.sed /etc/nginx/sites-available/sgc-erp\r"
        expect "# "
        send "nginx -t && systemctl reload nginx && echo SUCCESS || echo FAILED\r"
        expect "# "
        send "grep client_max_body_size /etc/nginx/sites-available/sgc-erp\r"
        expect "# "
        send "exit\r"
    }
    timeout {
        puts "Connection timed out"
        exit 1
    }
}

expect eof

