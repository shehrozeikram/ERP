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
        send "cat /etc/nginx/sites-available/sgc-erp\r"
        expect "# "
        send "exit\r"
    }
    timeout {
        puts "Connection timed out"
        exit 1
    }
}

expect eof

