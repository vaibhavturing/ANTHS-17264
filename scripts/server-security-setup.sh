#!/bin/bash
# scripts/server-security-setup.sh

# This script configures server security settings based on best practices
# It disables unused ports, enforces SSH key logins, and sets up automatic updates

# Exit on any error
set -e

echo "=== Healthcare Management Application - Server Security Setup ==="
echo "Setting up server security configuration..."

# Function to check if script is run as root
check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root" >&2
    exit 1
  fi
}

# Function to backup configuration files
backup_config() {
  local file=$1
  if [ -f "$file" ]; then
    cp "$file" "${file}.bak.$(date +%Y%m%d%H%M%S)"
    echo "Backup created for $file"
  fi
}

# Function to configure firewall
configure_firewall() {
  echo "Configuring firewall..."
  
  # Ensure firewall is installed
  if ! command -v ufw >/dev/null 2>&1; then
    apt-get update
    apt-get install -y ufw
  fi
  
  # Reset firewall rules
  ufw --force reset
  
  # Default deny policy
  ufw default deny incoming
  ufw default allow outgoing
  
  # Allow SSH, HTTP, HTTPS
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  
  # Allow application ports if different from standard web ports
  ufw allow 3000/tcp
  
  # Allow database ports only from application servers
  # Replace APP_SERVER_IP with your actual application server IPs
  ufw allow from APP_SERVER_IP to any port 5432
  ufw allow from APP_SERVER_IP to any port 27017
  
  # Enable firewall
  echo "y" | ufw enable
  
  echo "Firewall configured successfully"
}

# Function to harden SSH configuration
harden_ssh() {
  echo "Hardening SSH configuration..."
  
  # Backup SSH config
  backup_config "/etc/ssh/sshd_config"
  
  # Configure SSH
  cat > /etc/ssh/sshd_config <<EOF
# Healthcare Management Application - Secure SSH Configuration

# Protocol version
Protocol 2

# Authentication settings
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes

# Login restrictions
MaxAuthTries 3
LoginGraceTime 60

# Only allow specific users
AllowUsers app-user admin-user

# Idle timeout (5 minutes)
ClientAliveInterval 300
ClientAliveCountMax 0

# Logging
SyslogFacility AUTH
LogLevel VERBOSE

# Listen on specific address and port
Port 22
AddressFamily inet

# Use strong ciphers and MACs
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,hmac-sha2-512,hmac-sha2-256

# Disable X11 forwarding
X11Forwarding no

# Disable tunneling
PermitTunnel no
AllowAgentForwarding no
AllowTcpForwarding no
GatewayPorts no

# Strict mode
StrictModes yes

# Banner
Banner /etc/ssh/banner
EOF

  # Create SSH banner
  cat > /etc/ssh/banner <<EOF
*******************************************************************
*                  AUTHORIZED ACCESS ONLY                         *
* This system is restricted to authorized users for legitimate    *
* business purposes only. Unauthorized access is prohibited.      *
*******************************************************************
EOF

  # Restart SSH service
  systemctl restart sshd
  
  echo "SSH hardened successfully"
}

# Function to set up automatic updates
configure_auto_updates() {
  echo "Setting up automatic updates..."
  
  # Install unattended-upgrades
  apt-get update
  apt-get install -y unattended-upgrades apt-listchanges
  
  # Configure unattended-upgrades
  backup_config "/etc/apt/apt.conf.d/50unattended-upgrades"
  cat > /etc/apt/apt.conf.d/50unattended-upgrades <<EOF
// Healthcare Management Application - Automatic Updates Configuration

Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}";
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
    "\${distro_id}:\${distro_codename}-updates";
};

// Blacklist specific packages
Unattended-Upgrade::Package-Blacklist {
    "custom-app";
    "legacy-dependency";
};

// Auto-remove unused dependencies
Unattended-Upgrade::Remove-Unused-Dependencies "true";

// Auto-reboot if needed (typically scheduled during off-hours)
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";

// Send email notifications
Unattended-Upgrade::Mail "admin@healthcare-app.com";
Unattended-Upgrade::MailReport "on-change";

// Verbose logging
Unattended-Upgrade::Verbose "true";
EOF

  # Enable automatic updates
  backup_config "/etc/apt/apt.conf.d/20auto-upgrades"
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

  # Restart unattended-upgrades service
  systemctl restart unattended-upgrades
  
  echo "Automatic updates configured successfully"
}

# Function to set up security audit cron job
setup_security_audit() {
  echo "Setting up security audit cron job..."
  
  # Install lynis for security auditing
  apt-get update
  apt-get install -y lynis
  
  # Create audit script
  cat > /usr/local/bin/security-audit.sh <<EOF
#!/bin/bash
# Healthcare Management Application - Security Audit Script

# Run Lynis audit
lynis audit system --quick --no-colors > /var/log/security-audit-\$(date +%Y%m%d).log

# Check for failed SSH login attempts
grep "Failed password" /var/log/auth.log | tail -n 50 >> /var/log/security-audit-\$(date +%Y%m%d).log

# Check for open ports
echo "Open ports:" >> /var/log/security-audit-\$(date +%Y%m%d).log
netstat -tuln >> /var/log/security-audit-\$(date +%Y%m%d).log

# List installed packages that need updates
echo "Packages needing updates:" >> /var/log/security-audit-\$(date +%Y%m%d).log
apt list --upgradable 2>/dev/null >> /var/log/security-audit-\$(date +%Y%m%d).log

# Email the report
cat /var/log/security-audit-\$(date +%Y%m%d).log | mail -s "Healthcare App Security Audit Report" admin@healthcare-app.com
EOF

  # Make script executable
  chmod +x /usr/local/bin/security-audit.sh
  
  # Add to weekly cron
  echo "0 4 * * 0 root /usr/local/bin/security-audit.sh" > /etc/cron.d/security-audit
  
  echo "Security audit job configured successfully"
}

# Main execution
check_root
configure_firewall
harden_ssh
configure_auto_updates
setup_security_audit

echo "Server security setup completed successfully!"
echo "IMPORTANT: Ensure SSH keys are properly set up before logging out!"
echo "Test your SSH login with keys before closing this session."