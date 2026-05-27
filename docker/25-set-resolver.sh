#!/bin/sh
# Extract DNS resolver from /etc/resolv.conf and inject into nginx config
# Runs after envsubst (20-envsubst) but before nginx starts

CONF="/etc/nginx/conf.d/default.conf"
NS=$(grep nameserver /etc/resolv.conf | head -1 | awk '{print $2}')

# Wrap IPv6 addresses in brackets
case "$NS" in
  *:*) NS="[$NS]" ;;
esac

# Replace placeholder with actual resolver
sed -i "s|__RESOLVER__|${NS}|g" "$CONF"
