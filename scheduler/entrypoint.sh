#!/bin/sh
echo "INTERNAL_API_KEY='$INTERNAL_API_KEY'" >> /etc/environment
crond -f -l 8
