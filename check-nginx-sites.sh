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
        send "ls -la /etc/nginx/sites-available/\r"
        expect "# "
        send "ls -la /etc/nginx/sites-enabled/\r"
        expect "# "
        send "grep -i client_max_body_size /etc/nginx/nginx.conf\r"
        expect "# "
        send "grep -r -i client_max_body_size /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null || echo No client_max_body_size found\r"
        expect "# "
        send "cat /etc/nginx/sites-enabled/* 2>/dev/null | head -150\r"
        expect "# "
        send "exit\r"
    }
    timeout {
        puts "Connection timed out"
        exit 1
    }
}

expect eof
