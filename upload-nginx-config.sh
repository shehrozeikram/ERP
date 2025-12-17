#!/usr/bin/expect -f
set timeout 30
set server "68.183.215.177"
set user "root"
set password "sardar1Sahab"

spawn scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null /Users/shehroze/Documents/My\ Web\ Projects/Node\ js\ Projects/SGC_ERP/sgc-erp-nginx-config.txt $user@$server:/tmp/sgc-erp-new

expect {
    "password:" {
        send "$password\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    eof
}

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
        send "mv /tmp/sgc-erp-new /etc/nginx/sites-available/sgc-erp\r"
        expect "# "
        send "nginx -t\r"
        expect "# "
        send "if [ \$? -eq 0 ]; then systemctl reload nginx && echo 'SUCCESS: Nginx reloaded'; else echo 'FAILED: Config test failed'; fi\r"
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

