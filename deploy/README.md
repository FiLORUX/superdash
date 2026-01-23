# Production Deployment

## Prerequisites

- Node.js 20 LTS or later
- systemd-based Linux distribution (Ubuntu, Debian, RHEL, etc.)

## Installation

### 1. Create service user

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin superdash
```

### 2. Deploy application

```bash
sudo mkdir -p /opt/superdash
sudo cp -r . /opt/superdash/
sudo chown -R superdash:superdash /opt/superdash
```

### 3. Install dependencies

```bash
cd /opt/superdash
sudo -u superdash npm ci --production
```

### 4. Configure

```bash
sudo -u superdash cp config.example.json config.json
sudo -u superdash nano config.json  # Edit as needed
```

### 5. Install systemd unit

```bash
sudo cp deploy/superdash.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable superdash
sudo systemctl start superdash
```

## Management

```bash
# Check status
sudo systemctl status superdash

# View logs
sudo journalctl -u superdash -f

# Restart after config change
sudo systemctl restart superdash

# Stop service
sudo systemctl stop superdash
```

## Firewall

If using UFW:

```bash
sudo ufw allow 3050/tcp  # HTTP + WebSocket
sudo ufw allow 9000/tcp  # Ember+ (if needed externally)
```

## Updating

```bash
cd /opt/superdash
sudo systemctl stop superdash
sudo -u superdash git pull
sudo -u superdash npm ci --production
sudo systemctl start superdash
```

## Troubleshooting

### Service fails to start

Check logs:
```bash
sudo journalctl -u superdash -n 50 --no-pager
```

Common issues:
- Missing `config.json` — copy from example
- Port already in use — check with `ss -tlnp | grep 3050`
- Permission denied — verify ownership of `/opt/superdash`

### Connection refused

Verify service is running and listening:
```bash
sudo systemctl status superdash
curl http://localhost:3050/health
```
