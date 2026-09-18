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
send "cd /var/www/sgc-erp\r"
expect "# "

send "git stash pop || true\r"
expect "# "

send "grep -q '^MONGODB_URI=' .env || echo 'MONGODB_URI=mongodb://127.0.0.1:27017/sgc_erp' >> .env\r"
expect "# "

send "pm2 restart sgc-erp-backend\r"
expect "# "

send "pm2 status\r"
expect "# "

send "exit\r"
expect eof
