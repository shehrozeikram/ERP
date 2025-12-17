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
        send "nginx -t 2>&1\r"
        expect "# "
        send "cat /etc/nginx/sites-available/default 2>/dev/null | grep -A 5 -B 5 'client_max_body_size' || cat /etc/nginx/nginx.conf 2>/dev/null | grep -A 5 -B 5 'client_max_body_size' || echo 'Config file not found in standard locations'\r"
        expect "# "
        send "ls -la /etc/nginx/ 2>&1\r"
        expect "# "
        send "find /etc/nginx -name '*.conf' -type f 2>/dev/null | head -5\r"
        expect "# "
        send "systemctl status nginx 2>&1 | head -10\r"
        expect "# "
        send "exit\r"
    }
    timeout {
        puts "Connection timed out"
        exit 1
    }
}

expect eof

