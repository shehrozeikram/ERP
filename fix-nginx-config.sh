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
        send "cp /etc/nginx/sites-available/sgc-erp /etc/nginx/sites-available/sgc-erp.backup.$(date +%Y%m%d_%H%M%S)\r"
        expect "# "
        send "sed -i '/server_name 68.183.215.177 tovus.net www.tovus.net;/a\\    client_max_body_size 10M;' /etc/nginx/sites-available/sgc-erp\r"
        expect "# "
        send "sed -i '/location \\/api\\/ {/a\\        client_max_body_size 10M;' /etc/nginx/sites-available/sgc-erp\r"
        expect "# "
        send "nginx -t\r"
        expect "# "
        send "if [ $? -eq 0 ]; then systemctl reload nginx; echo 'Nginx reloaded successfully'; else echo 'Nginx config test failed - not reloading'; fi\r"
        expect "# "
        send "grep -n 'client_max_body_size' /etc/nginx/sites-available/sgc-erp\r"
        expect "# "
        send "exit\r"
    }
    timeout {
        puts "Connection timed out"
        exit 1
    }
}

expect eof

