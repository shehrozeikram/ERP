#!/usr/bin/expect -f

set timeout 30
set password "sardar1Sahab"
set ip "68.183.215.177"
set user "root"

spawn ssh -o BatchMode=no -o StrictHostKeyChecking=no $user@$ip

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

send "cat /var/www/sgc-erp/.env | grep MONGODB\r"
expect "# "

send "exit\r"
expect eof
