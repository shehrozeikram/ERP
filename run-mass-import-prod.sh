#!/usr/bin/expect -f

set timeout 600
set password "sardar1Sahab"
set ip "68.183.215.177"
set user "root"

spawn ssh $user@$ip

expect {
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    "password:" {
        send "$password\r"
    }
}

expect "# "

send "cd /var/www/sgc-erp\r"
expect "# "

send "git pull origin main\r"
expect "# "

send "node server/scripts/mass-import-prod.js\r"
expect "# "

send "exit\r"
expect eof
